import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIsFeedConnected } from "../components/ConnectionIndicator.tsx";
import {
  OrderConfirmDialog,
  OrderModifyDialog,
  PositionModifyDialog,
} from "../components/TradingDialogs.tsx";
import { useChartDrawings } from "../hooks/useChartDrawings.ts";
import {
  getChartPreferencesFromStorage,
  updateChartPreferences,
  useChartPreferences,
  type ChartPreferences,
} from "../hooks/useChartPreferences.ts";
import { useTradeSound } from "../hooks/useTradeSound";
import type { IndicatorType } from "../lib/indicators.ts";
import type { EngulfingZonesSettings } from "../lib/engulfing-zones.ts";
import type { SwingStructureSettings } from "../lib/swing-structure.ts";
import { posthog } from "../lib/posthog";
import { api } from "../services/api.ts";
import { wsClient } from "../services/ws.ts";
import {
  mergeCandlesIntoCache,
  prefetchCandlesForTimeframes,
  useCandles,
  useOrders,
  usePositions,
  useSymbols,
} from "../services/queries.ts";
import type { Order, PlaceOrderInput, Position, Symbol } from "../services/schemas.ts";
import { useAuthStore, useTradingStore } from "../services/store.tsx";
import { toast } from "../services/toast.ts";
import { ChartPanel } from "./trading/ChartPanel.tsx";
import { ChartToolbar } from "./trading/ChartToolbar.tsx";
import {
  type DrawingTool,
  type MagnetMode,
  REPLAY_ENABLED,
  TIMEFRAMES,
  type Timeframe,
} from "./trading/constants.ts";
import { ReplayScrubber } from "./trading/ReplayScrubber.tsx";
import { useReplayChartData } from "./trading/useReplayChartData.ts";
import { useReplayPlayback } from "./trading/useReplayPlayback.ts";
import { getPipDigits } from "./trading/utils.ts";

type ErrorWithMessage = { message?: string };
const CANDLE_PREFETCH_TIMEFRAMES: Timeframe[] = ["15s", "30s", "1m", "2m", "3m", "5m", "15m"];

type ConfirmOrderState = {
  symbol: string;
  side: "BUY" | "SELL";
  type: string;
  quantity: number;
  price?: number;
  stopPrice?: number;
  takeProfit?: number;
  stopLoss?: number;
  _submit: () => Promise<unknown>;
} | null;

function getErrorMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as ErrorWithMessage).message;
    if (typeof message === "string" && message.length > 0) return message;
  }
  return "Request failed";
}

export function TradingPage() {
  const hasTrackedFirstTrade = useRef(false);

  const handleFirstTrade = useCallback(() => {
    if (!hasTrackedFirstTrade.current) {
      hasTrackedFirstTrade.current = true;
      posthog.capture("funnel.trade.first_executed", { sessionId: posthog.get_session_id?.() });
    }
  }, []);

  const {
    selectedSymbol,
    setSelectedSymbol,
    ticks,
    updateTick,
    activeAccountId,
    symbols: _storeSymbols,
    replayVersion,
    isReplaying,
  } = useTradingStore();
  // Chart timeframe persistence (#8)
  const [timeframe, setTimeframe] = useState<Timeframe>(() => {
    const saved = localStorage.getItem(`tf_${selectedSymbol}`);
    return saved && TIMEFRAMES.includes(saved as Timeframe) ? (saved as Timeframe) : "15m";
  });
  const handleTimeframeChange = useCallback(
    (tf: Timeframe) => {
      setTimeframe(tf);
      localStorage.setItem(`tf_${selectedSymbol}`, tf);
    },
    [selectedSymbol],
  );
  // Restore timeframe when symbol changes
  useEffect(() => {
    const saved = localStorage.getItem(`tf_${selectedSymbol}`);
    if (saved && TIMEFRAMES.includes(saved as Timeframe)) setTimeframe(saved as Timeframe);
  }, [selectedSymbol]);

  const [activeIndicators, setActiveIndicators] = useState<IndicatorType[]>([]);
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);
  const [drawingTool, setDrawingTool] = useState<DrawingTool>("none");
  const toggleIndicatorMenu = useCallback(() => setShowIndicatorMenu((visible) => !visible), []);
  const handleDrawingTool = useCallback((nextTool: DrawingTool) => setDrawingTool(nextTool), []);
  const handleToggleIndicator = useCallback((type: IndicatorType) => {
    setActiveIndicators((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }, []);
  const {
    drawings,
    addDrawing,
    updateDrawing,
    removeDrawing,
    clearDrawings,
    undo: undoDrawing,
    redo: redoDrawing,
  } = useChartDrawings(selectedSymbol, timeframe);
  const [activePlugins, setActivePlugins] = useState<string[]>(
    () => getChartPreferencesFromStorage().activePlugins,
  );
  const handleTogglePlugin = useCallback((id: string) => {
    setActivePlugins((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      updateChartPreferences({ activePlugins: next });
      return next;
    });
  }, []);
  // Template load — replace the whole plugin list at once.
  const handleSetPlugins = useCallback((ids: string[]) => {
    setActivePlugins(ids);
    updateChartPreferences({ activePlugins: ids });
  }, []);
  // Trade sound effect
  const { playTradeSound } = useTradeSound();

  // (#6) Position modify dialog
  const [modifyingPosition, setModifyingPosition] = useState<Position | null>(null);

  // (#30) Order modify dialog
  const [modifyingOrder, setModifyingOrder] = useState<Order | null>(null);

  // (#7) Order confirmation dialog
  const [confirmOrder, setConfirmOrder] = useState<ConfirmOrderState>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  const queryClient = useQueryClient();
  const { data: symbols = [] } = useSymbols();
  const isFeedConnected = useIsFeedConnected();
  const isDemo = useAuthStore((s) => s.isDemo);

  // Prime the active symbol with a fresh server-side snapshot immediately on
  // symbol switch so bid/ask appears without waiting for the next WS tick.
  useEffect(() => {
    let cancelled = false;
    void api
      .getTick(selectedSymbol)
      .then((tick) => {
        if (cancelled || !tick) return;
        updateTick(
          selectedSymbol,
          Number(tick.bid),
          Number(tick.ask),
          typeof tick.timestamp === "number" ? tick.timestamp : Date.now(),
        );
      })
      .catch(() => {
        // Ignore snapshot misses; WS stream remains authoritative.
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSymbol, updateTick]);

  // Handler for chart drag-to-edit SL/TP levels
  const handleChartModifyPosition = useCallback(
    async (positionId: string, mods: { takeProfit?: number | null; stopLoss?: number | null }) => {
      if (!isFeedConnected) {
        toast.warning(
          "No Data Feed",
          "Cannot modify positions while disconnected from the data feed",
        );
        if (activeAccountId)
          queryClient.invalidateQueries({
            queryKey: ["positions", activeAccountId],
          });
        return;
      }
      try {
        await api.modifyPosition(positionId, mods);
        const field = mods.takeProfit !== undefined ? "TP" : "SL";
        const price = mods.takeProfit !== undefined ? mods.takeProfit : mods.stopLoss;
        toast.success(`${field} Updated`, `${field} set to ${price}`);
        if (activeAccountId) {
          queryClient.invalidateQueries({
            queryKey: ["positions", activeAccountId],
          });
        }
      } catch (err: unknown) {
        toast.error("Modify Failed", getErrorMessage(err));
        // Refetch to revert price line to original value
        if (activeAccountId) {
          queryClient.invalidateQueries({
            queryKey: ["positions", activeAccountId],
          });
        }
      }
    },
    [activeAccountId, queryClient, isFeedConnected],
  );

  // Chart context-menu quick orders (Buy/Sell limit/stop at the clicked price).
  // Always routes through the confirm dialog so a stray right-click can never
  // place an order directly.
  const handleQuickOrder = useCallback(
    (side: "BUY" | "SELL", type: "LIMIT" | "STOP", price: number) => {
      if (isDemo) {
        toast.warning("Read-only terminal", "Live trading is disabled in this workspace");
        return;
      }
      if (!activeAccountId) {
        toast.warning("No Account", "Select an account before placing orders");
        return;
      }
      const input: PlaceOrderInput = {
        accountId: activeAccountId,
        symbol: selectedSymbol,
        side,
        type,
        quantity: 1,
        ...(type === "LIMIT" ? { price } : { stopPrice: price }),
      };
      setConfirmOrder({
        symbol: selectedSymbol,
        side,
        type,
        quantity: 1,
        price: type === "LIMIT" ? price : undefined,
        stopPrice: type === "STOP" ? price : undefined,
        _submit: () => api.placeOrder(input),
      });
    },
    [activeAccountId, selectedSymbol, isDemo],
  );

  const handleClearIndicators = useCallback(() => {
    setActiveIndicators([]);
  }, []);

  // Deep-history target used after the initial fast render completes.
  const deepCandleLimit = useMemo(() => {
    switch (timeframe) {
      case "1m":
        return 3_000;
      case "2m":
      case "3m":
        return 5_000;
      case "5m":
        return 5_000;
      case "15m":
        return 12_000;
      case "30m":
        return 8_000;
      case "1h":
        return 8_760;
      case "4h":
        return 2_500;
      case "1d":
        return 1_000;
      case "1w":
        return 520;
      default:
        return 5_000;
    }
  }, [timeframe]);
  // First paint: viewport-sized so the initial fetch is as small as possible.
  // Mobile (<768px) needs fewer bars to fill the screen; desktop gets more.
  // The deep-history fetch fires 400ms later and loads a full year of data.
  const firstPaintCandleLimit = useMemo(() => {
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    return isMobile ? 500 : 400;
  }, []);
  const [candleLimit, setCandleLimit] = useState(firstPaintCandleLimit);
  useEffect(() => {
    setCandleLimit(firstPaintCandleLimit);
    // Wait long enough for the first-paint response to arrive and render
    // before firing the heavier deep-history request. 400 ms is a reasonable
    // budget for a cached/warm DB response; users on fast connections will
    // see data before the deep load starts, avoiding visible re-draws.
    const timer = window.setTimeout(() => {
      setCandleLimit(deepCandleLimit);
    }, 400);
    return () => {
      window.clearTimeout(timer);
    };
  }, [selectedSymbol, timeframe, firstPaintCandleLimit, deepCandleLimit]);
  const {
    data: candles = [],
    isFetching: isCandlesFetching,
    isPlaceholderData: isCandlesPlaceholder,
  } = useCandles(selectedSymbol, timeframe, candleLimit, replayVersion);
  useEffect(() => {
    if (isReplaying) return;
    void prefetchCandlesForTimeframes(
      queryClient,
      selectedSymbol,
      CANDLE_PREFETCH_TIMEFRAMES,
      timeframe,
      firstPaintCandleLimit,
      replayVersion,
    );
  }, [firstPaintCandleLimit, isReplaying, queryClient, replayVersion, selectedSymbol, timeframe]);
  useEffect(
    () =>
      wsClient.onReconnect(async () => {
        if (isReplaying) return;
        const recentCandles = await api.getCandles(selectedSymbol, timeframe, 100);
        mergeCandlesIntoCache(
          queryClient,
          selectedSymbol,
          timeframe,
          recentCandles,
          candleLimit,
          replayVersion,
        );
      }),
    [candleLimit, isReplaying, queryClient, replayVersion, selectedSymbol, timeframe],
  );
  // Replay: sliced 1m buffer + trade-event markers; null when not replaying.
  // While replayCandles is set, the live tick/candle feed is suppressed below
  // so real-time data can't paint over the playback.
  const { replayCandles, replayTradeEvents } = useReplayChartData(activeAccountId);
  const chartPrefs = useChartPreferences();
  const swingStructureSettings = useMemo<SwingStructureSettings>(
    () => ({
      lookbackBars: chartPrefs.swingStructureLookbackBars,
      lineColor: chartPrefs.swingStructureLineColor,
      lineWidth: chartPrefs.swingStructureLineWidth,
      showLabels: chartPrefs.swingStructureShowLabels,
      showFormingLeg: chartPrefs.swingStructureShowFormingLeg,
      highLabelColor: chartPrefs.swingStructureHighLabelColor,
      lowLabelColor: chartPrefs.swingStructureLowLabelColor,
    }),
    [chartPrefs],
  );
  const engulfingZonesSettings = useMemo<EngulfingZonesSettings>(
    () => ({
      lookbackBars: chartPrefs.engulfingZonesLookbackBars,
      maxPullbackBars: chartPrefs.engulfingZonesMaxPullbackBars,
      maxActiveSetups: chartPrefs.engulfingZonesMaxActiveSetups,
      bullishFillColor: chartPrefs.engulfingZonesBullishFillColor,
      bullishBorderColor: chartPrefs.engulfingZonesBullishBorderColor,
      bearishFillColor: chartPrefs.engulfingZonesBearishFillColor,
      bearishBorderColor: chartPrefs.engulfingZonesBearishBorderColor,
    }),
    [chartPrefs],
  );
  const updateSwingStructureSettings = useCallback((patch: Partial<SwingStructureSettings>) => {
    const preferences: Partial<ChartPreferences> = {};
    if (patch.lookbackBars !== undefined) preferences.swingStructureLookbackBars = patch.lookbackBars;
    if (patch.lineColor !== undefined) preferences.swingStructureLineColor = patch.lineColor;
    if (patch.lineWidth !== undefined) preferences.swingStructureLineWidth = patch.lineWidth;
    if (patch.showLabels !== undefined) preferences.swingStructureShowLabels = patch.showLabels;
    if (patch.showFormingLeg !== undefined) {
      preferences.swingStructureShowFormingLeg = patch.showFormingLeg;
    }
    if (patch.highLabelColor !== undefined) {
      preferences.swingStructureHighLabelColor = patch.highLabelColor;
    }
    if (patch.lowLabelColor !== undefined) preferences.swingStructureLowLabelColor = patch.lowLabelColor;
    updateChartPreferences(preferences);
  }, []);
  const updateEngulfingZonesSettings = useCallback((patch: Partial<EngulfingZonesSettings>) => {
    const preferences: Partial<ChartPreferences> = {};
    if (patch.lookbackBars !== undefined) preferences.engulfingZonesLookbackBars = patch.lookbackBars;
    if (patch.maxPullbackBars !== undefined) {
      preferences.engulfingZonesMaxPullbackBars = patch.maxPullbackBars;
    }
    if (patch.maxActiveSetups !== undefined) {
      preferences.engulfingZonesMaxActiveSetups = patch.maxActiveSetups;
    }
    if (patch.bullishFillColor !== undefined) {
      preferences.engulfingZonesBullishFillColor = patch.bullishFillColor;
    }
    if (patch.bullishBorderColor !== undefined) {
      preferences.engulfingZonesBullishBorderColor = patch.bullishBorderColor;
    }
    if (patch.bearishFillColor !== undefined) {
      preferences.engulfingZonesBearishFillColor = patch.bearishFillColor;
    }
    if (patch.bearishBorderColor !== undefined) {
      preferences.engulfingZonesBearishBorderColor = patch.bearishBorderColor;
    }
    updateChartPreferences(preferences);
  }, []);
  const cycleMagnetMode = useCallback(() => {
    const order: MagnetMode[] = ["none", "weak", "strong"];
    const next = order[(order.indexOf(chartPrefs.magnetMode) + 1) % order.length] ?? "none";
    updateChartPreferences({ magnetMode: next });
  }, [chartPrefs.magnetMode]);
  useReplayPlayback(activeAccountId ?? "");
  const { data: positions = [] } = usePositions(activeAccountId);
  const { data: orders = [] } = useOrders(activeAccountId);
  const chartPositions = chartPrefs.overlayPositionsOnChart ? positions : [];
  const chartOrders = chartPrefs.overlayPositionsOnChart ? orders : [];

  // Get account data for risk display
  const account = useTradingStore((s) => s.accounts.find((a) => a.id === activeAccountId));

  const tick = ticks[selectedSymbol];
  const symbolInfo = symbols.find((s) => s.name === selectedSymbol) as Symbol | undefined;
  const liveCandleUpdates = useTradingStore((s) => s.liveCandleUpdates);
  const liveCandle = liveCandleUpdates[`${selectedSymbol}:${timeframe}`];
  const pipDigits = useMemo(
    () => getPipDigits(symbolInfo, selectedSymbol),
    [symbolInfo, selectedSymbol],
  );

  const isDark = !document.documentElement.classList.contains("light");

  const [isFullscreen, setIsFullscreen] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsFullscreen(document.fullscreenElement === pageRef.current);
    };
    document.addEventListener("fullscreenchange", syncFullscreenState);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenState);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const page = pageRef.current;
    if (!page) return;
    try {
      if (document.fullscreenElement === page) {
        await document.exitFullscreen();
      } else {
        await page.requestFullscreen();
      }
    } catch {
      toast.warning("Fullscreen", "Fullscreen mode is not available in this browser");
    }
  }, []);

  return (
    <div ref={pageRef} className="relative z-0 flex h-full flex-col overflow-visible bg-slate-50 text-slate-900">
      {/* ── Top Toolbar ──────────────────────────────────── */}
      <ChartToolbar
        selectedSymbol={selectedSymbol}
        symbols={symbols}
        onSymbolChange={setSelectedSymbol}
        timeframe={timeframe}
        onTimeframeChange={handleTimeframeChange}
        activeIndicators={activeIndicators}
        swingStructureSettings={swingStructureSettings}
        onSwingStructureSettingsChange={updateSwingStructureSettings}
        engulfingZonesSettings={engulfingZonesSettings}
        onEngulfingZonesSettingsChange={updateEngulfingZonesSettings}
        onToggleIndicator={handleToggleIndicator}
        showIndicatorMenu={showIndicatorMenu}
        onToggleIndicatorMenu={toggleIndicatorMenu}
        drawingTool={drawingTool}
        onDrawingTool={handleDrawingTool}
        drawings={drawings}
        onClearDrawings={clearDrawings}
        isReplaying={isReplaying}
        replayAccountId={activeAccountId}
        activePlugins={activePlugins}
        onTogglePlugin={handleTogglePlugin}
        onSetIndicators={setActiveIndicators}
        onSetPlugins={handleSetPlugins}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        magnetMode={chartPrefs.magnetMode}
        onCycleMagnet={cycleMagnetMode}
        stayInDrawingMode={chartPrefs.stayInDrawingMode}
        onToggleStayInDrawingMode={() =>
          updateChartPreferences({ stayInDrawingMode: !chartPrefs.stayInDrawingMode })
        }
      />

      {/* ── Main Layout ──────────────────────────────────── */}
      <div className="flex flex-1 overflow-visible bg-slate-100 p-0">
        {/* Chart + Bottom Panel */}
        <div className="flex flex-col flex-1 min-w-0 overflow-visible p-0">
          {/* Chart Area */}
          <div className="relative flex-1 min-h-[200px] overflow-visible border-0 bg-slate-50 shadow-none">
            <div className="absolute inset-0 bg-slate-50" />
            <div className="relative h-full w-full">
            <ChartPanel
              candles={replayCandles ?? candles}
              isCandlesLoading={!replayCandles && isCandlesFetching}
              isCandlesPlaceholder={!replayCandles && isCandlesPlaceholder}
              selectedSymbol={selectedSymbol}
              timeframe={replayCandles ? "1m" : timeframe}
              isDark={isDark}
              activeIndicators={activeIndicators}
              swingStructureSettings={swingStructureSettings}
              engulfingZonesSettings={engulfingZonesSettings}
              drawingTool={drawingTool}
              drawings={drawings}
              onAddDrawing={addDrawing}
              onUpdateDrawing={updateDrawing}
              onRemoveDrawing={removeDrawing}
              onDrawingComplete={() => setDrawingTool("none")}
              onDrawingToolSelect={setDrawingTool}
              onUndoDrawing={undoDrawing}
              onRedoDrawing={redoDrawing}
              magnetMode={chartPrefs.magnetMode}
              stayInDrawingMode={chartPrefs.stayInDrawingMode}
              positions={chartPositions}
              orders={chartOrders}
              tick={replayCandles ? undefined : tick}
              liveCandle={replayCandles ? undefined : liveCandle}
              pipDigits={pipDigits}
              symbolInfo={symbolInfo}
              onModifyPosition={handleChartModifyPosition}
              replayTradeEvents={replayTradeEvents}
              isReplaying={isReplaying}
              activePlugins={activePlugins}
              onTogglePlugin={handleTogglePlugin}
              accountEquity={account?.equity ?? account?.balance ?? 0}
              accountId={activeAccountId}
              onQuickOrder={handleQuickOrder}
              onClearDrawings={clearDrawings}
              onClearIndicators={handleClearIndicators}
            />
            </div>
          </div>

          {/* Replay timeline scrubber — disabled until the feature is QA'd */}
          {REPLAY_ENABLED && isReplaying && activeAccountId != null && (
            <ReplayScrubber accountId={activeAccountId} />
          )}

        </div>
      </div>

      {/* Dialogs */}
      <PositionModifyDialog
        position={modifyingPosition}
        onClose={() => setModifyingPosition(null)}
        onSaved={() => setModifyingPosition(null)}
        tick={tick}
        isFeedConnected={isFeedConnected}
      />
      <OrderModifyDialog
        order={modifyingOrder}
        onClose={() => setModifyingOrder(null)}
        onSaved={() => setModifyingOrder(null)}
        tick={tick}
      />
      <OrderConfirmDialog
        isOpen={!!confirmOrder}
        order={confirmOrder}
        onConfirm={() => {
          if (confirmOrder?._submit) {
            setConfirmLoading(true);
            confirmOrder
              ._submit()
              .then(() => {
                playTradeSound();
                handleFirstTrade();
              })
              .catch((err: unknown) => {
                toast.error("Order Failed", getErrorMessage(err));
              })
              .finally(() => {
                setConfirmLoading(false);
                setConfirmOrder(null);
              });
          }
        }}
        onCancel={() => setConfirmOrder(null)}
        tick={tick}
        symbolInfo={symbolInfo}
        loading={confirmLoading}
      />
    </div>
  );
}

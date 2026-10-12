import { BarChart3, ChevronDown, Magnet, Maximize2, Minimize2, Pencil, Repeat, Settings2, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { INDICATOR_REGISTRY, type IndicatorType } from "../../lib/indicators.ts";
import type { EngulfingZonesSettings } from "../../lib/engulfing-zones.ts";
import type { SwingStructureSettings } from "../../lib/swing-structure.ts";
import { cn } from "../../lib/utils.ts";
import { ColorPalettePicker } from "../../components/ui/color-palette-picker.tsx";
import { ChartTemplatesMenu } from "./ChartTemplatesMenu.tsx";
import {
  type DrawingLine,
  type DrawingTool,
  type MagnetMode,
  TIMEFRAMES,
  type Timeframe,
} from "./constants.ts";

export interface ChartToolbarProps {
  selectedSymbol: string;
  symbols: Array<{
    id?: string;
    name: string;
    displayName?: string | null;
    assetClass?: string;
    baseCurrency?: string;
    quoteCurrency?: string;
    category?: string;
    isActive?: boolean;
  }>;
  onSymbolChange: (s: string) => void;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  activeIndicators: IndicatorType[];
  onToggleIndicator: (type: IndicatorType) => void;
  swingStructureSettings: SwingStructureSettings;
  onSwingStructureSettingsChange: (patch: Partial<SwingStructureSettings>) => void;
  engulfingZonesSettings: EngulfingZonesSettings;
  onEngulfingZonesSettingsChange: (patch: Partial<EngulfingZonesSettings>) => void;
  showIndicatorMenu: boolean;
  onToggleIndicatorMenu: () => void;
  drawingTool: DrawingTool;
  onDrawingTool: (t: DrawingTool) => void;
  drawings: DrawingLine[];
  onClearDrawings: () => void;
  aiTraderEnabled?: boolean;
  isReplaying?: boolean;
  replayAccountId?: string | null;
  activePlugins?: string[];
  onTogglePlugin?: (id: string) => void;
  onSetIndicators?: (indicators: IndicatorType[]) => void;
  onSetPlugins?: (ids: string[]) => void;
  magnetMode?: MagnetMode;
  onCycleMagnet?: () => void;
  stayInDrawingMode?: boolean;
  onToggleStayInDrawingMode?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export function ChartToolbar({
  selectedSymbol,
  symbols,
  onSymbolChange,
  timeframe,
  onTimeframeChange,
  activeIndicators,
  onToggleIndicator,
  swingStructureSettings,
  onSwingStructureSettingsChange,
  engulfingZonesSettings,
  onEngulfingZonesSettingsChange,
  showIndicatorMenu,
  onToggleIndicatorMenu,
  drawingTool,
  onDrawingTool,
  drawings,
  onClearDrawings,
  magnetMode = "none",
  onCycleMagnet,
  stayInDrawingMode = false,
  onToggleStayInDrawingMode,
  isFullscreen = false,
  onToggleFullscreen,
  activePlugins = [],
  onSetIndicators,
  onSetPlugins,
}: ChartToolbarProps) {
  const [showSymbolSearch, setShowSymbolSearch] = useState(false);
  const [symbolFilter, setSymbolFilter] = useState("");
  const [showDrawingMenu, setShowDrawingMenu] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<"SWING" | "ENGULF" | null>(null);
  const indicatorMenuRef = useRef<HTMLDivElement>(null);
  const drawingMenuRef = useRef<HTMLDivElement>(null);

  const filteredSymbols = useMemo(
    () =>
      symbols.filter(
        (s) =>
          s.name.toLowerCase().includes(symbolFilter.toLowerCase()) ||
          (s.category || "").toLowerCase().includes(symbolFilter.toLowerCase()),
      ),
    [symbols, symbolFilter],
  );

  useEffect(() => {
    if (!showIndicatorMenu && !showDrawingMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (showIndicatorMenu && !indicatorMenuRef.current?.contains(target)) {
        onToggleIndicatorMenu();
        setEditingIndicator(null);
      }
      if (showDrawingMenu && !drawingMenuRef.current?.contains(target)) {
        setShowDrawingMenu(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (showIndicatorMenu) {
        onToggleIndicatorMenu();
        setEditingIndicator(null);
      }
      setShowDrawingMenu(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onToggleIndicatorMenu, showDrawingMenu, showIndicatorMenu]);

  return (
    <div className="relative z-40 flex flex-col gap-1 border-b border-slate-200 bg-white/90 px-2 py-1.5 text-[10px] uppercase tracking-[0.16em] text-slate-800 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-sm md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-2">
      <div className="relative shrink-0">
        <button
          onClick={() => setShowSymbolSearch((v) => !v)}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 font-bold text-sm tracking-tight text-slate-900 shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-slate-50"
        >
          <span>{selectedSymbol}</span>
          <ChevronDown className="h-3 w-3 text-slate-700" />
        </button>

        {showSymbolSearch && (
          <div className="absolute left-0 top-full z-[60] mt-1 w-64 max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 bg-white text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
            <div className="border-b border-slate-200 p-2">
              <input
                autoFocus
                value={symbolFilter}
                onChange={(event) => setSymbolFilter(event.target.value)}
                placeholder="Search symbols..."
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            {filteredSymbols.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-600">No symbols found</div>
            ) : (
              filteredSymbols.map((symbol) => (
                <button
                  key={symbol.id || symbol.name}
                  onClick={() => {
                    onSymbolChange(symbol.name);
                    setShowSymbolSearch(false);
                    setSymbolFilter("");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100",
                    symbol.name === selectedSymbol && "bg-blue-50 text-blue-700",
                  )}
                >
                  <span>{symbol.name}</span>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-slate-600">
                    {symbol.category || symbol.assetClass || "FX"}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div data-testid="timeframe-strip" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain whitespace-nowrap md:flex-none">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => onTimeframeChange(tf)}
            className={cn(
              "shrink-0 rounded px-1.5 py-1 text-[9px] font-medium text-slate-900 transition-colors",
              timeframe === tf ? "bg-slate-200" : "hover:bg-slate-100",
            )}
          >
            {tf}
          </button>
        ))}
      </div>

      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 md:flex-nowrap md:justify-end">
      {onSetIndicators && onSetPlugins && (
        <ChartTemplatesMenu
          timeframe={timeframe}
          onSetTimeframe={onTimeframeChange}
          activeIndicators={activeIndicators}
          onSetIndicators={onSetIndicators}
          activePlugins={activePlugins}
          onSetPlugins={onSetPlugins}
        />
      )}
      <div ref={indicatorMenuRef} className="relative shrink-0">
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onToggleIndicatorMenu}
          aria-expanded={showIndicatorMenu}
          aria-haspopup="true"
          className={cn(
            "flex items-center gap-1.5 rounded-xl border border-transparent px-2 py-1 text-xs text-slate-700 transition-all duration-200 hover:border-slate-200 hover:bg-slate-50",
            activeIndicators.length > 0 && "border-blue-200 bg-blue-50 text-blue-700",
          )}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          Indicators
          {activeIndicators.length > 0 && (
            <span className="rounded-full bg-slate-200 px-1.5 text-[10px]">
              {activeIndicators.length}
            </span>
          )}
        </button>
        {activeIndicators.length > 0 && (
          <div className="ml-1 inline-flex max-w-[35vw] items-center gap-1 overflow-x-auto align-middle">
            {activeIndicators.map((type) => {
              const indicator = INDICATOR_REGISTRY.find((item) => item.type === type);
              if (!indicator) return null;
              return (
                <button
                  key={type}
                  type="button"
                  title={`Remove ${indicator.label}`}
                  aria-label={`Remove ${indicator.label}`}
                  onClick={() => onToggleIndicator(type)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-blue-700 hover:bg-blue-100"
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: indicator.color }} />
                  {indicator.label}
                  <X className="h-3 w-3" />
                </button>
              );
            })}
          </div>
        )}
        {showIndicatorMenu && (
          <div
            role="group"
            aria-label="Indicators"
            onPointerDown={(event) => event.stopPropagation()}
            className="absolute right-0 top-full z-[70] mt-1 max-h-[calc(100dvh-7rem)] w-72 max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-1 text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.12)]"
          >
            {INDICATOR_REGISTRY.map((indicator) => {
              const isConfigurable = indicator.type === "SWING" || indicator.type === "ENGULF";
              const isEditing = editingIndicator === indicator.type;
              return (
                <div key={indicator.type}>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-pressed={activeIndicators.includes(indicator.type)}
                      onClick={() => onToggleIndicator(indicator.type)}
                      className={cn(
                        "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-slate-100",
                        activeIndicators.includes(indicator.type) && "bg-blue-50 text-blue-700",
                      )}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: indicator.color }} />
                      <span className="min-w-0 flex-1">{indicator.label}</span>
                      <span className="text-[9px] uppercase text-slate-500">{indicator.pane}</span>
                    </button>
                    {isConfigurable && (
                      <button
                        type="button"
                        aria-label={`Settings for ${indicator.label}`}
                        aria-expanded={isEditing}
                        onClick={() => setEditingIndicator(isEditing ? null : indicator.type as "SWING" | "ENGULF")}
                        className={cn("rounded p-1.5 text-slate-600 hover:bg-slate-100", isEditing && "bg-slate-100 text-slate-900")}
                      >
                        <Settings2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {isEditing && indicator.type === "SWING" && (
                    <div className="grid grid-cols-2 gap-2 border-b border-slate-200 px-2 py-2 text-[10px] normal-case tracking-normal">
                      <NumberSetting label="Lookback bars" value={swingStructureSettings.lookbackBars} onChange={(lookbackBars) => onSwingStructureSettingsChange({ lookbackBars })} />
                      <NumberSetting label="Line width" value={swingStructureSettings.lineWidth} min={1} max={5} onChange={(lineWidth) => onSwingStructureSettingsChange({ lineWidth })} />
                      <ColorSetting label="Line" value={swingStructureSettings.lineColor} onChange={(lineColor) => onSwingStructureSettingsChange({ lineColor })} />
                      <ColorSetting label="High label" value={swingStructureSettings.highLabelColor} onChange={(highLabelColor) => onSwingStructureSettingsChange({ highLabelColor })} />
                      <ColorSetting label="Low label" value={swingStructureSettings.lowLabelColor} onChange={(lowLabelColor) => onSwingStructureSettingsChange({ lowLabelColor })} />
                      <CheckboxSetting label="Show labels" checked={swingStructureSettings.showLabels} onChange={(showLabels) => onSwingStructureSettingsChange({ showLabels })} />
                      <CheckboxSetting label="Forming leg" checked={swingStructureSettings.showFormingLeg} onChange={(showFormingLeg) => onSwingStructureSettingsChange({ showFormingLeg })} />
                    </div>
                  )}
                  {isEditing && indicator.type === "ENGULF" && (
                    <div className="grid grid-cols-2 gap-2 border-b border-slate-200 px-2 py-2 text-[10px] normal-case tracking-normal">
                      <NumberSetting label="Lookback bars" value={engulfingZonesSettings.lookbackBars} onChange={(lookbackBars) => onEngulfingZonesSettingsChange({ lookbackBars })} />
                      <NumberSetting label="Pullback bars" value={engulfingZonesSettings.maxPullbackBars} onChange={(maxPullbackBars) => onEngulfingZonesSettingsChange({ maxPullbackBars })} />
                      <NumberSetting label="Active setups" value={engulfingZonesSettings.maxActiveSetups} onChange={(maxActiveSetups) => onEngulfingZonesSettingsChange({ maxActiveSetups })} />
                      <ColorSetting label="Bullish fill" value={engulfingZonesSettings.bullishFillColor} onChange={(bullishFillColor) => onEngulfingZonesSettingsChange({ bullishFillColor })} />
                      <ColorSetting label="Bullish border" value={engulfingZonesSettings.bullishBorderColor} onChange={(bullishBorderColor) => onEngulfingZonesSettingsChange({ bullishBorderColor })} />
                      <ColorSetting label="Bearish fill" value={engulfingZonesSettings.bearishFillColor} onChange={(bearishFillColor) => onEngulfingZonesSettingsChange({ bearishFillColor })} />
                      <ColorSetting label="Bearish border" value={engulfingZonesSettings.bearishBorderColor} onChange={(bearishBorderColor) => onEngulfingZonesSettingsChange({ bearishBorderColor })} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div ref={drawingMenuRef} className="relative shrink-0">
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={() => setShowDrawingMenu((open) => !open)}
          title="Drawing tools"
          aria-label={drawingTool === "none" ? "Drawing tools" : `Drawing tools: ${drawingTool}`}
          aria-expanded={showDrawingMenu}
          aria-haspopup="true"
          className={cn(
            "flex items-center gap-1.5 rounded-xl border border-transparent px-2 py-1 text-xs text-slate-700 transition-all duration-200 hover:border-slate-200 hover:bg-slate-50",
            drawingTool !== "none" && "border-blue-200 bg-blue-50 text-blue-700",
          )}
        >
          <Pencil className="h-3.5 w-3.5" />
          Draw
        </button>
        {showDrawingMenu && (
          <div
            role="menu"
            aria-label="Drawing tools"
            onPointerDown={(event) => event.stopPropagation()}
            className="absolute right-0 top-full z-[70] mt-1 max-h-[calc(100dvh-7rem)] w-56 max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white py-1 text-slate-900 shadow-[0_18px_40px_rgba(15,23,42,0.12)]"
          >
            {DRAWING_TOOLS.map((tool) => (
              <button
                key={tool.value}
                type="button"
                role="menuitemradio"
                aria-checked={drawingTool === tool.value}
                onClick={() => {
                  onDrawingTool(drawingTool === tool.value ? "none" : tool.value);
                  setShowDrawingMenu(false);
                }}
                className={cn(
                  "w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100",
                  drawingTool === tool.value && "bg-slate-100 font-medium",
                )}
              >
                {tool.label}
              </button>
            ))}
            <div className="my-1 border-t border-slate-200" />
            {onCycleMagnet && (
              <button
                type="button"
                onClick={onCycleMagnet}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-100"
              >
                <Magnet className="h-3.5 w-3.5" />
                Magnet: {magnetMode}
              </button>
            )}
            {onToggleStayInDrawingMode && (
              <button
                type="button"
                onClick={onToggleStayInDrawingMode}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-100"
              >
                <Repeat className="h-3.5 w-3.5" />
                Stay in drawing mode {stayInDrawingMode ? "(on)" : "(off)"}
              </button>
            )}
            {drawings.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onClearDrawings();
                  setShowDrawingMenu(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear drawings
              </button>
            )}
          </div>
        )}
      </div>
      {onToggleFullscreen && (
        <button
          type="button"
          onClick={onToggleFullscreen}
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen chart"}
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen chart"}
          className="rounded p-1.5 text-slate-700 hover:bg-slate-100"
        >
          {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      )}
      </div>
    </div>
  );
}

function NumberSetting({
  label,
  value,
  onChange,
  min = 1,
  max = 10000,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-slate-600">
      {label}
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => {
          const nextValue = Number(event.target.value);
          if (Number.isFinite(nextValue) && nextValue >= min && nextValue <= max) onChange(nextValue);
        }}
        className="w-full rounded border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-900"
      />
    </label>
  );
}

function ColorSetting({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-1 text-slate-600">
      {label}
      <ColorPalettePicker label={label} value={value} onChange={onChange} />
    </label>
  );
}

function CheckboxSetting({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-1.5 text-slate-600">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

const DRAWING_TOOLS: Array<{ value: DrawingTool; label: string }> = [
  { value: "horizontal", label: "Horizontal Line" },
  { value: "trendline", label: "Trendline" },
  { value: "fibonacci", label: "Fibonacci" },
  { value: "rectangle", label: "Rectangle" },
  { value: "ray", label: "Ray" },
  { value: "extended", label: "Extended Line" },
  { value: "vertical", label: "Vertical Line" },
  { value: "channel", label: "Parallel Channel" },
  { value: "fibextension", label: "Fib Extension" },
  { value: "ellipse", label: "Ellipse" },
  { value: "arrow", label: "Arrow" },
  { value: "triangle", label: "Triangle" },
  { value: "text", label: "Text" },
  { value: "long-position", label: "Long Position" },
  { value: "short-position", label: "Short Position" },
  { value: "measure", label: "Measure" },
];

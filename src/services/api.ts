/**
 * API facade for the browser terminal. OANDA supplies market data; the demo
 * layer provides inert account placeholders (trading is disabled).
 */
import { demoApi } from "./demo/api.ts";
import { DEMO_SYMBOLS } from "./demo/instruments.ts";
import type { Symbol } from "./schemas.ts";
import type { MarketDataCandle } from "./api/market-data.ts";
import { accountsApi } from "./api/accounts.ts";
import { authApi } from "./api/auth.ts";
import { journalApi } from "./api/journal.ts";
import { marketdataApi } from "./api/market-data.ts";
import { TIMEFRAMES, type Timeframe } from "../pages/trading/constants.ts";
import { getOandaAccountId, getOandaApiKey } from "./oanda-config.ts";

export const API_BASE = "";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const OANDA_BASE_URL = "https://api-fxpractice.oanda.com";
const OANDA_GRANULARITY: Record<Timeframe, string> = {
  "15s": "S15",
  "30s": "S30",
  "1m": "M1",
  "2m": "M2",
  "3m": "M3",
  "5m": "M5",
  "15m": "M15",
  "30m": "M30",
  "1h": "H1",
  "4h": "H4",
  "1d": "D",
  "1w": "W",
};

type CandleRange = { fromMs: number; toMs: number };
type OandaCandle = {
  time: string;
  volume: number;
  mid?: { o: string; h: string; l: string; c: string };
};

async function oandaGet<T>(url: string): Promise<T> {
  const apiKey = getOandaApiKey();
  if (!apiKey) {
    throw new ApiError("OANDA_API_KEY is not configured");
  }

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
  });
  const body = await response.text();
  if (!response.ok) {
    const message = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ""}${body ? `: ${body}` : ""}`;
    throw new ApiError(message, response.status);
  }

  return JSON.parse(body) as T;
}

function assertInstrument(symbol: string): void {
  if (symbol !== "XAU_USD") throw new ApiError(`Unsupported instrument: ${symbol}`);
}

export async function getCandles(
  symbol: string,
  timeframe: string,
  limit?: number,
  range?: CandleRange,
): Promise<MarketDataCandle[]> {
  assertInstrument(symbol);
  if (!TIMEFRAMES.includes(timeframe as Timeframe)) {
    throw new ApiError(`Unsupported timeframe: ${timeframe}`);
  }

  const params = new URLSearchParams({
    granularity: OANDA_GRANULARITY[timeframe as Timeframe],
    alignmentTimezone: "America/New_York",
    price: "M",
  });
  if (timeframe === "1d") {
    params.set("dailyAlignment", "18");
  }
  if (range) {
    params.set("from", new Date(range.fromMs).toISOString());
    params.set("to", new Date(range.toMs).toISOString());
  } else {
    params.set("count", String(Math.min(Math.max(Math.floor(limit ?? 500), 1), 5000)));
  }

  const response = await oandaGet<{ candles?: OandaCandle[] }>(
    `${OANDA_BASE_URL}/v3/instruments/XAU_USD/candles?${params}`,
  );
  return (response.candles ?? []).flatMap((candle) => {
    if (!candle.mid) return [];
    return [{
      time: Math.floor(Date.parse(candle.time) / 1000),
      timestamp: candle.time,
      open: Number(candle.mid.o),
      high: Number(candle.mid.h),
      low: Number(candle.mid.l),
      close: Number(candle.mid.c),
      volume: candle.volume,
    }];
  });
}

async function getCandlesWithMeta(symbol: string, timeframe: string, limit?: number) {
  const candles = await getCandles(symbol, timeframe, limit);
  return {
    candles,
    metadata: {
      historicalCoverageStart: candles[0]?.time ?? null,
      isPartial: false,
      backfillQueued: false,
    },
  };
}

async function getTick(symbol: string) {
  assertInstrument(symbol);
  const accountId = getOandaAccountId();
  if (!accountId) {
    throw new ApiError("OANDA_ACCOUNT_ID is not configured");
  }
  const url = `${OANDA_BASE_URL}/v3/accounts/${encodeURIComponent(accountId)}/pricing?instruments=XAU_USD`;
  const response = await oandaGet<{
    prices?: Array<{
      instrument: string;
      time: string;
      bids?: Array<{ price: string }>;
      asks?: Array<{ price: string }>;
      closeoutBid?: string;
      closeoutAsk?: string;
    }>;
  }>(url);
  const price = response.prices?.[0];
  if (!price) throw new ApiError("OANDA returned no price for XAU_USD");
  return {
    symbol,
    bid: Number(price.bids?.[0]?.price ?? price.closeoutBid),
    ask: Number(price.asks?.[0]?.price ?? price.closeoutAsk),
    timestamp: price.time,
  };
}

const marketDataApi = {
  getSymbols: (): Promise<Symbol[]> => Promise.resolve(DEMO_SYMBOLS),
  getCandles,
  getCandlesWithMeta,
  getTick,
};

type DynamicApiMethodName =
  | "cancelOrder"
  | "clearAiTraderHistory"
  | "closeAllPositions"
  | "closePosition"
  | "closeTicket"
  | "connectBot"
  | "createAiTraderPlan"
  | "createBotIntegration"
  | "createScalingPlan"
  | "createTicket"
  | "deleteBotIntegration"
  | "disconnectBot"
  | "enrollInCompetition"
  | "enrollScaling"
  | "executeAiTraderPlan"
  | "getActiveCompetitions"
  | "getAiTraderHistory"
  | "getAnnouncements"
  | "getAnnouncementsUnreadCount"
  | "getBotActivityLogs"
  | "getBotIntegrations"
  | "getBotStatus"
  | "getClosedPositions"
  | "getClosedPositionsSummary"
  | "getCompetitionRankings"
  | "getFills"
  | "getFillQuality"
  | "getFirmLeaderboard"
  | "getLeaderboard"
  | "getLeaderboardPrizes"
  | "getLeaderboardStats"
  | "getMergeRequests"
  | "getMyAwards"
  | "getMyCertificates"
  | "getMyCompetitionEntries"
  | "getMyFirm"
  | "getMyLeaderboardRank"
  | "getMyProfitSplit"
  | "getMyTickets"
  | "getOpenPositionCount"
  | "getOrders"
  | "getPositions"
  | "getProfitSplitConfig"
  | "getPublicProfile"
  | "getPublicProfiles"
  | "getPushSubscriptions"
  | "getScalingPlans"
  | "getScalingProgress"
  | "getTicket"
  | "getVapidPublicKey"
  | "isAiTraderEnabled"
  | "markAllAnnouncementsRead"
  | "markAnnouncementRead"
  | "modifyOrder"
  | "modifyPosition"
  | "placeOrder"
  | "processMergeRequest"
  | "replyToTicket"
  | "requestAccountMerge"
  | "sendTestNotification"
  | "subscribePush"
  | "testBotIntegration"
  | "unsubscribePush"
  | "updateBotIntegration"
  | "updateProfile"
  | "updateProfitSplitConfig"
  | "validateCoupon";

type DynamicApiMethods = {
  [Method in DynamicApiMethodName]: (...args: any[]) => Promise<any>;
};

type ApiFacade =
  Omit<
    typeof demoApi,
    | keyof typeof accountsApi
    | keyof typeof authApi
    | keyof typeof journalApi
    | keyof typeof marketdataApi
    | keyof typeof marketDataApi
    | DynamicApiMethodName
  > &
  Omit<typeof accountsApi, DynamicApiMethodName> &
  Omit<typeof authApi, DynamicApiMethodName> &
  Omit<typeof journalApi, DynamicApiMethodName> &
  Omit<typeof marketdataApi, keyof typeof marketDataApi | DynamicApiMethodName> &
  Omit<typeof marketDataApi, DynamicApiMethodName> &
  DynamicApiMethods;

export const api = new Proxy(demoApi as Record<string, unknown>, {
  get(target, prop: string) {
    if (prop in marketDataApi) return marketDataApi[prop as keyof typeof marketDataApi];
    if (prop in target) return target[prop];
    return () => Promise.resolve(null);
  },
}) as ApiFacade;
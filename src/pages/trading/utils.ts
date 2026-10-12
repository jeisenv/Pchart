import { TickMarkType, type CandlestickData, type Time } from "lightweight-charts";
import type { CandleData } from "../../lib/indicators.ts";
import { KNOWN_CURRENCIES } from "./constants.ts";
import type { Timeframe } from "./constants.ts";

export const SESSION_TIME_ZONE = "America/New_York";
const NEW_YORK_TIME_ZONE = "America/New_York";
const DAY_MS = 24 * 60 * 60 * 1000;
const FOUR_HOURS_MS = 4 * 60 * 60 * 1000;

const newYorkDateTime = new Intl.DateTimeFormat("en-US", {
  timeZone: NEW_YORK_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const sessionDateTime = new Intl.DateTimeFormat("en-US", {
  timeZone: SESSION_TIME_ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function getDateParts(formatter: Intl.DateTimeFormat, timestampMs: number) {
  const parts = formatter.formatToParts(timestampMs);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value ?? 0);
  return { year: part("year"), month: part("month"), day: part("day"), hour: part("hour") };
}

function zonedWallTimeToUtcMs(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
): number {
  const targetAsUtcMs = Date.UTC(year, month - 1, day, hour);
  let guessMs = targetAsUtcMs;
  const formatter = timeZone === NEW_YORK_TIME_ZONE ? newYorkDateTime : new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(guessMs);
    const value = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((item) => item.type === type)?.value ?? 0);
    const representedAsUtcMs = Date.UTC(
      value("year"),
      value("month") - 1,
      value("day"),
      value("hour"),
      value("minute"),
      value("second"),
    );
    const correction = targetAsUtcMs - representedAsUtcMs;
    guessMs += correction;
    if (correction === 0) break;
  }
  return guessMs;
}

function newYorkSessionAnchorMs(timestampMs: number): number {
  const local = getDateParts(newYorkDateTime, timestampMs);
  const todayAnchor = zonedWallTimeToUtcMs(
    local.year,
    local.month,
    local.day,
    18,
    NEW_YORK_TIME_ZONE,
  );
  if (timestampMs >= todayAnchor) return todayAnchor;

  const previousDay = new Date(Date.UTC(local.year, local.month - 1, local.day) - DAY_MS);
  return zonedWallTimeToUtcMs(
    previousDay.getUTCFullYear(),
    previousDay.getUTCMonth() + 1,
    previousDay.getUTCDate(),
    18,
    NEW_YORK_TIME_ZONE,
  );
}

function newYorkFourHourAnchorMs(timestampMs: number): number {
  const local = getDateParts(newYorkDateTime, timestampMs);
  const todayAnchor = zonedWallTimeToUtcMs(
    local.year,
    local.month,
    local.day,
    1,
    NEW_YORK_TIME_ZONE,
  );
  if (timestampMs >= todayAnchor) return todayAnchor;

  const previousDay = new Date(Date.UTC(local.year, local.month - 1, local.day) - DAY_MS);
  return zonedWallTimeToUtcMs(
    previousDay.getUTCFullYear(),
    previousDay.getUTCMonth() + 1,
    previousDay.getUTCDate(),
    1,
    NEW_YORK_TIME_ZONE,
  );
}

function nextNewYorkSessionAnchorMs(anchorMs: number): number {
  const local = getDateParts(newYorkDateTime, anchorMs);
  const nextDay = new Date(Date.UTC(local.year, local.month - 1, local.day) + DAY_MS);
  return zonedWallTimeToUtcMs(
    nextDay.getUTCFullYear(),
    nextDay.getUTCMonth() + 1,
    nextDay.getUTCDate(),
    18,
    NEW_YORK_TIME_ZONE,
  );
}

function asDate(time: Time): Date {
  if (typeof time === "number") return new Date(time * 1000);
  if (typeof time === "string") return new Date(`${time}T00:00:00Z`);
  return new Date(Date.UTC(time.year, time.month - 1, time.day));
}

export function formatSessionTime(time: Time): string {
  return sessionDateTime.format(asDate(time));
}

export function formatSessionTickMark(time: Time, tickMarkType: TickMarkType, locale: string): string {
  const date = asDate(time);
  const dateOptions: Intl.DateTimeFormatOptions = { timeZone: SESSION_TIME_ZONE };
  switch (tickMarkType) {
    case TickMarkType.Year:
      return new Intl.DateTimeFormat(locale || "en-US", { ...dateOptions, year: "numeric" }).format(date);
    case TickMarkType.Month:
      return new Intl.DateTimeFormat(locale || "en-US", { ...dateOptions, month: "short" }).format(date);
    case TickMarkType.DayOfMonth:
      return new Intl.DateTimeFormat(locale || "en-US", { ...dateOptions, day: "numeric" }).format(date);
    case TickMarkType.TimeWithSeconds:
      return new Intl.DateTimeFormat(locale || "en-US", {
        ...dateOptions,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
      }).format(date);
    case TickMarkType.Time:
    default:
      return new Intl.DateTimeFormat(locale || "en-US", {
        ...dateOptions,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).format(date);
  }
}

/** Derive pip (decimal) precision from symbolInfo.tickSize or symbol name */
export function getPipDigits(
  symbolInfo?: { tickSize?: number | string },
  symbolName?: string,
): number {
  const symbolDecimals = _symbolNameDecimals(symbolName);
  if (symbolInfo?.tickSize) {
    const s = String(symbolInfo.tickSize);
    const tickDecimals = s.includes(".")
      ? s.split(".")[1]!.replace(/0+$/, "").length || s.split(".")[1]!.length
      : 0;
    // Use the higher of tick-derived or symbol-name-derived so forex pairs
    // (tickSize=0.0001) still show 5 decimal places instead of 4.
    return Math.max(tickDecimals, symbolDecimals, 2);
  }
  return symbolDecimals;
}

function _symbolNameDecimals(symbolName?: string): number {
  if (!symbolName) return 5;
  const n = symbolName.toUpperCase();
  if (n.includes("JPY") || n.includes("XAU") || n.includes("GOLD")) return 3;
  if (n.includes("BTC") || n.includes("ETH")) return 2;
  if (n.includes("US30") || n.includes("SPX") || n.includes("NAS") || n.includes("DAX")) return 2;
  return 5;
}

/** Get the minMove for lightweight-charts priceFormat from pip digits */
export function getMinMove(pipDigits: number): number {
  return Number((1 / Math.pow(10, pipDigits)).toFixed(pipDigits + 1));
}

/** Parse timestamp to unix seconds */
export function toUnixSeconds(ts: number | string | Date): number {
  if (typeof ts === "number") return ts > 1e12 ? Math.floor(ts / 1000) : ts;
  return Math.floor(new Date(ts).getTime() / 1000);
}

/** Normalise a numeric timestamp to unix milliseconds (accepts seconds or ms) */
export function toUnixMs(ts: number): number {
  return ts > 1e12 ? ts : ts * 1000;
}

/** Convert candles for indicator lib */
export function toIndicatorCandles(candles: CandlestickData<Time>[]): CandleData[] {
  return candles.map((c) => ({
    time: c.time as number,
    open: c.open,
    high: c.high,
    low: c.low,
    close: c.close,
    volume: 0,
  }));
}

/** Format seconds remaining as M:SS or H:MM:SS */
export function formatCountdown(totalSec: number): string {
  if (totalSec <= 0) return "0:00";
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function isLiveTickFresh(
  tickTimestampMs: number,
  nowMs: number,
  maxAgeMs = 3_000,
): boolean {
  const ageMs = nowMs - tickTimestampMs;
  return ageMs >= -10_000 && ageMs <= maxAgeMs;
}

/** Extract currency codes from a symbol name */
export function extractCurrencies(symbol: string): string[] {
  const upper = symbol.toUpperCase().replace(/[^A-Z]/g, "");
  const found: string[] = [];
  for (const c of KNOWN_CURRENCIES) {
    if (upper.includes(c)) found.push(c);
  }
  if (found.length === 0 && upper.length >= 6) {
    found.push(upper.slice(0, 3), upper.slice(3, 6));
  }
  return [...new Set(found)];
}

/** Return the candle-bucket start (unix seconds) for a given timestamp */
export function getCandleBucketTime(timestampMs: number, tf: Timeframe): number {
  const SEC = 1000;
  const intervals: Record<Timeframe, number> = {
    "15s": 15 * SEC,
    "30s": 30 * SEC,
    "1m": 60 * SEC,
    "2m": 2 * 60 * SEC,
    "3m": 3 * 60 * SEC,
    "5m": 5 * 60 * SEC,
    "15m": 15 * 60 * SEC,
    "30m": 30 * 60 * SEC,
    "1h": 60 * 60 * SEC,
    "4h": 4 * 60 * 60 * SEC,
    "1d": 24 * 60 * 60 * SEC,
    "1w": 7 * 24 * 60 * 60 * SEC,
  };
  if (tf === "1d") return Math.floor(newYorkSessionAnchorMs(timestampMs) / 1000);
  if (tf === "4h") {
    const anchorMs = newYorkFourHourAnchorMs(timestampMs);
    return Math.floor((anchorMs + Math.floor((timestampMs - anchorMs) / FOUR_HOURS_MS) * FOUR_HOURS_MS) / 1000);
  }
  const ms = intervals[tf];
  return Math.floor((Math.floor(timestampMs / ms) * ms) / 1000);
}

export function getNextCandleCloseMs(timestampMs: number, tf: Timeframe): number {
  if (tf === "1d") {
    const anchorMs = newYorkSessionAnchorMs(timestampMs);
    return timestampMs < anchorMs ? anchorMs : nextNewYorkSessionAnchorMs(anchorMs);
  }
  if (tf === "4h") return getCandleBucketTime(timestampMs, tf) * 1000 + FOUR_HOURS_MS;

  const intervals: Record<Timeframe, number> = {
    "15s": 15_000,
    "30s": 30_000,
    "1m": 60_000,
    "2m": 120_000,
    "3m": 180_000,
    "5m": 300_000,
    "15m": 900_000,
    "30m": 1_800_000,
    "1h": 3_600_000,
    "4h": FOUR_HOURS_MS,
    "1d": DAY_MS,
    "1w": 7 * DAY_MS,
  };
  const intervalMs = intervals[tf];
  return (Math.floor(timestampMs / intervalMs) + 1) * intervalMs;
}

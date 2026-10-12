import { describe, it, expect } from "vitest";
import type { Time } from "lightweight-charts";
import { cn, formatCurrency, formatNumber, pnlClass } from "@/lib/utils";
import {
  formatSessionTime,
  getCandleBucketTime,
  getNextCandleCloseMs,
  isLiveTickFresh,
} from "@/pages/trading/utils";

describe("cn (class name merge)", () => {
  it("merges class names", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("handles undefined and null", () => {
    expect(cn("foo", undefined, null, "bar")).toBe("foo bar");
  });

  it("handles conditional classes", () => {
    const hide = false;
    const show = true;
    expect(cn("base", hide && "hidden", show && "visible")).toBe("base visible");
  });

  it("resolves Tailwind conflicts (last wins)", () => {
    const result = cn("p-4", "p-6");
    expect(result).toBe("p-6");
  });

  it("handles empty input", () => {
    expect(cn()).toBe("");
  });
});

describe("formatCurrency", () => {
  it("formats positive numbers", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats negative numbers", () => {
    expect(formatCurrency(-500)).toBe("-$500.00");
  });

  it("respects custom decimals", () => {
    expect(formatCurrency(100, 0)).toBe("$100");
  });

  it("formats large numbers with commas", () => {
    expect(formatCurrency(1000000)).toBe("$1,000,000.00");
  });
});

describe("formatNumber", () => {
  it("formats with default 2 decimals", () => {
    expect(formatNumber(1234.5)).toBe("1,234.50");
  });

  it("formats zero", () => {
    expect(formatNumber(0)).toBe("0.00");
  });

  it("respects custom decimals", () => {
    expect(formatNumber(3.14159, 4)).toBe("3.1416");
  });
});

describe("pnlClass", () => {
  it("returns success for positive values", () => {
    expect(pnlClass(100)).toBe("text-success");
  });

  it("returns destructive for negative values", () => {
    expect(pnlClass(-50)).toBe("text-destructive");
  });

  it("returns muted for zero", () => {
    expect(pnlClass(0)).toBe("text-muted-foreground");
  });
});

describe("isLiveTickFresh", () => {
  it("accepts recent ticks and rejects stale or implausibly future-dated ticks", () => {
    expect(isLiveTickFresh(9_500, 10_000)).toBe(true);
    expect(isLiveTickFresh(6_000, 10_000)).toBe(false);
    expect(isLiveTickFresh(21_000, 10_000)).toBe(false);
  });
});

describe("getCandleBucketTime", () => {
  it("buckets 15-second and 30-second timeframes", () => {
    expect(getCandleBucketTime(31_000, "15s")).toBe(30);
    expect(getCandleBucketTime(61_000, "30s")).toBe(60);
  });

  it("buckets 2-minute and 3-minute timeframes", () => {
    expect(getCandleBucketTime(241_000, "2m")).toBe(240);
    expect(getCandleBucketTime(361_000, "3m")).toBe(360);
  });

  it("aligns daily candles to New York session time in winter and summer", () => {
    const winterOpen = Date.parse("2026-01-15T23:00:00Z");
    const summerOpen = Date.parse("2026-07-15T22:00:00Z");

    expect(getCandleBucketTime(winterOpen + 60_000, "1d") * 1000).toBe(winterOpen);
    expect(getCandleBucketTime(summerOpen + 60_000, "1d") * 1000).toBe(summerOpen);
    expect(formatSessionTime((winterOpen / 1000) as Time)).toContain("Jan 15, 2026, 18:00:00");
    expect(formatSessionTime((summerOpen / 1000) as Time)).toContain("Jul 15, 2026, 18:00:00");
  });

  it("aligns four-hour candle boundaries to OANDA's default 01:00 New York anchor", () => {
    const winterOpen = Date.parse("2026-01-16T06:00:00Z");
    const summerOpen = Date.parse("2026-07-16T05:00:00Z");

    expect(getCandleBucketTime(winterOpen + 60_000, "4h") * 1000).toBe(winterOpen);
    expect(getCandleBucketTime(winterOpen + 4 * 60 * 60_000, "4h") * 1000).toBe(
      winterOpen + 4 * 60 * 60_000,
    );
    expect(getCandleBucketTime(summerOpen + 60_000, "4h") * 1000).toBe(summerOpen);
    expect(getCandleBucketTime(summerOpen + 4 * 60 * 60_000, "4h") * 1000).toBe(
      summerOpen + 4 * 60 * 60_000,
    );
  });

  it("counts down to the OANDA-aligned four-hour close", () => {
    const now = Date.parse("2026-10-12T12:28:00Z");

    expect(getNextCandleCloseMs(now, "4h")).toBe(Date.parse("2026-10-12T13:00:00Z"));
    expect((getNextCandleCloseMs(now, "4h") - now) / 60_000).toBe(32);
  });

  it("closes each daily candle at the next New York 18:00 open", () => {
    const winterNow = Date.parse("2026-01-15T23:30:00Z");
    const summerNow = Date.parse("2026-07-15T22:30:00Z");

    expect(getNextCandleCloseMs(winterNow, "1d")).toBe(Date.parse("2026-01-16T23:00:00Z"));
    expect(getNextCandleCloseMs(summerNow, "1d")).toBe(Date.parse("2026-07-16T22:00:00Z"));
  });
});

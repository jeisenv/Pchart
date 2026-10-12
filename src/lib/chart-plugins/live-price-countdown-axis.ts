import type { ISeriesPrimitiveAxisView } from "lightweight-charts";
import { PluginBase } from "./plugin-base.ts";

const COUNTDOWN_LABEL_OFFSET = 18;
export const LIVE_PRICE_AXIS_LABEL_BACKGROUND = "rgba(100, 116, 139, 0.52)";

class CountdownAxisView implements ISeriesPrimitiveAxisView {
  constructor(private readonly source: LivePriceCountdownAxis) {}

  private coordinateForCountdown(): number | null {
    const price = this.source.price;
    if (price === null || !this.source.countdown) return null;
    const priceCoordinate = this.source.series.priceToCoordinate(price);
    return priceCoordinate === null ? null : priceCoordinate + COUNTDOWN_LABEL_OFFSET;
  }

  coordinate(): number {
    return this.coordinateForCountdown() ?? -1;
  }

  fixedCoordinate(): number | undefined {
    return this.coordinateForCountdown() ?? undefined;
  }

  text(): string {
    return this.source.countdown;
  }

  textColor(): string {
    return "rgba(255, 255, 255, 0.96)";
  }

  backColor(): string {
    return LIVE_PRICE_AXIS_LABEL_BACKGROUND;
  }

  visible(): boolean {
    return this.coordinateForCountdown() !== null;
  }

  tickVisible(): boolean {
    return false;
  }
}

export class LivePriceCountdownAxis extends PluginBase {
  private _price: number | null = null;
  private _countdown = "";
  private readonly _axisView = new CountdownAxisView(this);
  private readonly _axisViews = [this._axisView];

  get price(): number | null {
    return this._price;
  }

  get countdown(): string {
    return this._countdown;
  }

  setPrice(price: number | null): void {
    if (this._price === price) return;
    this._price = price;
    this.requestUpdate();
  }

  setCountdown(countdown: string): void {
    if (this._countdown === countdown) return;
    this._countdown = countdown;
    this.requestUpdate();
  }

  priceAxisViews(): readonly ISeriesPrimitiveAxisView[] {
    return this._axisViews;
  }
}
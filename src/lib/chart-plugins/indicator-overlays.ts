import type { CanvasRenderingTarget2D } from "fancy-canvas";
import type {
  ISeriesPrimitivePaneRenderer,
  ISeriesPrimitivePaneView,
  SeriesPrimitivePaneViewZOrder,
  Time,
} from "lightweight-charts";
import type { IndicatorPoint } from "../indicators.ts";
import { PluginBase } from "./plugin-base.ts";

export interface IndicatorOverlayLine {
  color: string;
  width: number;
  dashed?: boolean;
  points: IndicatorPoint[];
}

interface PositionedLine {
  color: string;
  width: number;
  dashed?: boolean;
  points: Array<{ x: number; y: number } | null>;
}

class IndicatorOverlayRenderer implements ISeriesPrimitivePaneRenderer {
  constructor(private readonly lines: PositionedLine[]) {}

  draw(target: CanvasRenderingTarget2D): void {
    target.useMediaCoordinateSpace(({ context }) => {
      const ctx = context;
      ctx.save();
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      for (const line of this.lines) {
        ctx.beginPath();
        ctx.strokeStyle = line.color;
        ctx.lineWidth = line.width;
        ctx.setLineDash(line.dashed ? [5, 4] : []);
        let started = false;
        for (const point of line.points) {
          if (!point) {
            started = false;
            continue;
          }
          if (started) ctx.lineTo(point.x, point.y);
          else {
            ctx.moveTo(point.x, point.y);
            started = true;
          }
        }
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    });
  }
}

class IndicatorOverlayPaneView implements ISeriesPrimitivePaneView {
  private lines: PositionedLine[] = [];

  constructor(private readonly source: IndicatorOverlaysPrimitive) {}

  update(): void {
    this.lines = this.source.resolveLines();
  }

  renderer(): ISeriesPrimitivePaneRenderer {
    return new IndicatorOverlayRenderer(this.lines);
  }

  zOrder(): SeriesPrimitivePaneViewZOrder {
    return "bottom";
  }
}

export class IndicatorOverlaysPrimitive extends PluginBase {
  private lines: IndicatorOverlayLine[] = [];
  private readonly views = [new IndicatorOverlayPaneView(this)];

  setLines(lines: IndicatorOverlayLine[]): void {
    this.lines = lines;
    this.updateAllViews();
    this.requestUpdate();
  }

  updateAllViews(): void {
    for (const view of this.views) view.update();
  }

  paneViews(): readonly ISeriesPrimitivePaneView[] {
    return this.views;
  }

  resolveLines(): PositionedLine[] {
    const timeScale = this.chart.timeScale();
    return this.lines.map((line) => ({
      color: line.color,
      width: line.width,
      dashed: line.dashed,
      points: line.points.map((point) => {
        const x = timeScale.timeToCoordinate(point.time as Time);
        const y = this.series.priceToCoordinate(point.value);
        return x === null || y === null ? null : { x, y };
      }),
    }));
  }
}
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Circle,
  Equal,
  EyeOff,
  GripVertical,
  Layers,
  Layers3,
  type LucideIcon,
  Minus,
  MousePointer2,
  MoveUpRight,
  MoveVertical,
  PenTool,
  Ruler,
  Spline,
  Square,
  TrendingUp,
  Triangle,
  Type,
} from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "../../lib/utils.ts";
import type { DrawingTool } from "./constants.ts";

interface ToolMeta {
  tool: DrawingTool;
  icon: LucideIcon;
  label: string;
}

interface ToolGroup {
  id: string;
  icon: LucideIcon;
  label: string;
  tools: ToolMeta[];
}

// TradingView-style left rail: tools grouped behind a flyout per category.
const GROUPS: ToolGroup[] = [
  {
    id: "lines",
    icon: TrendingUp,
    label: "Lines",
    tools: [
      { tool: "trendline", icon: TrendingUp, label: "Trend Line" },
      { tool: "ray", icon: MoveUpRight, label: "Ray" },
      { tool: "extended", icon: Spline, label: "Extended Line" },
      { tool: "horizontal", icon: Minus, label: "Horizontal Line" },
      { tool: "vertical", icon: MoveVertical, label: "Vertical Line" },
      { tool: "channel", icon: Equal, label: "Parallel Channel" },
    ],
  },
  {
    id: "fib",
    icon: Layers,
    label: "Fibonacci",
    tools: [
      { tool: "fibonacci", icon: Layers, label: "Fib Retracement" },
      { tool: "fibextension", icon: Layers3, label: "Fib Extension" },
    ],
  },
  {
    id: "shapes",
    icon: Square,
    label: "Shapes",
    tools: [
      { tool: "rectangle", icon: Square, label: "Rectangle" },
      { tool: "ellipse", icon: Circle, label: "Ellipse" },
      { tool: "triangle", icon: Triangle, label: "Triangle" },
      { tool: "arrow", icon: ArrowRight, label: "Arrow" },
    ],
  },
  {
    id: "trade",
    icon: ArrowUpRight,
    label: "Trade",
    tools: [
      { tool: "long-position", icon: ArrowUpRight, label: "Long Position" },
      { tool: "short-position", icon: ArrowDownRight, label: "Short Position" },
      { tool: "measure", icon: Ruler, label: "Measure" },
    ],
  },
  { id: "text", icon: Type, label: "Text", tools: [{ tool: "text", icon: Type, label: "Text" }] },
];

function RailButton({
  icon: Icon,
  title,
  active,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={Boolean(active)}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        active ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/25" : "text-muted-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function RailGroup({
  group,
  activeTool,
  open,
  onToggle,
  onSelect,
}: {
  group: ToolGroup;
  activeTool: DrawingTool;
  open: boolean;
  onToggle: () => void;
  onSelect: (t: DrawingTool) => void;
}) {
  const activeMeta = group.tools.find((t) => t.tool === activeTool);
  const Icon = activeMeta?.icon ?? group.icon;
  return (
    <div className="relative">
      <RailButton icon={Icon} title={group.label} active={Boolean(activeMeta)} onClick={onToggle} />
      {open && (
        <div className="absolute left-full top-0 z-30 ml-2 min-w-[184px] rounded-lg border border-border/80 bg-card/95 p-1 shadow-xl backdrop-blur-xl">
          {group.tools.map((t) => (
            <button
              key={t.tool}
              type="button"
              aria-pressed={activeTool === t.tool}
              onClick={() => onSelect(t.tool)}
              className={cn(
                "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-xs text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                activeTool === t.tool && "bg-primary/10 text-primary",
              )}
            >
              <t.icon className="h-4 w-4 shrink-0" />
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function DrawingToolRail({
  drawingTool,
  onDrawingTool,
}: {
  drawingTool: DrawingTool;
  onDrawingTool: (t: DrawingTool) => void;
}) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const dragStart = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const rail = ref.current;
    const bounds = rail?.parentElement?.getBoundingClientRect();
    const startRect = rail?.getBoundingClientRect();
    if (!rail || !bounds || !startRect || event.button !== 0) return;
    event.preventDefault();

    const startX = event.clientX;
    const startY = event.clientY;
    const startOffset = offset;
    const onMove = (moveEvent: PointerEvent) => {
      const nextLeft = startRect.left + moveEvent.clientX - startX;
      const nextTop = startRect.top + moveEvent.clientY - startY;
      const left = Math.min(Math.max(bounds.left, nextLeft), Math.max(bounds.left, bounds.right - startRect.width));
      const top = Math.min(Math.max(bounds.top, nextTop), Math.max(bounds.top, bounds.bottom - startRect.height));
      setOffset({ x: startOffset.x + left - startRect.left, y: startOffset.y + top - startRect.top });
    };
    const stop = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  };
  const positionStyle = offset.x || offset.y
    ? { transform: `translate(${offset.x}px, ${offset.y}px)` }
    : undefined;

  useEffect(() => {
    if (!openGroup) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenGroup(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openGroup]);

  const select = (t: DrawingTool) => {
    onDrawingTool(drawingTool === t ? "none" : t);
    setOpenGroup(null);
  };

  const hide = () => {
    setOpenGroup(null);
    setHidden(true);
  };

  // Collapsed: a small restorable button where the rail was last positioned.
  if (hidden) {
    return (
      <button
        type="button"
        title="Show drawing tools"
        onClick={() => setHidden(false)}
        style={positionStyle}
        className="absolute left-1 top-1 z-20 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/80 bg-card/95 text-muted-foreground shadow-lg backdrop-blur-xl transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <PenTool className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div
      ref={ref}
      style={positionStyle}
      className="absolute left-1 top-1 z-20 flex flex-col items-center gap-0.5 rounded-xl border border-border/80 bg-card/95 p-1 shadow-lg backdrop-blur-xl"
    >
      <button
        type="button"
        onPointerDown={dragStart}
        title="Drag to move drawing toolbar"
        aria-label="Move drawing toolbar"
        className="flex h-7 w-8 touch-none cursor-grab items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-secondary hover:text-muted-foreground active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <RailButton
        icon={MousePointer2}
        title="Cursor"
        active={drawingTool === "none"}
        onClick={() => {
          onDrawingTool("none");
          setOpenGroup(null);
        }}
      />
      {GROUPS.map((g) => (
        <RailGroup
          key={g.id}
          group={g}
          activeTool={drawingTool}
          open={openGroup === g.id}
          onToggle={() => setOpenGroup((o) => (o === g.id ? null : g.id))}
          onSelect={select}
        />
      ))}
      <div className="my-1 w-full border-t border-border/60" />
      <RailButton icon={EyeOff} title="Hide toolbar" onClick={hide} />
    </div>
  );
}

import { Check, Pipette } from "lucide-react";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cn } from "../../lib/utils.ts";

const COLOR_SWATCHES = [
  "#ffffff", "#e6e6e6", "#b3b3b3", "#808080", "#595959", "#333333", "#000000",
  "#ffe5e5", "#ffb3b3", "#ff8080", "#ff4d4d", "#e60000", "#b30000", "#660000",
  "#fff0e0", "#ffd1a3", "#ffb366", "#ff9933", "#e67300", "#b35900", "#663300",
  "#fff9cc", "#fff080", "#ffe633", "#ffd600", "#e6b800", "#b38f00", "#665200",
  "#e6f5e6", "#b3e6b3", "#80d480", "#4dc94d", "#26a626", "#1a751a", "#0d400d",
  "#e5f0ff", "#b3d1ff", "#80b3ff", "#4d94ff", "#2673e6", "#1a4d99", "#0d264d",
  "#f0e5ff", "#d1b3ff", "#b380ff", "#9952ff", "#7a33e6", "#4d1a99", "#260d4d",
] as const;

type RgbColor = { red: number; green: number; blue: number; alpha: number };

function parseColor(value: string): RgbColor | null {
  const hex = /^#?([\da-f]{6})([\da-f]{2})?$/i.exec(value);
  if (hex) {
    const raw = hex[1]!;
    return {
      red: Number.parseInt(raw.slice(0, 2), 16),
      green: Number.parseInt(raw.slice(2, 4), 16),
      blue: Number.parseInt(raw.slice(4, 6), 16),
      alpha: hex[2] ? Number.parseInt(hex[2], 16) / 255 : 1,
    };
  }
  const shortHex = /^#?([\da-f])([\da-f])([\da-f])$/i.exec(value);
  if (shortHex) {
    return {
      red: Number.parseInt(shortHex[1]!.repeat(2), 16),
      green: Number.parseInt(shortHex[2]!.repeat(2), 16),
      blue: Number.parseInt(shortHex[3]!.repeat(2), 16),
      alpha: 1,
    };
  }
  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(value);
  if (!rgb) return null;
  return {
    red: Number(rgb[1]),
    green: Number(rgb[2]),
    blue: Number(rgb[3]),
    alpha: rgb[4] === undefined ? 1 : Math.min(1, Math.max(0, Number(rgb[4]))),
  };
}

function colorWithOpacity(color: string, opacity: number): string {
  const rgb = parseColor(color);
  if (!rgb) return color;
  if (opacity >= 1) {
    return `#${[rgb.red, rgb.green, rgb.blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
  }
  return `rgba(${rgb.red}, ${rgb.green}, ${rgb.blue}, ${opacity})`;
}

function colorHex(color: string): string {
  const rgb = parseColor(color);
  if (!rgb) return "#ffffff";
  return `#${[rgb.red, rgb.green, rgb.blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function ColorPalettePicker({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [opacity, setOpacity] = useState(100);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const updatePosition = () => {
      const trigger = triggerRef.current?.getBoundingClientRect();
      const popup = popupRef.current?.getBoundingClientRect();
      if (!trigger || !popup) return;

      const margin = 8;
      const left = Math.min(
        Math.max(margin, trigger.right - popup.width),
        window.innerWidth - popup.width - margin,
      );
      const below = trigger.bottom + margin;
      const top = below + popup.height <= window.innerHeight - margin
        ? below
        : Math.max(margin, trigger.top - popup.height - margin);
      setPosition({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !popupRef.current?.contains(target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative inline-flex shrink-0", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        title={`${label}: ${value}`}
        onClick={() => {
          setOpacity(Math.round((parseColor(value)?.alpha ?? 1) * 100));
          setPosition(null);
          setOpen((visible) => !visible);
        }}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded border border-border bg-background p-1 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <span
          aria-hidden="true"
          className="h-full w-full rounded-sm border border-black/20 shadow-inner"
          style={{ backgroundColor: value }}
        />
      </button>
      {open && createPortal(
        <div
          ref={popupRef}
          role="dialog"
          aria-label={`${label} palette`}
          className="fixed z-[10000] max-h-[calc(100dvh-1rem)] w-60 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-md border border-border bg-card p-2.5 text-card-foreground shadow-xl"
          style={{ top: position?.top ?? 0, left: position?.left ?? 0, visibility: position ? "visible" : "hidden" }}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</span>
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
              <span className="h-3.5 w-3.5 rounded-sm border border-black/15" style={{ backgroundColor: value }} />
              {colorHex(value).toUpperCase()}
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5" aria-label="Color swatches">
            {COLOR_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                aria-label={`Select ${color}`}
                aria-pressed={colorHex(value).toLowerCase() === color}
                onClick={() => {
                  onChange(colorWithOpacity(color, opacity / 100));
                  setOpen(false);
                }}
                className={cn(
                  "relative aspect-square w-full rounded-sm border border-black/15 transition-transform hover:z-10 hover:scale-110 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  colorHex(value).toLowerCase() === color && "ring-2 ring-primary ring-offset-1 ring-offset-card",
                )}
                style={{ backgroundColor: color }}
              >
                {colorHex(value).toLowerCase() === color && (
                  <Check className={cn("absolute inset-0 m-auto h-3.5 w-3.5", ["#ffffff", "#e6e6e6", "#b3b3b3", "#ffe5e5", "#fff0e0", "#fff9cc", "#e6f5e6", "#e5f0ff", "#f0e5ff"].includes(color) ? "text-slate-900" : "text-white")} />
                )}
              </button>
            ))}
          </div>
          <div className="mt-2 border-t border-border pt-2">
            <label className="flex items-center justify-between gap-3 text-[10px] font-medium text-muted-foreground">
              Opacity <span className="font-mono text-foreground">{opacity}%</span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={opacity}
              aria-label={`${label} opacity`}
              onChange={(event) => {
                const nextOpacity = Number(event.target.value);
                setOpacity(nextOpacity);
                onChange(colorWithOpacity(value, nextOpacity / 100));
              }}
              className="mt-1.5 h-4 w-full cursor-pointer accent-primary"
            />
          </div>
          <div className="mt-2 border-t border-border pt-2">
            <input
              ref={customInputRef}
              type="color"
              value={colorHex(value)}
              aria-label={`Custom ${label}`}
              onChange={(event) => onChange(colorWithOpacity(event.target.value, opacity / 100))}
              className="sr-only"
              tabIndex={-1}
            />
            <button
              type="button"
              onClick={() => customInputRef.current?.click()}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-secondary"
            >
              <Pipette className="h-3.5 w-3.5" />
              Custom color…
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ChartToolbar, type ChartToolbarProps } from "../pages/trading/ChartToolbar.tsx";

const toolbarProps = (): ChartToolbarProps => ({
  selectedSymbol: "EUR_USD",
  symbols: [{ name: "EUR_USD", category: "FX" }],
  onSymbolChange: vi.fn(),
  timeframe: "1m",
  onTimeframeChange: vi.fn(),
  activeIndicators: [],
  onToggleIndicator: vi.fn(),
  swingStructureSettings: {
    lookbackBars: 500,
    lineColor: "#1e64e6",
    lineWidth: 2,
    showLabels: true,
    showFormingLeg: false,
    highLabelColor: "#ef4444",
    lowLabelColor: "#22c55e",
  },
  onSwingStructureSettingsChange: vi.fn(),
  engulfingZonesSettings: {
    lookbackBars: 500,
    maxPullbackBars: 15,
    maxActiveSetups: 40,
    bullishFillColor: "#22c55e",
    bullishBorderColor: "#16a34a",
    bearishFillColor: "#ef4444",
    bearishBorderColor: "#dc2626",
  },
  onEngulfingZonesSettingsChange: vi.fn(),
  showIndicatorMenu: true,
  onToggleIndicatorMenu: vi.fn(),
  drawingTool: "none",
  onDrawingTool: vi.fn(),
  drawings: [],
  onClearDrawings: vi.fn(),
  onToggleFullscreen: vi.fn(),
});

function InteractiveToolbar() {
  const [showIndicatorMenu, setShowIndicatorMenu] = useState(false);
  return (
    <ChartToolbar
      {...toolbarProps()}
      showIndicatorMenu={showIndicatorMenu}
      onToggleIndicatorMenu={() => setShowIndicatorMenu((visible) => !visible)}
    />
  );
}

describe("ChartToolbar", () => {
  it("updates Swing Structure settings from the indicator menu", async () => {
    const user = userEvent.setup();
    const props = toolbarProps();
    render(<ChartToolbar {...props} />);

    await user.click(screen.getByRole("button", { name: "Settings for Swing Structure" }));
    fireEvent.change(screen.getByLabelText("Lookback bars"), { target: { value: "800" } });

    expect(props.onSwingStructureSettingsChange).toHaveBeenCalledWith({ lookbackBars: 800 });
  });

  it("updates Engulfing Zones colors from its settings panel", async () => {
    const user = userEvent.setup();
    const props = toolbarProps();
    render(<ChartToolbar {...props} />);

    await user.click(screen.getByRole("button", { name: "Settings for Engulfing Zones" }));
    await user.click(screen.getByRole("button", { name: "Bearish border" }));
    fireEvent.change(screen.getByLabelText("Custom Bearish border"), { target: { value: "#123456" } });

    expect(props.onEngulfingZonesSettingsChange).toHaveBeenCalledWith({ bearishBorderColor: "#123456" });
  });

  it("toggles an active indicator from the dropdown menu", async () => {
    const user = userEvent.setup();
    const props = { ...toolbarProps(), activeIndicators: ["SWING"] as ChartToolbarProps["activeIndicators"] };
    render(<ChartToolbar {...props} />);

    await user.click(screen.getByRole("button", { name: "Indicators 1" }));
    await user.click(screen.getByRole("button", { name: "Swing Structure overlay" }));

    expect(props.onToggleIndicator).toHaveBeenCalledWith("SWING");
  });

  it("selects a drawing tool and closes its menu", async () => {
    const user = userEvent.setup();
    const props = toolbarProps();
    render(<ChartToolbar {...props} showIndicatorMenu={false} />);

    await user.click(screen.getByRole("button", { name: "Drawing tools" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Trendline" }));

    expect(props.onDrawingTool).toHaveBeenCalledWith("trendline");
    expect(screen.queryByRole("menu", { name: "Drawing tools" })).not.toBeInTheDocument();
  });

  it("exposes chart templates and fullscreen controls", async () => {
    const user = userEvent.setup();
    const props = {
      ...toolbarProps(),
      timeframe: "5m" as const,
      activePlugins: [],
      onSetIndicators: vi.fn(),
      onSetPlugins: vi.fn(),
    };
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <ChartToolbar {...props} showIndicatorMenu={false} />
      </QueryClientProvider>,
    );

    localStorage.removeItem("oc_chart_templates");
    await user.click(screen.getByRole("button", { name: "Templates" }));
    expect(screen.getByText("Layout templates")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Add template" }));
    const templateName = screen.getByPlaceholderText("Template name…");
    await user.type(templateName, "Clean chart");
    await user.keyboard("{Enter}");
    await waitFor(() => expect(localStorage.getItem("oc_chart_templates")).toContain("Clean chart"));
    expect(localStorage.getItem("oc_chart_templates")).toContain('"timeframe":"5m"');
    await waitFor(() => expect(screen.getByRole("button", { name: 'Load template "Clean chart"' })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: 'Load template "Clean chart"' }));
    expect(props.onTimeframeChange).toHaveBeenCalledWith("5m");
    expect(props.onSetIndicators).toHaveBeenCalledWith([]);
    expect(props.onSetPlugins).toHaveBeenCalledWith([]);
    await user.click(screen.getByRole("button", { name: "Fullscreen chart" }));
    expect(props.onToggleFullscreen).toHaveBeenCalledOnce();
  });

  it("dismisses open menus on Escape and outside click", async () => {
    const user = userEvent.setup();
    render(<InteractiveToolbar />);

    await user.click(screen.getByRole("button", { name: "Indicators" }));
    await user.click(screen.getByRole("button", { name: "Drawing tools" }));
    expect(screen.getByRole("menu", { name: "Drawing tools" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("group", { name: "Indicators" })).not.toBeInTheDocument());
    expect(screen.queryByRole("menu", { name: "Drawing tools" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Drawing tools" }));
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(screen.queryByRole("menu", { name: "Drawing tools" })).not.toBeInTheDocument());
  });

  it("keeps the action row unclipped so floating menus can render above the chart canvas", () => {
    render(<ChartToolbar {...toolbarProps()} />);

    const actionRow = screen.getByTestId("toolbar-actions");
    expect(actionRow.className).toContain("overflow-visible");
    expect(actionRow.className).not.toContain("overflow-x-auto");
  });

  it("anchors the drawing menu to the visible edge instead of spilling off-screen", async () => {
    const user = userEvent.setup();
    render(<ChartToolbar {...toolbarProps()} showIndicatorMenu={false} />);

    await user.click(screen.getByRole("button", { name: "Drawing tools" }));
    const menu = screen.getByRole("menu", { name: "Drawing tools" });
    expect(menu.className).toContain("right-0");
    expect(menu.className).toContain("left-auto");
  });

  it("keeps timeframes in a compact scroll window with a limited visible count", () => {
    render(<ChartToolbar {...toolbarProps()} />);

    expect(screen.queryByText("Bid")).not.toBeInTheDocument();
    expect(screen.queryByText("Ask")).not.toBeInTheDocument();
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
    expect(screen.queryByText("Spread")).not.toBeInTheDocument();
    const strip = screen.getByTestId("timeframe-strip");
    expect(strip.className).toContain("overflow-x-auto");
    expect(strip.className).toContain("max-w-[12rem]");
  });
});

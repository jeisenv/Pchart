import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ColorPalettePicker } from "@/components/ui/color-palette-picker";

describe("ColorPalettePicker", () => {
  it("shows a 7x7 palette and applies the selected color", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColorPalettePicker label="Candle color" value="#ffffff" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Candle color" }));

    const swatches = screen.getAllByRole("button", { name: /^Select #/ });
    expect(swatches).toHaveLength(49);
    const palette = screen.getByRole("dialog", { name: "Candle color palette" });
    expect(palette.parentElement).toBe(document.body);
    expect(palette.className).toContain("fixed");
    fireEvent.change(screen.getByRole("slider", { name: "Candle color opacity" }), {
      target: { value: "45" },
    });
    expect(onChange).toHaveBeenLastCalledWith("rgba(255, 255, 255, 0.45)");
    await user.click(screen.getByRole("button", { name: "Select #e60000" }));

    expect(onChange).toHaveBeenLastCalledWith("rgba(230, 0, 0, 0.45)");
    expect(screen.queryByRole("dialog", { name: "Candle color palette" })).not.toBeInTheDocument();
  });
});
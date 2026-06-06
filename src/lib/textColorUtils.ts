import {
  BOARD_TEXT_COLORS,
  DEFAULT_BOARD_TEXT_COLOR,
} from "./boardTextColors";

export function normalizeColorToHex(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    const h = v.slice(1);
    return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
  }
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;

  const rgb = v.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (rgb) {
    return (
      "#" +
      [rgb[1], rgb[2], rgb[3]]
        .map((n) => Number(n).toString(16).padStart(2, "0"))
        .join("")
    );
  }
  return null;
}

export function matchPaletteColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const hex = normalizeColorToHex(value);
  if (!hex) return null;
  const hit = BOARD_TEXT_COLORS.find(
    (c) => c.toLowerCase() === hex.toLowerCase()
  );
  return hit ?? null;
}

export function resolveBoardTextColor(color?: string): string {
  return color ?? DEFAULT_BOARD_TEXT_COLOR;
}

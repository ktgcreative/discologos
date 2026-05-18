import type { DiscoShape } from "./disco-cube";

export const CUBE_CONFIG = {
  shape: "roundedSquare" satisfies DiscoShape,
  iconScale: 0.55,
  iconRaise: 0.00999,
  iconDepth: 0.0125,
  gradientDirection: [1, -1, 0.4] satisfies [number, number, number],
};

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = h.length === 3
    ? h.split("").map((c) => c + c).join("")
    : h.padEnd(6, "0");
  return [
    parseInt(n.slice(0, 2), 16),
    parseInt(n.slice(2, 4), 16),
    parseInt(n.slice(4, 6), 16),
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return [h, s, l];
}

function hslToRgbStr(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else[r, g, b] = [c, 0, x];
  return `${Math.round((r + m) * 255)}, ${Math.round((g + m) * 255)}, ${Math.round((b + m) * 255)}`;
}

export function paletteFromTint(tint: string) {
  const [r, g, b] = hexToRgb(tint);
  const [h, sRaw] = rgbToHsl(r, g, b);
  // For near-grey tints (black/white logos) fall back to a cool blue
  // instead of violet for a more subtle, neutral gradient
  const s = sRaw < 0.15 ? 0.4 : Math.max(0.55, sRaw);
  const hue = sRaw < 0.15 ? 220 : h;
  return {
    bgStart: `rgb(${hslToRgbStr(hue, s * 0.7, 0.18)})`,
    bgEnd: `rgb(${hslToRgbStr(hue + 200, s * 0.5, 0.06)})`,
    bgFocus: `rgba(${hslToRgbStr(hue, s * 0.75, 0.5)}, 0.24)`,
    bgAccent: `rgba(${hslToRgbStr(hue + 55, s * 0.7, 0.48)}, 0.14)`,
  };
}

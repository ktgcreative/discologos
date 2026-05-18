import type { DiscoToolbarState } from "./toolbar";

export const DEFAULT_DISCO_CONTROLS: Omit<
  DiscoToolbarState,
  "tint" | "iconTint" | "iconKey"
> = {
  shape: "roundedSquare",
  density: 11,
  autoRotateSpeed: 6,
};

export const DISCO_CLOSENESS = 3.2;

export function densityToMirrorSize(density: number): number {
  const t = (density - 1) / 9;
  return 0.18 - t * 0.14;
}

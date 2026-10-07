import { clamp01 } from '../../services/math';

type RGB = readonly [number, number, number];

const hex = (value: string): RGB => {
  const n = Number.parseInt(value.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const PURPLE = hex('#bd93f9');
const CYAN = hex('#8be9fd');
const PINK = hex('#ff79c6');
const RED = hex('#ff5555');

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * The core's palette slides from calm (purple → cyan) to strained
 * (pink → red) as instability grows. Shared by the 3D core and its fallback.
 */
export function corePalette(instability: number): { inner: RGB; rim: RGB } {
  const t = clamp01(instability);
  const warm = clamp01((t - 0.15) / 0.6);
  const hot = clamp01((t - 0.55) / 0.45);
  return {
    inner: mix(PURPLE, mix(PINK, RED, hot * 0.6), warm),
    rim: mix(CYAN, mix(PINK, RED, hot), warm),
  };
}

export const rgbCss = ([r, g, b]: RGB, alpha = 1): string =>
  `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${alpha})`;

export const rgbUnit = ([r, g, b]: RGB): [number, number, number] => [r / 255, g / 255, b / 255];

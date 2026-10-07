import { hashString, mulberry32 } from '../../services/math';

/**
 * Organic geometry. Shapes are seeded, so a given area or system always has
 * the same silhouette — its identity — while no two are alike.
 */

export type Point = readonly [number, number];

const n2 = (n: number) => String(Math.round(n * 100) / 100);

/** Closed Catmull-Rom spline through the points, as cubic Béziers. */
export function closedCurve(points: readonly Point[], tension = 1): string {
  const count = points.length;
  if (count < 3) return '';
  const at = (i: number) => points[(i + count) % count];
  let d = `M${n2(at(0)[0])} ${n2(at(0)[1])}`;
  for (let i = 0; i < count; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1[0] + ((p2[0] - p0[0]) / 6) * tension;
    const c1y = p1[1] + ((p2[1] - p0[1]) / 6) * tension;
    const c2x = p2[0] - ((p3[0] - p1[0]) / 6) * tension;
    const c2y = p2[1] - ((p3[1] - p1[1]) / 6) * tension;
    d += `C${n2(c1x)} ${n2(c1y)} ${n2(c2x)} ${n2(c2y)} ${n2(p2[0])} ${n2(p2[1])}`;
  }
  return `${d}Z`;
}

/** Open Catmull-Rom spline through the points (endpoints clamped). */
export function openCurve(points: readonly Point[]): string {
  const count = points.length;
  if (count < 2) return '';
  const at = (i: number) => points[Math.max(0, Math.min(count - 1, i))];
  let d = `M${n2(at(0)[0])} ${n2(at(0)[1])}`;
  for (let i = 0; i < count - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${n2(c1x)} ${n2(c1y)} ${n2(c2x)} ${n2(c2y)} ${n2(p2[0])} ${n2(p2[1])}`;
  }
  return d;
}

export interface BlobOptions {
  cx?: number;
  cy?: number;
  radius?: number;
  points?: number;
  /** 0 = circle, 0.3 = lumpy */
  variance?: number;
  /** vertical squash (1 = round) */
  squash?: number;
}

export function blobPoints(seed: string | number, options: BlobOptions = {}): Point[] {
  const { cx = 50, cy = 50, radius = 40, points = 7, variance = 0.16, squash = 1 } = options;
  const rand = mulberry32(typeof seed === 'number' ? seed : hashString(seed));
  const offset = rand() * Math.PI * 2;
  return Array.from({ length: points }, (_, i) => {
    const angle = offset + (i / points) * Math.PI * 2 + (rand() - 0.5) * (Math.PI / points) * 0.6;
    const r = radius * (1 + (rand() - 0.5) * 2 * variance);
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r * squash] as const;
  });
}

export function blobPath(seed: string | number, options?: BlobOptions): string {
  return closedCurve(blobPoints(seed, options));
}

/** Point on a circle. 0° = 12 o'clock, clockwise. */
export function polar(cx: number, cy: number, r: number, degrees: number): Point {
  const a = ((degrees - 90) * Math.PI) / 180;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
}

/** Open arc from `start` to `end` degrees (clockwise). */
export function arcPath(cx: number, cy: number, r: number, start: number, end: number): string {
  const sweep = Math.max(0.01, Math.min(359.99, end - start));
  const [x0, y0] = polar(cx, cy, r, start);
  const [x1, y1] = polar(cx, cy, r, start + sweep);
  return `M${n2(x0)} ${n2(y0)}A${n2(r)} ${n2(r)} 0 ${sweep > 180 ? 1 : 0} 1 ${n2(x1)} ${n2(y1)}`;
}

/** A full circle as two arcs, so pathLength can draw it. */
export function circlePath(cx: number, cy: number, r: number): string {
  return `${arcPath(cx, cy, r, 0, 180)}${arcPath(cx, cy, r, 180, 359.99).replace(/^M[^A]+/, '')}`;
}

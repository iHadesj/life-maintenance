import { mulberry32, smoothstep } from '../../services/math';

/**
 * The wear line.
 *
 *   ●──────────────────◌······          fresh
 *   ●──────────── ─ ──◌                 aging: the newest stretch frays
 *   ●──── ─ ─‐ ─ ‐  ‐ ◌ ‐  · .·:        overdue: fragments shed past the ring
 *
 * Origin dot = last service. Ring = end of the cycle. The head is "now".
 * Fragmentation is a pure function of (progress, seed): the same system always
 * frays the same way, and nothing flickers between frames.
 */

export interface WearFrame {
  w: number;
  h: number;
  /** origin x */
  x0: number;
  /** pixels for one full cycle */
  cycle: number;
  /** pixels available past the ring for overdue time (asymptotic) */
  overflow: number;
  y: number;
  dot: number;
  ring: number;
  head: number;
  seg: number;
  jitter: number;
}

export const WEAR_LINE: WearFrame = {
  w: 320,
  h: 22,
  x0: 5,
  cycle: 236,
  overflow: 74,
  y: 11,
  dot: 3.1,
  ring: 4.3,
  head: 2,
  seg: 6.4,
  jitter: 4.4,
};

export const WEAR_HERO: WearFrame = {
  w: 320,
  h: 44,
  x0: 7,
  cycle: 228,
  overflow: 78,
  y: 22,
  dot: 5,
  ring: 6.6,
  head: 3,
  seg: 6,
  jitter: 8,
};

const f = (n: number) => n.toFixed(1);

export function overflowOffset(frame: WearFrame, over: number): number {
  return frame.overflow * (1 - Math.exp(-Math.max(0, over) * 1.6));
}

export function ringX(frame: WearFrame): number {
  return frame.x0 + frame.cycle;
}

export function headX(frame: WearFrame, progress: number): number {
  const p = Math.max(0, progress);
  return frame.x0 + frame.cycle * Math.min(p, 1) + (p > 1 ? overflowOffset(frame, p - 1) : 0);
}

/** Inverse of headX. */
export function progressAtX(frame: WearFrame, x: number): number {
  const rel = x - frame.x0;
  if (rel <= frame.cycle) return Math.max(0, rel / frame.cycle);
  const o = Math.min(0.995, (rel - frame.cycle) / frame.overflow);
  return 1 - Math.log(1 - o) / 1.6;
}

export interface WearPaths {
  /** Intact stretch of the line. */
  solid: string;
  /** Frayed stretch: thinner, broken, displaced. */
  worn: string;
  ahead: string;
  particles: string;
  head: number;
}

/** How worn the line is at a given point of the cycle (0 intact → 1 shredded). */
export function wearAt(t: number): number {
  return smoothstep(0.45, 1.3, t);
}

/**
 * @param noise 0..1 multiplier on fragmentation — dropped to 0 during a cycle
 *              reset so the line "discharges" before it rewinds.
 */
export function buildWear(frame: WearFrame, progress: number, seed: number, noise = 1): WearPaths {
  const p = Math.max(0, progress);
  const hx = headX(frame, p);
  const rx = ringX(frame);
  const rand = mulberry32(seed);

  let solid = '';
  let worn = '';
  let index = 0;
  for (let x = frame.x0; x < hx - 0.25; x += frame.seg, index++) {
    // Always consume three numbers per segment: segment i is identical at any progress.
    const r1 = rand();
    const r2 = rand();
    const r3 = rand();
    const x1 = Math.min(hx, x + frame.seg);
    const t = progressAtX(frame, (x + x1) / 2);
    const wear = wearAt(t) * noise;

    if (wear > 0.25 && r1 < wear * wear * 0.5) continue;
    const gap = wear * frame.seg * 0.7 * (0.3 + r2);
    const xa = x + (index === 0 ? 0 : gap * 0.5);
    const xb = x1 - gap * 0.5;
    if (xb - xa < 0.5) continue;
    const dy = wear > 0.1 ? (r3 - 0.5) * 2 * Math.pow(wear, 1.6) * frame.jitter : 0;
    const piece = `M${f(xa)} ${f(frame.y + dy)}H${f(xb)}`;
    if (wear < 0.42) solid += piece;
    else worn += piece;
  }

  const ahead = p < 0.97 ? `M${f(hx + frame.head + 3)} ${frame.y}H${f(rx - frame.ring - 2.5)}` : '';

  let particles = '';
  const shed = smoothstep(0.82, 1.6, p) * noise;
  if (shed > 0.02) {
    const prand = mulberry32(seed ^ 0x9e3779b9);
    const count = Math.round(3 + shed * 13);
    const spread = 16 + shed * 36;
    for (let i = 0; i < count; i++) {
      const a = prand();
      const b = prand();
      const c = prand();
      const px = hx - spread * a * 1.1 + 7 * b;
      const py = frame.y + (b - 0.5) * 2 * (3 + shed * frame.jitter * 1.7);
      const r = 0.5 + c * 0.9;
      particles += `M${f(px - r)} ${f(py)}a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${f(r * 2)} 0a${r.toFixed(2)} ${r.toFixed(2)} 0 1 0 ${f(-r * 2)} 0`;
    }
  }

  return { solid, worn, ahead, particles, head: hx };
}

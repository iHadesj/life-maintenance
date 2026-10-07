import { motionValue } from 'framer-motion';
import type { PageTransition, Point } from '../motion/transitions';
import type { NavState, Route } from './router';

/** Scroll position of the active page — drives the header and parallax. */
export const pageScrollY = motionValue(0);

/** 0..1 progress through the active page — drives scroll-linked indicators. */
export const pageScrollProgress = motionValue(0);

export type DiveVia = 'orbit' | 'cluster';

interface DiveRecord {
  origin: Point;
  via: DiveVia;
}

/** Where each area was entered from, so "surface" folds back into the same spot. */
const dives = new Map<string, DiveRecord>();

export function rememberDive(categoryId: string, origin: Point, via: DiveVia): void {
  dives.set(categoryId, { origin, via });
}

export function diveRecord(categoryId: string | undefined): DiveRecord | undefined {
  return categoryId ? dives.get(categoryId) : undefined;
}

export function organismLayoutId(categoryId: string, via: DiveVia): string {
  return `organism-${via}-${categoryId}`;
}

const RANK: Record<Route['name'], number> = { system: 0, category: 0.5, queue: 1, log: 2, settings: 3 };

export function computeTransition(prev: Route | null, next: Route, nav: NavState | null, reduced: boolean): PageTransition {
  if (!prev) return { kind: 'boot', dir: 1, origin: null, reduced };

  if (prev.name === 'system' && next.name === 'category') {
    const record = diveRecord(next.id);
    if (record) return { kind: 'dive', dir: 1, origin: nav?.origin ?? record.origin, reduced };
  }
  if (prev.name === 'category' && next.name === 'system') {
    const record = diveRecord(prev.id);
    if (record) return { kind: 'surface', dir: -1, origin: record.origin, reduced };
  }

  return { kind: 'scan', dir: RANK[next.name] >= RANK[prev.name] ? 1 : -1, origin: null, reduced };
}

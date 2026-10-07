import type { Criticality, MaintenanceItem } from '../db/types';
import { type CycleState, type MaintenanceStatus, worstOf } from './cycle';
import { clamp01, smoothstep } from './math';

/** How much each system weighs in aggregated health. */
export const CRITICALITY_WEIGHT: Record<Criticality, number> = {
  low: 1,
  medium: 1.5,
  high: 2.25,
  critical: 3,
};

export interface EvaluatedItem {
  item: MaintenanceItem;
  cycle: CycleState;
}

export interface HealthSummary {
  total: number;
  /** Weighted mean of item health, null when nothing is registered. */
  health: number | null;
  counts: Record<MaintenanceStatus, number>;
  /** stable + watch */
  stable: number;
  /** attention + due */
  attention: number;
  /** overdue + critical */
  overdue: number;
  worstStatus: MaintenanceStatus | null;
  /** 0–1: drives how cracked and restless the core looks. */
  instability: number;
}

export function emptyCounts(): Record<MaintenanceStatus, number> {
  return { stable: 0, watch: 0, attention: 0, due: 0, overdue: 0, critical: 0 };
}

/** 0 while comfortably inside the cycle, approaching 1 well past it. */
export function pressureFromProgress(progress: number): number {
  return smoothstep(0.55, 1.6, progress);
}

export function summarize(evaluated: readonly EvaluatedItem[]): HealthSummary {
  const counts = emptyCounts();
  let weightSum = 0;
  let healthSum = 0;
  let pressureSum = 0;
  let peak = 0;
  let worst: MaintenanceStatus | null = null;

  for (const { item, cycle } of evaluated) {
    counts[cycle.status] += 1;
    const weight = CRITICALITY_WEIGHT[item.criticality];
    weightSum += weight;
    healthSum += weight * cycle.health;
    const pressure = pressureFromProgress(cycle.cycleProgress);
    pressureSum += weight * pressure;
    // A single badly degraded critical system must be visible, but never dominate.
    peak = Math.max(peak, pressure * (0.7 + 0.1 * weight));
    worst = worstOf(worst, cycle.status);
  }

  const total = evaluated.length;
  return {
    total,
    health: total ? healthSum / weightSum : null,
    counts,
    stable: counts.stable + counts.watch,
    attention: counts.attention + counts.due,
    overdue: counts.overdue + counts.critical,
    worstStatus: worst,
    instability: total ? clamp01(0.6 * (pressureSum / weightSum) + 0.4 * peak) : 0,
  };
}

export function compareUrgency(a: EvaluatedItem, b: EvaluatedItem): number {
  return (
    b.cycle.urgency - a.cycle.urgency ||
    a.cycle.daysRemaining - b.cycle.daysRemaining ||
    a.item.title.localeCompare(b.item.title)
  );
}

export function sortByUrgency(list: readonly EvaluatedItem[]): EvaluatedItem[] {
  return [...list].sort(compareUrgency);
}

export function groupByCategory(list: readonly EvaluatedItem[]): Map<string, EvaluatedItem[]> {
  const groups = new Map<string, EvaluatedItem[]>();
  for (const entry of list) {
    const group = groups.get(entry.item.categoryId);
    if (group) group.push(entry);
    else groups.set(entry.item.categoryId, [entry]);
  }
  return groups;
}

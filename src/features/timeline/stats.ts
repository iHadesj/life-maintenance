import type { MaintenanceLog } from '../../db/types';
import { diffCalendarDays } from '../../services/dates';

export interface LogStatistics {
  total: number;
  last30: number;
  onTimeRate: number | null;
  averageDrift: number | null;
  /** Services per week, oldest first (12 weeks). */
  weeks: number[];
  top: { title: string; count: number } | null;
}

export function computeLogStats(logs: readonly MaintenanceLog[], now: Date): LogStatistics {
  const weeks = new Array<number>(12).fill(0);
  let last30 = 0;
  let planned = 0;
  let onTime = 0;
  let driftSum = 0;
  const perSystem = new Map<string, { title: string; count: number }>();

  for (const log of logs) {
    const age = diffCalendarDays(now, log.completedAt);
    if (age >= 0 && age < 30) last30 += 1;
    const week = Math.floor(age / 7);
    if (week >= 0 && week < 12) weeks[11 - week] += 1;

    if (log.intervalDays) {
      planned += 1;
      if (log.previousCycleDuration <= log.intervalDays) onTime += 1;
      driftSum += log.previousCycleDuration - log.intervalDays;
    }

    const entry = perSystem.get(log.maintenanceItemId);
    if (entry) entry.count += 1;
    else perSystem.set(log.maintenanceItemId, { title: log.itemTitle ?? 'Removed system', count: 1 });
  }

  let top: LogStatistics['top'] = null;
  for (const entry of perSystem.values()) if (!top || entry.count > top.count) top = entry;

  return {
    total: logs.length,
    last30,
    onTimeRate: planned ? onTime / planned : null,
    averageDrift: planned ? driftSum / planned : null,
    weeks,
    top,
  };
}

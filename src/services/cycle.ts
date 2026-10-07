import type { Criticality, MaintenanceItem } from '../db/types';
import { addDays, diffCalendarDays } from './dates';

/**
 * The maintenance cycle model.
 *
 * Time is measured in whole calendar days (local). Every derived number —
 * labels, status, health, geometry — comes from the same integer, so what the
 * user reads and what the interface draws can never disagree.
 */

export type MaintenanceStatus = 'stable' | 'watch' | 'attention' | 'due' | 'overdue' | 'critical';

export const STATUS_RANK: Record<MaintenanceStatus, number> = {
  stable: 0,
  watch: 1,
  attention: 2,
  due: 3,
  overdue: 4,
  critical: 5,
};

export const STATUS_LABEL: Record<MaintenanceStatus, string> = {
  stable: 'STABLE',
  watch: 'WATCH',
  attention: 'ATTENTION',
  due: 'DUE',
  overdue: 'OVERDUE',
  critical: 'CRITICAL',
};

/** Fraction of the cycle at which each pre-due state begins. */
export const CYCLE_THRESHOLDS = { watch: 0.5, attention: 0.75, due: 0.9 } as const;

/** Cycle progress at which an overdue system escalates to CRITICAL. */
export const CRITICAL_PROGRESS: Record<Criticality, number> = {
  low: 2,
  medium: 1.5,
  high: 1.25,
  critical: 1.1,
};

/** Very short cycles must not flap into CRITICAL after a single late day. */
export const CRITICAL_MIN_DAYS_OVERDUE = 2;

/** How much criticality pulls an item up the queue. */
export const URGENCY_FACTOR: Record<Criticality, number> = {
  low: 0.85,
  medium: 1,
  high: 1.15,
  critical: 1.3,
};

export const MIN_INTERVAL_DAYS = 1;
export const MAX_INTERVAL_DAYS = 3650;

export interface CycleState {
  /** Whole calendar days since the last service (never negative). */
  elapsedDays: number;
  intervalDays: number;
  /** elapsed / interval — unclamped, 1 means "due today". */
  cycleProgress: number;
  /** 0–100 condition of the system. */
  health: number;
  status: MaintenanceStatus;
  daysRemaining: number;
  daysOverdue: number;
  nextDueAt: Date;
  /** Sort key: progress weighted by criticality. */
  urgency: number;
}

export type CycleInput = Pick<MaintenanceItem, 'lastMaintenanceAt' | 'recommendedIntervalDays' | 'criticality'>;

export function normalizeInterval(days: number): number {
  if (!Number.isFinite(days)) return MIN_INTERVAL_DAYS;
  return Math.min(MAX_INTERVAL_DAYS, Math.max(MIN_INTERVAL_DAYS, Math.round(days)));
}

/**
 * Health stays high for most of the cycle, reaches 60% on the due day and then
 * decays exponentially — degraded, never instantly "dead".
 */
export function healthFromProgress(progress: number): number {
  const p = Math.max(0, progress);
  if (p <= 1) return 100 * (1 - 0.4 * p * p);
  const wear = 0.4 + 0.6 * (1 - Math.exp(-1.5 * (p - 1)));
  return 100 * (1 - wear);
}

export function statusFor(progress: number, daysOverdue: number, criticality: Criticality): MaintenanceStatus {
  if (daysOverdue > 0) {
    const escalated = progress >= CRITICAL_PROGRESS[criticality] && daysOverdue >= CRITICAL_MIN_DAYS_OVERDUE;
    return escalated ? 'critical' : 'overdue';
  }
  if (progress >= CYCLE_THRESHOLDS.due) return 'due';
  if (progress >= CYCLE_THRESHOLDS.attention) return 'attention';
  if (progress >= CYCLE_THRESHOLDS.watch) return 'watch';
  return 'stable';
}

export function evaluateCycle(item: CycleInput, now: Date): CycleState {
  const intervalDays = normalizeInterval(item.recommendedIntervalDays);
  const elapsedDays = Math.max(0, diffCalendarDays(now, item.lastMaintenanceAt));
  const cycleProgress = elapsedDays / intervalDays;
  const daysRemaining = Math.max(0, intervalDays - elapsedDays);
  const daysOverdue = Math.max(0, elapsedDays - intervalDays);

  return {
    elapsedDays,
    intervalDays,
    cycleProgress,
    health: healthFromProgress(cycleProgress),
    status: statusFor(cycleProgress, daysOverdue, item.criticality),
    daysRemaining,
    daysOverdue,
    nextDueAt: addDays(item.lastMaintenanceAt, intervalDays),
    urgency: cycleProgress * URGENCY_FACTOR[item.criticality],
  };
}

export const needsAttention = (status: MaintenanceStatus): boolean => STATUS_RANK[status] >= STATUS_RANK.attention;

export const isOverdue = (status: MaintenanceStatus): boolean => status === 'overdue' || status === 'critical';

export function worstOf(a: MaintenanceStatus | null, b: MaintenanceStatus): MaintenanceStatus {
  if (a === null) return b;
  return STATUS_RANK[b] > STATUS_RANK[a] ? b : a;
}

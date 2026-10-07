import type { Criticality } from '../db/types';
import { STATUS_LABEL, type CycleState } from './cycle';

export const CRITICALITY_LABEL: Record<Criticality, string> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
  critical: 'CRITICAL',
};

export const CRITICALITY_HINT: Record<Criticality, string> = {
  low: 'comfort or cosmetic',
  medium: 'routine upkeep',
  high: 'costly if ignored',
  critical: 'safety or data loss',
};

/** The big right-hand counter on a node: "18D", "DUE TODAY", "+10D". */
export function counterLabel(cycle: CycleState): string {
  if (cycle.daysOverdue > 0) return `+${cycle.daysOverdue}D`;
  if (cycle.daysRemaining === 0) return 'TODAY';
  return `${cycle.daysRemaining}D`;
}

export function counterCaption(cycle: CycleState): string {
  if (cycle.daysOverdue > 0) return 'overdue';
  if (cycle.daysRemaining === 0) return 'due';
  return 'left';
}

export function agoLabel(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

export function inLabel(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days}d`;
}

export function intervalHuman(days: number): string {
  if (days >= 365 && days % 365 === 0) return days === 365 ? '1 year' : `${days / 365} years`;
  if (days >= 30 && days % 30 === 0) return days === 30 ? '1 month' : `${days / 30} months`;
  if (days >= 7 && days % 7 === 0) return days === 7 ? '1 week' : `${days / 7} weeks`;
  return days === 1 ? '1 day' : `${days} days`;
}

export function durationLabel(minutes: number | undefined): string | null {
  if (!minutes) return null;
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function pct(value: number | null): string {
  return value === null ? '—' : String(Math.round(value));
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Full sentence for assistive tech — the visual never carries meaning alone. */
export function cycleSentence(cycle: CycleState): string {
  const pctText = `${Math.round(cycle.cycleProgress * 100)}% of cycle`;
  const when =
    cycle.daysOverdue > 0
      ? `overdue by ${plural(cycle.daysOverdue, 'day')}`
      : cycle.daysRemaining === 0
        ? 'due today'
        : `${plural(cycle.daysRemaining, 'day')} remaining`;
  return `${STATUS_LABEL[cycle.status].toLowerCase()}, ${pctText}, ${when}`;
}

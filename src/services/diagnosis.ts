import { isOverdue } from './cycle';
import type { EvaluatedItem, HealthSummary } from './health';

/**
 * Turns the numbers into one calm sentence. The goal is
 * "my system is healthy, but these two areas are starting to need attention" —
 * never "you have N late tasks".
 */

export type DiagnosisTone = 'empty' | 'nominal' | 'attention' | 'degraded';

export interface Diagnosis {
  tone: DiagnosisTone;
  headline: string;
  detail: string;
}

const days = (n: number): string => (n === 1 ? '1 day' : `${n} days`);

function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function areaSentence(areas: readonly string[]): string {
  if (areas.length === 1) return `${areas[0]} is starting to need attention.`;
  if (areas.length <= 3) return `${listNames(areas)} are starting to need attention.`;
  return `${areas.length} areas are starting to need attention.`;
}

/**
 * @param byUrgency evaluated items sorted by urgency, most urgent first.
 */
export function diagnose(
  byUrgency: readonly EvaluatedItem[],
  summary: HealthSummary,
  categoryName: (id: string) => string,
): Diagnosis {
  if (summary.total === 0) {
    return {
      tone: 'empty',
      headline: 'No systems registered.',
      detail: 'Register a system and Life Maintenance starts watching its cycle.',
    };
  }

  const overdue = byUrgency.filter((e) => isOverdue(e.cycle.status));
  const attention = byUrgency.filter((e) => e.cycle.status === 'attention' || e.cycle.status === 'due');
  const attentionAreas = [...new Set(attention.map((e) => categoryName(e.item.categoryId).toUpperCase()))];

  if (summary.counts.critical > 0) {
    const worst = overdue[0];
    const more = overdue.length > 1 ? ` ${overdue.length - 1} more past ${overdue.length - 1 === 1 ? 'its' : 'their'} cycle.` : '';
    return {
      tone: 'degraded',
      headline: 'Degradation detected.',
      detail: `Start with ${worst.item.title} — ${days(worst.cycle.daysOverdue)} past its cycle.${more}`,
    };
  }

  if (overdue.length > 0) {
    const first = overdue[0];
    const lead =
      overdue.length === 1
        ? `${first.item.title} is ${days(first.cycle.daysOverdue)} past its cycle.`
        : `${overdue.length} systems are past their cycle, starting with ${first.item.title}.`;
    const tail = attentionAreas.length ? ` ${areaSentence(attentionAreas)}` : ' Everything else is holding.';
    return { tone: 'attention', headline: 'System holding.', detail: lead + tail };
  }

  if (attention.length > 0) {
    return { tone: 'attention', headline: 'System healthy.', detail: areaSentence(attentionAreas) };
  }

  const next = [...byUrgency].sort((a, b) => a.cycle.daysRemaining - b.cycle.daysRemaining)[0];
  return {
    tone: 'nominal',
    headline: 'All systems nominal.',
    detail: `Next cycle: ${next.item.title} in ${days(next.cycle.daysRemaining)}.`,
  };
}

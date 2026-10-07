import { describe, expect, it } from 'vitest';
import type { Criticality, MaintenanceItem } from '../src/db/types';
import { evaluateCycle } from '../src/services/cycle';
import { addDays } from '../src/services/dates';
import { diagnose } from '../src/services/diagnosis';
import { sortByUrgency, summarize, type EvaluatedItem } from '../src/services/health';

const NOW = new Date(2026, 9, 7, 12);

function entry(id: string, categoryId: string, daysAgo: number, interval: number, criticality: Criticality = 'medium'): EvaluatedItem {
  const item: MaintenanceItem = {
    id,
    title: id,
    categoryId,
    lastMaintenanceAt: addDays(NOW, -daysAgo),
    recommendedIntervalDays: interval,
    criticality,
    createdAt: NOW,
    updatedAt: NOW,
  };
  return { item, cycle: evaluateCycle(item, NOW) };
}

const names: Record<string, string> = { digital: 'Digital', car: 'Car', house: 'House' };
const nameOf = (id: string) => names[id] ?? id;

describe('summarize', () => {
  it('returns no health for an empty system', () => {
    const s = summarize([]);
    expect(s.health).toBeNull();
    expect(s.total).toBe(0);
    expect(s.instability).toBe(0);
  });

  it('groups counts into stable / attention / overdue', () => {
    const s = summarize([
      entry('a', 'digital', 1, 30),
      entry('b', 'digital', 16, 30),
      entry('c', 'car', 24, 30),
      entry('d', 'car', 28, 30),
      entry('e', 'house', 35, 30),
      entry('f', 'house', 80, 30),
    ]);
    expect(s.stable).toBe(2);
    expect(s.attention).toBe(2);
    expect(s.overdue).toBe(2);
    expect(s.worstStatus).toBe('critical');
  });

  it('weights critical systems more heavily', () => {
    const lightIsLate = summarize([entry('ok', 'digital', 0, 30, 'critical'), entry('late', 'digital', 40, 30, 'low')]);
    const heavyIsLate = summarize([entry('ok', 'digital', 0, 30, 'low'), entry('late', 'digital', 40, 30, 'critical')]);
    expect(lightIsLate.health!).toBeGreaterThan(heavyIsLate.health!);
  });

  it('keeps instability within 0..1 and rises with degradation', () => {
    const calm = summarize([entry('a', 'digital', 1, 30), entry('b', 'car', 2, 30)]);
    const rough = summarize([entry('a', 'digital', 70, 30), entry('b', 'car', 90, 30)]);
    expect(calm.instability).toBeLessThan(0.1);
    expect(rough.instability).toBeGreaterThan(0.6);
    expect(rough.instability).toBeLessThanOrEqual(1);
  });

  it('a single overdue system does not collapse system health', () => {
    const list = [
      ...Array.from({ length: 12 }, (_, i) => entry(`ok${i}`, 'digital', 3, 30)),
      entry('late', 'house', 40, 30),
    ];
    expect(summarize(list).health!).toBeGreaterThan(85);
  });
});

describe('diagnose', () => {
  it('names the areas that are starting to need attention, most urgent first', () => {
    const list = sortByUrgency([entry('a', 'digital', 24, 30), entry('b', 'car', 25, 30), entry('c', 'house', 1, 30)]);
    const d = diagnose(list, summarize(list), nameOf);
    expect(d.headline).toBe('System healthy.');
    expect(d.detail).toBe('CAR and DIGITAL are starting to need attention.');
  });

  it('is nominal when everything is inside its cycle', () => {
    const list = sortByUrgency([entry('backup', 'digital', 2, 30), entry('filter', 'house', 1, 90)]);
    const d = diagnose(list, summarize(list), nameOf);
    expect(d.tone).toBe('nominal');
    expect(d.detail).toBe('Next cycle: backup in 28 days.');
  });

  it('points at the worst system when degraded', () => {
    const list = sortByUrgency([entry('brakes', 'car', 60, 30, 'critical'), entry('backup', 'digital', 1, 30)]);
    const d = diagnose(list, summarize(list), nameOf);
    expect(d.tone).toBe('degraded');
    expect(d.detail).toContain('Start with brakes');
  });
});

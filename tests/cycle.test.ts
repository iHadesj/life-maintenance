import { describe, expect, it } from 'vitest';
import type { Criticality } from '../src/db/types';
import { evaluateCycle, healthFromProgress, normalizeInterval } from '../src/services/cycle';
import { addDays, diffCalendarDays } from '../src/services/dates';

const NOW = new Date(2026, 9, 7, 15, 30);

function system(daysAgo: number, interval: number, criticality: Criticality = 'medium') {
  return { lastMaintenanceAt: addDays(NOW, -daysAgo), recommendedIntervalDays: interval, criticality };
}

describe('evaluateCycle', () => {
  it('backup 12 days into a 30-day cycle is at 40% and stable', () => {
    const c = evaluateCycle(system(12, 30), NOW);
    expect(c.elapsedDays).toBe(12);
    expect(c.cycleProgress).toBeCloseTo(0.4);
    expect(c.daysRemaining).toBe(18);
    expect(c.daysOverdue).toBe(0);
    expect(c.status).toBe('stable');
  });

  it('laptop cleaning 190 days into a 180-day cycle is OVERDUE +10', () => {
    const c = evaluateCycle(system(190, 180), NOW);
    expect(c.status).toBe('overdue');
    expect(c.daysOverdue).toBe(10);
    expect(c.daysRemaining).toBe(0);
  });

  it('the due day itself is DUE, not overdue', () => {
    const c = evaluateCycle(system(30, 30), NOW);
    expect(c.status).toBe('due');
    expect(c.daysRemaining).toBe(0);
    expect(c.daysOverdue).toBe(0);
  });

  it('walks through every state as the cycle ages', () => {
    const states = [0, 15, 23, 27, 31, 46].map((d) => evaluateCycle(system(d, 30), NOW).status);
    expect(states).toEqual(['stable', 'watch', 'attention', 'due', 'overdue', 'critical']);
  });

  it('criticality decides when an overdue system escalates', () => {
    const at = (c: Criticality) => evaluateCycle(system(34, 30, c), NOW).status;
    expect(at('critical')).toBe('critical');
    expect(at('high')).toBe('overdue');
    expect(at('medium')).toBe('overdue');
    expect(at('low')).toBe('overdue');
    expect(evaluateCycle(system(60, 30, 'low'), NOW).status).toBe('critical');
  });

  it('very short cycles need two late days before turning critical', () => {
    expect(evaluateCycle(system(2, 1, 'critical'), NOW).status).toBe('overdue');
    expect(evaluateCycle(system(3, 1, 'critical'), NOW).status).toBe('critical');
  });

  it('counts calendar days, not 24-hour blocks', () => {
    const lateLastNight = new Date(2026, 9, 6, 23, 50);
    const justAfterMidnight = new Date(2026, 9, 7, 0, 10);
    const c = evaluateCycle({ lastMaintenanceAt: lateLastNight, recommendedIntervalDays: 7, criticality: 'low' }, justAfterMidnight);
    expect(c.elapsedDays).toBe(1);
  });

  it('never reports negative time for dates in the future', () => {
    const c = evaluateCycle(system(-3, 30), NOW);
    expect(c.elapsedDays).toBe(0);
    expect(c.status).toBe('stable');
  });

  it('computes the next due date from the last service', () => {
    const c = evaluateCycle(system(12, 30), NOW);
    expect(diffCalendarDays(c.nextDueAt, NOW)).toBe(18);
  });

  it('weights urgency by criticality', () => {
    const low = evaluateCycle(system(20, 30, 'low'), NOW);
    const critical = evaluateCycle(system(20, 30, 'critical'), NOW);
    expect(critical.urgency).toBeGreaterThan(low.urgency);
  });
});

describe('health', () => {
  it('is 100 when fresh, 60 on the due day and keeps decaying', () => {
    expect(healthFromProgress(0)).toBe(100);
    expect(healthFromProgress(1)).toBeCloseTo(60);
    expect(healthFromProgress(1.5)).toBeLessThan(healthFromProgress(1.1));
    expect(healthFromProgress(10)).toBeGreaterThanOrEqual(0);
  });

  it('decreases monotonically with progress', () => {
    let previous = Infinity;
    for (let p = 0; p <= 3; p += 0.05) {
      const h = healthFromProgress(p);
      expect(h).toBeLessThanOrEqual(previous);
      previous = h;
    }
  });
});

describe('normalizeInterval', () => {
  it('clamps to whole days between 1 and 3650', () => {
    expect(normalizeInterval(0)).toBe(1);
    expect(normalizeInterval(29.6)).toBe(30);
    expect(normalizeInterval(99999)).toBe(3650);
    expect(normalizeInterval(Number.NaN)).toBe(1);
  });
});

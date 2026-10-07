import { describe, expect, it } from 'vitest';
import { WEAR_HERO, WEAR_LINE, buildWear, headX, progressAtX } from '../src/components/wear/geometry';

describe('wear line geometry', () => {
  it('is deterministic for a given system', () => {
    expect(buildWear(WEAR_LINE, 1.2, 42)).toEqual(buildWear(WEAR_LINE, 1.2, 42));
    expect(buildWear(WEAR_LINE, 1.2, 42).worn).not.toEqual(buildWear(WEAR_LINE, 1.2, 43).worn);
  });

  it('is clean while young: no fraying, no particles', () => {
    const young = buildWear(WEAR_LINE, 0.3, 7);
    expect(young.worn).toBe('');
    expect(young.particles).toBe('');
    expect(young.solid).not.toBe('');
    expect(young.ahead).not.toBe('');
  });

  it('frays near the end of the cycle and sheds past it', () => {
    const due = buildWear(WEAR_LINE, 0.95, 7);
    const overdue = buildWear(WEAR_LINE, 1.4, 7);
    expect(due.worn).not.toBe('');
    expect(overdue.particles).not.toBe('');
    expect(overdue.ahead).toBe('');
  });

  it('discharging the noise restores a clean line', () => {
    const calm = buildWear(WEAR_LINE, 1.4, 7, 0);
    expect(calm.worn).toBe('');
    expect(calm.particles).toBe('');
  });

  it('maps time to space and back', () => {
    for (const frame of [WEAR_LINE, WEAR_HERO]) {
      for (const p of [0, 0.25, 0.5, 1, 1.3, 2]) {
        expect(progressAtX(frame, headX(frame, p))).toBeCloseTo(p, 4);
      }
      expect(headX(frame, 5)).toBeLessThan(frame.x0 + frame.cycle + frame.overflow);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { fuzzyMatch, normalizeText } from '../src/services/search';

describe('search', () => {
  it('ignores accents and case', () => {
    expect(normalizeText('Manutenção Elétrica')).toBe('manutencao eletrica');
    expect(fuzzyMatch('manutencao', 'Manutenção do carro')).not.toBeNull();
  });

  it('prefers prefix matches over inner matches', () => {
    const prefix = fuzzyMatch('pass', 'Passport renewal')!;
    const inner = fuzzyMatch('pass', 'Compass calibration')!;
    expect(prefix.score).toBeGreaterThan(inner.score);
  });

  it('finds subsequences across words', () => {
    expect(fuzzyMatch('pwrev', 'Password review')).not.toBeNull();
    expect(fuzzyMatch('xyz', 'Password review')).toBeNull();
  });

  it('maps highlight indices back to the original string', () => {
    expect(fuzzyMatch('cao', 'Revisão')).toBeNull();
    const accented = fuzzyMatch('sao', 'Revisão')!;
    expect(accented.indices).toEqual([4, 5, 6]);
  });
});

import { describe, expect, it } from 'vitest';
import type { Category, MaintenanceItem } from '../src/db/types';
import { suggest, type PaletteContext } from '../src/features/command-palette/commands';
import { evaluateCycle } from '../src/services/cycle';
import { addDays } from '../src/services/dates';
import { sortByUrgency } from '../src/services/health';

const NOW = new Date(2026, 9, 7, 12);

function item(id: string, title: string, categoryId: string, daysAgo: number, interval: number): MaintenanceItem {
  return {
    id,
    title,
    categoryId,
    lastMaintenanceAt: addDays(NOW, -daysAgo),
    recommendedIntervalDays: interval,
    criticality: 'medium',
    createdAt: NOW,
    updatedAt: NOW,
  };
}

const items = [
  item('tire', 'Tire pressure', 'car', 34, 30),
  item('backup', 'Full backup', 'digital', 3, 30),
  item('passport', 'Passport validity', 'documents', 100, 365),
];
const categories: Category[] = [
  { id: 'digital', name: 'Digital', symbol: 'digital', color: 'violet', order: 0, builtIn: true, createdAt: NOW, updatedAt: NOW },
  { id: 'car', name: 'Car', symbol: 'car', color: 'peach', order: 1, builtIn: true, createdAt: NOW, updatedAt: NOW },
];
const ctx: PaletteContext = {
  evaluated: sortByUrgency(items.map((i) => ({ item: i, cycle: evaluateCycle(i, NOW) }))),
  categories,
  categoryName: (id) => categories.find((c) => c.id === id)?.name ?? 'Other',
};

describe('terminal grammar', () => {
  it('offers useful defaults on an empty prompt', () => {
    const { list } = suggest('', ctx);
    expect(list.map((s) => s.key)).toContain('add');
    expect(list[0].key).toBe('complete:tire');
  });

  it('fuzzy-matches verb and system together', () => {
    const { list } = suggest('comp tir', ctx);
    expect(list[0].action).toEqual({ type: 'complete', itemId: 'tire' });
  });

  it('understands aliases', () => {
    expect(suggest('done tire', ctx).list[0].action).toEqual({ type: 'complete', itemId: 'tire' });
    expect(suggest('cd dig', ctx).list[0].action).toEqual({ type: 'navigate', to: '#/c/digital' });
  });

  it('completes inline with a ghost suffix', () => {
    expect(suggest('export', ctx).ghost).toBe(' data');
    expect(suggest('open dig', ctx).ghost).toBe('ital/');
  });

  it('registers whatever follows add', () => {
    expect(suggest('add Water filter', ctx).list[0].action).toEqual({ type: 'create', title: 'Water filter' });
  });

  it('searches systems by name', () => {
    const { list } = suggest('search passport', ctx);
    expect(list[0].action).toEqual({ type: 'open-item', itemId: 'passport' });
  });

  it('falls back to search or register for unknown input', () => {
    const { list } = suggest('zzqx', ctx);
    expect(list.map((s) => s.action.type)).toEqual(['search', 'create']);
  });
});

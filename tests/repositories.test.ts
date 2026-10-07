import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../src/db/database';
import { categoriesRepository } from '../src/repositories/categories';
import { itemsRepository, type ItemDraft } from '../src/repositories/items';
import { logsRepository } from '../src/repositories/logs';
import { settingsRepository } from '../src/repositories/settings';
import { applySnapshot, readSnapshot, wipeAll } from '../src/repositories/transfer';
import { addDays } from '../src/services/dates';

const draft = (overrides: Partial<ItemDraft> = {}): ItemDraft => ({
  title: '  Backup  ',
  categoryId: 'digital',
  lastMaintenanceAt: addDays(new Date(), -40),
  recommendedIntervalDays: 30,
  criticality: 'high',
  ...overrides,
});

beforeEach(async () => {
  await db.delete();
  await db.open();
  await categoriesRepository.ensureDefaults();
});

describe('categories', () => {
  it('seeds the eight default areas once', async () => {
    await categoriesRepository.ensureDefaults();
    const list = await categoriesRepository.list();
    expect(list.map((c) => c.id)).toEqual(['digital', 'house', 'car', 'documents', 'finance', 'personal', 'equipment', 'other']);
  });

  it('creates custom areas with unique slugs', async () => {
    const a = await categoriesRepository.create({ name: 'Garden', symbol: 'leaf', color: 'mint' });
    const b = await categoriesRepository.create({ name: 'garden', symbol: 'leaf', color: 'mint' });
    expect(a.id).toBe('garden');
    expect(b.id).toBe('garden-2');
  });

  it('moves systems to OTHER when their area is removed', async () => {
    const item = await itemsRepository.create(draft({ categoryId: 'car' }));
    expect(await categoriesRepository.remove('car')).toBe(1);
    expect((await itemsRepository.get(item.id))?.categoryId).toBe('other');
    await expect(categoriesRepository.remove('other')).rejects.toThrow();
  });
});

describe('items', () => {
  it('sanitizes drafts', async () => {
    const item = await itemsRepository.create(draft({ recommendedIntervalDays: 29.7, notes: '   ' }));
    expect(item.title).toBe('Backup');
    expect(item.recommendedIntervalDays).toBe(30);
    expect('notes' in item).toBe(false);
    await expect(itemsRepository.create(draft({ title: '   ' }))).rejects.toThrow('A system needs a name.');
  });

  it('completing a service logs it and resets the cycle', async () => {
    const item = await itemsRepository.create(draft());
    const completedAt = new Date();
    const log = await itemsRepository.complete(item.id, { completedAt, note: ' swapped SSD ' });

    expect(log.previousCycleDuration).toBe(40);
    expect(log.note).toBe('swapped SSD');
    expect(log.itemTitle).toBe('Backup');
    expect((await itemsRepository.get(item.id))?.lastMaintenanceAt.getTime()).toBe(completedAt.getTime());
    expect(await logsRepository.forItem(item.id)).toHaveLength(1);
  });

  it('undo restores the previous cycle', async () => {
    const item = await itemsRepository.create(draft());
    const log = await itemsRepository.complete(item.id);
    await itemsRepository.undoComplete(log.id);
    expect((await itemsRepository.get(item.id))?.lastMaintenanceAt.getTime()).toBe(item.lastMaintenanceAt.getTime());
    expect(await logsRepository.list()).toHaveLength(0);
  });

  it('backdated services older than the cycle do not move it backwards', async () => {
    const item = await itemsRepository.create(draft({ lastMaintenanceAt: addDays(new Date(), -5) }));
    await itemsRepository.complete(item.id, { completedAt: addDays(new Date(), -20) });
    expect((await itemsRepository.get(item.id))?.lastMaintenanceAt.getTime()).toBe(item.lastMaintenanceAt.getTime());
  });

  it('removing a system keeps its history', async () => {
    const item = await itemsRepository.create(draft());
    await itemsRepository.complete(item.id);
    await itemsRepository.remove(item.id);
    const logs = await logsRepository.list();
    expect(logs).toHaveLength(1);
    expect(logs[0].itemTitle).toBe('Backup');
  });
});

describe('transfer', () => {
  it('replace restores an exact snapshot', async () => {
    const item = await itemsRepository.create(draft());
    await itemsRepository.complete(item.id);
    await settingsRepository.set('motion', 'reduced');
    const snapshot = await readSnapshot();

    await wipeAll();
    await categoriesRepository.ensureDefaults();
    const report = await applySnapshot(snapshot, 'replace');

    expect(report.items).toBe(1);
    expect(report.logs).toBe(1);
    expect((await readSnapshot()).maintenanceItems).toEqual(snapshot.maintenanceItems);
    expect((await settingsRepository.getAll()).motion).toBe('reduced');
  });

  it('merge keeps the most recently updated copy and fixes unknown areas', async () => {
    const item = await itemsRepository.create(draft());
    const older = { ...item, title: 'Old title', updatedAt: addDays(item.updatedAt, -1) };
    const orphan = { ...item, id: 'orphan', categoryId: 'does-not-exist' };
    const report = await applySnapshot(
      { categories: [], maintenanceItems: [older, orphan], maintenanceLogs: [], settings: {} },
      'merge',
    );
    expect((await itemsRepository.get(item.id))?.title).toBe('Backup');
    expect((await itemsRepository.get('orphan'))?.categoryId).toBe('other');
    expect(report.reassigned).toBe(1);
  });
});

import { db } from '../db/database';
import type { SettingKey } from '../db/types';
import type { BackupSnapshot } from '../services/backup';
import { DEFAULT_CATEGORIES, FALLBACK_CATEGORY_ID } from '../services/defaults';
import { readSettings } from './settings';

export type ImportMode = 'merge' | 'replace';

export interface ImportReport {
  categories: number;
  items: number;
  logs: number;
  /** Systems whose area did not exist and were moved to OTHER. */
  reassigned: number;
}

const ALL_TABLES = () => [db.categories, db.maintenanceItems, db.maintenanceLogs, db.settings];

export async function readSnapshot(): Promise<BackupSnapshot> {
  return db.transaction('r', ALL_TABLES(), async () => {
    const categories = await db.categories.orderBy('order').toArray();
    const maintenanceItems = await db.maintenanceItems.toArray();
    const maintenanceLogs = await db.maintenanceLogs.orderBy('completedAt').toArray();
    const settings = readSettings(await db.settings.toArray());
    return {
      categories,
      maintenanceItems,
      maintenanceLogs,
      settings: {
        motion: settings.motion,
        coreRenderer: settings.coreRenderer,
        haptics: settings.haptics,
        backupIntervalDays: settings.backupIntervalDays,
      },
    };
  });
}

/**
 * merge   — upsert by id; for systems and areas the most recently updated copy wins.
 * replace — clears systems, log and areas first. Device-only settings are kept.
 */
export async function applySnapshot(snapshot: BackupSnapshot, mode: ImportMode): Promise<ImportReport> {
  return db.transaction('rw', ALL_TABLES(), async () => {
    if (mode === 'replace') {
      await db.categories.clear();
      await db.maintenanceItems.clear();
      await db.maintenanceLogs.clear();
    }

    let categories = 0;
    for (const category of snapshot.categories) {
      const existing = mode === 'merge' ? await db.categories.get(category.id) : undefined;
      if (!existing || category.updatedAt.getTime() >= existing.updatedAt.getTime()) {
        await db.categories.put(category);
        categories += 1;
      }
    }

    if (!(await db.categories.get(FALLBACK_CATEGORY_ID))) {
      const now = new Date();
      const last = await db.categories.orderBy('order').last();
      const base = DEFAULT_CATEGORIES.find((c) => c.id === FALLBACK_CATEGORY_ID)!;
      await db.categories.add({ ...base, order: (last?.order ?? -1) + 1, builtIn: true, createdAt: now, updatedAt: now });
    }

    const known = new Set(await db.categories.toCollection().primaryKeys());
    let items = 0;
    let reassigned = 0;
    for (const incoming of snapshot.maintenanceItems) {
      let item = incoming;
      if (!known.has(item.categoryId)) {
        item = { ...item, categoryId: FALLBACK_CATEGORY_ID };
        reassigned += 1;
      }
      const existing = mode === 'merge' ? await db.maintenanceItems.get(item.id) : undefined;
      if (!existing || item.updatedAt.getTime() >= existing.updatedAt.getTime()) {
        await db.maintenanceItems.put(item);
        items += 1;
      }
    }

    await db.maintenanceLogs.bulkPut(snapshot.maintenanceLogs);

    for (const [key, value] of Object.entries(snapshot.settings)) {
      if (value !== undefined) await db.settings.put({ key: key as SettingKey, value });
    }

    return { categories, items, logs: snapshot.maintenanceLogs.length, reassigned };
  });
}

export async function wipeAll(): Promise<void> {
  await db.transaction('rw', ALL_TABLES(), async () => {
    await db.categories.clear();
    await db.maintenanceItems.clear();
    await db.maintenanceLogs.clear();
    await db.settings.clear();
  });
}

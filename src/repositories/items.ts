import { db } from '../db/database';
import type { Criticality, MaintenanceItem, MaintenanceLog } from '../db/types';
import { normalizeInterval } from '../services/cycle';
import { diffCalendarDays, isValidDate } from '../services/dates';
import { newId } from '../services/ids';

export interface ItemDraft {
  title: string;
  description?: string;
  categoryId: string;
  lastMaintenanceAt: Date;
  recommendedIntervalDays: number;
  criticality: Criticality;
  estimatedDurationMinutes?: number;
  notes?: string;
}

export interface CompleteOptions {
  completedAt?: Date;
  note?: string;
}

export const TITLE_MAX = 80;
const TEXT_MAX = 2000;
const NOTE_MAX = 500;

function cleanText(value: string | undefined, max = TEXT_MAX): string | undefined {
  const text = value?.trim();
  return text ? text.slice(0, max) : undefined;
}

function cleanDuration(value: number | undefined): number | undefined {
  return value !== undefined && Number.isFinite(value) && value > 0 ? Math.min(1440, Math.round(value)) : undefined;
}

/** Validates and normalizes user input. Throws with a human message. */
export function sanitizeDraft(draft: ItemDraft): ItemDraft {
  const title = draft.title.trim().slice(0, TITLE_MAX);
  if (!title) throw new Error('A system needs a name.');
  if (!isValidDate(draft.lastMaintenanceAt)) throw new Error('The last service date is invalid.');
  if (!draft.categoryId) throw new Error('Choose an area for this system.');
  return {
    title,
    description: cleanText(draft.description),
    categoryId: draft.categoryId,
    lastMaintenanceAt: draft.lastMaintenanceAt,
    recommendedIntervalDays: normalizeInterval(draft.recommendedIntervalDays),
    criticality: draft.criticality,
    estimatedDurationMinutes: cleanDuration(draft.estimatedDurationMinutes),
    notes: cleanText(draft.notes),
  };
}

function withoutUndefined<T extends object>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as T;
}

export const itemsRepository = {
  list: (): Promise<MaintenanceItem[]> => db.maintenanceItems.toArray(),

  get: (id: string): Promise<MaintenanceItem | undefined> => db.maintenanceItems.get(id),

  async create(draft: ItemDraft, id: string = newId()): Promise<MaintenanceItem> {
    const now = new Date();
    const item: MaintenanceItem = { ...withoutUndefined(sanitizeDraft(draft)), id, createdAt: now, updatedAt: now };
    await db.maintenanceItems.add(item);
    return item;
  },

  /** Undefined optional fields are removed from the stored record. */
  async update(id: string, draft: ItemDraft): Promise<void> {
    const clean = sanitizeDraft(draft);
    await db.maintenanceItems.update(id, { ...clean, updatedAt: new Date() });
  },

  /** Removes the system. Its log entries stay: history is never rewritten. */
  async remove(id: string): Promise<MaintenanceItem | undefined> {
    return db.transaction('rw', db.maintenanceItems, async () => {
      const item = await db.maintenanceItems.get(id);
      if (item) await db.maintenanceItems.delete(id);
      return item;
    });
  },

  async restore(item: MaintenanceItem): Promise<void> {
    await db.maintenanceItems.put(item);
  },

  /**
   * Records a service: writes the log entry and resets the cycle in one
   * transaction. Backdated services older than the current cycle are logged
   * without moving the cycle backwards.
   */
  async complete(id: string, options: CompleteOptions = {}): Promise<MaintenanceLog> {
    const completedAt = options.completedAt ?? new Date();
    return db.transaction('rw', db.maintenanceItems, db.maintenanceLogs, async () => {
      const item = await db.maintenanceItems.get(id);
      if (!item) throw new Error('System not found.');

      const log: MaintenanceLog = {
        id: newId(),
        maintenanceItemId: id,
        completedAt,
        previousCycleDuration: Math.max(0, diffCalendarDays(completedAt, item.lastMaintenanceAt)),
        itemTitle: item.title,
        categoryId: item.categoryId,
        intervalDays: item.recommendedIntervalDays,
        previousMaintenanceAt: item.lastMaintenanceAt,
      };
      const note = cleanText(options.note, NOTE_MAX);
      if (note) log.note = note;

      await db.maintenanceLogs.add(log);
      if (completedAt.getTime() >= item.lastMaintenanceAt.getTime()) {
        await db.maintenanceItems.update(id, { lastMaintenanceAt: completedAt, updatedAt: new Date() });
      }
      return log;
    });
  },

  /** Reverts a service if nothing else moved the cycle since. */
  async undoComplete(logId: string): Promise<void> {
    await db.transaction('rw', db.maintenanceItems, db.maintenanceLogs, async () => {
      const log = await db.maintenanceLogs.get(logId);
      if (!log) return;
      await db.maintenanceLogs.delete(logId);
      const item = await db.maintenanceItems.get(log.maintenanceItemId);
      if (item && log.previousMaintenanceAt && item.lastMaintenanceAt.getTime() === log.completedAt.getTime()) {
        await db.maintenanceItems.update(item.id, { lastMaintenanceAt: log.previousMaintenanceAt, updatedAt: new Date() });
      }
    });
  },
};

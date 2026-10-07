import {
  CRITICALITIES,
  IDENTITY_COLORS,
  SYMBOL_KEYS,
  type AppSettings,
  type Category,
  type MaintenanceItem,
  type MaintenanceLog,
} from '../db/types';
import { normalizeInterval } from './cycle';
import { formatISODate, isValidDate } from './dates';
import { FALLBACK_CATEGORY_ID } from './defaults';

/**
 * Backup format. Pure functions only — reading/writing IndexedDB lives in
 * repositories/transfer.ts, files and share sheets in services/dataTransfer.ts.
 */

export const BACKUP_FORMAT = 'life-maintenance/backup';
export const BACKUP_VERSION = 1;

export type PortableSettings = Pick<AppSettings, 'motion' | 'coreRenderer' | 'haptics' | 'backupIntervalDays'>;

export interface BackupSnapshot {
  categories: Category[];
  maintenanceItems: MaintenanceItem[];
  maintenanceLogs: MaintenanceLog[];
  settings: Partial<PortableSettings>;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  app: string;
  exportedAt: string;
  counts: { categories: number; maintenanceItems: number; maintenanceLogs: number };
  data: BackupSnapshot;
}

export interface ParsedBackup {
  exportedAt: Date | null;
  snapshot: BackupSnapshot;
  /** Records that failed validation and will not be imported. */
  skipped: number;
}

export type ParseResult = { ok: true; backup: ParsedBackup } | { ok: false; error: string };

export function createBackup(snapshot: BackupSnapshot, appVersion: string, now: Date = new Date()): BackupFile {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: `Life Maintenance ${appVersion}`,
    exportedAt: now.toISOString(),
    counts: {
      categories: snapshot.categories.length,
      maintenanceItems: snapshot.maintenanceItems.length,
      maintenanceLogs: snapshot.maintenanceLogs.length,
    },
    data: snapshot,
  };
}

/** Dates serialize to ISO strings through Date.prototype.toJSON. */
export function stringifyBackup(file: BackupFile): string {
  return JSON.stringify(file, null, 2);
}

export function backupFileName(now: Date = new Date()): string {
  return `life-maintenance-${formatISODate(now)}.json`;
}

// ── validation ──────────────────────────────────────────────────────────────

type UnknownRecord = Record<string, unknown>;

const isRecord = (v: unknown): v is UnknownRecord => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v.length > 0 ? v : undefined);
const optText = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
};
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const toDate = (v: unknown): Date | null => {
  if (typeof v !== 'string' && typeof v !== 'number') return null;
  const d = new Date(v);
  return isValidDate(d) ? d : null;
};
function oneOf<T extends string>(v: unknown, options: readonly T[], fallback: T): T {
  return typeof v === 'string' && (options as readonly string[]).includes(v) ? (v as T) : fallback;
}

function readCategory(v: unknown, index: number): Category | null {
  if (!isRecord(v)) return null;
  const id = str(v.id);
  const name = optText(v.name, 40);
  if (!id || !name) return null;
  const now = new Date();
  return {
    id,
    name,
    symbol: oneOf(v.symbol, SYMBOL_KEYS, 'other'),
    color: oneOf(v.color, IDENTITY_COLORS, 'ash'),
    order: num(v.order) ?? index,
    builtIn: v.builtIn === true,
    createdAt: toDate(v.createdAt) ?? now,
    updatedAt: toDate(v.updatedAt) ?? now,
  };
}

function readItem(v: unknown): MaintenanceItem | null {
  if (!isRecord(v)) return null;
  const id = str(v.id);
  const title = optText(v.title, 80);
  const last = toDate(v.lastMaintenanceAt);
  const interval = num(v.recommendedIntervalDays);
  if (!id || !title || !last || interval === undefined || interval < 1) return null;

  const item: MaintenanceItem = {
    id,
    title,
    categoryId: str(v.categoryId) ?? FALLBACK_CATEGORY_ID,
    lastMaintenanceAt: last,
    recommendedIntervalDays: normalizeInterval(interval),
    criticality: oneOf(v.criticality, CRITICALITIES, 'medium'),
    createdAt: toDate(v.createdAt) ?? last,
    updatedAt: toDate(v.updatedAt) ?? last,
  };
  const description = optText(v.description, 2000);
  const notes = optText(v.notes, 2000);
  const duration = num(v.estimatedDurationMinutes);
  if (description) item.description = description;
  if (notes) item.notes = notes;
  if (duration !== undefined && duration > 0) item.estimatedDurationMinutes = Math.min(1440, Math.round(duration));
  return item;
}

function readLog(v: unknown): MaintenanceLog | null {
  if (!isRecord(v)) return null;
  const id = str(v.id);
  const itemId = str(v.maintenanceItemId);
  const completedAt = toDate(v.completedAt);
  if (!id || !itemId || !completedAt) return null;

  const log: MaintenanceLog = {
    id,
    maintenanceItemId: itemId,
    completedAt,
    previousCycleDuration: Math.max(0, Math.round(num(v.previousCycleDuration) ?? 0)),
  };
  const note = optText(v.note, 500);
  const itemTitle = optText(v.itemTitle, 80);
  const categoryId = str(v.categoryId);
  const intervalDays = num(v.intervalDays);
  const previous = toDate(v.previousMaintenanceAt);
  if (note) log.note = note;
  if (itemTitle) log.itemTitle = itemTitle;
  if (categoryId) log.categoryId = categoryId;
  if (intervalDays !== undefined && intervalDays >= 1) log.intervalDays = normalizeInterval(intervalDays);
  if (previous) log.previousMaintenanceAt = previous;
  return log;
}

function readSettings(v: unknown): Partial<PortableSettings> {
  if (!isRecord(v)) return {};
  const out: Partial<PortableSettings> = {};
  if (v.motion === 'system' || v.motion === 'full' || v.motion === 'reduced') out.motion = v.motion;
  if (v.coreRenderer === 'auto' || v.coreRenderer === 'lite') out.coreRenderer = v.coreRenderer;
  if (typeof v.haptics === 'boolean') out.haptics = v.haptics;
  const interval = num(v.backupIntervalDays);
  if (interval !== undefined && interval >= 1) out.backupIntervalDays = normalizeInterval(interval);
  return out;
}

function collect<T>(list: unknown[], read: (v: unknown, index: number) => T | null): { valid: T[]; skipped: number } {
  const valid: T[] = [];
  let skipped = 0;
  list.forEach((entry, index) => {
    const parsed = read(entry, index);
    if (parsed) valid.push(parsed);
    else skipped += 1;
  });
  return { valid, skipped };
}

function uniqueById<T extends { id: string }>(list: T[]): T[] {
  const seen = new Map<string, T>();
  for (const entry of list) seen.set(entry.id, entry);
  return [...seen.values()];
}

export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'The file is not valid JSON.' };
  }
  if (!isRecord(raw) || raw.format !== BACKUP_FORMAT) {
    return { ok: false, error: 'This file is not a Life Maintenance backup.' };
  }
  if (typeof raw.version !== 'number' || raw.version < 1) {
    return { ok: false, error: 'The backup has no readable version.' };
  }
  if (raw.version > BACKUP_VERSION) {
    return { ok: false, error: `Backup v${raw.version} is newer than this app (v${BACKUP_VERSION}). Update first.` };
  }
  const data = raw.data;
  if (!isRecord(data)) return { ok: false, error: 'The backup has no data section.' };
  const { categories, maintenanceItems, maintenanceLogs } = data;
  if (!Array.isArray(categories) || !Array.isArray(maintenanceItems) || !Array.isArray(maintenanceLogs)) {
    return { ok: false, error: 'The backup is missing one of its tables.' };
  }

  const cats = collect(categories, readCategory);
  const items = collect(maintenanceItems, (v) => readItem(v));
  const logs = collect(maintenanceLogs, (v) => readLog(v));

  return {
    ok: true,
    backup: {
      exportedAt: toDate(raw.exportedAt),
      snapshot: {
        categories: uniqueById(cats.valid),
        maintenanceItems: uniqueById(items.valid),
        maintenanceLogs: uniqueById(logs.valid),
        settings: readSettings(data.settings),
      },
      skipped: cats.skipped + items.skipped + logs.skipped,
    },
  };
}

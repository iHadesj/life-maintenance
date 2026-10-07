import { db } from '../db/database';
import type { AppSettings, SettingKey, SettingRecord } from '../db/types';
import { isValidDate } from '../services/dates';

export const DEFAULT_SETTINGS: AppSettings = {
  motion: 'system',
  coreRenderer: 'auto',
  haptics: true,
  backupIntervalDays: 30,
  lastBackupAt: null,
  firstBootAt: null,
  introSeen: false,
  suggestionsDismissed: false,
};

const isDateOrNull = (v: unknown): boolean => v === null || isValidDate(v);

const VALIDATORS: { [K in SettingKey]: (value: unknown) => boolean } = {
  motion: (v) => v === 'system' || v === 'full' || v === 'reduced',
  coreRenderer: (v) => v === 'auto' || v === 'lite',
  haptics: (v) => typeof v === 'boolean',
  backupIntervalDays: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 1,
  lastBackupAt: isDateOrNull,
  firstBootAt: isDateOrNull,
  introSeen: (v) => typeof v === 'boolean',
  suggestionsDismissed: (v) => typeof v === 'boolean',
};

/** Merges stored rows over defaults, ignoring anything malformed. */
export function readSettings(rows: readonly SettingRecord[]): AppSettings {
  const settings: AppSettings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    const validate = VALIDATORS[row.key];
    if (validate && validate(row.value)) (settings as unknown as Record<string, unknown>)[row.key] = row.value;
  }
  return settings;
}

export const settingsRepository = {
  async getAll(): Promise<AppSettings> {
    return readSettings(await db.settings.toArray());
  },

  async set<K extends SettingKey>(key: K, value: AppSettings[K]): Promise<void> {
    await db.settings.put({ key, value });
  },
};

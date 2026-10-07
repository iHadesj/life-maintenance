/** Domain types shared by the database, repositories, services and UI. */

export type Criticality = 'low' | 'medium' | 'high' | 'critical';
export const CRITICALITIES: readonly Criticality[] = ['low', 'medium', 'high', 'critical'];

export interface MaintenanceItem {
  id: string;

  title: string;
  description?: string;

  categoryId: string;

  lastMaintenanceAt: Date;

  recommendedIntervalDays: number;

  criticality: Criticality;

  estimatedDurationMinutes?: number;

  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface MaintenanceLog {
  id: string;
  maintenanceItemId: string;

  completedAt: Date;

  note?: string;

  /** How many days the cycle that just ended actually lasted. */
  previousCycleDuration: number;

  /** Snapshots: history stays readable after a system is renamed or removed. */
  itemTitle?: string;
  categoryId?: string;
  intervalDays?: number;

  /** lastMaintenanceAt before this service — what an undo restores. */
  previousMaintenanceAt?: Date;
}

/** Soft identity hues for categories. Never used to express state. */
export type IdentityColor = 'violet' | 'rose' | 'sky' | 'mint' | 'sand' | 'peach' | 'lilac' | 'ash';
export const IDENTITY_COLORS: readonly IdentityColor[] = ['violet', 'rose', 'sky', 'mint', 'sand', 'peach', 'lilac', 'ash'];

export const SYMBOL_KEYS = [
  'digital',
  'house',
  'car',
  'documents',
  'finance',
  'personal',
  'equipment',
  'other',
  'leaf',
  'paw',
  'heart',
  'bolt',
  'drop',
  'shield',
  'cube',
  'shirt',
  'book',
  'plane',
] as const;
export type SymbolKey = (typeof SYMBOL_KEYS)[number];

export interface Category {
  id: string;
  name: string;
  symbol: SymbolKey;
  color: IdentityColor;
  order: number;
  builtIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type MotionPreference = 'system' | 'full' | 'reduced';
export type CoreRenderer = 'auto' | 'lite';

export interface AppSettings {
  motion: MotionPreference;
  coreRenderer: CoreRenderer;
  haptics: boolean;
  /** The app maintains its own data: backups have a cycle too. */
  backupIntervalDays: number;
  lastBackupAt: Date | null;
  firstBootAt: Date | null;
  introSeen: boolean;
  suggestionsDismissed: boolean;
}

export type SettingKey = keyof AppSettings;

export interface SettingRecord {
  key: SettingKey;
  value: unknown;
}

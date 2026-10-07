import type { Category, Criticality } from '../db/types';

export const FALLBACK_CATEGORY_ID = 'other';

export const DEFAULT_CATEGORIES: ReadonlyArray<Pick<Category, 'id' | 'name' | 'symbol' | 'color' | 'order'>> = [
  { id: 'digital', name: 'Digital', symbol: 'digital', color: 'violet', order: 0 },
  { id: 'house', name: 'House', symbol: 'house', color: 'sky', order: 1 },
  { id: 'car', name: 'Car', symbol: 'car', color: 'peach', order: 2 },
  { id: 'documents', name: 'Documents', symbol: 'documents', color: 'sand', order: 3 },
  { id: 'finance', name: 'Finance', symbol: 'finance', color: 'mint', order: 4 },
  { id: 'personal', name: 'Personal', symbol: 'personal', color: 'rose', order: 5 },
  { id: 'equipment', name: 'Equipment', symbol: 'equipment', color: 'lilac', order: 6 },
  { id: 'other', name: 'Other', symbol: 'other', color: 'ash', order: 7 },
];

export const INTERVAL_PRESETS: readonly number[] = [7, 14, 30, 90, 180, 365];

export const DURATION_PRESETS: readonly number[] = [5, 15, 30, 60, 120];

export interface SystemSuggestion {
  key: string;
  title: string;
  categoryId: string;
  intervalDays: number;
  criticality: Criticality;
  estimatedDurationMinutes?: number;
  description?: string;
}

/** Offered after the first system exists. Never added without the user's tap. */
export const FIRST_SUGGESTIONS: readonly SystemSuggestion[] = [
  {
    key: 'backup',
    title: 'Backup',
    categoryId: 'digital',
    intervalDays: 30,
    criticality: 'high',
    estimatedDurationMinutes: 30,
    description: 'Full backup of computer and phone.',
  },
  {
    key: 'computer-cleaning',
    title: 'Computer cleaning',
    categoryId: 'equipment',
    intervalDays: 180,
    criticality: 'medium',
    estimatedDurationMinutes: 45,
    description: 'Dust, fans, keyboard and screen.',
  },
  {
    key: 'document-review',
    title: 'Document review',
    categoryId: 'documents',
    intervalDays: 365,
    criticality: 'high',
    estimatedDurationMinutes: 60,
    description: 'IDs, passport, licenses — check what expires.',
  },
  {
    key: 'password-review',
    title: 'Password review',
    categoryId: 'digital',
    intervalDays: 180,
    criticality: 'high',
    estimatedDurationMinutes: 30,
    description: 'Rotate weak or reused passwords, check 2FA.',
  },
];

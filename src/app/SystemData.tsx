import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { AppSettings, Category, MaintenanceItem, MaintenanceLog } from '../db/types';
import { DESKTOP_QUERY, useMediaQuery } from '../hooks/useMediaQuery';
import { useNow } from '../hooks/useNow';
import { categoriesRepository } from '../repositories/categories';
import { itemsRepository } from '../repositories/items';
import { logsRepository } from '../repositories/logs';
import { DEFAULT_SETTINGS, settingsRepository } from '../repositories/settings';
import { evaluateCycle } from '../services/cycle';
import { FALLBACK_CATEGORY_ID } from '../services/defaults';
import { diagnose, type Diagnosis } from '../services/diagnosis';
import { groupByCategory, sortByUrgency, summarize, type EvaluatedItem, type HealthSummary } from '../services/health';

export interface SystemData {
  ready: boolean;
  now: Date;
  refreshNow: () => void;

  items: MaintenanceItem[];
  /** Every system with its cycle, most urgent first. */
  evaluated: EvaluatedItem[];
  byId: Map<string, EvaluatedItem>;

  categories: Category[];
  categoryById: Map<string, Category>;
  categoryOf: (categoryId: string) => Category | undefined;
  categoryName: (categoryId: string) => string;
  byCategory: Map<string, EvaluatedItem[]>;
  categorySummaries: Map<string, HealthSummary>;

  summary: HealthSummary;
  diagnosis: Diagnosis;
  logs: MaintenanceLog[];
  settings: AppSettings;

  /** Effective motion preference (settings override the OS). */
  reduced: boolean;
  desktop: boolean;
}

const SystemDataContext = createContext<SystemData | null>(null);

const EMPTY_ITEMS: MaintenanceItem[] = [];
const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_LOGS: MaintenanceLog[] = [];

export function SystemDataProvider({ children }: { children: ReactNode }) {
  const items = useLiveQuery(() => itemsRepository.list(), []);
  const categories = useLiveQuery(() => categoriesRepository.list(), []);
  const logs = useLiveQuery(() => logsRepository.list(), []);
  const settings = useLiveQuery(() => settingsRepository.getAll(), []);
  const { now, refresh } = useNow();
  const osReduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const desktop = useMediaQuery(DESKTOP_QUERY);

  const value = useMemo<SystemData>(() => {
    const list = items ?? EMPTY_ITEMS;
    const cats = categories ?? EMPTY_CATEGORIES;
    const conf = settings ?? DEFAULT_SETTINGS;

    const categoryById = new Map(cats.map((c) => [c.id, c]));
    const categoryOf = (id: string) => categoryById.get(id) ?? categoryById.get(FALLBACK_CATEGORY_ID);
    const categoryName = (id: string) => categoryOf(id)?.name ?? 'Other';

    const evaluated = sortByUrgency(list.map((item) => ({ item, cycle: evaluateCycle(item, now) })));
    const byId = new Map(evaluated.map((e) => [e.item.id, e]));

    // Systems whose area vanished are shown under OTHER.
    const normalized = evaluated.map((e) =>
      categoryById.has(e.item.categoryId) ? e : { ...e, item: { ...e.item, categoryId: FALLBACK_CATEGORY_ID } },
    );
    const byCategory = groupByCategory(normalized);
    const categorySummaries = new Map(cats.map((c) => [c.id, summarize(byCategory.get(c.id) ?? [])]));
    const summary = summarize(evaluated);

    const reduced = conf.motion === 'reduced' || (conf.motion === 'system' && osReduced);

    return {
      ready: items !== undefined && categories !== undefined && logs !== undefined && settings !== undefined,
      now,
      refreshNow: refresh,
      items: list,
      evaluated,
      byId,
      categories: cats,
      categoryById,
      categoryOf,
      categoryName,
      byCategory,
      categorySummaries,
      summary,
      diagnosis: diagnose(evaluated, summary, categoryName),
      logs: logs ?? EMPTY_LOGS,
      settings: conf,
      reduced,
      desktop,
    };
  }, [items, categories, logs, settings, now, refresh, osReduced, desktop]);

  return <SystemDataContext.Provider value={value}>{children}</SystemDataContext.Provider>;
}

export function useSystemData(): SystemData {
  const value = useContext(SystemDataContext);
  if (!value) throw new Error('useSystemData must be used inside <SystemDataProvider>.');
  return value;
}

export function useReducedMotionPref(): boolean {
  return useContext(SystemDataContext)?.reduced ?? false;
}

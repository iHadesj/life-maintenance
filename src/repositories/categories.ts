import { db } from '../db/database';
import type { Category, IdentityColor, SymbolKey } from '../db/types';
import { DEFAULT_CATEGORIES, FALLBACK_CATEGORY_ID } from '../services/defaults';
import { slugify } from '../services/ids';

export interface CategoryDraft {
  name: string;
  symbol: SymbolKey;
  color: IdentityColor;
}

export const CATEGORY_NAME_MAX = 24;

function cleanName(name: string): string {
  const clean = name.trim().replace(/\s+/g, ' ').slice(0, CATEGORY_NAME_MAX);
  if (!clean) throw new Error('An area needs a name.');
  return clean;
}

function fallbackCategory(order: number, now: Date): Category {
  const base = DEFAULT_CATEGORIES.find((c) => c.id === FALLBACK_CATEGORY_ID)!;
  return { ...base, order, builtIn: true, createdAt: now, updatedAt: now };
}

export const categoriesRepository = {
  list: (): Promise<Category[]> => db.categories.orderBy('order').toArray(),

  get: (id: string): Promise<Category | undefined> => db.categories.get(id),

  /** Seeds the eight default areas on a fresh database; always keeps OTHER. */
  async ensureDefaults(): Promise<void> {
    await db.transaction('rw', db.categories, async () => {
      const now = new Date();
      if ((await db.categories.count()) === 0) {
        await db.categories.bulkAdd(
          DEFAULT_CATEGORIES.map((c) => ({ ...c, builtIn: true, createdAt: now, updatedAt: now })),
        );
        return;
      }
      if (!(await db.categories.get(FALLBACK_CATEGORY_ID))) {
        const last = await db.categories.orderBy('order').last();
        await db.categories.add(fallbackCategory((last?.order ?? 0) + 1, now));
      }
    });
  },

  async create(draft: CategoryDraft): Promise<Category> {
    const name = cleanName(draft.name);
    return db.transaction('rw', db.categories, async () => {
      const base = slugify(name) || 'area';
      let id = base;
      for (let n = 2; await db.categories.get(id); n++) id = `${base}-${n}`;
      const last = await db.categories.orderBy('order').last();
      const now = new Date();
      const category: Category = {
        id,
        name,
        symbol: draft.symbol,
        color: draft.color,
        order: (last?.order ?? -1) + 1,
        builtIn: false,
        createdAt: now,
        updatedAt: now,
      };
      await db.categories.add(category);
      return category;
    });
  },

  async update(id: string, draft: CategoryDraft): Promise<void> {
    await db.categories.update(id, {
      name: cleanName(draft.name),
      symbol: draft.symbol,
      color: draft.color,
      updatedAt: new Date(),
    });
  },

  /** Deletes an area; its systems move to OTHER. Returns how many moved. */
  async remove(id: string): Promise<number> {
    if (id === FALLBACK_CATEGORY_ID) throw new Error('OTHER is the fallback area and cannot be removed.');
    return db.transaction('rw', db.categories, db.maintenanceItems, async () => {
      const moved = await db.maintenanceItems
        .where('categoryId')
        .equals(id)
        .modify({ categoryId: FALLBACK_CATEGORY_ID, updatedAt: new Date() });
      await db.categories.delete(id);
      return moved;
    });
  },

  async move(id: string, direction: -1 | 1): Promise<void> {
    await db.transaction('rw', db.categories, async () => {
      const list = await db.categories.orderBy('order').toArray();
      const from = list.findIndex((c) => c.id === id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= list.length) return;
      [list[from], list[to]] = [list[to], list[from]];
      for (let index = 0; index < list.length; index++) {
        if (list[index].order !== index) await db.categories.update(list[index].id, { order: index });
      }
    });
  },
};

import Dexie, { type EntityTable } from 'dexie';
import type { Category, MaintenanceItem, MaintenanceLog, SettingRecord } from './types';

export const DATABASE_NAME = 'life-maintenance';

/**
 * IndexedDB is the source of truth. Nothing here is UI-aware:
 * screens read through live queries and write through repositories.
 */
export class LifeMaintenanceDatabase extends Dexie {
  declare maintenanceItems: EntityTable<MaintenanceItem, 'id'>;
  declare maintenanceLogs: EntityTable<MaintenanceLog, 'id'>;
  declare categories: EntityTable<Category, 'id'>;
  declare settings: EntityTable<SettingRecord, 'key'>;

  constructor(name: string = DATABASE_NAME) {
    super(name);
    this.version(1).stores({
      maintenanceItems: 'id, categoryId, lastMaintenanceAt, updatedAt',
      maintenanceLogs: 'id, maintenanceItemId, completedAt',
      categories: 'id, order',
      settings: 'key',
    });
  }
}

export const db = new LifeMaintenanceDatabase();

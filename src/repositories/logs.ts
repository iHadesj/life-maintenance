import { db } from '../db/database';
import type { MaintenanceLog } from '../db/types';

export const logsRepository = {
  /** Newest first. */
  list: (): Promise<MaintenanceLog[]> => db.maintenanceLogs.orderBy('completedAt').reverse().toArray(),

  /** Newest first. */
  forItem: (itemId: string): Promise<MaintenanceLog[]> =>
    db.maintenanceLogs.where('maintenanceItemId').equals(itemId).reverse().sortBy('completedAt'),

  remove: (id: string): Promise<void> => db.maintenanceLogs.delete(id),
};

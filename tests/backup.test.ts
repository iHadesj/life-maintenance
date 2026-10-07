import { describe, expect, it } from 'vitest';
import type { Category, MaintenanceItem, MaintenanceLog } from '../src/db/types';
import { BACKUP_FORMAT, createBackup, parseBackup, stringifyBackup, type BackupSnapshot } from '../src/services/backup';

const T = new Date('2026-10-01T10:00:00.000Z');

const category: Category = {
  id: 'digital',
  name: 'Digital',
  symbol: 'digital',
  color: 'violet',
  order: 0,
  builtIn: true,
  createdAt: T,
  updatedAt: T,
};

const item: MaintenanceItem = {
  id: 'i1',
  title: 'Backup completo',
  categoryId: 'digital',
  lastMaintenanceAt: new Date('2026-09-25T12:00:00.000Z'),
  recommendedIntervalDays: 30,
  criticality: 'high',
  estimatedDurationMinutes: 20,
  notes: 'External SSD + cloud',
  createdAt: T,
  updatedAt: T,
};

const log: MaintenanceLog = {
  id: 'l1',
  maintenanceItemId: 'i1',
  completedAt: new Date('2026-09-25T12:00:00.000Z'),
  previousCycleDuration: 31,
  note: 'took longer than usual',
  itemTitle: 'Backup completo',
  categoryId: 'digital',
  intervalDays: 30,
  previousMaintenanceAt: new Date('2026-08-25T12:00:00.000Z'),
};

const snapshot: BackupSnapshot = {
  categories: [category],
  maintenanceItems: [item],
  maintenanceLogs: [log],
  settings: { motion: 'reduced', haptics: false },
};

describe('backup round trip', () => {
  it('restores every record with real Date objects', () => {
    const text = stringifyBackup(createBackup(snapshot, '1.0.0', T));
    const result = parseBackup(text);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.skipped).toBe(0);
    expect(result.backup.exportedAt?.toISOString()).toBe(T.toISOString());
    expect(result.backup.snapshot).toEqual(snapshot);
    expect(result.backup.snapshot.maintenanceItems[0].lastMaintenanceAt).toBeInstanceOf(Date);
  });
});

describe('parseBackup', () => {
  it('rejects invalid JSON', () => {
    expect(parseBackup('{nope').ok).toBe(false);
  });

  it('rejects files from other apps', () => {
    const result = parseBackup(JSON.stringify({ format: 'something-else', version: 1, data: {} }));
    expect(result).toEqual({ ok: false, error: 'This file is not a Life Maintenance backup.' });
  });

  it('rejects backups from a newer version', () => {
    const result = parseBackup(JSON.stringify({ format: BACKUP_FORMAT, version: 99, data: {} }));
    expect(result.ok).toBe(false);
  });

  it('skips malformed records but keeps the valid ones', () => {
    const file = createBackup(snapshot, '1.0.0', T);
    const tampered = JSON.parse(stringifyBackup(file));
    tampered.data.maintenanceItems.push({ id: 'bad', title: '', lastMaintenanceAt: 'yesterday' });
    tampered.data.maintenanceLogs.push({ id: 'bad-log' });
    const result = parseBackup(JSON.stringify(tampered));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.skipped).toBe(2);
    expect(result.backup.snapshot.maintenanceItems).toHaveLength(1);
  });

  it('normalizes unknown enum values instead of failing', () => {
    const file = JSON.parse(stringifyBackup(createBackup(snapshot, '1.0.0', T)));
    file.data.maintenanceItems[0].criticality = 'apocalyptic';
    file.data.categories[0].symbol = 'unicorn';
    const result = parseBackup(JSON.stringify(file));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.backup.snapshot.maintenanceItems[0].criticality).toBe('medium');
    expect(result.backup.snapshot.categories[0].symbol).toBe('other');
  });
});

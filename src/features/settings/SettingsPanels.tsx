import { useEffect, useState, type ReactNode } from 'react';
import { openOverlay } from '../../app/router';
import { useSystemData } from '../../app/SystemData';
import { uiActions } from '../../app/ui';
import { Choice } from '../../components/Choice';
import { HoldButton } from '../../components/HoldButton';
import { CycleIndicator } from '../../components/wear/CycleIndicator';
import type { CoreRenderer, MotionPreference } from '../../db/types';
import { categoriesRepository } from '../../repositories/categories';
import { settingsRepository } from '../../repositories/settings';
import { wipeAll } from '../../repositories/transfer';
import { evaluateCycle } from '../../services/cycle';
import { APP_VERSION } from '../../services/dataTransfer';
import { formatISODate } from '../../services/dates';
import { agoLabel, plural } from '../../services/format';
import { haptic } from '../../services/haptics';
import { isIOS, isStandalone, requestPersistentStorage, storageStatus, webglAvailable } from '../../services/platform';
import { CategoryOrganism } from '../categories/CategoryOrganism';
import { errorMessage } from '../maintenance/actions';
import { pickAndImport, runExport } from './transferActions';
import s from './Settings.module.css';

export function ConfigSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={s.section} aria-label={title}>
      <h2 className={s.sectionTitle}>
        <span className={s.hash}>#</span> {title}
        <span className={s.rule} aria-hidden="true" />
      </h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={s.row}>
      <span className={s.rowLabel}>{label}</span>
      <div className={s.rowValue}>{children}</div>
    </div>
  );
}

/** The app maintains itself too: backups have a cycle and a wear line. */
export function BackupPanel() {
  const { settings, now, items } = useSystemData();
  const last = settings.lastBackupAt;
  const reference = last ?? settings.firstBootAt ?? now;
  const cycle = evaluateCycle(
    { lastMaintenanceAt: reference, recommendedIntervalDays: settings.backupIntervalDays, criticality: 'high' },
    now,
  );
  const status = items.length === 0 ? 'stable' : last ? cycle.status : cycle.status === 'stable' ? 'watch' : cycle.status;

  return (
    <ConfigSection title="backup">
      <div className={s.backupLine}>
        <CycleIndicator progress={items.length === 0 ? 0 : cycle.cycleProgress} status={status} seed="backup-cycle" grow />
        <p className={s.muted}>
          {last ? `last backup ${agoLabel(cycle.elapsedDays)} · ${formatISODate(last)}` : 'no backup yet'} · cycle{' '}
          {settings.backupIntervalDays}d
        </p>
      </div>
      <div className={s.actions}>
        <button type="button" className={s.primary} onClick={() => void runExport()}>
          export json
        </button>
        <button type="button" className={s.ghost} onClick={() => void pickAndImport()}>
          import json
        </button>
      </div>
      <p className={s.note}>
        Everything lives on this device, in IndexedDB. No account, no server — the export is your only copy elsewhere.
      </p>
    </ConfigSection>
  );
}

export function AreasPanel() {
  const { categories, categorySummaries, byCategory } = useSystemData();
  const move = async (id: string, direction: -1 | 1) => {
    haptic('tick');
    await categoriesRepository.move(id, direction);
  };
  return (
    <ConfigSection title="areas">
      <ul className={s.areas}>
        {categories.map((category, index) => (
          <li key={category.id} className={s.area} data-identity={category.color}>
            <CategoryOrganism category={category} summary={categorySummaries.get(category.id)} size={34} />
            <button type="button" className={s.areaName} onClick={() => openOverlay({ area: category.id })}>
              {category.name.toUpperCase()}
              <span className="slash">/</span>
              <span className={s.areaCount}>{plural(byCategory.get(category.id)?.length ?? 0, 'system')}</span>
            </button>
            <span className={s.reorder}>
              <button type="button" onClick={() => void move(category.id, -1)} disabled={index === 0} aria-label={`Move ${category.name} up`}>
                ↑
              </button>
              <button
                type="button"
                onClick={() => void move(category.id, 1)}
                disabled={index === categories.length - 1}
                aria-label={`Move ${category.name} down`}
              >
                ↓
              </button>
            </span>
          </li>
        ))}
      </ul>
      <button type="button" className={s.add} onClick={() => openOverlay({ area: 'new' })}>
        + new area
      </button>
    </ConfigSection>
  );
}

export function PreferencesPanel() {
  const { settings } = useSystemData();
  const [webgl] = useState(() => webglAvailable());
  return (
    <ConfigSection title="motion & feel">
      <Row label="motion">
        <Choice<MotionPreference>
          label="Motion"
          value={settings.motion}
          onChange={(value) => void settingsRepository.set('motion', value)}
          options={[
            { value: 'system', label: 'system' },
            { value: 'full', label: 'full' },
            { value: 'reduced', label: 'reduced' },
          ]}
        />
      </Row>
      <Row label="core">
        <Choice<CoreRenderer>
          label="System core renderer"
          value={settings.coreRenderer}
          onChange={(value) => void settingsRepository.set('coreRenderer', value)}
          options={[
            { value: 'auto', label: webgl ? '3d' : '3d · n/a' },
            { value: 'lite', label: 'lite' },
          ]}
        />
      </Row>
      <Row label="haptics">
        <Choice
          label="Haptic feedback"
          value={settings.haptics ? 'on' : 'off'}
          onChange={(value) => void settingsRepository.set('haptics', value === 'on')}
          options={[
            { value: 'on', label: 'on' },
            { value: 'off', label: 'off' },
          ]}
        />
      </Row>
      <p className={s.note}>
        The 3D core only runs on SYSTEM and pauses whenever it is off screen. Reduced motion freezes ambient movement; every
        state stays readable as shape and text.
      </p>
    </ConfigSection>
  );
}

const formatBytes = (bytes: number | null) =>
  bytes === null ? 'unknown' : bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function StoragePanel() {
  const [status, setStatus] = useState<Awaited<ReturnType<typeof storageStatus>> | null>(null);
  const refresh = () => void storageStatus().then(setStatus);
  useEffect(refresh, []);
  const standalone = isStandalone();

  return (
    <ConfigSection title="storage">
      <Row label="persistence">
        {status?.persisted ? (
          <span className={s.ok}>granted</span>
        ) : (
          <button
            type="button"
            className={s.inline}
            onClick={() =>
              void requestPersistentStorage().then((granted) => {
                refresh();
                uiActions.toast({
                  tone: granted ? 'ok' : 'info',
                  title: granted ? 'STORAGE PERSISTENT' : 'BEST-EFFORT STORAGE',
                  detail: granted ? 'the browser will not evict your data' : 'install the app to keep data safe',
                });
              })
            }
          >
            {status?.persisted === false ? 'best-effort · request' : 'request'}
          </button>
        )}
      </Row>
      <Row label="usage">
        <span>
          {formatBytes(status?.usage ?? null)}
          {status?.quota ? ` of ${formatBytes(status.quota)}` : ''}
        </span>
      </Row>
      <Row label="install">
        <span>{standalone ? <span className={s.ok}>standalone app</span> : 'running in the browser'}</span>
      </Row>
      {!standalone && isIOS() && (
        <p className={s.note}>On iPhone: Share → Add to Home Screen. Installed, it runs full-screen, offline, and its data is not evicted.</p>
      )}
    </ConfigSection>
  );
}

export function SystemPanel() {
  const offline = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && Boolean(navigator.serviceWorker.controller);

  const replayIntro = async () => {
    await settingsRepository.set('introSeen', false);
    window.location.reload();
  };

  const wipe = async () => {
    try {
      await wipeAll();
      await categoriesRepository.ensureDefaults();
      uiActions.toast({ tone: 'info', title: 'SYSTEM WIPED', detail: 'rebooting…' });
      window.setTimeout(() => {
        window.location.hash = '#/';
        window.location.reload();
      }, 700);
    } catch (error) {
      uiActions.toast({ tone: 'warn', title: 'WIPE FAILED', detail: errorMessage(error) });
    }
  };

  return (
    <ConfigSection title="system">
      <Row label="version">
        <span>
          {APP_VERSION} · {__BUILD_DATE__}
        </span>
      </Row>
      <Row label="offline">
        <span className={offline ? s.ok : undefined}>{offline ? 'cached · works offline' : 'caching on first install'}</span>
      </Row>
      <div className={s.actions}>
        <button type="button" className={s.ghost} onClick={() => void replayIntro()}>
          replay intro
        </button>
        <HoldButton label="wipe all data" holdingLabel="wiping…" ms={1600} onConfirm={() => void wipe()} />
      </div>
    </ConfigSection>
  );
}

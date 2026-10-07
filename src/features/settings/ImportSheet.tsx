import { AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import { uiActions, useUI } from '../../app/ui';
import { Choice } from '../../components/Choice';
import { HoldButton } from '../../components/HoldButton';
import { Sheet } from '../../components/Sheet';
import type { ImportMode } from '../../repositories/transfer';
import type { ParseResult } from '../../services/backup';
import { importBackup, readBackupFile } from '../../services/dataTransfer';
import { formatISODate } from '../../services/dates';
import { plural } from '../../services/format';
import { haptic } from '../../services/haptics';
import { errorMessage } from '../maintenance/actions';
import s from './Settings.module.css';

function ImportPanel({ file }: { file: File }) {
  const [result, setResult] = useState<ParseResult | null>(null);
  const [mode, setMode] = useState<ImportMode>('merge');
  const [busy, setBusy] = useState(false);
  const close = () => uiActions.endImport();

  useEffect(() => {
    let alive = true;
    readBackupFile(file)
      .then((parsed) => alive && setResult(parsed))
      .catch((error) => alive && setResult({ ok: false, error: errorMessage(error) }));
    return () => {
      alive = false;
    };
  }, [file]);

  const apply = async () => {
    if (!result?.ok || busy) return;
    setBusy(true);
    try {
      const report = await importBackup(result.backup, mode);
      haptic('success');
      uiActions.toast({
        tone: 'ok',
        title: 'IMPORT COMPLETE',
        detail: `${plural(report.items, 'system')} · ${plural(report.logs, 'log entry', 'log entries')}${report.reassigned ? ` · ${report.reassigned} moved to OTHER/` : ''}`,
      });
      close();
    } catch (error) {
      setBusy(false);
      haptic('warn');
      uiActions.toast({ tone: 'warn', title: 'IMPORT FAILED', detail: errorMessage(error) });
    }
  };

  const snapshot = result?.ok ? result.backup.snapshot : null;

  return (
    <Sheet
      label="Import backup"
      onClose={close}
      seed="import-sheet"
      header={
        <>
          <span className={s.sheetHeading}>
            <span className="slash">&gt;</span> import data
          </span>
          <button type="button" className={s.sheetCancel} onClick={close}>
            cancel
          </button>
        </>
      }
    >
      <div className={s.importBody}>
        <p className={s.fileName}>{file.name}</p>
        {!result && <p className={s.muted}>reading backup…</p>}
        {result && !result.ok && (
          <p className={s.error} role="alert">
            ! {result.error}
          </p>
        )}
        {result?.ok && snapshot && (
          <>
            <dl className={s.kv}>
              <div>
                <dt>exported</dt>
                <dd>{result.backup.exportedAt ? formatISODate(result.backup.exportedAt) : 'unknown'}</dd>
              </div>
              <div>
                <dt>systems</dt>
                <dd>{snapshot.maintenanceItems.length}</dd>
              </div>
              <div>
                <dt>log entries</dt>
                <dd>{snapshot.maintenanceLogs.length}</dd>
              </div>
              <div>
                <dt>areas</dt>
                <dd>{snapshot.categories.length}</dd>
              </div>
              {result.backup.skipped > 0 && (
                <div>
                  <dt>invalid</dt>
                  <dd className={s.warnText}>{plural(result.backup.skipped, 'record')} will be skipped</dd>
                </div>
              )}
            </dl>

            <Choice
              label="Import mode"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'merge', label: 'merge' },
                { value: 'replace', label: 'replace' },
              ]}
            />
            <p className={s.muted}>
              {mode === 'merge'
                ? 'Adds what is new and updates what changed. Nothing on this device is deleted.'
                : 'Replaces every system, log entry and area on this device with the backup.'}
            </p>

            {mode === 'merge' ? (
              <button type="button" className={s.primary} onClick={() => void apply()} disabled={busy}>
                merge backup
              </button>
            ) : (
              <HoldButton label="replace everything" holdingLabel="replacing…" onConfirm={() => void apply()} disabled={busy} />
            )}
          </>
        )}
      </div>
    </Sheet>
  );
}

export function ImportSheet() {
  const file = useUI((state) => state.importFile);
  return <AnimatePresence>{file && <ImportPanel key={`${file.name}-${file.lastModified}`} file={file} />}</AnimatePresence>;
}

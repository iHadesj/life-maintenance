import { uiActions } from '../../app/ui';
import { exportBackup, pickBackupFile, TransferCancelled } from '../../services/dataTransfer';
import { haptic } from '../../services/haptics';
import { errorMessage } from '../maintenance/actions';

export async function runExport(): Promise<void> {
  try {
    const { fileName, via } = await exportBackup();
    haptic('success');
    uiActions.toast({ tone: 'ok', title: 'BACKUP EXPORTED', detail: via === 'share' ? `${fileName} · shared` : fileName });
  } catch (error) {
    if (error instanceof TransferCancelled) return;
    haptic('warn');
    uiActions.toast({ tone: 'warn', title: 'EXPORT FAILED', detail: errorMessage(error) });
  }
}

/** Call from a tap or keypress handler: the picker opens synchronously. */
export async function pickAndImport(): Promise<void> {
  const file = await pickBackupFile();
  if (file) uiActions.startImport(file);
}

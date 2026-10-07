import { settingsRepository } from '../repositories/settings';
import { applySnapshot, readSnapshot, type ImportMode, type ImportReport } from '../repositories/transfer';
import { backupFileName, createBackup, parseBackup, stringifyBackup, type ParsedBackup, type ParseResult } from './backup';
import { isIOS } from './platform';

export const APP_VERSION: string = __APP_VERSION__;

export class TransferCancelled extends Error {
  constructor() {
    super('cancelled');
  }
}

function download(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/**
 * Exports everything as JSON. On iOS the share sheet is the only reliable way
 * for a standalone PWA to hand a file to Files/AirDrop; elsewhere we download.
 */
export async function exportBackup(): Promise<{ fileName: string; via: 'share' | 'download' }> {
  const snapshot = await readSnapshot();
  const text = stringifyBackup(createBackup(snapshot, APP_VERSION));
  const fileName = backupFileName();
  const blob = new Blob([text], { type: 'application/json' });

  let via: 'share' | 'download' = 'download';
  const file = typeof File === 'function' ? new File([blob], fileName, { type: 'application/json' }) : null;
  if (isIOS() && file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Life Maintenance backup' });
      via = 'share';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw new TransferCancelled();
      download(blob, fileName);
    }
  } else {
    download(blob, fileName);
  }

  await settingsRepository.set('lastBackupAt', new Date());
  return { fileName, via };
}

/**
 * Opens the system file picker. Must be called synchronously inside a user
 * gesture (tap, click, Enter) or browsers will refuse to show it.
 */
export function pickBackupFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    const done = (file: File | null) => {
      input.remove();
      resolve(file);
    };
    input.addEventListener('change', () => done(input.files?.[0] ?? null), { once: true });
    input.addEventListener('cancel', () => done(null), { once: true });
    document.body.appendChild(input);
    input.click();
  });
}

export async function readBackupFile(file: File): Promise<ParseResult> {
  if (file.size > 25 * 1024 * 1024) return { ok: false, error: 'The file is too large to be a backup.' };
  return parseBackup(await file.text());
}

export function importBackup(backup: ParsedBackup, mode: ImportMode): Promise<ImportReport> {
  return applySnapshot(backup.snapshot, mode);
}

import type { MaintenanceStatus } from '../services/cycle';
import { createStore, useStore } from './store';

/** Transient interface state: never persisted, never in the URL. */

export type ToastTone = 'ok' | 'info' | 'warn';

export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  detail?: string;
  action?: { label: string; run: () => void };
  ttl: number;
}

export interface HudState {
  itemId: string;
  x: number;
  y: number;
}

export type BootPhase = 'running' | 'done';

export interface ServicedMark {
  at: number;
  /** Status before the service: lists keep the system in place while it resets. */
  prevStatus: MaintenanceStatus;
}

interface UIState {
  paletteOpen: boolean;
  paletteSeed: string;
  toasts: Toast[];
  hud: HudState | null;
  /** Incremented to request a SYSTEM CHECK sweep. */
  checkSeq: number;
  boot: BootPhase;
  /** Systems serviced in the last moments, for choreography. */
  serviced: Record<string, ServicedMark>;
  /** Last system registered: its area pulses to receive it. */
  ingested: { itemId: string; categoryId: string; at: number } | null;
  /** A backup file waiting for the user to review and import. */
  importFile: File | null;
  /** Text for the polite live region. */
  announcement: string;
}

export const ui = createStore<UIState>({
  paletteOpen: false,
  paletteSeed: '',
  toasts: [],
  hud: null,
  checkSeq: 0,
  boot: 'running',
  serviced: {},
  ingested: null,
  importFile: null,
  announcement: '',
});

export function useUI<S>(selector: (state: UIState) => S): S {
  return useStore(ui, selector);
}

let toastSeq = 0;
const SERVICED_WINDOW_MS = 1600;

export const uiActions = {
  openPalette(seed = ''): void {
    // iOS only raises the keyboard for focus that happens inside the user's
    // gesture: focus a proxy input now, the palette input takes over on mount.
    document.getElementById('lm-focus-proxy')?.focus({ preventScroll: true });
    ui.set({ paletteOpen: true, paletteSeed: seed, hud: null });
  },
  togglePalette(): void {
    if (ui.get().paletteOpen) uiActions.closePalette();
    else uiActions.openPalette();
  },
  closePalette(): void {
    ui.set({ paletteOpen: false, paletteSeed: '' });
  },
  toast(input: Omit<Toast, 'id' | 'ttl'> & { ttl?: number }): number {
    const id = ++toastSeq;
    const toast: Toast = { ttl: input.action ? 6000 : 3800, ...input, id };
    ui.set((s) => ({ toasts: [...s.toasts.slice(-2), toast] }));
    uiActions.announce(toast.detail ? `${toast.title}. ${toast.detail}` : toast.title);
    return id;
  },
  dismissToast(id: number): void {
    ui.set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
  showHud(hud: HudState): void {
    ui.set({ hud });
  },
  hideHud(): void {
    if (ui.get().hud) ui.set({ hud: null });
  },
  requestCheck(): void {
    ui.set((s) => ({ checkSeq: s.checkSeq + 1 }));
  },
  setBoot(boot: BootPhase): void {
    ui.set({ boot });
  },
  markServiced(itemId: string, prevStatus: MaintenanceStatus): void {
    ui.set((s) => ({ serviced: { ...s.serviced, [itemId]: { at: Date.now(), prevStatus } } }));
    window.setTimeout(() => {
      ui.set((s) => {
        const mark = s.serviced[itemId];
        if (!mark || Date.now() - mark.at < SERVICED_WINDOW_MS - 50) return {};
        const next = { ...s.serviced };
        delete next[itemId];
        return { serviced: next };
      });
    }, SERVICED_WINDOW_MS);
  },
  markIngested(itemId: string, categoryId: string): void {
    ui.set({ ingested: { itemId, categoryId, at: Date.now() } });
  },
  startImport(file: File): void {
    ui.set({ importFile: file, paletteOpen: false });
  },
  endImport(): void {
    ui.set({ importFile: null });
  },
  announce(message: string): void {
    // Toggle through an empty string so repeated messages are re-announced.
    ui.set({ announcement: '' });
    window.setTimeout(() => ui.set({ announcement: message }), 30);
  },
};

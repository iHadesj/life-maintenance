import { useEffect } from 'react';
import { categoriesRepository } from '../repositories/categories';
import { settingsRepository } from '../repositories/settings';
import { setHapticsEnabled } from '../services/haptics';
import { maintenanceActions } from '../features/maintenance/actions';
import type { SystemData } from './SystemData';
import { uiActions, ui } from './ui';

/** One-time setup and settings that live outside React (html attributes, haptics). */
export function useBootstrap(data: SystemData): void {
  useEffect(() => {
    void categoriesRepository.ensureDefaults();
  }, []);

  useEffect(() => {
    if (data.ready && !data.settings.firstBootAt) void settingsRepository.set('firstBootAt', new Date());
  }, [data.ready, data.settings.firstBootAt]);

  useEffect(() => {
    document.documentElement.dataset.motion = data.settings.motion;
  }, [data.settings.motion]);

  useEffect(() => {
    setHapticsEnabled(data.settings.haptics);
  }, [data.settings.haptics]);
}

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/** ⌘K / Ctrl+K terminal · "/" search · "n" new system. */
export function useKeyboardShortcuts(): void {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        uiActions.togglePalette();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (ui.get().paletteOpen || document.querySelector('[role="dialog"]')) return;
      if (event.key === '/') {
        event.preventDefault();
        uiActions.openPalette('search ');
      } else if (event.key === 'n') {
        event.preventDefault();
        maintenanceActions.create();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

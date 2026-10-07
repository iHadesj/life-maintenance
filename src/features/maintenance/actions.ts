import { closeAllOverlays, openOverlay } from '../../app/router';
import { uiActions } from '../../app/ui';
import type { MaintenanceItem } from '../../db/types';
import { itemsRepository, type CompleteOptions } from '../../repositories/items';
import type { MaintenanceStatus } from '../../services/cycle';
import { diffCalendarDays } from '../../services/dates';
import { intervalHuman } from '../../services/format';
import { haptic } from '../../services/haptics';

export const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : 'Something went wrong.');

/** Every user-facing maintenance action, shared by gestures, sheets and the terminal. */
export const maintenanceActions = {
  async service(item: MaintenanceItem, status: MaintenanceStatus, options: CompleteOptions = {}) {
    try {
      uiActions.markServiced(item.id, status);
      const log = await itemsRepository.complete(item.id, options);
      haptic('success');
      const backdated = options.completedAt ? diffCalendarDays(new Date(), options.completedAt) : 0;
      uiActions.toast({
        tone: 'ok',
        title: backdated > 0 ? `SERVICE LOGGED · ${backdated}D AGO` : 'SERVICE COMPLETE',
        detail: `${item.title} · cycle reset · next in ${intervalHuman(item.recommendedIntervalDays)}`,
        action: {
          label: 'undo',
          run: () => {
            void itemsRepository.undoComplete(log.id).then(() => {
              haptic('tick');
              uiActions.toast({ tone: 'info', title: 'SERVICE REVERTED', detail: item.title });
            });
          },
        },
      });
      return log;
    } catch (error) {
      haptic('warn');
      uiActions.toast({ tone: 'warn', title: 'SERVICE FAILED', detail: errorMessage(error) });
      return null;
    }
  },

  /** Closes any sheet first so the node can fold out of its list in view. */
  async remove(item: MaintenanceItem) {
    closeAllOverlays();
    await new Promise((resolve) => window.setTimeout(resolve, 380));
    try {
      const removed = await itemsRepository.remove(item.id);
      haptic('heavy');
      if (removed) {
        uiActions.toast({
          tone: 'info',
          title: 'SYSTEM REMOVED',
          detail: `${item.title} · its log is kept`,
          action: { label: 'restore', run: () => void itemsRepository.restore(removed) },
        });
      }
    } catch (error) {
      uiActions.toast({ tone: 'warn', title: 'REMOVE FAILED', detail: errorMessage(error) });
    }
  },

  open(itemId: string) {
    uiActions.hideHud();
    openOverlay({ item: itemId });
  },

  edit(itemId: string) {
    uiActions.hideHud();
    openOverlay({ edit: itemId });
  },

  create(preset: { categoryId?: string; title?: string; suggestion?: string } = {}) {
    const params: Record<string, string> = { edit: 'new' };
    if (preset.categoryId) params.cat = preset.categoryId;
    if (preset.title) params.title = preset.title;
    if (preset.suggestion) params.preset = preset.suggestion;
    openOverlay(params);
  },
};

import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { uiActions } from './ui';

/** Service worker lifecycle, reported through the console. Production only. */
export function UpdateNotice() {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  useEffect(() => {
    if (!offlineReady) return;
    uiActions.toast({ tone: 'ok', title: 'OFFLINE READY', detail: 'the system is cached and runs without network' });
    setOfflineReady(false);
  }, [offlineReady, setOfflineReady]);

  useEffect(() => {
    if (!needRefresh) return;
    uiActions.toast({
      tone: 'info',
      title: 'PATCH AVAILABLE',
      detail: 'a new version is ready',
      ttl: 20000,
      action: { label: 'apply', run: () => void updateServiceWorker(true) },
    });
  }, [needRefresh, updateServiceWorker]);

  return null;
}

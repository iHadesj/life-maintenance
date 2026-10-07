import { useCallback, useEffect, useState } from 'react';
import { diffCalendarDays, msUntilNextDay } from '../services/dates';

/**
 * "Today", kept honest: ticks at midnight and when the app resumes from the
 * background (iOS keeps standalone PWAs alive for days without reloading).
 */
export function useNow(): { now: Date; refresh: () => void } {
  const [now, setNow] = useState(() => new Date());
  const refresh = useCallback(() => setNow(new Date()), []);

  useEffect(() => {
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(() => {
        setNow(new Date());
        schedule();
      }, msUntilNextDay(new Date()) + 500);
    };
    schedule();

    const onResume = () => {
      if (document.visibilityState !== 'visible') return;
      setNow((previous) => (diffCalendarDays(new Date(), previous) !== 0 ? new Date() : previous));
    };
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('focus', onResume);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('focus', onResume);
    };
  }, []);

  return { now, refresh };
}

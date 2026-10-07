import { AnimatePresence, motion } from 'framer-motion';
import type { MaintenanceLog } from '../../db/types';
import { easings } from '../../motion/springs';
import { formatStampFor } from '../../services/dates';
import s from './ItemHistory.module.css';

interface Props {
  logs: readonly MaintenanceLog[];
  interval: number;
  now: Date;
}

/** This system's own git log: every service, its real cycle and its drift. */
export function ItemHistory({ logs, interval, now }: Props) {
  if (logs.length === 0) {
    return <p className={s.empty}>No services logged yet. The first one starts this system's record.</p>;
  }

  return (
    <ol className={s.history}>
      <AnimatePresence initial={false}>
        {logs.slice(0, 12).map((log) => {
          const planned = log.intervalDays ?? interval;
          const drift = log.previousCycleDuration - planned;
          const tone = drift > 0 ? 'late' : 'ok';
          return (
            <motion.li
              key={log.id}
              layout="position"
              className={s.entry}
              data-tone={tone}
              initial={{ clipPath: 'inset(0% 100% 0% 0%)', x: -12 }}
              animate={{ clipPath: 'inset(0% 0% 0% 0%)', x: 0, transition: { duration: 0.6, ease: easings.out } }}
              exit={{ opacity: 0 }}
            >
              <span className={s.date}>{formatStampFor(log.completedAt, now)}</span>
              <span className={s.cycle}>
                cycle {log.previousCycleDuration}d / {planned}d
              </span>
              <span className={s.drift}>{drift > 0 ? `+${drift}d late` : drift < 0 ? `${-drift}d early` : 'on time'}</span>
              {log.note && <span className={s.note}>// {log.note}</span>}
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ol>
  );
}

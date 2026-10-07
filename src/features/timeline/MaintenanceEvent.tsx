import { motion } from 'framer-motion';
import type { Category, MaintenanceLog } from '../../db/types';
import { drawVariants, sproutVariants } from '../../motion/transitions';
import { formatStamp } from '../../services/dates';
import { maintenanceActions } from '../maintenance/actions';
import s from './MaintenanceTimeline.module.css';

interface Props {
  log: MaintenanceLog;
  category?: Category;
  traced: boolean;
  dimmed: boolean;
  exists: boolean;
  onTrace: () => void;
}

/** One commit in the life log: short hash, the system, its real cycle and drift. */
export function MaintenanceEvent({ log, category, traced, dimmed, exists, onTrace }: Props) {
  const planned = log.intervalDays;
  const drift = planned ? log.previousCycleDuration - planned : 0;
  const title = log.itemTitle ?? 'Removed system';
  const driftText = !planned ? null : drift > 0 ? `+${drift}d late` : drift < 0 ? `${-drift}d early` : 'on time';

  return (
    <motion.li
      className={s.event}
      data-identity={category?.color ?? 'ash'}
      data-traced={traced || undefined}
      data-dimmed={dimmed || undefined}
      data-late={drift > 0 || undefined}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: '0px 0px -6% 0px' }}
    >
      <svg className={s.branch} viewBox="0 0 26 26" aria-hidden="true">
        <motion.path d="M0.5 0C0.5 14 7 23 26 23" variants={drawVariants} />
      </svg>
      <motion.div className={s.eventBody} variants={sproutVariants}>
        <button
          type="button"
          className={s.eventButton}
          onClick={onTrace}
          aria-pressed={traced}
          aria-label={`${title} serviced ${formatStamp(log.completedAt)}${driftText ? `, ${driftText}` : ''}. Trace this system.`}
        >
          <span className={s.dot} data-trace-anchor={log.maintenanceItemId} aria-hidden="true" />
          <span className={s.line1}>
            <code className={s.hash}>{log.id.replace(/-/g, '').slice(0, 7)}</code>
            <span className={s.eventTitle}>{title}</span>
          </span>
          <span className={s.line2}>
            {category && <span className={s.area}>{category.name.toUpperCase()}/</span>}
            <span>cycle {log.previousCycleDuration}d{planned ? ` of ${planned}d` : ''}</span>
            {driftText && <span className={s.drift}>{driftText}</span>}
          </span>
          {log.note && <span className={s.note}>// {log.note}</span>}
        </button>
        {traced && exists && (
          <button type="button" className={s.openSystem} onClick={() => maintenanceActions.open(log.maintenanceItemId)}>
            open system →
          </button>
        )}
      </motion.div>
    </motion.li>
  );
}

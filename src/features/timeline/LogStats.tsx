import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useSystemData } from '../../app/SystemData';
import { easings } from '../../motion/springs';
import { computeLogStats } from './stats';
import s from './LogStats.module.css';

/** A `top`-style header: three numbers that matter, and the pulse of the last 12 weeks. */
export function LogStats() {
  const { logs, now } = useSystemData();
  const stats = useMemo(() => computeLogStats(logs, now), [logs, now]);
  const peak = Math.max(1, ...stats.weeks);
  const drift = stats.averageDrift;

  return (
    <section className={s.stats} aria-label="Maintenance statistics">
      <dl className={s.figures}>
        <div className={s.figure}>
          <dt>services</dt>
          <dd>{stats.total}</dd>
        </div>
        <div className={s.figure}>
          <dt>on time</dt>
          <dd>
            {stats.onTimeRate === null ? (
              '—'
            ) : (
              <>
                {Math.round(stats.onTimeRate * 100)}
                <small>%</small>
              </>
            )}
          </dd>
        </div>
        <div className={s.figure}>
          <dt>avg drift</dt>
          <dd data-late={drift !== null && drift > 0 ? '' : undefined}>
            {drift === null ? (
              '—'
            ) : (
              <>
                {`${drift > 0 ? '+' : ''}${drift.toFixed(1)}`}
                <small>d</small>
              </>
            )}
          </dd>
        </div>
      </dl>

      <div className={s.pulse}>
        <span className="label">12 weeks</span>
        <ol className={s.weeks} aria-label={`Services per week: ${stats.weeks.join(', ')}`}>
          {stats.weeks.map((count, i) => (
            <li key={i} className={s.week}>
              <motion.span
                className={s.beat}
                data-empty={count === 0 || undefined}
                initial={{ scaleY: 0.1 }}
                animate={{ scaleY: count === 0 ? 0.12 : 0.25 + (count / peak) * 0.75 }}
                transition={{ duration: 0.8, delay: 0.03 * i, ease: easings.out }}
              />
            </li>
          ))}
        </ol>
      </div>

      <p className={s.footnote}>
        {stats.last30} in the last 30 days
        {stats.top ? (
          <>
            {' '}
            · most serviced: <b>{stats.top.title}</b> ×{stats.top.count}
          </>
        ) : null}
      </p>
    </section>
  );
}

import { motion, type Variants } from 'framer-motion';
import { navigate, withQuery } from '../../app/router';
import { StatusGlyph } from '../../components/StatusGlyph';
import { easings } from '../../motion/springs';
import { maskRiseVariants } from '../../motion/transitions';
import type { MaintenanceStatus } from '../../services/cycle';
import type { Diagnosis } from '../../services/diagnosis';
import { pct } from '../../services/format';
import type { HealthSummary } from '../../services/health';
import { AnimatedNumber } from './AnimatedNumber';
import s from './HealthReadout.module.css';

interface Props {
  summary: HealthSummary;
  diagnosis: Diagnosis;
  /** The page is building after boot: count up and rise into place. */
  build: boolean;
  /** Boot has not released the page yet. */
  hold: boolean;
}

/**
 * Readout choreography after boot: number → verdict → the three counts, each
 * count printed out of the line before it (a staggered reveal, not a pop).
 */
const countsVariants: Variants = {
  hidden: {},
  shown: { transition: { delayChildren: 0.5, staggerChildren: 0.09 } },
};

const countVariants: Variants = {
  hidden: { clipPath: 'inset(0% 100% 0% 0%)', x: -12 },
  shown: {
    clipPath: 'inset(0% 0% 0% 0%)',
    x: 0,
    transition: { duration: 0.5, ease: easings.out },
    transitionEnd: { clipPath: 'none' },
  },
};

const COUNTS: ReadonlyArray<{ key: 'attention' | 'overdue' | 'stable'; status: MaintenanceStatus; label: string; filter: string }> = [
  { key: 'attention', status: 'attention', label: 'need attention', filter: 'attention' },
  { key: 'overdue', status: 'overdue', label: 'overdue', filter: 'overdue' },
  { key: 'stable', status: 'stable', label: 'stable', filter: 'stable' },
];

/**
 * The number is part of the composition: huge, overlapping the bottom of the
 * orbit, with its label running vertically along it. Below, one calm sentence.
 */
export function HealthReadout({ summary, diagnosis, build, hold }: Props) {
  const state = hold ? 'hidden' : 'shown';
  return (
    <section className={s.readout} aria-labelledby="system-health-label" data-tone={diagnosis.tone}>
      <div className={s.numberRow}>
        <h2 id="system-health-label" className={s.vertical}>
          system health
        </h2>
        <motion.p
          className={s.number}
          variants={maskRiseVariants}
          initial={build ? 'hidden' : false}
          animate={state}
          aria-label={`${pct(summary.health)} percent`}
        >
          <AnimatedNumber value={hold ? 0 : Math.round(summary.health ?? 0)} from={build ? 0 : undefined} />
          <span className={s.unit}>%</span>
        </motion.p>
      </div>

      <motion.div
        className={s.diagnosis}
        variants={maskRiseVariants}
        initial={build ? 'hidden' : false}
        animate={state}
        transition={{ delay: 0.25 }}
      >
        <p className={s.headline}>{diagnosis.headline}</p>
        <p className={s.detail}>{diagnosis.detail}</p>
      </motion.div>

      <motion.ul className={s.counts} variants={countsVariants} initial={build ? 'hidden' : false} animate={state}>
        {COUNTS.map((count) => (
          <motion.li key={count.key} variants={countVariants}>
            <button
              type="button"
              className={s.count}
              data-status={count.status}
              data-zero={summary[count.key] === 0 || undefined}
              onClick={() => navigate(withQuery('#/queue', { f: count.filter }))}
            >
              <StatusGlyph status={count.status} size={14} live={false} label="" />
              <b>{summary[count.key]}</b>
              <span>{count.label}</span>
            </button>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}

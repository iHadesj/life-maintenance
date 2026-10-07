import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { easings } from '../motion/springs';
import { SCAN_DURATION, type PageTransition } from '../motion/transitions';
import { plural } from '../services/format';
import { useSystemData } from './SystemData';
import { uiActions, useUI } from './ui';
import s from './App.module.css';

/** The line that writes a new view over the old one during tab changes. */
export function ScanBeam({ transition }: { transition: PageTransition }) {
  if (transition.kind !== 'scan' || transition.reduced) return null;
  const from = transition.dir > 0 ? '100vw' : '0vw';
  const to = transition.dir > 0 ? '0vw' : '100vw';
  return (
    <motion.div
      className={s.beam}
      aria-hidden="true"
      initial={{ x: from, opacity: 1 }}
      animate={{ x: to, opacity: [1, 1, 0] }}
      transition={{ x: { duration: SCAN_DURATION, ease: easings.scan }, opacity: { duration: SCAN_DURATION, times: [0, 0.82, 1] } }}
    />
  );
}

/**
 * SYSTEM CHECK: a sweep runs down the screen, "now" is re-read (cycles are
 * recomputed for today), and the console prints what was found.
 */
export function SystemCheckSweep() {
  const seq = useUI((state) => state.checkSeq);
  const data = useSystemData();
  const latest = useRef(data);
  latest.current = data;
  const [run, setRun] = useState(0);

  useEffect(() => {
    if (!seq) return;
    latest.current.refreshNow();
    setRun(seq);
    const timer = window.setTimeout(() => {
      setRun(0);
      const { summary } = latest.current;
      uiActions.toast({
        tone: summary.overdue ? 'warn' : 'ok',
        title: 'SYSTEM CHECK COMPLETE',
        detail: `${plural(summary.total, 'system')} scanned · ${summary.attention} attention · ${summary.overdue} overdue`,
      });
    }, latest.current.reduced ? 50 : 1050);
    return () => window.clearTimeout(timer);
  }, [seq]);

  if (!run || data.reduced) return null;
  return (
    <motion.div
      key={run}
      className={s.sweep}
      aria-hidden="true"
      initial={{ y: '-4vh' }}
      animate={{ y: '104vh' }}
      transition={{ duration: 1, ease: easings.organic }}
    >
      <span className={s.sweepLabel}>system check · scanning {data.summary.total}</span>
    </motion.div>
  );
}

/** Static substrate: dot matrix and a glow where the core lives. Never animated. */
export function Backdrop() {
  return <div className={s.backdrop} aria-hidden="true" />;
}

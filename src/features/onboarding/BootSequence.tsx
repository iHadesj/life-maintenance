import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useSystemData } from '../../app/SystemData';
import { uiActions } from '../../app/ui';
import { fit } from '../../components/fit';
import { settingsRepository } from '../../repositories/settings';
import { easings } from '../../motion/springs';
import s from './BootSequence.module.css';

/**
 * The boot line and the core ring share one structure — a move plus four
 * cubic segments (26 numbers) — so the line can literally curl into the ring.
 */
function lineCurve(x0: number, x1: number, y: number): number[] {
  const step = (x1 - x0) / 4;
  const out = [x0, y];
  for (let i = 0; i < 4; i++) {
    const a = x0 + step * i;
    out.push(a + step / 3, y, a + (2 * step) / 3, y, a + step, y);
  }
  return out;
}

/** Starts at the left of the ring and runs clockwise. */
function ringCurve(cx: number, cy: number, r: number): number[] {
  const k = 0.5523 * r;
  return [
    cx - r, cy,
    cx - r, cy - k, cx - k, cy - r, cx, cy - r,
    cx + k, cy - r, cx + r, cy - k, cx + r, cy,
    cx + r, cy + k, cx + k, cy + r, cx, cy + r,
    cx - k, cy + r, cx - r, cy + k, cx - r, cy,
  ];
}

function curvePath(a: number[], b: number[], t: number): string {
  const n = a.map((v, i) => (v + (b[i] - v) * t).toFixed(1));
  let d = `M${n[0]} ${n[1]}`;
  for (let i = 2; i < n.length; i += 6) d += `C${n[i]} ${n[i + 1]} ${n[i + 2]} ${n[i + 3]} ${n[i + 4]} ${n[i + 5]}`;
  return d;
}

type Stage = 'idle' | 'sweep' | 'ready' | 'curl' | 'fade';

const TIMING = {
  full: { sweep: 0.62, ready: 760, curl: 1180, fade: 1600, release: 1640, end: 2100 },
  short: { sweep: 0.36, ready: 380, curl: 470, fade: 800, release: 820, end: 1150 },
};

function BootRun({ full, onEnd }: { full: boolean; onEnd: () => void }) {
  const t = full ? TIMING.full : TIMING.short;
  const [stage, setStage] = useState<Stage>('idle');
  const finish = useRef(onEnd);
  finish.current = onEnd;
  const [target, setTarget] = useState<{ x: number; y: number; r: number } | null>(null);
  const geometry = useRef(
    (() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const gutter = Math.max(20, Math.min(32, w * 0.06));
      return { w, h, x0: gutter, x1: w - gutter, y: Math.round(h * 0.47) };
    })(),
  ).current;

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setStage('sweep'), 60),
      window.setTimeout(() => setStage('ready'), t.ready),
      window.setTimeout(() => {
        const anchor = document.querySelector('[data-core-anchor]')?.getBoundingClientRect();
        setTarget(
          anchor && anchor.width > 0
            ? { x: anchor.left + anchor.width / 2, y: anchor.top + anchor.height / 2, r: anchor.width * 0.3 }
            : { x: geometry.w / 2, y: geometry.h * 0.4, r: 36 },
        );
        setStage('curl');
      }, t.curl),
      window.setTimeout(() => setStage('fade'), t.fade),
      window.setTimeout(() => {
        uiActions.setBoot('done');
        if (full) void settingsRepository.set('introSeen', true);
      }, t.release),
      window.setTimeout(() => finish.current(), t.end),
    ];
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [t, full, geometry]);

  const { w, h, x0, x1, y } = geometry;
  const swept = stage !== 'idle';
  const curled = stage === 'curl' || stage === 'fade';
  const span = x1 - x0;
  const line = useRef(lineCurve(x0, x1, y)).current;
  const ring = target ? ringCurve(target.x, target.y, target.r) : line;
  const curl = useMotionValue(0);
  const d = useTransform(curl, (t) => curvePath(line, ring, t));
  const reveal = swept ? 'inset(0% 0% 0% 0%)' : 'inset(0% 100% 0% 0%)';

  useEffect(() => {
    if (!curled) return;
    const controls = animate(curl, 1, { duration: 0.42, ease: easings.organic });
    return () => controls.stop();
  }, [curled, curl]);

  return (
    <motion.div
      className={s.boot}
      initial={{ opacity: 1 }}
      animate={{ opacity: stage === 'fade' ? 0 : 1 }}
      transition={{ duration: 0.45, ease: easings.out }}
      aria-hidden="true"
    >
      <svg className={s.svg} viewBox={`0 0 ${w} ${h}`}>
        <motion.path
          className={s.line}
          d={d}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: swept ? 1 : 0 }}
          transition={{ pathLength: { duration: curled ? 0 : t.sweep, ease: easings.scan } }}
        />
      </svg>

      <motion.span
        className={s.cursor}
        style={{ top: y - 22, left: x0 }}
        initial={{ x: 0, opacity: 1 }}
        animate={{ x: swept ? span : 0, opacity: curled ? 0 : 1 }}
        transition={{ x: { duration: t.sweep, ease: easings.scan }, opacity: { duration: 0.12 } }}
      />

      {full ? (
        <motion.div
          className={s.words}
          style={{ left: x0, width: span, bottom: h - y + 14 }}
          initial={{ clipPath: 'inset(0% 100% 0% 0%)' }}
          animate={{ clipPath: curled ? 'inset(0% 0% 0% 100%)' : reveal }}
          transition={{ duration: curled ? 0.3 : t.sweep, ease: curled ? easings.in : easings.scan }}
        >
          <span className={`${s.word} fit`} style={fit('LIFE/', '7rem')}>
            LIFE<span className="slash">/</span>
          </span>
          <span className={`${s.word} fit`} style={fit('MAINTENANCE', '7rem')}>
            MAINTENANCE
          </span>
        </motion.div>
      ) : null}

      <motion.span
        className={s.ready}
        style={{ top: y + 14, right: w - x1 }}
        initial={{ clipPath: 'inset(0% 100% 0% 0%)' }}
        animate={{
          clipPath: stage === 'ready' ? 'inset(0% 0% 0% 0%)' : curled ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)',
        }}
        transition={{ duration: stage === 'ready' ? 0.28 : 0.2, ease: stage === 'ready' ? 'linear' : easings.in }}
      >
        <span className={s.ok}>✓</span> SYSTEM READY
      </motion.span>

      {full && (
        <motion.span
          className={s.version}
          style={{ top: y + 14, left: x0 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: stage === 'ready' ? 1 : 0 }}
          transition={{ duration: 0.2 }}
        >
          LM://{__APP_VERSION__}
        </motion.span>
      )}
    </motion.div>
  );
}

/**
 * A cursor runs across the screen, printing the name, then its line curls into
 * the core. Full sequence on first launch (~1.6s); a 0.8s echo afterwards;
 * nothing at all with reduced motion.
 */
export function BootSequence() {
  const { ready, reduced, settings } = useSystemData();
  const [ended, setEnded] = useState(false);
  const decided = useRef<boolean | null>(null);

  useEffect(() => {
    if (ready && reduced) {
      uiActions.setBoot('done');
      setEnded(true);
    }
  }, [ready, reduced]);

  if (ended) return null;
  if (!ready || reduced) return <div className={s.boot} aria-hidden="true" />;
  if (decided.current === null) decided.current = !settings.introSeen;
  return <BootRun full={decided.current} onEnd={() => setEnded(true)} />;
}

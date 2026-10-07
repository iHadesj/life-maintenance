import { animate, motion, useMotionValue, useMotionValueEvent } from 'framer-motion';
import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
import { useElementWidth } from '../../hooks/useElementWidth';
import { springs } from '../../motion/springs';
import { intervalHuman } from '../../services/format';
import { haptic } from '../../services/haptics';
import { clamp } from '../../services/math';
import s from './IntervalRuler.module.css';

const MAX = 730;
const TAPE = 1500;
const LN_MAX = Math.log(MAX);

const toPos = (days: number) => (TAPE * Math.log(clamp(days, 1, MAX))) / LN_MAX;
const toDays = (pos: number) => clamp(Math.round(Math.exp((clamp(pos, 0, TAPE) / TAPE) * LN_MAX)), 1, MAX);

const MAJOR: Record<number, string> = { 1: '1D', 7: '1W', 14: '2W', 30: '1M', 60: '2M', 90: '3M', 180: '6M', 365: '1Y', 730: '2Y' };

function buildTicks(): Array<{ d: number; x: number; major: boolean }> {
  const days = new Set<number>(Object.keys(MAJOR).map(Number));
  for (let d = 1; d <= 30; d++) days.add(d);
  for (let d = 35; d <= 90; d += 5) days.add(d);
  for (let d = 105; d <= 360; d += 15) days.add(d);
  for (let d = 395; d <= 725; d += 30) days.add(d);
  return [...days].sort((a, b) => a - b).map((d) => ({ d, x: toPos(d), major: d in MAJOR }));
}

interface Props {
  value: number;
  onChange: (days: number) => void;
}

/**
 * A tape measure for cycle length on a logarithmic scale: days are wide,
 * years are dense. Drag with inertia; it settles exactly on a day.
 */
export function IntervalRuler({ value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useElementWidth(ref, 340);
  const center = width / 2;
  const x = useMotionValue(center - toPos(Math.min(value, MAX)));
  const emitted = useRef(value);
  const userDriven = useRef(false);
  const release = useRef(0);
  const ticks = useMemo(buildTicks, []);

  useEffect(() => () => window.clearTimeout(release.current), []);

  useEffect(() => {
    if (userDriven.current) return;
    const target = center - toPos(Math.min(value, MAX));
    emitted.current = value;
    if (Math.abs(x.get() - target) < 0.5) return;
    const controls = animate(x, target, springs.organic);
    return () => controls.stop();
  }, [value, center, x]);

  useMotionValueEvent(x, 'change', (latest) => {
    if (!userDriven.current) return;
    const days = toDays(center - latest);
    if (days === emitted.current) return;
    emitted.current = days;
    if (MAJOR[days]) haptic('tick');
    onChange(days);
  });

  const step = (delta: number) => {
    const next = clamp(value + delta, 1, 3650);
    if (next !== value) onChange(next);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const map: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1, PageUp: 7, PageDown: -7 };
    if (event.key in map) {
      event.preventDefault();
      step(map[event.key]);
    } else if (event.key === 'Home') {
      event.preventDefault();
      onChange(1);
    } else if (event.key === 'End') {
      event.preventDefault();
      onChange(MAX);
    }
  };

  return (
    <div
      className={s.ruler}
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label="Cycle length in days"
      aria-valuemin={1}
      aria-valuemax={3650}
      aria-valuenow={value}
      aria-valuetext={`${value} days, ${intervalHuman(value)}`}
      onKeyDown={onKeyDown}
    >
      <motion.div
        className={s.tape}
        style={{ x }}
        drag="x"
        dragConstraints={{ left: center - TAPE, right: center }}
        dragElastic={0.14}
        dragTransition={{
          power: 0.28,
          timeConstant: 240,
          bounceStiffness: 420,
          bounceDamping: 30,
          modifyTarget: (target) => center - toPos(toDays(center - target)),
        }}
        onDragStart={() => {
          userDriven.current = true;
          window.clearTimeout(release.current);
        }}
        onDragEnd={() => {
          // Safety net in case the inertia never reports its end.
          release.current = window.setTimeout(() => (userDriven.current = false), 1600);
        }}
        onDragTransitionEnd={() => {
          window.clearTimeout(release.current);
          userDriven.current = false;
        }}
      >
        <svg width={TAPE} height={48} viewBox={`0 0 ${TAPE} 48`} aria-hidden="true">
          <line x1={0} x2={TAPE} y1={10} y2={10} className={s.base} />
          {ticks.map((tick) => (
            <g key={tick.d}>
              <line x1={tick.x} x2={tick.x} y1={10} y2={tick.major ? 24 : 17} className={tick.major ? s.major : s.minor} />
              {tick.major && (
                <text x={tick.x} y={38} className={s.tickLabel}>
                  {MAJOR[tick.d]}
                </text>
              )}
            </g>
          ))}
        </svg>
      </motion.div>
      <div className={s.needle} aria-hidden="true" />
      <div className={s.fadeLeft} aria-hidden="true" />
      <div className={s.fadeRight} aria-hidden="true" />
    </div>
  );
}

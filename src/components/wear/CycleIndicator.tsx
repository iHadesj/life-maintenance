import { animate, motion, useInView, useMotionValue, useTransform, type MotionValue } from 'framer-motion';
import { useEffect, useId, useMemo, useRef } from 'react';
import { useReducedMotionPref } from '../../app/SystemData';
import { easings, springs } from '../../motion/springs';
import type { MaintenanceStatus } from '../../services/cycle';
import { hashString } from '../../services/math';
import { WEAR_HERO, WEAR_LINE, buildWear, headX, ringX, type WearPaths } from './geometry';
import s from './CycleIndicator.module.css';

interface Props {
  progress: number;
  status: MaintenanceStatus;
  seed: string;
  variant?: 'line' | 'hero';
  /** Grow from the origin the first time it scrolls into view. */
  grow?: boolean;
  /** 0..1 — pushes time back toward the origin (swipe-to-service). */
  compress?: MotionValue<number>;
  /** Direct control of the drawn progress; negative values are ignored. */
  override?: MotionValue<number>;
  /** When set, the line is exposed as a meter with this description. */
  label?: string;
  className?: string;
}

/**
 * Time since the last service, drawn as a line that wears out.
 * Any drop in progress (a service) plays the reset: the noise discharges,
 * the line rewinds to the origin with recoil, and the origin emits a pulse.
 */
export function CycleIndicator({
  progress,
  status,
  seed,
  variant = 'line',
  grow = false,
  compress,
  override,
  label,
  className,
}: Props) {
  const frame = variant === 'hero' ? WEAR_HERO : WEAR_LINE;
  const reduced = useReducedMotionPref();
  const seedNumber = useMemo(() => hashString(seed), [seed]);
  const gradientId = `wear-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;

  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  const startFromZero = grow && !reduced;

  const base = useMotionValue(startFromZero ? 0 : progress);
  const noise = useMotionValue(1);
  const pulse = useMotionValue(0);
  const zero = useMotionValue(0);
  const none = useMotionValue(-1);
  const previous = useRef(startFromZero ? 0 : progress);

  useEffect(() => {
    if (startFromZero && !inView) return;
    const was = previous.current;
    previous.current = progress;

    if (reduced) {
      base.jump(progress);
      noise.jump(1);
      return;
    }

    if (progress < was - 0.08) {
      const discharge = animate(noise, 0, { duration: 0.14, ease: easings.out });
      const rewind = animate(base, progress, { ...springs.rewind, delay: 0.1 });
      const ring = animate(pulse, [0, 1], { duration: 1.1, delay: 0.18, ease: easings.out });
      const settle = window.setTimeout(() => animate(noise, 1, { duration: 0.9, ease: easings.out }), 760);
      return () => {
        discharge.stop();
        rewind.stop();
        ring.stop();
        window.clearTimeout(settle);
      };
    }

    const controls = animate(base, progress, springs.wear);
    return () => controls.stop();
  }, [progress, inView, startFromZero, reduced, base, noise, pulse]);

  const shown = useTransform([base, compress ?? zero, override ?? none], ([b, c, o]: number[]) =>
    (o >= 0 ? o : b) * (1 - c),
  );
  const geometry = useTransform([shown, noise], ([p, n]: number[]): WearPaths => buildWear(frame, p, seedNumber, n));
  const solid = useTransform(geometry, (g) => g.solid);
  const worn = useTransform(geometry, (g) => g.worn);
  const ahead = useTransform(geometry, (g) => g.ahead);
  const particles = useTransform(geometry, (g) => g.particles);
  const head = useTransform(geometry, (g) => g.head);
  const pulseScale = useTransform(pulse, [0, 1], [1, 4.4]);
  const pulseOpacity = useTransform(pulse, [0, 0.08, 1], [0, 0.95, 0]);

  const rx = ringX(frame);
  const reached = progress >= 1;
  const ticks = variant === 'hero' ? [0.25, 0.5, 0.75].map((t) => headX(frame, t)) : [];
  const meter = label
    ? {
        role: 'meter',
        'aria-valuemin': 0,
        'aria-valuemax': 100,
        'aria-valuenow': Math.round(Math.min(progress, 1) * 100),
        'aria-valuetext': label,
      }
    : { 'aria-hidden': true };

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${frame.w} ${frame.h}`}
      className={className ? `${s.wear} ${className}` : s.wear}
      data-status={status}
      data-variant={variant}
      preserveAspectRatio="xMinYMid meet"
      {...meter}
    >
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1={frame.x0} x2={rx} y1={0} y2={0}>
          <stop offset="0" style={{ stopColor: 'var(--fg-4)' }} />
          <stop offset="0.5" style={{ stopColor: 'currentColor' }} />
          <stop offset="1" style={{ stopColor: 'currentColor' }} />
        </linearGradient>
      </defs>

      {ticks.map((x) => (
        <line key={x} className={s.tick} x1={x} x2={x} y1={frame.y + 6} y2={frame.y + 10} />
      ))}

      <motion.path className={s.ahead} d={ahead} />
      <motion.path className={s.solid} d={solid} stroke={`url(#${gradientId})`} />
      <motion.path className={s.worn} d={worn} />
      <motion.path className={s.particles} d={particles} />

      <circle className={reached ? `${s.ring} ${s.reached}` : s.ring} cx={rx} cy={frame.y} r={frame.ring} />
      <motion.circle className={s.pulse} cx={frame.x0} cy={frame.y} r={frame.dot} style={{ scale: pulseScale, opacity: pulseOpacity }} />
      <circle className={s.origin} cx={frame.x0} cy={frame.y} r={frame.dot} />
      <motion.circle className={s.head} cx={head} cy={frame.y} r={frame.head} />
    </svg>
  );
}

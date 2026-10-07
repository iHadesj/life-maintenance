import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useMotionValueEvent,
  useTransform,
  type AnimationPlaybackControls,
  type PanInfo,
} from 'framer-motion';
import { useCallback, useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { organismLayoutId, pageScrollY, type DiveVia } from '../../app/pageTransition';
import { useSystemData } from '../../app/SystemData';
import { CategorySymbol } from '../../components/CategorySymbol';
import { arcPath } from '../../components/organic/shapes';
import type { Category } from '../../db/types';
import { useElementWidth } from '../../hooks/useElementWidth';
import { easings, springs } from '../../motion/springs';
import type { Point } from '../../motion/transitions';
import { needsAttention } from '../../services/cycle';
import { pct, plural } from '../../services/format';
import type { HealthSummary } from '../../services/health';
import { clamp } from '../../services/math';
import s from './OrbitMap.module.css';

/** Survives page changes: the system is where you left it. */
let savedAngle = -Math.PI / 2 + 0.42;

const DRIFT_RAD_PER_MS = 0.000034;
const PAN_RAD_PER_PX = 0.0068;

interface Props {
  categories: readonly Category[];
  summaries: ReadonlyMap<string, HealthSummary>;
  core: ReactNode;
  /** Mounted under the boot overlay: start collapsed and build on release. */
  build: boolean;
  /** Boot released the page: orbits draw out of the core, areas spread to their paths. */
  release: boolean;
  onEnter: (category: Category, origin: Point, via: DiveVia) => void;
}

/**
 * Areas of life orbiting the core on a tilted ellipse. Depth is real: areas
 * pass behind the core and swell as they come forward. Drag to spin the
 * system (it keeps its inertia); tap an area to dive into it.
 */
export function OrbitMap({ categories, summaries, core, build, release, onEnter }: Props) {
  const { reduced } = useSystemData();
  const ref = useRef<HTMLDivElement>(null);
  const width = useElementWidth(ref, 380);
  const height = Math.round(clamp(width * 0.84, 300, 460));
  const rx = Math.min(width * 0.41, 260);
  const ry = rx * 0.56;
  const cx = width / 2;
  const cy = height / 2;
  const coreSize = Math.round(Math.min(width * 0.43, 230));

  const angle = useMotionValue(savedAngle);
  const spread = useMotionValue(build && !reduced ? 0 : 1);
  // Scrolling away tilts the system toward edge-on: the orbit flattens as it recedes.
  const flatten = useTransform(pageScrollY, [0, 420], [1, 0.58], { clamp: true });
  const satellites = useRef<Array<HTMLElement | null>>([]);
  const tethers = useRef<Array<SVGLineElement | null>>([]);
  const interacting = useRef(false);
  const lastPan = useRef(0);
  const inertia = useRef<AnimationPlaybackControls | null>(null);
  const count = categories.length;

  const place = useCallback(() => {
    const a = angle.get();
    const sp = spread.get();
    const tilt = ry * flatten.get();
    for (let i = 0; i < count; i++) {
      const t = a + (i / count) * Math.PI * 2;
      const x = cx + Math.cos(t) * rx * sp;
      const y = cy + Math.sin(t) * tilt * sp;
      const depth = (Math.sin(t) + 1) / 2;
      const el = satellites.current[i];
      if (el) {
        el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${(0.74 + depth * 0.36).toFixed(3)})`;
        el.style.zIndex = depth > 0.5 ? '5' : '1';
        el.style.opacity = (0.45 + depth * 0.55 * Math.min(1, sp * 1.4)).toFixed(3);
      }
      const line = tethers.current[i];
      if (line) {
        line.setAttribute('x2', x.toFixed(1));
        line.setAttribute('y2', y.toFixed(1));
      }
    }
  }, [angle, spread, flatten, count, cx, cy, rx, ry]);

  useLayoutEffect(place);
  useMotionValueEvent(angle, 'change', place);
  useMotionValueEvent(spread, 'change', place);
  useMotionValueEvent(flatten, 'change', place);

  const recede = useTransform(pageScrollY, [0, 520], [1, 0.9], { clamp: true });
  const drift = useTransform(pageScrollY, [0, 520], [0, 110], { clamp: true });
  const dim = useTransform(pageScrollY, [0, 520], [1, 0.35], { clamp: true });

  useEffect(() => {
    if (!build || reduced) {
      spread.jump(1);
      return;
    }
    if (!release) return;
    const controls = animate(spread, 1, { ...springs.organic, delay: 0.12 });
    return () => controls.stop();
  }, [build, release, reduced, spread]);

  const inView = useInView(ref, { amount: 0.2 });
  useEffect(() => {
    if (reduced || !inView) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (!interacting.current && document.visibilityState === 'visible') angle.set(angle.get() + dt * DRIFT_RAD_PER_MS);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, inView, angle]);

  useEffect(
    () => () => {
      inertia.current?.stop();
      savedAngle = angle.get();
    },
    [angle],
  );

  const onPanStart = () => {
    interacting.current = true;
    inertia.current?.stop();
  };
  const onPan = (_: PointerEvent, info: PanInfo) => {
    angle.set(angle.get() + info.delta.x * PAN_RAD_PER_PX);
  };
  const onPanEnd = (_: PointerEvent, info: PanInfo) => {
    lastPan.current = Date.now();
    inertia.current = animate(angle, angle.get(), {
      type: 'inertia',
      velocity: info.velocity.x * PAN_RAD_PER_PX,
      power: 0.55,
      timeConstant: 600,
      onComplete: () => {
        interacting.current = false;
      },
    });
  };

  const transform = (i: number) => {
    const t = angle.get() + (i / Math.max(1, count)) * Math.PI * 2;
    const sp = spread.get();
    const tilt = ry * flatten.get();
    return `translate3d(${(cx + Math.cos(t) * rx * sp).toFixed(1)}px, ${(cy + Math.sin(t) * tilt * sp).toFixed(1)}px, 0) translate(-50%, -50%)`;
  };

  const backArc = `M${cx - rx} ${cy}A${rx} ${ry} 0 0 1 ${cx + rx} ${cy}`;
  const frontArc = `M${cx + rx} ${cy}A${rx} ${ry} 0 0 1 ${cx - rx} ${cy}`;
  const outer = { rx: rx * 1.17, ry: ry * 1.2 };
  const drawn = build && !reduced;
  const drawTo = drawn && !release ? 0 : 1;

  return (
    <motion.div
      ref={ref}
      className={s.orbit}
      style={{ height, scale: recede, y: drift, opacity: dim }}
      onPanStart={onPanStart}
      onPan={onPan}
      onPanEnd={onPanEnd}
    >
      <motion.svg className={s.back} viewBox={`0 0 ${width} ${height}`} style={{ scaleY: flatten }} aria-hidden="true">
        <motion.path
          d={backArc}
          className={s.pathBack}
          initial={drawn ? { pathLength: 0 } : false}
          animate={{ pathLength: drawTo }}
          transition={{ duration: 1.1, ease: easings.out, delay: 0.2 }}
        />
        <motion.path
          d={`M${cx - outer.rx} ${cy}A${outer.rx} ${outer.ry} 0 0 1 ${cx + outer.rx * 0.2} ${cy - outer.ry * 0.98}`}
          className={s.pathOuter}
          initial={drawn ? { pathLength: 0 } : false}
          animate={{ pathLength: drawTo }}
          transition={{ duration: 1.4, ease: easings.out, delay: 0.35 }}
        />
      </motion.svg>
      <svg className={s.back} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {categories.map((category, i) => {
          const summary = summaries.get(category.id);
          const pulling = summary?.worstStatus ? needsAttention(summary.worstStatus) : false;
          return (
            <line
              key={category.id}
              ref={(el) => {
                tethers.current[i] = el;
              }}
              x1={cx}
              y1={cy}
              x2={cx}
              y2={cy}
              className={s.tether}
              data-status={summary?.worstStatus ?? 'stable'}
              data-active={pulling || undefined}
            />
          );
        })}
      </svg>

      <div
        className={s.core}
        style={{ left: cx - coreSize / 2, top: cy - coreSize / 2, width: coreSize, height: coreSize }}
      >
        {core}
      </div>

      <motion.svg className={s.front} viewBox={`0 0 ${width} ${height}`} style={{ scaleY: flatten }} aria-hidden="true">
        <motion.path
          d={frontArc}
          className={s.pathFront}
          initial={drawn ? { pathLength: 0 } : false}
          animate={{ pathLength: drawTo }}
          transition={{ duration: 1.1, ease: easings.out, delay: 0.2 }}
        />
      </motion.svg>

      <ul className={s.satellites} aria-label="Areas of life">
        {categories.map((category, i) => {
          const summary = summaries.get(category.id);
          const total = summary?.total ?? 0;
          const health = summary?.health ?? null;
          const attention = (summary?.attention ?? 0) + (summary?.overdue ?? 0);
          const sweep = health === null ? 0 : Math.max(6, (health / 100) * 340);
          return (
            <li
              key={category.id}
              ref={(el) => {
                satellites.current[i] = el;
              }}
              className={s.satellite}
              style={{ transform: transform(i) }}
              data-identity={category.color}
              data-status={summary?.worstStatus ?? 'stable'}
              data-empty={total === 0 || undefined}
            >
              <button
                type="button"
                className={s.satButton}
                onClick={(event) => {
                  if (Date.now() - lastPan.current < 250) return;
                  const box = event.currentTarget.querySelector('[data-body]')?.getBoundingClientRect();
                  const origin = box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : { x: event.clientX, y: event.clientY };
                  onEnter(category, origin, 'orbit');
                }}
                aria-label={`${category.name}: ${total ? `${pct(health)} percent health, ${plural(total, 'system')}${attention ? `, ${attention} need attention` : ''}` : 'no systems yet'}. Open area.`}
              >
                <motion.span layoutId={organismLayoutId(category.id, 'orbit')} className={s.body} data-body="">
                  <svg viewBox="0 0 40 40" aria-hidden="true">
                    <path d={arcPath(20, 20, 17, 0, 359.9)} className={s.ringTrack} />
                    {sweep > 0 && <path d={arcPath(20, 20, 17, 0, sweep)} className={s.ring} />}
                  </svg>
                  <CategorySymbol symbol={category.symbol} size={15} strokeWidth={1.8} />
                </motion.span>
                <span className={s.label}>
                  {category.name.toUpperCase()}
                  {attention > 0 && <b className={s.badge}>{attention}</b>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </motion.div>
  );
}

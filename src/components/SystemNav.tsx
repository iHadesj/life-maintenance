import { motion, useSpring, useTransform, useVelocity } from 'framer-motion';
import { useLayoutEffect, useRef, useState } from 'react';
import { navigate, pathFor, type Route, type RouteName } from '../app/router';
import { uiActions } from '../app/ui';
import { springs } from '../motion/springs';
import { haptic } from '../services/haptics';
import { blobPath } from './organic/shapes';
import s from './SystemNav.module.css';

const TABS: ReadonlyArray<{ name: RouteName; label: string; hint: string }> = [
  { name: 'system', label: 'SYSTEM', hint: 'System health' },
  { name: 'queue', label: 'QUEUE', hint: 'Maintenance queue' },
  { name: 'log', label: 'LOG', hint: 'Maintenance log' },
  { name: 'settings', label: 'SETTINGS', hint: 'Settings' },
];

const PROMPT_BLOB = blobPath('prompt-node', { cx: 30, cy: 30, radius: 25, points: 6, variance: 0.1 });

/**
 * Not a tab bar: a rail. The line rises into a liquid notch under the active
 * area and stretches with the speed of the jump. The prompt node in the middle
 * opens the terminal (tap, or drag it upward).
 */
function railPath(width: number, x: number, stretch: number, invert: boolean): string {
  const base = invert ? 4 : 18;
  const peak = invert ? 15 : 6;
  const half = 30 + stretch;
  const c = half * 0.55;
  const a = Math.max(0, x - half);
  const b = Math.min(width, x + half);
  return `M0 ${base}H${a.toFixed(1)}C${(a + c).toFixed(1)} ${base} ${(x - c).toFixed(1)} ${peak} ${x.toFixed(1)} ${peak}C${(x + c).toFixed(1)} ${peak} ${(b - c).toFixed(1)} ${base} ${b.toFixed(1)} ${base}H${width}`;
}

interface Props {
  route: Route;
  variant: 'rail' | 'tabs';
}

export function SystemNav({ route, variant }: Props) {
  const active: RouteName = route.name === 'category' ? 'system' : route.name;
  const rowRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  const notchX = useSpring(-100, springs.layout);
  const velocity = useVelocity(notchX);
  const stretch = useTransform(velocity, (v) => Math.min(34, Math.abs(v) / 45));
  const d = useTransform([notchX, stretch], ([x, st]: number[]) => railPath(width, x, st, variant === 'tabs'));

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const place = (jump: boolean) => {
      const rowBox = row.getBoundingClientRect();
      setWidth(rowBox.width);
      const tab = row.querySelector<HTMLElement>(`[data-tab="${active}"]`);
      if (!tab) return;
      const box = tab.getBoundingClientRect();
      const x = box.left - rowBox.left + box.width / 2;
      if (jump) notchX.jump(x);
      else notchX.set(x);
    };
    place(notchX.get() < 0);
    const observer = new ResizeObserver(() => place(true));
    observer.observe(row);
    return () => observer.disconnect();
  }, [active, notchX]);

  const go = (name: RouteName) => {
    if (name === active && route.name !== 'category') return;
    haptic('tick');
    navigate(pathFor(name));
  };

  const tabs = TABS.map((tab) => (
    <a
      key={tab.name}
      href={pathFor(tab.name)}
      data-tab={tab.name}
      className={s.tab}
      aria-current={active === tab.name ? 'page' : undefined}
      aria-label={tab.hint}
      onClick={(event) => {
        event.preventDefault();
        go(tab.name);
      }}
    >
      <span className={s.label}>{tab.label}</span>
    </a>
  ));

  if (variant === 'tabs') {
    return (
      <nav className={s.tabs} aria-label="Primary">
        <div className={s.tabRow} ref={rowRef}>
          {tabs}
          <svg className={s.tabRail} viewBox={`0 0 ${width} 20`} preserveAspectRatio="none" aria-hidden="true">
            <motion.path d={d} />
          </svg>
        </div>
      </nav>
    );
  }

  return (
    <nav className={s.rail} aria-label="Primary">
      <svg className={s.railLine} viewBox={`0 0 ${width} 24`} preserveAspectRatio="none" aria-hidden="true">
        <motion.path d={d} />
      </svg>
      <div className={s.row} ref={rowRef}>
        {tabs.slice(0, 2)}
        <motion.button
          type="button"
          className={s.prompt}
          aria-label="Open command terminal"
          onClick={() => {
            haptic('tick');
            uiActions.openPalette();
          }}
          onPanEnd={(_, info) => {
            if (info.offset.y < -28) {
              haptic('confirm');
              uiActions.openPalette();
            }
          }}
          whileTap={{ scale: 0.92 }}
        >
          <svg viewBox="0 0 60 60" className={s.promptShape} aria-hidden="true">
            <path d={PROMPT_BLOB} />
          </svg>
          <span className={s.promptGlyph} aria-hidden="true">
            &gt;<span className={s.promptCursor}>_</span>
          </span>
        </motion.button>
        {tabs.slice(2)}
      </div>
    </nav>
  );
}

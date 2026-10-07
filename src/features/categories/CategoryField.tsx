import { AnimatePresence, motion } from 'framer-motion';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { openCurve, type Point } from '../../components/organic/shapes';
import type { Category } from '../../db/types';
import { easings } from '../../motion/springs';
import type { EvaluatedItem } from '../../services/health';
import { clamp } from '../../services/math';
import { MaintenanceNode } from '../maintenance/MaintenanceNode';
import { useServiceChoreography } from '../maintenance/useServiceChoreography';
import s from './CategoryField.module.css';

interface Props {
  category: Category;
  entries: readonly EvaluatedItem[];
  scope: string;
}

interface Spine {
  d: string;
  width: number;
  height: number;
}

/**
 * The gravity field of an area. The more urgent a system, the closer it sits
 * to the axis and the more space and weight it claims. A spine grows out of the
 * organism and passes through every system: one body, not a list.
 */
export function CategoryField({ category, entries, scope }: Props) {
  const { entries: ordered } = useServiceChoreography(entries);
  const listRef = useRef<HTMLUListElement>(null);
  const [spine, setSpine] = useState<Spine | null>(null);
  const orderKey = ordered.map((e) => e.item.id).join('|');

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = list.getBoundingClientRect();
        const points: Point[] = [[box.width - 58, -40]];
        for (const anchor of list.querySelectorAll<HTMLElement>('[data-anchor]')) {
          const a = anchor.getBoundingClientRect();
          points.push([a.left - box.left + a.width / 2, a.top - box.top + a.height / 2]);
        }
        const last = points[points.length - 1];
        points.push([last[0] * 0.5 + box.width * 0.25, last[1] + 64]);
        setSpine({ d: openCurve(points), width: box.width, height: box.height + 110 });
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    const settle = window.setTimeout(measure, 900);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.clearTimeout(settle);
    };
  }, [orderKey]);

  return (
    <div className={s.field} data-identity={category.color}>
      {spine && (
        <svg
          className={s.spine}
          width={spine.width}
          height={spine.height}
          viewBox={`0 -44 ${spine.width} ${spine.height}`}
          aria-hidden="true"
        >
          <motion.path
            d={spine.d}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.4, ease: easings.out }}
          />
        </svg>
      )}
      <ul className={s.list} ref={listRef} aria-label={`${category.name} systems, most urgent first`}>
        <AnimatePresence initial={false} mode="popLayout">
          {ordered.map((entry, index) => {
            const emphasis = clamp((entry.cycle.urgency - 0.35) / 0.9, 0, 1);
            const inset = (1 - emphasis) * 16;
            const left = index % 2 === 0;
            const style = {
              '--inset-left': `${left ? inset : inset * 0.2}%`,
              '--inset-right': `${left ? inset * 0.2 : inset}%`,
            } as CSSProperties;
            return (
              <MaintenanceNode
                key={entry.item.id}
                entry={entry}
                category={category}
                scope={scope}
                emphasis={emphasis}
                strained={emphasis > 0.82}
                style={style}
                branch={false}
                showArea={false}
              />
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}

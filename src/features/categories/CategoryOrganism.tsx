import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { CategorySymbol } from '../../components/CategorySymbol';
import { arcPath, blobPath } from '../../components/organic/shapes';
import type { Category } from '../../db/types';
import type { HealthSummary } from '../../services/health';
import s from './CategoryOrganism.module.css';

interface Props {
  category: Category;
  summary: HealthSummary | undefined;
  size: number;
  layoutId?: string;
  /** Slow rotation of the membrane (header only). */
  alive?: boolean;
  className?: string;
}

/**
 * An area of life as an organism: its membrane gets lumpier as the area
 * degrades, and an incomplete ring around it shows how much health is left.
 */
export function CategoryOrganism({ category, summary, size, layoutId, alive = false, className }: Props) {
  const instability = summary?.instability ?? 0;
  const health = summary?.health ?? null;
  const membrane = useMemo(
    () => blobPath(category.id, { cx: 50, cy: 50, radius: 31, points: 7, variance: 0.07 + instability * 0.24 }),
    [category.id, instability],
  );
  const inner = useMemo(
    () => blobPath(`${category.id}:core`, { cx: 50, cy: 50, radius: 19, points: 6, variance: 0.1 + instability * 0.2 }),
    [category.id, instability],
  );
  const sweep = health === null ? 0 : Math.max(4, (health / 100) * 340);

  return (
    <motion.div
      layoutId={layoutId}
      className={className ? `${s.organism} ${className}` : s.organism}
      data-identity={category.color}
      data-status={summary?.worstStatus ?? 'stable'}
      data-empty={!summary || summary.total === 0 ? '' : undefined}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 100 100" className={s.svg} aria-hidden="true">
        <g className={alive ? s.alive : undefined}>
          <path d={membrane} className={s.membrane} />
          <path d={inner} className={s.inner} />
        </g>
        <path d={arcPath(50, 50, 44, 0, 359.9)} className={s.track} />
        {sweep > 0 && <path d={arcPath(50, 50, 44, 0, sweep)} className={s.health} />}
      </svg>
      <span className={s.symbol}>
        <CategorySymbol symbol={category.symbol} size={Math.round(size * 0.24)} strokeWidth={1.7} />
      </span>
    </motion.div>
  );
}

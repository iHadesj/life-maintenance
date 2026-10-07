import { motion } from 'framer-motion';
import { useMemo, type CSSProperties } from 'react';
import { organismLayoutId, type DiveVia } from '../../app/pageTransition';
import { useUI } from '../../app/ui';
import { CategorySymbol } from '../../components/CategorySymbol';
import { blobPath } from '../../components/organic/shapes';
import type { Category } from '../../db/types';
import type { Point } from '../../motion/transitions';
import { easings } from '../../motion/springs';
import type { MaintenanceStatus } from '../../services/cycle';
import { pct, plural } from '../../services/format';
import type { EvaluatedItem, HealthSummary } from '../../services/health';
import s from './CategoryCluster.module.css';

const DOT: Record<MaintenanceStatus, number> = {
  stable: 2.1,
  watch: 2.4,
  attention: 2.9,
  due: 3.2,
  overdue: 3.6,
  critical: 4.1,
};

interface Props {
  category: Category;
  entries: readonly EvaluatedItem[];
  summary: HealthSummary | undefined;
  onEnter: (category: Category, origin: Point, via: DiveVia) => void;
}

/**
 * An area as a cell: its systems float inside as a phyllotaxis spiral —
 * the most urgent at the nucleus, largest and brightest.
 */
export function CategoryCluster({ category, entries, summary, onEnter }: Props) {
  const ingestAt = useUI((state) => (state.ingested?.categoryId === category.id ? state.ingested.at : 0));
  const count = entries.length;
  const size = count ? Math.min(178, 112 + count * 10) : 84;
  const instability = summary?.instability ?? 0;

  const membrane = useMemo(
    () => blobPath(`${category.id}:cluster`, { cx: 50, cy: 50, radius: 41, points: 8, variance: 0.07 + instability * 0.26, squash: 0.93 }),
    [category.id, instability],
  );

  const dots = useMemo(
    () =>
      entries.slice(0, 48).map((entry, k) => {
        const r = (count > 12 ? 4.4 : 5.6) * Math.sqrt(k + 0.55);
        const a = k * 2.39996;
        return {
          id: entry.item.id,
          x: 50 + Math.cos(a) * r,
          y: 51 + Math.sin(a) * r * 0.93,
          r: DOT[entry.cycle.status],
          status: entry.cycle.status,
        };
      }),
    [entries, count],
  );

  const style = { '--size': `${size}px` } as CSSProperties;

  return (
    <li className={s.cluster} style={style} data-identity={category.color}>
      <button
        type="button"
        className={s.hit}
        onClick={(event) => {
          const box = event.currentTarget.querySelector('[data-shape]')?.getBoundingClientRect();
          const origin = box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : { x: event.clientX, y: event.clientY };
          onEnter(category, origin, 'cluster');
        }}
        aria-label={`${category.name}: ${count ? `${pct(summary?.health ?? null)} percent health, ${plural(count, 'system')}` : 'no systems'}. Open area.`}
      >
        <motion.div layoutId={organismLayoutId(category.id, 'cluster')} className={s.shape} data-shape="">
          <svg viewBox="0 0 100 100" aria-hidden="true">
            <path d={membrane} className={s.membrane} />
            {dots.map((dot) => (
              <circle key={dot.id} cx={dot.x} cy={dot.y} r={dot.r} className={s.dot} data-status={dot.status} />
            ))}
          </svg>
          {count === 0 && (
            <span className={s.emptySymbol}>
              <CategorySymbol symbol={category.symbol} size={20} />
            </span>
          )}
          {ingestAt > 0 && (
            <motion.span
              key={ingestAt}
              className={s.ingest}
              initial={{ scale: 0.3, opacity: 0.9 }}
              animate={{ scale: 1.5, opacity: 0, transition: { duration: 1.3, ease: easings.out } }}
              aria-hidden="true"
            />
          )}
        </motion.div>
        <span className={s.name}>
          <CategorySymbol symbol={category.symbol} size={12} strokeWidth={2} />
          {category.name.toUpperCase()}
          <span className="slash">/</span>
        </span>
        <span className={s.stats} data-status={summary?.worstStatus ?? 'stable'}>
          {count ? (
            <>
              <b>{pct(summary?.health ?? null)}%</b> · {plural(count, 'system')}
            </>
          ) : (
            'empty'
          )}
        </span>
      </button>
    </li>
  );
}

import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { STATUS_LABEL, type MaintenanceStatus } from '../services/cycle';
import { easings, springs } from '../motion/springs';
import { arcPath, circlePath } from './organic/shapes';
import s from './StatusGlyph.module.css';

/**
 * Ring integrity. A system's state is a ring that breaks apart as it ages —
 * readable without color: closed → opened → split → segmented → shattered.
 */

type Core = 'dot' | 'ring' | 'cross' | 'bang' | 'nucleus';

const C = 12;
const R = 8;

const dashes = (list: ReadonlyArray<readonly [number, number, number]>) => list.map(([r, a, b]) => arcPath(C, C, r, a, b));

const SHAPES: Record<MaintenanceStatus, { strokes: string[]; core: Core }> = {
  stable: { strokes: [circlePath(C, C, R)], core: 'dot' },
  watch: { strokes: [arcPath(C, C, R, 38, 338)], core: 'dot' },
  attention: { strokes: [arcPath(C, C, R, 22, 160), arcPath(C, C, R, 190, 334)], core: 'ring' },
  due: {
    strokes: [arcPath(C, C, R, 14, 70), arcPath(C, C, R, 104, 160), arcPath(C, C, R, 194, 250), arcPath(C, C, R, 284, 340)],
    core: 'cross',
  },
  overdue: {
    strokes: dashes([
      [8, 8, 30],
      [8.8, 52, 70],
      [7.4, 96, 110],
      [8.3, 140, 166],
      [9.2, 198, 212],
      [7.6, 236, 262],
      [8.5, 298, 318],
    ]),
    core: 'bang',
  },
  critical: {
    strokes: dashes([
      [9.8, 0, 14],
      [6.9, 42, 56],
      [10.6, 84, 94],
      [7.9, 122, 142],
      [10.2, 176, 186],
      [6.7, 212, 228],
      [10, 252, 262],
      [8.3, 300, 316],
      [11.2, 330, 338],
    ]),
    core: 'nucleus',
  },
};

const svgVariants: Variants = {
  hidden: { rotate: -60, opacity: 0 },
  shown: { rotate: 0, opacity: 1, transition: springs.snappy },
  gone: { rotate: 50, opacity: 0, transition: { duration: 0.22, ease: easings.in } },
};

const strokeVariants: Variants = {
  hidden: { pathLength: 0 },
  shown: (i: number) => ({ pathLength: 1, transition: { duration: 0.5, delay: 0.04 * i, ease: easings.out } }),
};

function CoreMark({ kind }: { kind: Core }) {
  switch (kind) {
    case 'dot':
      return <circle cx={C} cy={C} r={2.6} className={s.fill} />;
    case 'ring':
      return <circle cx={C} cy={C} r={2.5} />;
    case 'cross':
      return (
        <>
          <path d="M12 8.4v2M12 13.6v2M8.4 12h2M13.6 12h2" />
          <circle cx={C} cy={C} r={0.9} className={s.fill} />
        </>
      );
    case 'bang':
      return (
        <>
          <path d="M12 8.2v4.4" className={s.thick} />
          <circle cx={C} cy={15.6} r={1.1} className={s.fill} />
        </>
      );
    case 'nucleus':
      return (
        <>
          <circle cx={C} cy={C} r={3.3} className={s.halo} />
          <circle cx={C} cy={C} r={3.3} className={s.fill} />
        </>
      );
  }
}

interface Props {
  status: MaintenanceStatus;
  size?: number;
  /** Allow the ambient unrest of OVERDUE/CRITICAL. Off in dense or reduced contexts. */
  live?: boolean;
  label?: string;
  className?: string;
  layoutId?: string;
}

export function StatusGlyph({ status, size = 20, live = true, label, className, layoutId }: Props) {
  const shape = SHAPES[status];
  // An empty label marks the glyph as decorative (the text beside it says it all).
  const a11y = label === '' ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label ?? STATUS_LABEL[status] };
  return (
    <motion.span
      layoutId={layoutId}
      className={className ? `${s.glyph} ${className}` : s.glyph}
      data-status={status}
      style={{ width: size, height: size }}
      {...a11y}
    >
      <AnimatePresence initial={false}>
        <motion.svg
          key={status}
          viewBox="0 0 24 24"
          className={s.svg}
          data-live={live ? status : undefined}
          variants={svgVariants}
          initial="hidden"
          animate="shown"
          exit="gone"
          aria-hidden="true"
        >
          <g className={s.rings}>
            {shape.strokes.map((d, i) => (
              <motion.path key={i} d={d} custom={i} variants={strokeVariants} />
            ))}
          </g>
          <CoreMark kind={shape.core} />
        </motion.svg>
      </AnimatePresence>
    </motion.span>
  );
}

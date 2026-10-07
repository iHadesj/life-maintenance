import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { CycleIndicator } from '../../components/wear/CycleIndicator';
import { WEAR_HERO, headX, progressAtX } from '../../components/wear/geometry';
import { useElementWidth } from '../../hooks/useElementWidth';
import { springs } from '../../motion/springs';
import { agoLabel, cycleSentence, inLabel } from '../../services/format';
import { haptic } from '../../services/haptics';
import type { EvaluatedItem } from '../../services/health';
import s from './ResetLine.module.css';

interface Props {
  entry: EvaluatedItem;
  onReset: () => void;
}

/**
 * The hero wear line. Its head ("now") can be dragged back to the origin —
 * literally rewinding the cycle — to log a service.
 */
export function ResetLine({ entry, onReset }: Props) {
  const { item, cycle } = entry;
  const ref = useRef<HTMLDivElement>(null);
  const width = useElementWidth(ref, 340);
  const scale = width / WEAR_HERO.w;
  const headPx = headX(WEAR_HERO, cycle.cycleProgress) * scale;
  const originPx = WEAR_HERO.x0 * scale;
  const range = Math.max(0, headPx - originPx);
  const canReset = range > 22;

  const drag = useMotionValue(0);
  const committing = useRef(false);
  const override = useTransform(drag, (dx) => (dx === 0 && !committing.current ? -1 : progressAtX(WEAR_HERO, (headPx + dx) / scale)));
  const hint = useTransform(drag, [-40, 0], [0, 1]);
  const lineY = WEAR_HERO.y * scale;

  const onDragEnd = () => {
    const remaining = range > 0 ? (range + drag.get()) / range : 1;
    if (remaining < 0.16) {
      committing.current = true;
      haptic('success');
      animate(drag, -range, springs.snappy);
      onReset();
      window.setTimeout(() => {
        committing.current = false;
        drag.jump(0);
      }, 1150);
    } else {
      animate(drag, 0, springs.elastic);
    }
  };

  const due =
    cycle.daysOverdue > 0 ? `${cycle.daysOverdue}d past` : cycle.daysRemaining === 0 ? 'today' : inLabel(cycle.daysRemaining);

  return (
    <div className={s.wrap} data-status={cycle.status}>
      <div className={s.labels}>
        <span>
          <span className="label">last service</span>
          <b>{agoLabel(cycle.elapsedDays)}</b>
        </span>
        <span className={s.right}>
          <span className="label">{cycle.daysOverdue > 0 ? 'overdue' : 'next cycle'}</span>
          <b className={s.due}>{due}</b>
        </span>
      </div>

      <div className={s.track} ref={ref}>
        <CycleIndicator
          variant="hero"
          progress={cycle.cycleProgress}
          status={cycle.status}
          seed={item.id}
          override={override}
          label={cycleSentence(cycle)}
        />
        {canReset && (
          <motion.button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            className={s.handle}
            style={{ x: drag, left: headPx - 22, top: lineY - 22 }}
            drag="x"
            dragConstraints={{ left: -range, right: 0 }}
            dragElastic={0.08}
            dragMomentum={false}
            onDragStart={() => haptic('tick')}
            onDragEnd={onDragEnd}
          >
            <span className={s.grip} />
          </motion.button>
        )}
      </div>

      {canReset && (
        <motion.p className={s.hint} style={{ opacity: hint }} aria-hidden="true">
          ← drag <i>now</i> back to the origin to reset the cycle
        </motion.p>
      )}
    </div>
  );
}

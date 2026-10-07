import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  useTransform,
  useVelocity,
  type Variants,
} from 'framer-motion';
import { useRef, useState, type CSSProperties, type Ref } from 'react';
import { useReducedMotionPref } from '../../app/SystemData';
import { uiActions, useUI } from '../../app/ui';
import { CategorySymbol } from '../../components/CategorySymbol';
import { DecodeText } from '../../components/DecodeText';
import { StatusGlyph } from '../../components/StatusGlyph';
import { CycleIndicator } from '../../components/wear/CycleIndicator';
import type { Category } from '../../db/types';
import { useLongPress } from '../../hooks/useLongPress';
import { SWIPE_COMMIT_PX, velocityToSkew } from '../../motion/gestures';
import { easings } from '../../motion/springs';
import { agoLabel, counterCaption, counterLabel, cycleSentence } from '../../services/format';
import { haptic } from '../../services/haptics';
import type { EvaluatedItem } from '../../services/health';
import { maintenanceActions } from './actions';
import s from './MaintenanceNode.module.css';

const nodeVariants: Variants = {
  hidden: { clipPath: 'inset(0% 100% 0% 0%)', x: -18 },
  shown: {
    clipPath: 'inset(0% 0% 0% 0%)',
    x: 0,
    transition: { duration: 0.7, ease: easings.out },
    transitionEnd: { clipPath: 'none' },
  },
  gone: {
    clipPath: ['inset(0% 0% 0% 0%)', 'inset(0% 100% 0% 0%)'],
    x: -26,
    transition: { duration: 0.42, ease: easings.in },
  },
};

interface Props {
  entry: EvaluatedItem;
  category?: Category;
  /** Namespaces shared-element ids to the page that renders the node. */
  scope: string;
  /** 0..1 — how much presence the node claims (category field). */
  emphasis?: number;
  branch?: boolean;
  showArea?: boolean;
  /** Visibly under strain: the most urgent systems of a field distort slightly. */
  strained?: boolean;
  style?: CSSProperties;
  ref?: Ref<HTMLLIElement>;
}

/**
 * One maintained system.
 *   drag →  pushes time back along the wear line; release past the mark = SERVICE
 *   drag ←  stretches the node; release = EDIT
 *   hold    technical readout next to the finger
 *   tap     opens the system
 */
export function MaintenanceNode({
  entry,
  category,
  scope,
  emphasis = 0,
  branch = true,
  showArea = true,
  strained = false,
  style: slotStyle,
  ref,
}: Props) {
  const { item, cycle } = entry;
  const reduced = useReducedMotionPref();
  const justServiced = useUI((state) => Boolean(state.serviced[item.id]));

  const x = useMotionValue(0);
  const velocity = useVelocity(x);
  const skew = useSpring(
    useTransform(velocity, (v) => (reduced ? 0 : velocityToSkew(v))),
    { stiffness: 380, damping: 30 },
  );
  const compress = useTransform(x, [0, SWIPE_COMMIT_PX], [0, 0.9], { clamp: true });
  const stretch = useTransform(x, [-SWIPE_COMMIT_PX * 1.5, 0], [1.05, 1], { clamp: true });
  const spin = useTransform(x, [-SWIPE_COMMIT_PX, 0, SWIPE_COMMIT_PX], [24, 0, -260]);
  const serviceOpacity = useTransform(x, [10, SWIPE_COMMIT_PX * 0.8], [0, 1], { clamp: true });
  const serviceShift = useTransform(x, [0, SWIPE_COMMIT_PX], [-18, 0], { clamp: true });
  const editOpacity = useTransform(x, [-SWIPE_COMMIT_PX * 0.8, -10], [1, 0], { clamp: true });
  const editShift = useTransform(x, [-SWIPE_COMMIT_PX, 0], [0, 18], { clamp: true });

  const [armed, setArmed] = useState<-1 | 0 | 1>(0);
  const armedRef = useRef<-1 | 0 | 1>(0);
  const dragged = useRef(false);

  const press = useLongPress(
    (point) => {
      haptic('tick');
      uiActions.showHud({ itemId: item.id, x: point.x, y: point.y });
    },
    { onRelease: () => uiActions.hideHud() },
  );

  useMotionValueEvent(x, 'change', (value) => {
    const next = value >= SWIPE_COMMIT_PX ? 1 : value <= -SWIPE_COMMIT_PX ? -1 : 0;
    if (next === armedRef.current) return;
    armedRef.current = next;
    setArmed(next);
    if (next !== 0) haptic('tick');
  });

  const onDragEnd = () => {
    const action = armedRef.current;
    armedRef.current = 0;
    setArmed(0);
    if (action === 1) void maintenanceActions.service(item, cycle.status);
    else if (action === -1) maintenanceActions.edit(item.id);
  };

  const style = { ...slotStyle, '--emphasis': emphasis } as CSSProperties;

  return (
    <motion.li
      ref={ref}
      layout="position"
      className={s.node}
      data-status={cycle.status}
      data-armed={armed || undefined}
      data-branch={branch ? '' : undefined}
      data-strained={strained ? '' : undefined}
      style={style}
      variants={nodeVariants}
      initial="hidden"
      animate="shown"
      exit="gone"
    >
      <div className={s.actions} aria-hidden="true">
        <motion.span className={s.serviceAction} style={{ opacity: serviceOpacity, x: serviceShift }}>
          {armed === 1 ? 'release · service' : 'service →'}
        </motion.span>
        <motion.span className={s.editAction} style={{ opacity: editOpacity, x: editShift }}>
          {armed === -1 ? 'release · edit' : '← edit'}
        </motion.span>
      </div>

      <motion.div
        className={s.body}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.62}
        dragTransition={{ bounceStiffness: 480, bounceDamping: 24 }}
        style={{ x, skewX: skew, scaleX: stretch }}
        onDragStart={() => {
          dragged.current = true;
          press.cancel();
          uiActions.hideHud();
        }}
        onDragEnd={onDragEnd}
        onPointerDown={(event) => {
          dragged.current = false;
          press.handlers.onPointerDown(event);
        }}
        onPointerMove={press.handlers.onPointerMove}
        onPointerUp={press.handlers.onPointerUp}
        onPointerCancel={press.handlers.onPointerCancel}
        onContextMenu={press.handlers.onContextMenu}
      >
        {branch && (
          <svg className={s.branch} viewBox="0 0 24 26" aria-hidden="true">
            <path d="M0.5 0C0.5 15 7 25 24 25" />
          </svg>
        )}
        <button
          type="button"
          className={s.hit}
          onClick={() => {
            if (dragged.current || press.fired()) return;
            maintenanceActions.open(item.id);
          }}
          aria-label={`${item.title}${category ? `, ${category.name}` : ''}: ${cycleSentence(cycle)}. Open system.`}
        >
          <span className={s.head}>
            <motion.span className={s.glyphWrap} style={{ rotate: spin }} data-anchor="">
              <StatusGlyph status={cycle.status} size={20} layoutId={`${scope}:glyph:${item.id}`} live={!reduced} />
            </motion.span>
            <motion.span layoutId={`${scope}:title:${item.id}`} className={s.title}>
              {item.title}
            </motion.span>
            <span className={s.counter}>
              <b>{counterLabel(cycle)}</b>
              <small>{counterCaption(cycle)}</small>
            </span>
          </span>

          <CycleIndicator progress={cycle.cycleProgress} status={cycle.status} seed={item.id} compress={compress} grow />

          <span className={s.meta}>
            {justServiced ? (
              <DecodeText className={s.reset} text="SERVICE COMPLETE · CYCLE RESET" duration={620} />
            ) : (
              <>
                {showArea && category && (
                  <span className={s.area} data-identity={category.color}>
                    <CategorySymbol symbol={category.symbol} size={11} strokeWidth={2} />
                    {category.name}/
                  </span>
                )}
                <span>{cycle.intervalDays}d cycle</span>
                <span>last {agoLabel(cycle.elapsedDays)}</span>
              </>
            )}
          </span>
        </button>
      </motion.div>
    </motion.li>
  );
}

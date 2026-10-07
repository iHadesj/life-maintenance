import { motion, useDragControls, useMotionValue, useSpring, useTransform, useVelocity } from 'framer-motion';
import { useMemo, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { useElementWidth } from '../hooks/useElementWidth';
import { SHEET_DISMISS_PX, SHEET_DISMISS_VELOCITY } from '../motion/gestures';
import { springs } from '../motion/springs';
import { hashString } from '../services/math';
import s from './Sheet.module.css';

interface Props {
  label: string;
  onClose: () => void;
  children: ReactNode;
  /** Drag area content (title row). */
  header?: ReactNode;
  seed?: string;
  tall?: boolean;
  className?: string;
}

const EDGE_H = 34;

/**
 * The sheet's top edge is a living membrane: an asymmetric tab where the title
 * sits, flowing down to the right. Its curvature responds to the sheet's
 * velocity — it leads when rising, trails when falling.
 */
function edgePath(width: number, tension: number, seed: number): string {
  const w = Math.max(200, width);
  const tab = 0.34 + ((seed % 7) / 7) * 0.12;
  const t = tension * 9;
  const top = 5 - t * 0.5;
  const low = 17 + t * 0.6;
  const x1 = w * tab;
  const x2 = w * (tab + 0.16);
  return [
    `M0 ${EDGE_H}`,
    `L0 ${15 - t * 0.2}`,
    `C0 ${8} 5 ${top} 16 ${top}`,
    `L${x1.toFixed(1)} ${top}`,
    `C${(x1 + w * 0.06).toFixed(1)} ${top} ${(x2 - w * 0.07).toFixed(1)} ${low} ${x2.toFixed(1)} ${low}`,
    `L${(w - 18).toFixed(1)} ${low}`,
    `C${(w - 6).toFixed(1)} ${low} ${w} ${low + 3} ${w} ${low + 9}`,
    `L${w} ${EDGE_H}Z`,
  ].join('');
}

function edgeStroke(width: number, tension: number, seed: number): string {
  return edgePath(width, tension, seed).replace(/^M0 \d+L/, 'M').replace(/L[\d.]+ \d+Z$/, '');
}

export function Sheet({ label, onClose, children, header, seed = 'sheet', tall = false, className }: Props) {
  const ref = useRef<HTMLElement>(null);
  const controls = useDragControls();
  const seedNumber = useMemo(() => hashString(seed), [seed]);
  const width = useElementWidth(ref, 400);
  const vh = typeof window === 'undefined' ? 900 : window.innerHeight;

  const y = useMotionValue(vh);
  const velocity = useVelocity(y);
  const rawTension = useTransform(velocity, [-2600, 0, 2600], [1, 0, -1], { clamp: true });
  const tension = useSpring(rawTension, { stiffness: 420, damping: 18 });
  const fill = useTransform(tension, (t) => edgePath(width, t, seedNumber));
  const stroke = useTransform(tension, (t) => edgeStroke(width, t, seedNumber));

  useFocusTrap(ref, true, onClose);

  return createPortal(
    <div className={s.layer}>
      <motion.div
        className={s.scrim}
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.25 } }}
        aria-hidden="true"
      />
      <motion.section
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={[s.sheet, tall ? s.tall : '', className ?? ''].join(' ')}
        style={{ y }}
        initial={{ y: vh }}
        animate={{ y: 0, transition: springs.sheet }}
        exit={{ y: vh, transition: { ...springs.sheet, stiffness: 300 } }}
        drag="y"
        dragControls={controls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.05, bottom: 0.9 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > SHEET_DISMISS_PX || info.velocity.y > SHEET_DISMISS_VELOCITY) onClose();
        }}
      >
        <svg className={s.edge} viewBox={`0 0 ${Math.max(200, width)} ${EDGE_H}`} preserveAspectRatio="none" aria-hidden="true">
          <motion.path className={s.edgeFill} d={fill} />
          <motion.path className={s.edgeStroke} d={stroke} />
        </svg>
        <div className={s.grip} onPointerDown={(event) => controls.start(event)}>
          <span className={s.handle} aria-hidden="true" />
          {header}
        </div>
        <div className={s.body}>{children}</div>
      </motion.section>
    </div>,
    document.body,
  );
}

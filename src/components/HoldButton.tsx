import { animate, motion, useMotionValue, type AnimationPlaybackControls } from 'framer-motion';
import { useRef, useState } from 'react';
import { springs } from '../motion/springs';
import { haptic } from '../services/haptics';
import s from './HoldButton.module.css';

interface Props {
  label: string;
  holdingLabel?: string;
  onConfirm: () => void;
  ms?: number;
  tone?: 'danger' | 'brand';
  className?: string;
  disabled?: boolean;
}

/**
 * Destructive actions charge up while held. Releasing early discharges the
 * fill with a spring. Works with Space/Enter held down, too.
 */
export function HoldButton({ label, holdingLabel = 'keep holding', onConfirm, ms = 1100, tone = 'danger', className, disabled }: Props) {
  const charge = useMotionValue(0);
  const controls = useRef<AnimationPlaybackControls | null>(null);
  const done = useRef(false);
  const [holding, setHolding] = useState(false);

  const start = () => {
    if (disabled) return;
    done.current = false;
    setHolding(true);
    haptic('tick');
    controls.current?.stop();
    controls.current = animate(charge, 1, {
      duration: (ms / 1000) * (1 - charge.get()),
      ease: 'linear',
      onComplete: () => {
        done.current = true;
        setHolding(false);
        haptic('heavy');
        onConfirm();
      },
    });
  };

  const cancel = () => {
    if (done.current) return;
    setHolding(false);
    controls.current?.stop();
    controls.current = animate(charge, 0, springs.snappy);
  };

  return (
    <button
      type="button"
      className={[s.hold, s[tone], className ?? ''].join(' ')}
      data-holding={holding || undefined}
      disabled={disabled}
      aria-label={`${label} — press and hold to confirm`}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
          event.preventDefault();
          start();
        }
      }}
      onKeyUp={(event) => {
        if (event.key === 'Enter' || event.key === ' ') cancel();
      }}
    >
      <motion.span className={s.charge} style={{ scaleX: charge }} aria-hidden="true" />
      <span className={s.text}>{holding ? holdingLabel : label}</span>
    </button>
  );
}

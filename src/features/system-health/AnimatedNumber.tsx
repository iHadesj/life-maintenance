import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { useEffect } from 'react';
import { useReducedMotionPref } from '../../app/SystemData';
import { easings } from '../../motion/springs';

interface Props {
  value: number;
  /** Count up from here on mount (e.g. 0 during the boot build). */
  from?: number;
  className?: string;
}

/** A readout that travels to its new value instead of jumping. */
export function AnimatedNumber({ value, from, className }: Props) {
  const reduced = useReducedMotionPref();
  const mv = useMotionValue(from ?? value);
  const text = useTransform(mv, (v) => String(Math.round(v)));

  useEffect(() => {
    if (reduced) {
      mv.jump(value);
      return;
    }
    const controls = animate(mv, value, { duration: 1.2, ease: easings.out });
    return () => controls.stop();
  }, [value, reduced, mv]);

  return <motion.span className={className}>{text}</motion.span>;
}

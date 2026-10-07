import { animate, motion, useMotionValue, useMotionValueEvent, useScroll, useTransform } from 'framer-motion';
import { useEffect, useRef, type ReactNode } from 'react';
import { PULL_COMMIT_PX, rubberband } from '../motion/gestures';
import { springs } from '../motion/springs';
import { pageVariants, type PageTransition } from '../motion/transitions';
import { haptic } from '../services/haptics';
import { pageScrollProgress, pageScrollY } from './pageTransition';
import { uiActions } from './ui';
import s from './PageFrame.module.css';

interface Props {
  transition: PageTransition;
  label: string;
  children?: ReactNode;
  /** Pull down at the top to run SYSTEM CHECK. */
  pullToCheck?: boolean;
  className?: string;
}

/**
 * A page: its own scroll container (so outgoing and incoming pages can overlap
 * during choreography without layout jumps) and the shared scroll signal.
 */
export function PageFrame({ transition, label, children, pullToCheck = false, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const pull = useMotionValue(0);
  const pullProgress = useTransform(pull, [0, PULL_COMMIT_PX], [0, 1], { clamp: true });
  const indicatorOpacity = useTransform(pull, [8, 40], [0, 1]);
  const arc = useTransform(pullProgress, (p) => p * 0.999);

  // The page's own scroll feeds the shared signals (header, parallax, depth).
  const { scrollY, scrollYProgress } = useScroll({ container: ref });
  useMotionValueEvent(scrollY, 'change', (value) => pageScrollY.set(value));
  useMotionValueEvent(scrollYProgress, 'change', (value) => pageScrollProgress.set(value));

  useEffect(() => {
    pageScrollY.set(ref.current?.scrollTop ?? 0);
    pageScrollProgress.set(0);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!pullToCheck || !el) return;
    let startY = 0;
    let tracking = false;
    let armed = false;

    const onStart = (event: TouchEvent) => {
      if (el.scrollTop > 0 || event.touches.length !== 1) return;
      startY = event.touches[0].clientY;
      tracking = true;
      armed = false;
    };
    const onMove = (event: TouchEvent) => {
      if (!tracking) return;
      const dy = event.touches[0].clientY - startY;
      if (dy <= 0 || el.scrollTop > 0) {
        pull.set(0);
        return;
      }
      event.preventDefault();
      pull.set(rubberband(dy, 320, 0.6));
      const nowArmed = pull.get() >= PULL_COMMIT_PX;
      if (nowArmed !== armed) {
        armed = nowArmed;
        if (armed) haptic('tick');
      }
    };
    const onEnd = () => {
      if (!tracking) return;
      tracking = false;
      if (armed) {
        haptic('confirm');
        uiActions.requestCheck();
      }
      armed = false;
      animate(pull, 0, springs.elastic);
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [pullToCheck, pull]);

  return (
    <motion.div
      ref={ref}
      className={className ? `${s.frame} ${className}` : s.frame}
      custom={transition}
      variants={pageVariants}
      initial="initial"
      animate="enter"
      exit="exit"
      layoutScroll
      aria-label={label}
      role="region"
    >
      {pullToCheck && (
        <motion.div className={s.pull} style={{ opacity: indicatorOpacity }} aria-hidden="true">
          <svg viewBox="0 0 24 24" className={s.pullArc}>
            <circle cx="12" cy="12" r="9" className={s.pullTrack} />
            <motion.circle cx="12" cy="12" r="9" className={s.pullFill} style={{ pathLength: arc }} />
          </svg>
          <span className="label">system check</span>
        </motion.div>
      )}
      <motion.div className={s.content} style={pullToCheck ? { y: pull } : undefined}>
        {children}
      </motion.div>
    </motion.div>
  );
}

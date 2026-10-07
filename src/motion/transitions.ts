import type { Variants } from 'framer-motion';
import { easings, springs } from './springs';

/**
 * Page choreography.
 *
 *  scan     tab → tab: the next view is written over the previous one by a scan line
 *  dive     system → area: the area's organism grows out of its orbit and becomes the page
 *  surface  area → system: the page folds back into the satellite it came from
 *  boot     first paint: the page builds itself after the boot line
 */

export type PageTransitionKind = 'boot' | 'scan' | 'dive' | 'surface' | 'fade';

export interface Point {
  x: number;
  y: number;
}

export interface PageTransition {
  kind: PageTransitionKind;
  /** 1 = moving forward/right, -1 = back/left */
  dir: 1 | -1;
  origin: Point | null;
  reduced: boolean;
}

export const SCAN_DURATION = 0.5;

const viewport = () => ({
  w: typeof window === 'undefined' ? 414 : window.innerWidth,
  h: typeof window === 'undefined' ? 896 : window.innerHeight,
});

const circle = (o: Point | null, r: number) => {
  const p = o ?? { x: viewport().w / 2, y: viewport().h / 2 };
  return `circle(${Math.round(r)}px at ${Math.round(p.x)}px ${Math.round(p.y)}px)`;
};

const coverRadius = (o: Point | null) => {
  const { w, h } = viewport();
  const p = o ?? { x: w / 2, y: h / 2 };
  return Math.hypot(Math.max(p.x, w - p.x), Math.max(p.y, h - p.y)) + 24;
};

const originOf = (o: Point | null) => {
  const { w, h } = viewport();
  return o ? { originX: o.x / w, originY: o.y / h } : { originX: 0.5, originY: 0.5 };
};

export const pageVariants: Variants = {
  initial: (t: PageTransition) => {
    if (t.reduced) return { opacity: 0, zIndex: 2 };
    switch (t.kind) {
      case 'scan':
        return {
          clipPath: t.dir > 0 ? 'inset(0% 0% 0% 100%)' : 'inset(0% 100% 0% 0%)',
          x: 0,
          scale: 1,
          opacity: 1,
          zIndex: 2,
        };
      case 'dive':
        return { clipPath: circle(t.origin, 0), x: 0, scale: 1, opacity: 1, zIndex: 2 };
      case 'surface':
        return { scale: 1.32, opacity: 0, x: 0, zIndex: 1, ...originOf(t.origin) };
      case 'fade':
        return { opacity: 0, zIndex: 2 };
      default:
        return { opacity: 1, zIndex: 2 };
    }
  },
  enter: (t: PageTransition) => {
    if (t.reduced) return { opacity: 1, transition: { duration: 0.16 } };
    switch (t.kind) {
      case 'scan':
        return {
          clipPath: 'inset(0% 0% 0% 0%)',
          transition: { duration: SCAN_DURATION, ease: easings.scan },
          transitionEnd: { clipPath: 'none' },
        };
      case 'dive':
        return {
          clipPath: circle(t.origin, coverRadius(t.origin)),
          transition: { duration: 0.62, ease: easings.out },
          transitionEnd: { clipPath: 'none' },
        };
      case 'surface':
        return { scale: 1, opacity: 1, transition: { ...springs.layout, opacity: { duration: 0.32 } } };
      default:
        return { opacity: 1, transition: { duration: 0.24 } };
    }
  },
  exit: (t: PageTransition) => {
    if (t.reduced) return { opacity: 0, transition: { duration: 0.12 } };
    switch (t.kind) {
      case 'scan':
        return {
          x: `${-t.dir * 14}%`,
          opacity: 0,
          zIndex: 1,
          transition: { duration: SCAN_DURATION, ease: easings.scan },
        };
      case 'dive':
        return {
          scale: 1.42,
          opacity: 0,
          zIndex: 1,
          ...originOf(t.origin),
          transition: { duration: 0.5, ease: easings.out },
        };
      case 'surface':
        return {
          clipPath: [circle(t.origin, coverRadius(t.origin)), circle(t.origin, 0)],
          zIndex: 3,
          transition: { duration: 0.5, ease: easings.organic },
        };
      default:
        return { opacity: 0, zIndex: 1, transition: { duration: 0.2 } };
    }
  },
};

/** Content sprouting sideways out of a conduit line. */
export const sproutVariants: Variants = {
  hidden: { clipPath: 'inset(0% 100% 0% 0%)', x: -14 },
  shown: {
    clipPath: 'inset(0% 0% 0% 0%)',
    x: 0,
    transition: { duration: 0.6, ease: easings.out },
    transitionEnd: { clipPath: 'none' },
  },
};

/** Text rising through a mask, as if printed from below the baseline. */
export const maskRiseVariants: Variants = {
  hidden: { clipPath: 'inset(0% 0% 100% 0%)', y: '45%' },
  shown: {
    clipPath: 'inset(0% 0% 0% 0%)',
    y: '0%',
    transition: { duration: 0.7, ease: easings.out },
    transitionEnd: { clipPath: 'none' },
  },
};

/** Lines drawing themselves. */
export const drawVariants: Variants = {
  hidden: { pathLength: 0 },
  shown: { pathLength: 1, transition: { duration: 0.9, ease: easings.out } },
};

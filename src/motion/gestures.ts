import { clamp } from '../services/math';

/** Hold this long without moving to trigger a long press. */
export const LONG_PRESS_MS = 420;
/** Pointer travel that cancels a pending long press. */
export const MOVE_TOLERANCE_PX = 9;
/** Horizontal travel at which a node swipe commits its action. */
export const SWIPE_COMMIT_PX = 104;
/** Pull distance at which SYSTEM CHECK runs. */
export const PULL_COMMIT_PX = 86;
/** Drag distance (or velocity) that dismisses a sheet. */
export const SHEET_DISMISS_PX = 120;
export const SHEET_DISMISS_VELOCITY = 650;

/**
 * Rubber band: resistance grows with distance, like iOS overscroll.
 * Keeps dragged objects predictable — they always follow the finger, just less.
 */
export function rubberband(distance: number, dimension: number, constant = 0.55): number {
  if (distance === 0) return 0;
  const sign = Math.sign(distance);
  const d = Math.abs(distance);
  return sign * ((d * dimension * constant) / (dimension + constant * d));
}

/** Horizontal velocity (px/s) → skew (deg): fast flicks lean the object. */
export function velocityToSkew(velocity: number, max = 7): number {
  return clamp(velocity / 160, -max, max);
}

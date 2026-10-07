/**
 * Named springs. Every movement in the interface uses one of these, so the
 * whole system shares one physical "material".
 */
export const springs = {
  /** Default settle: organic, a hint of overshoot. */
  organic: { type: 'spring', stiffness: 170, damping: 24, mass: 1 },
  /** Precise responses to taps and toggles. */
  snappy: { type: 'spring', stiffness: 460, damping: 38 },
  /** Objects released after a drag, returning to rest. */
  elastic: { type: 'spring', stiffness: 520, damping: 22, mass: 0.7 },
  /** Shared-element travel between places. */
  layout: { type: 'spring', stiffness: 300, damping: 34 },
  /** Sheets rising out of the floor. */
  sheet: { type: 'spring', stiffness: 360, damping: 36, mass: 0.9 },
  /** A cycle rewinding to zero after a service: fast, with recoil. */
  rewind: { type: 'spring', stiffness: 130, damping: 14, mass: 0.8 },
  /** Wear accumulating: time grows slowly into the line. */
  wear: { type: 'spring', stiffness: 48, damping: 16, mass: 1 },
} as const;

export const easings = {
  out: [0.16, 1, 0.3, 1],
  organic: [0.65, 0, 0.35, 1],
  scan: [0.7, 0, 0.2, 1],
  in: [0.5, 0, 0.75, 0],
} as const;

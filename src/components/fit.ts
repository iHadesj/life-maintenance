import type { CSSProperties } from 'react';

/** Inline variables for the global `.fit` class: size a display line to its length. */
export function fit(text: string, max = '6rem'): CSSProperties {
  return { '--chars': Math.max(1, text.length), '--fit-max': max } as CSSProperties;
}

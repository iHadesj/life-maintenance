import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import { LONG_PRESS_MS, MOVE_TOLERANCE_PX } from '../motion/gestures';

interface Options {
  ms?: number;
  tolerance?: number;
  onRelease?: () => void;
}

/**
 * Hold-to-inspect. Cancels as soon as the finger travels, so it coexists with
 * horizontal drags and vertical scrolling on the same element.
 */
export function useLongPress(onLongPress: (point: { x: number; y: number }) => void, options: Options = {}) {
  const { ms = LONG_PRESS_MS, tolerance = MOVE_TOLERANCE_PX, onRelease } = options;
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const callback = useRef(onLongPress);
  const release = useRef(onRelease);
  callback.current = onLongPress;
  release.current = onRelease;

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => clear, [clear]);

  const handlers = useMemo(
    () => ({
      onPointerDown(event: ReactPointerEvent) {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        fired.current = false;
        origin.current = { x: event.clientX, y: event.clientY };
        clear();
        timer.current = window.setTimeout(() => {
          timer.current = null;
          fired.current = true;
          if (origin.current) callback.current(origin.current);
        }, ms);
      },
      onPointerMove(event: ReactPointerEvent) {
        if (!origin.current || timer.current === null) return;
        if (Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y) > tolerance) clear();
      },
      onPointerUp() {
        clear();
        if (fired.current) release.current?.();
        origin.current = null;
      },
      onPointerCancel() {
        clear();
        if (fired.current) release.current?.();
        origin.current = null;
      },
      onContextMenu(event: ReactMouseEvent) {
        if (fired.current || timer.current !== null) event.preventDefault();
      },
    }),
    [clear, ms, tolerance],
  );

  return {
    handlers,
    /** True when the current/last press became a long press (suppress the tap). */
    fired: () => fired.current,
    cancel: clear,
  };
}

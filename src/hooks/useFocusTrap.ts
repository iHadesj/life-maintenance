import { useEffect, useRef, type RefObject } from 'react';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Keeps keyboard focus inside a dialog, closes on Escape, restores focus after. */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active: boolean, onEscape?: () => void): void {
  const escape = useRef(onEscape);
  escape.current = onEscape;

  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusables = () =>
      Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);

    const timer = window.setTimeout(() => {
      if (root.contains(document.activeElement)) return;
      const target = root.querySelector<HTMLElement>('[data-autofocus]') ?? root;
      target.focus({ preventScroll: true });
    }, 60);

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        escape.current?.();
        return;
      }
      if (event.key !== 'Tab') return;
      const list = focusables();
      if (list.length === 0) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === root)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    root.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      root.removeEventListener('keydown', onKey);
      // Never hand focus back to the keyboard proxy: that would keep iOS's keyboard up.
      if (previous && previous.id !== 'lm-focus-proxy' && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [active, ref]);
}

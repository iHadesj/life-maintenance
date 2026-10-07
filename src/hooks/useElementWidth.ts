import { useLayoutEffect, useState, type RefObject } from 'react';

export function useElementWidth(ref: RefObject<HTMLElement | SVGElement | null>, fallback = 360): number {
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.getBoundingClientRect().width || fallback);
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width;
      if (next > 0) setWidth(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, fallback]);
  return width;
}

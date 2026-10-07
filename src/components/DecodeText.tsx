import { useEffect, useRef, type ElementType } from 'react';
import { useReducedMotionPref } from '../app/SystemData';

const GLYPHS = '▚▞▙▟░▒/\\<>_=+*#01';

interface Props {
  text: string;
  /** Run the decode (e.g. once in view, or after boot). */
  active?: boolean;
  duration?: number;
  delay?: number;
  className?: string;
  as?: ElementType;
}

/**
 * Text that resolves left to right out of noise, like a terminal printing a
 * value it just computed. Mono text only (no width jitter). Assistive tech
 * always reads the final text.
 */
export function DecodeText({ text, active = true, duration = 520, delay = 0, className, as: Tag = 'span' }: Props) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotionPref();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!active || reduced) {
      el.textContent = text;
      return;
    }
    let raf = 0;
    const start = performance.now() + delay;
    const tick = (time: number) => {
      const k = Math.min(1, Math.max(0, (time - start) / duration));
      const revealed = Math.floor(k * text.length);
      let out = '';
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        out += i < revealed || ch === ' ' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.textContent = text;
    };
  }, [text, active, duration, delay, reduced]);

  return (
    <Tag className={className}>
      <span className="visually-hidden">{text}</span>
      <span ref={ref} aria-hidden="true">
        {text}
      </span>
    </Tag>
  );
}

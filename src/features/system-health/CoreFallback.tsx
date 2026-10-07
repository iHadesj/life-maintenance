import { useId, useMemo, type CSSProperties } from 'react';
import { arcPath, blobPath } from '../../components/organic/shapes';
import { corePalette, rgbCss } from './coreColors';
import s from './CoreFallback.module.css';

interface Props {
  instability: number;
  /** No systems yet: a dormant scanner looking for something to monitor. */
  dormant?: boolean;
}

/**
 * Lightweight core: SVG layers rotated by compositor-only CSS animations.
 * Used before Three.js loads, when WebGL is unavailable, or by preference.
 */
export function CoreFallback({ instability, dormant = false }: Props) {
  const gradient = `core-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const { inner, rim } = corePalette(instability);
  const body = useMemo(
    () => blobPath('system-core', { cx: 50, cy: 50, radius: 27, points: 9, variance: 0.04 + instability * 0.3 }),
    [instability],
  );
  const shell = useMemo(
    () => blobPath('system-shell', { cx: 50, cy: 50, radius: 35, points: 11, variance: 0.03 + instability * 0.22 }),
    [instability],
  );
  const fragments = useMemo(() => {
    if (instability < 0.25) return [];
    const count = Math.round(4 + instability * 10);
    return Array.from({ length: count }, (_, i) => {
      const start = (i / count) * 360 + (i % 3) * 7;
      const r = 41 + ((i * 37) % 9) - 3 * instability;
      return arcPath(50, 50, r, start, start + 8 + ((i * 13) % 14));
    });
  }, [instability]);

  const style = {
    '--core-inner': rgbCss(inner),
    '--core-rim': rgbCss(rim),
    '--core-speed': `${Math.max(9, 34 - instability * 26)}s`,
  } as CSSProperties;

  if (dormant) {
    return (
      <div className={`${s.core} ${s.dormant}`} aria-hidden="true">
        <svg viewBox="0 0 100 100" className={s.layer}>
          <circle cx="50" cy="50" r="38" className={s.dormantRing} />
          <circle cx="50" cy="50" r="24" className={s.dormantRing} />
          <circle cx="50" cy="50" r="2" className={s.dormantDot} />
        </svg>
        <div className={s.radar} />
      </div>
    );
  }

  return (
    <div className={s.core} style={style} aria-hidden="true">
      <svg viewBox="0 0 100 100" className={`${s.layer} ${s.spinSlow}`}>
        <path d={arcPath(50, 50, 46, 10, 150)} className={s.orbitLine} />
        <path d={arcPath(50, 50, 46, 190, 330)} className={s.orbitLine} />
        {fragments.map((d, i) => (
          <path key={i} d={d} className={s.fragment} />
        ))}
      </svg>
      <svg viewBox="0 0 100 100" className={`${s.layer} ${s.spinReverse}`}>
        <circle cx="50" cy="50" r="40" className={s.dashRing} />
      </svg>
      <svg viewBox="0 0 100 100" className={`${s.layer} ${s.breathe}`}>
        <defs>
          <radialGradient id={gradient} cx="42%" cy="38%" r="70%">
            <stop offset="0%" stopColor={rgbCss(inner, 0.95)} />
            <stop offset="55%" stopColor={rgbCss(inner, 0.38)} />
            <stop offset="100%" stopColor={rgbCss(rim, 0.08)} />
          </radialGradient>
        </defs>
        <path d={shell} className={s.shell} />
        <path d={body} fill={`url(#${gradient})`} className={s.body} />
      </svg>
    </div>
  );
}

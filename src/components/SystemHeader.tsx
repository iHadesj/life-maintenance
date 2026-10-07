import { AnimatePresence, motion, useTransform } from 'framer-motion';
import { pageScrollY } from '../app/pageTransition';
import type { Route } from '../app/router';
import { useSystemData } from '../app/SystemData';
import { uiActions } from '../app/ui';
import { easings } from '../motion/springs';
import { formatDayHeader } from '../services/dates';
import { pct } from '../services/format';
import { isAppleDevice } from '../services/platform';
import { DecodeText } from './DecodeText';
import { StatusGlyph } from './StatusGlyph';
import { SystemNav } from './SystemNav';
import s from './SystemHeader.module.css';

function segmentFor(route: Route, categoryName: (id: string) => string): string {
  switch (route.name) {
    case 'category':
      return `${categoryName(route.id ?? '').toUpperCase()}/`;
    case 'queue':
      return 'QUEUE';
    case 'log':
      return 'LOG';
    case 'settings':
      return 'SETTINGS';
    default:
      return 'SYSTEM';
  }
}

/**
 * The path bar: LIFE/ + where you are. Transparent at rest; as the page
 * scrolls it condenses onto a backdrop and picks up the live health readout.
 */
export function SystemHeader({ route }: { route: Route }) {
  const { summary, now, categoryName, desktop } = useSystemData();
  const backdrop = useTransform(pageScrollY, [8, 64], [0, 1]);
  const readoutShift = useTransform(pageScrollY, [40, 140], [6, 0]);
  const segment = segmentFor(route, categoryName);
  const shortcut = isAppleDevice() ? '⌘K' : 'Ctrl K';

  return (
    <header className={s.header}>
      <motion.div className={s.backdrop} style={{ opacity: backdrop }} aria-hidden="true" />
      <a href="#/" className={s.path} aria-label={`Life Maintenance, ${segment.replace('/', '')}`}>
        <span className={s.root}>
          LIFE<span className="slash">/</span>
        </span>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={segment}
            className={s.segment}
            initial={{ clipPath: 'inset(0% 100% 0% 0%)' }}
            animate={{ clipPath: 'inset(0% 0% 0% 0%)', transition: { duration: 0.42, ease: easings.out } }}
            exit={{ clipPath: 'inset(0% 0% 0% 100%)', transition: { duration: 0.2, ease: easings.in } }}
          >
            <DecodeText text={segment} duration={360} />
          </motion.span>
        </AnimatePresence>
      </a>

      {desktop && <SystemNav route={route} variant="tabs" />}

      <motion.div className={s.status} style={{ y: readoutShift }}>
        <span className={s.date}>{formatDayHeader(now)}</span>
        <button
          type="button"
          className={s.readout}
          onClick={() => uiActions.openPalette()}
          aria-label={`System health ${pct(summary.health)} percent. Open command terminal.`}
        >
          <StatusGlyph status={summary.worstStatus ?? 'stable'} size={13} live={false} />
          <span>{summary.total ? `${pct(summary.health)}%` : '--'}</span>
          {desktop && <kbd className={s.kbd}>{shortcut}</kbd>}
        </button>
      </motion.div>
    </header>
  );
}

import { AnimatePresence, motion } from 'framer-motion';
import { useSystemData } from '../../app/SystemData';
import { settingsRepository } from '../../repositories/settings';
import { easings } from '../../motion/springs';
import { FIRST_SUGGESTIONS } from '../../services/defaults';
import { intervalHuman } from '../../services/format';
import { normalizeText } from '../../services/search';
import { maintenanceActions } from '../maintenance/actions';
import s from './Suggestions.module.css';

/**
 * After the first system exists: how to read the line, and a few systems that
 * usually wear out silently. Each one opens the editor pre-filled — nothing is
 * ever added without the user registering it.
 */
export function Suggestions() {
  const { items, settings } = useSystemData();
  const known = new Set(items.map((item) => normalizeText(item.title)));
  const list = FIRST_SUGGESTIONS.filter((sug) => !known.has(normalizeText(sug.title)));
  const visible = !settings.suggestionsDismissed && items.length > 0 && items.length <= 6 && list.length > 0;

  return (
    <AnimatePresence initial={false}>
      {visible && (
        <motion.section
          className={s.suggest}
          aria-labelledby="suggestions-title"
          initial={{ clipPath: 'inset(0% 100% 0% 0%)' }}
          animate={{ clipPath: 'inset(0% 0% 0% 0%)', transition: { duration: 0.7, ease: easings.out } }}
          exit={{ clipPath: 'inset(0% 0% 0% 100%)', transition: { duration: 0.35, ease: easings.in } }}
        >
          <div className={s.legend} aria-label="How to read a system">
            <span className={s.legendLine} aria-hidden="true">
              <i className={s.dot} />
              <i className={s.rule} />
              <i className={s.ring} />
            </span>
            <span>
              <b>●</b> last service <b>──</b> time passing <b>◌</b> end of cycle. The line frays as a system wears. Swipe a
              system right to log a service.
            </span>
          </div>

          <header className={s.head}>
            <h2 id="suggestions-title" className="label">
              suggested systems
            </h2>
            <button type="button" className={s.dismiss} onClick={() => void settingsRepository.set('suggestionsDismissed', true)}>
              dismiss
            </button>
          </header>
          <ul className={s.list}>
            {list.map((sug) => (
              <li key={sug.key}>
                <button type="button" className={s.item} onClick={() => maintenanceActions.create({ suggestion: sug.key })}>
                  <span className={s.plus} aria-hidden="true">
                    +
                  </span>
                  <span className={s.title}>{sug.title}</span>
                  <span className={s.interval}>{intervalHuman(sug.intervalDays)}</span>
                </button>
              </li>
            ))}
          </ul>
        </motion.section>
      )}
    </AnimatePresence>
  );
}

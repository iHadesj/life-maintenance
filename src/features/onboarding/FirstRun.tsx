import { motion } from 'framer-motion';
import { useUI } from '../../app/ui';
import { fit } from '../../components/fit';
import { maskRiseVariants } from '../../motion/transitions';
import { easings } from '../../motion/springs';
import { isIOS, isStandalone } from '../../services/platform';
import { CoreView } from '../system-health/CoreView';
import { maintenanceActions } from '../maintenance/actions';
import s from './FirstRun.module.css';

/**
 * Empty system. No slides: the product introduces itself in two lines and
 * hands over the prompt. The dormant core keeps scanning for something to
 * monitor until the first system is registered.
 */
export function FirstRun() {
  const booting = useUI((state) => state.boot !== 'done');
  const shown = booting ? 'hidden' : 'shown';
  const showInstallHint = isIOS() && !isStandalone();

  return (
    <section className={s.first} aria-labelledby="first-run-title">
      <div className={s.core}>
        <CoreView instability={0} dormant />
      </div>

      <motion.h1 id="first-run-title" className={s.brand} variants={maskRiseVariants} initial="hidden" animate={shown}>
        <span className="fit" style={fit('LIFE/', '7rem')}>
          LIFE<span className="slash">/</span>
        </span>
        <span className="fit" style={fit('MAINTENANCE', '7rem')}>
          MAINTENANCE
        </span>
      </motion.h1>

      <motion.p
        className={s.motto}
        variants={maskRiseVariants}
        initial="hidden"
        animate={shown}
        transition={{ delay: 0.2 }}
      >
        Nothing is maintenance-free.
      </motion.p>

      <motion.div
        className={s.block}
        initial={{ clipPath: 'inset(0% 100% 0% 0%)' }}
        animate={booting ? undefined : { clipPath: 'inset(0% 0% 0% 0%)' }}
        transition={{ duration: 0.8, delay: 0.45, ease: easings.out }}
      >
        <p className="label">no systems registered</p>
        <p className={s.copy}>Life Maintenance cannot evaluate a system it doesn&apos;t know yet.</p>
        <button type="button" className={s.prompt} onClick={() => maintenanceActions.create()} data-autofocus="">
          <span className={s.mark} aria-hidden="true">
            &gt;
          </span>
          <span className={s.typed}>register your first system</span>
          <span className="cursor" aria-hidden="true" />
        </button>
        {showInstallHint && (
          <p className={s.hint}>
            tip · install it: Share <span aria-hidden="true">⎋</span> → Add to Home Screen. It works fully offline.
          </p>
        )}
      </motion.div>
    </section>
  );
}

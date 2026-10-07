import { useState } from 'react';
import type { DiveVia } from '../../app/pageTransition';
import { useSystemData } from '../../app/SystemData';
import { useUI } from '../../app/ui';
import type { Category } from '../../db/types';
import type { Point } from '../../motion/transitions';
import { CoreView } from './CoreView';
import { HealthReadout } from './HealthReadout';
import { OrbitMap } from './OrbitMap';
import s from './SystemHealth.module.css';

interface Props {
  onEnter: (category: Category, origin: Point, via: DiveVia) => void;
}

/**
 * SYSTEM HEALTH: the core (state of everything at once), the areas orbiting
 * it, and the readout — one composition instead of a dashboard of widgets.
 * Mounted under the boot overlay, it holds collapsed and builds on release.
 */
export function SystemHealth({ onEnter }: Props) {
  const { summary, diagnosis, categories, categorySummaries } = useSystemData();
  const boot = useUI((state) => state.boot);
  const [build] = useState(() => boot !== 'done');
  const hold = boot !== 'done';

  return (
    <section className={s.hero} aria-label="System health">
      <OrbitMap
        categories={categories}
        summaries={categorySummaries}
        build={build}
        release={!hold}
        onEnter={onEnter}
        core={<CoreView instability={summary.instability} />}
      />
      <HealthReadout summary={summary} diagnosis={diagnosis} build={build} hold={hold} />
    </section>
  );
}

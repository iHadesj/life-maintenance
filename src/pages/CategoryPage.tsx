import { motion, useTransform } from 'framer-motion';
import { useEffect } from 'react';
import { PageFrame } from '../app/PageFrame';
import { diveRecord, organismLayoutId, pageScrollY } from '../app/pageTransition';
import { navigate, openOverlay, pathFor } from '../app/router';
import { useSystemData } from '../app/SystemData';
import { fit } from '../components/fit';
import { CategoryField } from '../features/categories/CategoryField';
import { CategoryOrganism } from '../features/categories/CategoryOrganism';
import { maintenanceActions } from '../features/maintenance/actions';
import { maskRiseVariants } from '../motion/transitions';
import type { PageTransition } from '../motion/transitions';
import { pct } from '../services/format';
import s from './CategoryPage.module.css';

export function CategoryPage({ id, transition }: { id: string; transition: PageTransition }) {
  const { categoryById, categorySummaries, byCategory, ready } = useSystemData();
  const category = categoryById.get(id);
  const organismY = useTransform(pageScrollY, [0, 300], [0, 120]);
  const organismScale = useTransform(pageScrollY, [0, 300], [1, 0.82]);

  useEffect(() => {
    if (ready && !category) navigate(pathFor('system'), { replace: true });
  }, [ready, category]);

  if (!category) {
    return <PageFrame transition={transition} label="Area" />;
  }

  const summary = categorySummaries.get(id);
  const entries = byCategory.get(id) ?? [];
  const record = diveRecord(id);
  const layoutId = transition.kind === 'dive' && record ? organismLayoutId(id, record.via) : undefined;
  const name = category.name.toUpperCase();

  return (
    <PageFrame transition={transition} label={`${category.name} area`}>
      <header className={s.head} data-identity={category.color}>
        <p className="label">area</p>
        <motion.h1
          className={`${s.title} fit`}
          style={fit(`${name}/`, '5.75rem')}
          variants={maskRiseVariants}
          initial="hidden"
          animate="shown"
        >
          {name}
          <span className="slash">/</span>
        </motion.h1>

        <div className={s.row}>
          <div className={s.status}>
            <div className={s.readout}>
              <span className="label">overall health</span>
              <b className={s.health} data-status={summary?.worstStatus ?? 'stable'}>
                {summary?.total ? `${pct(summary.health)}%` : '—'}
              </b>
            </div>
            <ul className={s.counts}>
              <li data-status="stable">{summary?.stable ?? 0} stable</li>
              <li data-status="attention">{summary?.attention ?? 0} attention</li>
              <li data-status="overdue">{summary?.overdue ?? 0} overdue</li>
            </ul>
            <button type="button" className={s.editArea} onClick={() => openOverlay({ area: id })}>
              edit area
            </button>
          </div>
          <motion.div className={s.organismSlot} style={{ y: organismY, scale: organismScale }}>
            <CategoryOrganism category={category} summary={summary} size={124} layoutId={layoutId} alive />
          </motion.div>
        </div>
      </header>

      {entries.length > 0 ? (
        <CategoryField category={category} entries={entries} scope={`category:${id}`} />
      ) : (
        <div className={s.empty}>
          <p className="label">no systems in {name}/</p>
          <p className={s.emptyCopy}>Nothing here is being watched yet. What in this area wears out over time?</p>
        </div>
      )}

      <button type="button" className={s.register} onClick={() => maintenanceActions.create({ categoryId: id })}>
        <span className="slash">&gt;</span> register system in {category.name.toLowerCase()}/<span className="cursor" aria-hidden="true" />
      </button>
    </PageFrame>
  );
}

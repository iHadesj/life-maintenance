import { motion } from 'framer-motion';
import { PageFrame } from '../app/PageFrame';
import { rememberDive, type DiveVia } from '../app/pageTransition';
import { navigate, pathFor } from '../app/router';
import { useSystemData } from '../app/SystemData';
import { useUI } from '../app/ui';
import type { Category } from '../db/types';
import { CategoryCluster } from '../features/categories/CategoryCluster';
import { MaintenanceStream } from '../features/maintenance/MaintenanceStream';
import { FirstRun } from '../features/onboarding/FirstRun';
import { Suggestions } from '../features/onboarding/Suggestions';
import { SystemHealth } from '../features/system-health/SystemHealth';
import { sproutVariants } from '../motion/transitions';
import type { PageTransition, Point } from '../motion/transitions';
import { needsAttention } from '../services/cycle';
import { haptic } from '../services/haptics';
import s from './SystemPage.module.css';

function SectionHead({ title, count }: { title: string; count?: number }) {
  return (
    <motion.h2
      className={s.sectionHead}
      variants={sproutVariants}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true }}
    >
      <span>{title}</span>
      <span className={s.sectionRule} aria-hidden="true" />
      {count !== undefined && <span className={s.sectionCount}>{count}</span>}
    </motion.h2>
  );
}

export function SystemPage({ transition }: { transition: PageTransition }) {
  const { summary, categories, categorySummaries, byCategory, evaluated } = useSystemData();
  const serviced = useUI((state) => state.serviced);

  const enter = (category: Category, origin: Point, via: DiveVia) => {
    haptic('tick');
    rememberDive(category.id, origin, via);
    navigate(pathFor('category', category.id), { state: { origin } });
  };

  if (summary.total === 0) {
    return (
      <PageFrame transition={transition} label="System">
        <FirstRun />
      </PageFrame>
    );
  }

  const attention = evaluated.filter((e) => needsAttention(e.cycle.status) || serviced[e.item.id]);
  const upcoming = evaluated
    .filter((e) => !needsAttention(e.cycle.status) && !serviced[e.item.id])
    .sort((a, b) => a.cycle.daysRemaining - b.cycle.daysRemaining)
    .slice(0, 3);

  return (
    <PageFrame transition={transition} label="System health" pullToCheck>
      <h1 className="visually-hidden">Life Maintenance — system health</h1>
      <SystemHealth onEnter={enter} />

      <Suggestions />

      <section className={s.section} aria-label="Attention required">
        <SectionHead title="attention required" count={summary.attention + summary.overdue} />
        <MaintenanceStream
          entries={attention}
          scope="system"
          label="Systems that need attention"
          empty={<p className={s.clear}>Nothing needs attention right now. Every system is inside its cycle.</p>}
        />
      </section>

      {upcoming.length > 0 && (
        <section className={s.section} aria-label="Next cycles">
          <SectionHead title="next cycles" />
          <MaintenanceStream entries={upcoming} scope="system" label="Next cycles" />
        </section>
      )}

      <section className={s.section} aria-label="Subsystems">
        <SectionHead title="subsystems" count={categories.length} />
        <ul className={s.clusters}>
          {categories.map((category) => (
            <CategoryCluster
              key={category.id}
              category={category}
              entries={byCategory.get(category.id) ?? []}
              summary={categorySummaries.get(category.id)}
              onEnter={enter}
            />
          ))}
        </ul>
      </section>
    </PageFrame>
  );
}

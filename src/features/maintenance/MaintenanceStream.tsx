import { AnimatePresence, motion } from 'framer-motion';
import { useMemo, type ReactNode } from 'react';
import { useSystemData } from '../../app/SystemData';
import { worstOf, type MaintenanceStatus } from '../../services/cycle';
import type { EvaluatedItem } from '../../services/health';
import { MaintenanceNode } from './MaintenanceNode';
import { useServiceChoreography } from './useServiceChoreography';
import s from './MaintenanceStream.module.css';

const SECTIONS: ReadonlyArray<{ key: string; title: string; match: (status: MaintenanceStatus) => boolean }> = [
  { key: 'past', title: 'past cycle', match: (st) => st === 'overdue' || st === 'critical' },
  { key: 'attention', title: 'needs attention', match: (st) => st === 'attention' || st === 'due' },
  { key: 'watch', title: 'watch', match: (st) => st === 'watch' },
  { key: 'stable', title: 'stable', match: (st) => st === 'stable' },
];

type Row =
  | { kind: 'head'; key: string; title: string; count: number; status: MaintenanceStatus }
  | { kind: 'node'; key: string; entry: EvaluatedItem };

interface Props {
  entries: readonly EvaluatedItem[];
  scope: string;
  label: string;
  sections?: boolean;
  showArea?: boolean;
  empty?: ReactNode;
}

/**
 * Systems hang off a conduit — one line the whole list shares — instead of
 * sitting in boxes. New nodes sprout out of it; removed nodes fold back into it.
 */
export function MaintenanceStream({ entries, scope, label, sections = false, showArea = true, empty }: Props) {
  const { categoryOf } = useSystemData();
  const { entries: ordered, displayStatus } = useServiceChoreography(entries);

  const rows = useMemo<Row[]>(() => {
    if (!sections) return ordered.map((entry) => ({ kind: 'node', key: entry.item.id, entry }));
    const out: Row[] = [];
    for (const section of SECTIONS) {
      const group = ordered.filter((entry) => section.match(displayStatus(entry)));
      if (!group.length) continue;
      const status = group.reduce<MaintenanceStatus | null>((acc, e) => worstOf(acc, displayStatus(e)), null) ?? 'stable';
      out.push({ kind: 'head', key: `head:${section.key}`, title: section.title, count: group.length, status });
      for (const entry of group) out.push({ kind: 'node', key: entry.item.id, entry });
    }
    return out;
  }, [ordered, sections, displayStatus]);

  if (entries.length === 0) return <>{empty ?? null}</>;

  return (
    <ul className={s.stream} aria-label={label}>
      <AnimatePresence initial={false} mode="popLayout">
        {rows.map((row) =>
          row.kind === 'head' ? (
            <motion.li
              key={row.key}
              layout="position"
              className={s.section}
              data-status={row.status}
              initial={{ clipPath: 'inset(0% 100% 0% 0%)' }}
              animate={{ clipPath: 'inset(0% 0% 0% 0%)' }}
              exit={{ opacity: 0 }}
            >
              <span className={s.sectionTitle}>{row.title}</span>
              <span className={s.sectionRule} aria-hidden="true" />
              <span className={s.sectionCount}>{row.count}</span>
            </motion.li>
          ) : (
            <MaintenanceNode
              key={row.key}
              entry={row.entry}
              category={categoryOf(row.entry.item.categoryId)}
              scope={scope}
              showArea={showArea}
            />
          ),
        )}
      </AnimatePresence>
    </ul>
  );
}

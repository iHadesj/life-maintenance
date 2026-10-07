import { useEffect, useMemo, useRef, useState } from 'react';
import { PageFrame } from '../app/PageFrame';
import { setQuery } from '../app/router';
import { useSystemData } from '../app/SystemData';
import { CategorySymbol } from '../components/CategorySymbol';
import { Choice } from '../components/Choice';
import { PageTitle } from '../components/PageTitle';
import { maintenanceActions } from '../features/maintenance/actions';
import { MaintenanceStream } from '../features/maintenance/MaintenanceStream';
import type { PageTransition } from '../motion/transitions';
import { isOverdue, type MaintenanceStatus } from '../services/cycle';
import { plural } from '../services/format';
import type { EvaluatedItem } from '../services/health';
import { searchItems } from '../services/search';
import s from './QueuePage.module.css';

type Filter = 'all' | 'attention' | 'overdue' | 'stable';

const MATCHES: Record<Filter, (status: MaintenanceStatus) => boolean> = {
  all: () => true,
  attention: (st) => st === 'attention' || st === 'due',
  overdue: isOverdue,
  stable: (st) => st === 'stable' || st === 'watch',
};

const isFilter = (value: string | undefined): value is Filter =>
  value === 'all' || value === 'attention' || value === 'overdue' || value === 'stable';

export function QueuePage({ transition, query }: { transition: PageTransition; query: Record<string, string> }) {
  const { evaluated, categories, categoryName, summary } = useSystemData();
  const filter: Filter = isFilter(query.f) ? query.f : 'all';
  const area = query.a ?? '';
  const [text, setText] = useState(query.q ?? '');
  const written = useRef(query.q ?? '');

  // Keep the URL in sync with the search box, without flooding history.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = text.trim();
      if ((query.q ?? '') === next) return;
      written.current = next;
      setQuery({ q: next || null });
    }, 260);
    return () => window.clearTimeout(timer);
  }, [text, query.q]);

  // Searches can also arrive from outside (the terminal's `search …`).
  useEffect(() => {
    const incoming = query.q ?? '';
    if (incoming !== written.current) {
      written.current = incoming;
      setText(incoming);
    }
  }, [query.q]);

  const searching = Boolean(query.q?.trim());
  const entries = useMemo<EvaluatedItem[]>(() => {
    let list: EvaluatedItem[] = searching ? searchItems(query.q ?? '', evaluated, categoryName, 999).map((r) => r.entry) : [...evaluated];
    if (area) list = list.filter((e) => e.item.categoryId === area);
    return list.filter((e) => MATCHES[filter](e.cycle.status));
  }, [searching, query.q, evaluated, categoryName, area, filter]);

  const counts: Record<Filter, number> = {
    all: summary.total,
    attention: summary.attention,
    overdue: summary.overdue,
    stable: summary.stable,
  };

  return (
    <PageFrame transition={transition} label="Maintenance queue">
      <PageTitle primary="MAINTENANCE" secondary="QUEUE/" kicker={`${plural(summary.total, 'system')} · most urgent first`} />

      <div className={s.controls}>
        <Choice<Filter>
          label="Filter by state"
          value={filter}
          onChange={(next) => setQuery({ f: next === 'all' ? null : next })}
          options={(['all', 'attention', 'overdue', 'stable'] as const).map((key) => ({
            value: key,
            status: key === 'all' ? undefined : key === 'overdue' ? 'overdue' : key,
            label: (
              <>
                {key} <span className={s.count}>{counts[key]}</span>
              </>
            ),
            name: `${key}, ${counts[key]}`,
          }))}
        />

        <label className={s.search}>
          <span className={s.searchMark} aria-hidden="true">
            &gt;
          </span>
          <input
            type="search"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="filter systems"
            aria-label="Filter systems by name, area or notes"
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>

        <div className={s.areas} role="group" aria-label="Filter by area">
          <button type="button" className={s.areaChip} aria-pressed={!area} onClick={() => setQuery({ a: null })}>
            all areas
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={s.areaChip}
              data-identity={c.color}
              aria-pressed={area === c.id}
              onClick={() => setQuery({ a: area === c.id ? null : c.id })}
            >
              <CategorySymbol symbol={c.symbol} size={13} strokeWidth={1.9} />
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <MaintenanceStream
        entries={entries}
        scope="queue"
        label="Maintenance queue"
        sections={!searching}
        empty={
          <div className={s.empty}>
            <p className="label">{searching ? 'no match' : summary.total ? 'queue clear' : 'no systems registered'}</p>
            <p className={s.emptyCopy}>
              {searching
                ? `Nothing matches “${query.q}”.`
                : summary.total
                  ? 'No system matches this filter.'
                  : 'Register a system to start its cycle.'}
            </p>
            <button
              type="button"
              className={s.register}
              onClick={() => maintenanceActions.create(searching ? { title: query.q } : {})}
            >
              <span className="slash">&gt;</span> {searching ? `register “${query.q}”` : 'register system'}
              <span className="cursor" aria-hidden="true" />
            </button>
          </div>
        }
      />
    </PageFrame>
  );
}

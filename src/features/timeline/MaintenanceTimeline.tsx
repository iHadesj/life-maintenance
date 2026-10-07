import { AnimatePresence, motion, useTransform } from 'framer-motion';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { pageScrollProgress } from '../../app/pageTransition';
import { useSystemData } from '../../app/SystemData';
import type { MaintenanceLog } from '../../db/types';
import { easings } from '../../motion/springs';
import { formatISODate, formatMonthYear, formatStamp } from '../../services/dates';
import { plural } from '../../services/format';
import { MaintenanceEvent } from './MaintenanceEvent';
import s from './MaintenanceTimeline.module.css';

type Row =
  | { kind: 'month'; key: string; label: string }
  | { kind: 'day'; key: string; date: Date; logs: MaintenanceLog[] };

const WEEKDAY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function buildRows(logs: readonly MaintenanceLog[]): Row[] {
  const rows: Row[] = [];
  let month = '';
  let day: Extract<Row, { kind: 'day' }> | null = null;
  for (const log of logs) {
    const m = formatMonthYear(log.completedAt);
    if (m !== month) {
      month = m;
      rows.push({ kind: 'month', key: `m:${m}`, label: m });
      day = null;
    }
    const d = formatISODate(log.completedAt);
    if (!day || day.key !== `d:${d}`) {
      day = { kind: 'day', key: `d:${d}`, date: log.completedAt, logs: [] };
      rows.push(day);
    }
    day.logs.push(log);
  }
  return rows;
}

/**
 * MAINTENANCE LOG — a git log --graph for a life. One trunk; each service
 * branches off it. Tap a service to trace that system: its entries light up
 * and a line connects them through time.
 */
export function MaintenanceTimeline() {
  const { logs, categoryOf, byId } = useSystemData();
  const [trace, setTrace] = useState<string | null>(null);
  const [tracePath, setTracePath] = useState<{ d: string; w: number; h: number; count: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => buildRows(logs), [logs]);
  // The trunk lights up as you travel back through time.
  const lit = useTransform(pageScrollProgress, [0, 1], [0.03, 1]);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!trace || !wrap) {
      setTracePath(null);
      return;
    }
    const measure = () => {
      const box = wrap.getBoundingClientRect();
      const points = Array.from(wrap.querySelectorAll<HTMLElement>(`[data-trace-anchor="${trace}"]`)).map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left - box.left + r.width / 2, y: r.top - box.top + r.height / 2 };
      });
      if (points.length < 2) {
        setTracePath({ d: '', w: box.width, h: box.height, count: points.length });
        return;
      }
      // A dedicated lane between the trunk and the entries: the traced
      // system's history reads as one continuous branch through time.
      const lane = points[0].x - 13;
      let d = `M${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        d += `C${lane} ${a.y + 4} ${lane} ${a.y + 16} ${lane} ${a.y + 26}`;
        d += `L${lane} ${b.y - 26}`;
        d += `C${lane} ${b.y - 16} ${lane} ${b.y - 4} ${b.x} ${b.y}`;
      }
      setTracePath({ d, w: box.width, h: box.height, count: points.length });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [trace, rows]);

  if (logs.length === 0) {
    return (
      <div className={s.empty}>
        <p className={s.emptyCmd}>
          <span className="slash">$</span> maintenance log
        </p>
        <p className={s.emptyOut}>&gt; no entries yet</p>
        <p className={s.emptyCopy}>
          Every service you log becomes a line here — with the cycle it really lasted and how far it drifted from plan.
        </p>
      </div>
    );
  }

  const tracedTitle = trace ? logs.find((l) => l.maintenanceItemId === trace)?.itemTitle : null;

  return (
    <div className={s.wrap} ref={wrapRef} data-tracing={trace ? '' : undefined}>
      <AnimatePresence>
        {trace && (
          <motion.div
            key="tracebar"
            className={s.traceBar}
            initial={{ clipPath: 'inset(0% 100% 0% 0%)' }}
            animate={{ clipPath: 'inset(0% 0% 0% 0%)', transition: { duration: 0.45, ease: easings.out } }}
            exit={{ clipPath: 'inset(0% 0% 0% 100%)', transition: { duration: 0.25 } }}
          >
            <span>
              tracing <b>{tracedTitle ?? 'system'}</b> · {plural(tracePath?.count ?? 0, 'entry', 'entries')}
            </span>
            <button type="button" onClick={() => setTrace(null)}>
              clear
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {tracePath?.d && (
        <svg className={s.trace} width={tracePath.w} height={tracePath.h} aria-hidden="true">
          <motion.path
            key={trace}
            d={tracePath.d}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: easings.out }}
          />
        </svg>
      )}

      <ol className={s.timeline}>
        <motion.li className={s.trunkLit} style={{ scaleY: lit }} role="presentation" aria-hidden="true" />
        {rows.map((row) =>
          row.kind === 'month' ? (
            <li key={row.key} className={s.month} aria-hidden="true">
              {row.label}
            </li>
          ) : (
            <li key={row.key} className={s.day}>
              <div className={s.dayHead}>
                <span className={s.dayNode} aria-hidden="true" />
                <time dateTime={formatISODate(row.date)}>{formatStamp(row.date)}</time>
                <span className={s.weekday}>{WEEKDAY[row.date.getDay()]}</span>
              </div>
              <ul className={s.events}>
                {row.logs.map((log) => (
                  <MaintenanceEvent
                    key={log.id}
                    log={log}
                    category={categoryOf(log.categoryId ?? '')}
                    traced={trace === log.maintenanceItemId}
                    dimmed={Boolean(trace) && trace !== log.maintenanceItemId}
                    exists={byId.has(log.maintenanceItemId)}
                    onTrace={() => setTrace((current) => (current === log.maintenanceItemId ? null : log.maintenanceItemId))}
                  />
                ))}
              </ul>
            </li>
          ),
        )}
      </ol>
    </div>
  );
}

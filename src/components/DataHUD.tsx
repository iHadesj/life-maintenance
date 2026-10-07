import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useSystemData } from '../app/SystemData';
import { useUI, type HudState } from '../app/ui';
import { easings } from '../motion/springs';
import { STATUS_LABEL } from '../services/cycle';
import { formatISODate } from '../services/dates';
import { CRITICALITY_LABEL, durationLabel } from '../services/format';
import type { EvaluatedItem } from '../services/health';
import s from './DataHUD.module.css';

const W = 236;
const H = 172;

function Readout({ hud, entry, area }: { hud: HudState; entry: EvaluatedItem; area: string }) {
  const { item, cycle } = entry;
  const vw = window.innerWidth;
  const left = Math.min(Math.max(12, hud.x - 48), vw - W - 12);
  const above = hud.y - H - 34 > 60;
  const top = above ? hud.y - H - 34 : hud.y + 34;
  const ox = hud.x - left;
  const oy = hud.y - top;
  const radius = Math.hypot(Math.max(ox, W - ox), Math.max(oy, H - oy));
  const duration = durationLabel(item.estimatedDurationMinutes);

  const rows: Array<[string, string]> = [
    ['SYS', item.title],
    ['AREA', `${area.toUpperCase()}/`],
    ['AGE', `${cycle.elapsedDays}D / ${cycle.intervalDays}D`],
    ['CYCLE', `${Math.round(cycle.cycleProgress * 100)}% · ${STATUS_LABEL[cycle.status]}`],
    ['DEGR', `${Math.round(100 - cycle.health)}%`],
    ['LAST', formatISODate(item.lastMaintenanceAt)],
    ['NEXT', formatISODate(cycle.nextDueAt)],
    ['CRIT', duration ? `${CRITICALITY_LABEL[item.criticality]} · ${duration}` : CRITICALITY_LABEL[item.criticality]],
  ];

  return (
    <>
      <svg className={s.leader} aria-hidden="true">
        <line x1={hud.x} y1={hud.y} x2={left + Math.min(Math.max(ox, 18), W - 18)} y2={above ? top + H : top} />
        <circle cx={hud.x} cy={hud.y} r={26} />
      </svg>
      <motion.div
        className={s.hud}
        data-status={cycle.status}
        style={{ left, top, width: W }}
        initial={{ clipPath: `circle(0px at ${ox}px ${oy}px)` }}
        animate={{ clipPath: `circle(${radius}px at ${ox}px ${oy}px)`, transition: { duration: 0.34, ease: easings.out } }}
        exit={{ clipPath: `circle(0px at ${ox}px ${oy}px)`, transition: { duration: 0.18, ease: easings.in } }}
        role="status"
      >
        <dl className={s.rows}>
          {rows.map(([key, value]) => (
            <div key={key} className={s.row}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </motion.div>
    </>
  );
}

/** Long-press readout: technical data appears right next to the finger. */
export function DataHUD() {
  const hud = useUI((state) => state.hud);
  const { byId, categoryName } = useSystemData();
  const entry = hud ? byId.get(hud.itemId) : undefined;
  return createPortal(
    <div className={s.layer}>
      <AnimatePresence>
        {hud && entry && <Readout key={`${hud.itemId}-${hud.x}`} hud={hud} entry={entry} area={categoryName(entry.item.categoryId)} />}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

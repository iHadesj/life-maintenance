import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { closeOverlay, currentRoute } from '../../app/router';
import { useSystemData } from '../../app/SystemData';
import { CategorySymbol } from '../../components/CategorySymbol';
import { DecodeText } from '../../components/DecodeText';
import { HoldButton } from '../../components/HoldButton';
import { Sheet } from '../../components/Sheet';
import { StatusGlyph } from '../../components/StatusGlyph';
import { easings } from '../../motion/springs';
import { STATUS_LABEL } from '../../services/cycle';
import { atDay, formatISODate, formatStampFor, parseISODate } from '../../services/dates';
import { CRITICALITY_HINT, CRITICALITY_LABEL, durationLabel, intervalHuman } from '../../services/format';
import type { EvaluatedItem } from '../../services/health';
import { maintenanceActions } from './actions';
import { ItemHistory } from './ItemHistory';
import { ResetLine } from './ResetLine';
import s from './MaintenanceDetail.module.css';

interface Props {
  itemId: string;
  scope: string;
}

export function MaintenanceDetail({ itemId, scope }: Props) {
  const { byId, categoryOf, logs, ready, now } = useSystemData();
  const live = byId.get(itemId);
  const kept = useRef<EvaluatedItem | undefined>(live);
  if (live) kept.current = live;
  const entry = live ?? kept.current;

  const [note, setNote] = useState('');
  const [otherDay, setOtherDay] = useState(false);
  const [serviceDate, setServiceDate] = useState(() => formatISODate(new Date()));
  const [completedFlash, setCompletedFlash] = useState(0);
  const history = useMemo(() => logs.filter((log) => log.maintenanceItemId === itemId), [logs, itemId]);

  // The system vanished (removed elsewhere, or an unknown link): close.
  useEffect(() => {
    if (ready && !live && currentRoute().query.item === itemId) closeOverlay(['item']);
  }, [ready, live, itemId]);

  useEffect(() => {
    if (!completedFlash) return;
    const timer = window.setTimeout(() => setCompletedFlash(0), 2400);
    return () => window.clearTimeout(timer);
  }, [completedFlash]);

  if (!entry) return null;
  const { item, cycle } = entry;
  const category = categoryOf(item.categoryId);
  const close = () => closeOverlay(['item']);

  const service = async () => {
    const day = otherDay ? parseISODate(serviceDate) : null;
    const completedAt = day ? atDay(day, now) : new Date();
    const log = await maintenanceActions.service(item, cycle.status, { completedAt, note });
    if (log) {
      setNote('');
      setOtherDay(false);
      setCompletedFlash(Date.now());
    }
  };

  const readout: Array<[string, string]> = [
    ['last service', `${formatStampFor(item.lastMaintenanceAt, now)} · ${cycle.elapsedDays}d ago`],
    [
      'next cycle',
      `${formatStampFor(cycle.nextDueAt, now)} · ${cycle.daysOverdue > 0 ? `${cycle.daysOverdue}d overdue` : `${cycle.daysRemaining}d left`}`,
    ],
    ['interval', `${cycle.intervalDays}d · ${intervalHuman(cycle.intervalDays)}`],
    ['cycle', `${Math.round(cycle.cycleProgress * 100)}% · ${STATUS_LABEL[cycle.status]}`],
    ['degradation', `${Math.round(100 - cycle.health)}%`],
    ['criticality', `${CRITICALITY_LABEL[item.criticality]} · ${CRITICALITY_HINT[item.criticality]}`],
  ];
  const duration = durationLabel(item.estimatedDurationMinutes);
  if (duration) readout.push(['est. duration', duration]);

  return (
    <Sheet
      label={`${item.title} — system details`}
      onClose={close}
      seed={item.id}
      header={
        // The title lives in the (unclipped) header so the shared glyph and
        // title can fly in from the list without being cut by the scroll area.
        <div className={s.headerStack} data-status={cycle.status}>
          <div className={s.headerRow}>
            <span className={s.path} data-identity={category?.color}>
              {category && <CategorySymbol symbol={category.symbol} size={13} strokeWidth={2} />}
              {(category?.name ?? 'Other').toUpperCase()}
              <span className="slash">/</span>
            </span>
            <button type="button" className={s.close} onClick={close} aria-label="Close">
              esc
            </button>
          </div>
          <div className={s.titleRow}>
            <StatusGlyph status={cycle.status} size={30} layoutId={`${scope}:glyph:${item.id}`} />
            <h2 className={s.title}>
              <motion.span layoutId={`${scope}:title:${item.id}`} className={s.titleText}>
                {item.title}
              </motion.span>
            </h2>
          </div>
        </div>
      }
    >
      <div className={s.detail} data-status={cycle.status}>
        {item.description && <p className={s.description}>{item.description}</p>}

        <ResetLine entry={entry} onReset={() => void service()} />

        <AnimatePresence>
          {completedFlash > 0 && (
            <motion.p
              key={completedFlash}
              className={s.flash}
              initial={{ clipPath: 'inset(0% 100% 0% 0%)' }}
              animate={{ clipPath: 'inset(0% 0% 0% 0%)', transition: { duration: 0.5, ease: easings.out } }}
              exit={{ clipPath: 'inset(0% 0% 0% 100%)', transition: { duration: 0.3 } }}
            >
              <DecodeText text="SERVICE COMPLETE" />
              <span>cycle reset · next in {intervalHuman(cycle.intervalDays)}</span>
            </motion.p>
          )}
        </AnimatePresence>

        <section className={s.service} aria-label="Log a service">
          <label className={s.noteField}>
            <span className="label">note · optional</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="// what was done"
              maxLength={500}
              enterKeyHint="done"
            />
          </label>
          <div className={s.serviceRow}>
            <button type="button" className={s.primary} onClick={() => void service()}>
              {otherDay ? `log service · ${serviceDate}` : 'mark serviced'}
            </button>
            <button type="button" className={s.ghost} onClick={() => setOtherDay((v) => !v)} aria-expanded={otherDay}>
              {otherDay ? 'today' : 'other day'}
            </button>
          </div>
          {otherDay && (
            <label className={s.dateField}>
              <span className="label">serviced on</span>
              <input
                type="date"
                value={serviceDate}
                max={formatISODate(now)}
                onChange={(event) => setServiceDate(event.target.value)}
              />
            </label>
          )}
        </section>

        <dl className={s.readout}>
          {readout.map(([key, value]) => (
            <div key={key} className={s.row}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        {item.notes && (
          <section className={s.block}>
            <h3 className="label">notes</h3>
            <p className={s.notes}>{item.notes}</p>
          </section>
        )}

        <section className={s.block}>
          <h3 className="label">service history · {history.length}</h3>
          <ItemHistory logs={history} interval={item.recommendedIntervalDays} now={now} />
        </section>

        <footer className={s.footer}>
          <button type="button" className={s.ghost} onClick={() => maintenanceActions.edit(item.id)}>
            edit system
          </button>
          <HoldButton label="remove" holdingLabel="removing…" onConfirm={() => void maintenanceActions.remove(item)} />
        </footer>
      </div>
    </Sheet>
  );
}

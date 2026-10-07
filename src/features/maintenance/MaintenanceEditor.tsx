import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { closeOverlay, currentRoute } from '../../app/router';
import { useSystemData } from '../../app/SystemData';
import { uiActions } from '../../app/ui';
import { CategorySymbol } from '../../components/CategorySymbol';
import { Choice } from '../../components/Choice';
import { Sheet } from '../../components/Sheet';
import { StatusGlyph } from '../../components/StatusGlyph';
import { CycleIndicator } from '../../components/wear/CycleIndicator';
import { CRITICALITIES, type Criticality } from '../../db/types';
import { itemsRepository, TITLE_MAX, type ItemDraft } from '../../repositories/items';
import { easings } from '../../motion/springs';
import { STATUS_LABEL, evaluateCycle, normalizeInterval } from '../../services/cycle';
import { addDays, atDay, diffCalendarDays, formatISODate, parseISODate } from '../../services/dates';
import { DURATION_PRESETS, FIRST_SUGGESTIONS, INTERVAL_PRESETS } from '../../services/defaults';
import { CRITICALITY_HINT, CRITICALITY_LABEL, counterLabel, durationLabel, intervalHuman } from '../../services/format';
import { haptic } from '../../services/haptics';
import { newId } from '../../services/ids';
import { requestPersistentStorage } from '../../services/platform';
import { errorMessage } from './actions';
import { IntervalRuler } from './IntervalRuler';
import s from './MaintenanceEditor.module.css';

const LAST_PRESETS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 0, label: 'today' },
  { days: 7, label: '1w ago' },
  { days: 30, label: '1m ago' },
  { days: 90, label: '3m ago' },
  { days: 180, label: '6m ago' },
];

const PRESET_LABEL: Record<number, string> = { 7: '1W', 14: '2W', 30: '1M', 90: '3M', 180: '6M', 365: '1Y' };

interface Props {
  /** An item id, or "new". */
  target: string;
  presetCategory?: string;
  presetTitle?: string;
  preset?: string;
  scope: string;
}

export function MaintenanceEditor({ target, presetCategory, presetTitle, preset, scope }: Props) {
  const { byId, categories, categoryById, categoryName, now, summary, ready } = useSystemData();
  const existing = target === 'new' ? undefined : byId.get(target)?.item;
  const suggestion = preset ? FIRST_SUGGESTIONS.find((sug) => sug.key === preset) : undefined;
  const [id] = useState(() => existing?.id ?? newId());
  const [firstSystem] = useState(() => !existing && summary.total === 0);

  const defaultCategory =
    (presetCategory && categoryById.has(presetCategory) && presetCategory) ||
    (suggestion && categoryById.has(suggestion.categoryId) && suggestion.categoryId) ||
    categories[0]?.id ||
    'other';

  const [title, setTitle] = useState(existing?.title ?? suggestion?.title ?? presetTitle ?? '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? defaultCategory);
  const [interval, setInterval] = useState(existing?.recommendedIntervalDays ?? suggestion?.intervalDays ?? 30);
  const [lastService, setLastService] = useState<Date>(() => existing?.lastMaintenanceAt ?? new Date());
  const [criticality, setCriticality] = useState<Criticality>(existing?.criticality ?? suggestion?.criticality ?? 'medium');
  const [duration, setDuration] = useState<number | undefined>(
    existing?.estimatedDurationMinutes ?? suggestion?.estimatedDurationMinutes,
  );
  const [description, setDescription] = useState(existing?.description ?? suggestion?.description ?? '');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [details, setDetails] = useState(Boolean(existing?.description || existing?.notes));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ready && target !== 'new' && !byId.has(target) && !saving && currentRoute().query.edit === target) {
      closeOverlay(['edit']);
    }
  }, [ready, target, byId, saving]);

  const preview = useMemo(
    () => evaluateCycle({ lastMaintenanceAt: lastService, recommendedIntervalDays: interval, criticality }, now),
    [lastService, interval, criticality, now],
  );

  const lastDays = Math.max(0, diffCalendarDays(now, lastService));
  const lastPreset = LAST_PRESETS.find((p) => p.days === lastDays);
  const close = () => closeOverlay(['edit', 'cat', 'title', 'preset']);

  const save = async (event?: FormEvent) => {
    event?.preventDefault();
    setError(null);
    const draft: ItemDraft = {
      title,
      categoryId,
      lastMaintenanceAt: lastService,
      recommendedIntervalDays: interval,
      criticality,
      estimatedDurationMinutes: duration,
      description,
      notes,
    };
    try {
      setSaving(true);
      if (existing) {
        await itemsRepository.update(existing.id, draft);
        uiActions.toast({ tone: 'ok', title: 'CHANGES COMMITTED', detail: title.trim() });
      } else {
        await itemsRepository.create(draft, id);
        uiActions.markIngested(id, categoryId);
        uiActions.toast({
          tone: 'ok',
          title: 'SYSTEM REGISTERED',
          detail: `${title.trim()} → ${categoryName(categoryId).toUpperCase()}/`,
        });
        if (firstSystem) void requestPersistentStorage();
      }
      haptic('confirm');
      close();
    } catch (failure) {
      setSaving(false);
      setError(errorMessage(failure));
      haptic('warn');
    }
  };

  const heading = existing ? 'edit system' : firstSystem ? 'register your first system' : 'register system';

  return (
    <Sheet
      label={existing ? `Edit ${existing.title}` : 'Register a system'}
      onClose={close}
      seed={`editor-${id}`}
      tall
      header={
        <>
          <span className={s.heading}>
            <span className="slash">{'>'}</span> {heading}
          </span>
          <button type="button" className={s.cancel} onClick={close}>
            cancel
          </button>
        </>
      }
    >
      <form className={s.form} onSubmit={save} noValidate>
        <div className={s.preview} data-status={preview.status} aria-live="polite">
          <div className={s.previewHead}>
            <StatusGlyph status={preview.status} size={22} layoutId={`${scope}:glyph:${id}`} />
            <motion.span layoutId={`${scope}:title:${id}`} className={s.previewTitle}>
              {title.trim() || 'unnamed system'}
            </motion.span>
            <span className={s.previewCounter}>{counterLabel(preview)}</span>
          </div>
          <CycleIndicator variant="hero" progress={preview.cycleProgress} status={preview.status} seed={id} />
          <p className={s.previewCaption}>
            {lastDays}d since last service · {interval}d cycle · {STATUS_LABEL[preview.status]}
          </p>
          {firstSystem && (
            <p className={s.teach}>
              <b>●</b> is the last service. <b>◌</b> is where the cycle ends. The line between them is time: it frays as
              the system wears. Log a service and it rewinds to zero.
            </p>
          )}
        </div>

        <label className={s.field}>
          <span className="label">name</span>
          <span className={s.prompt}>
            <span className={s.promptMark} aria-hidden="true">
              &gt;
            </span>
            <input
              className={s.titleInput}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Full backup"
              maxLength={TITLE_MAX}
              autoComplete="off"
              enterKeyHint="next"
              data-autofocus={!existing ? '' : undefined}
              required
            />
          </span>
        </label>

        <div className={s.field}>
          <span className="label" id={`${id}-area`}>
            area
          </span>
          <Choice
            label="Area"
            value={categoryId}
            onChange={setCategoryId}
            options={categories.map((c) => ({
              value: c.id,
              name: c.name,
              label: (
                <span className={s.area} data-identity={c.color}>
                  <CategorySymbol symbol={c.symbol} size={14} strokeWidth={1.8} />
                  {c.name}
                </span>
              ),
            }))}
          />
        </div>

        <div className={s.field}>
          <span className={s.fieldHead}>
            <span className="label">cycle</span>
            <span className={s.cycleValue}>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={3650}
                value={interval}
                aria-label="Cycle length in days"
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next) && next > 0) setInterval(normalizeInterval(next));
                }}
              />
              <span>days · {intervalHuman(interval)}</span>
            </span>
          </span>
          <IntervalRuler value={interval} onChange={setInterval} />
          <Choice
            label="Cycle presets"
            value={String(INTERVAL_PRESETS.includes(interval) ? interval : '')}
            onChange={(v) => setInterval(Number(v))}
            options={INTERVAL_PRESETS.map((days) => ({ value: String(days), label: PRESET_LABEL[days], name: intervalHuman(days) }))}
          />
        </div>

        <div className={s.field}>
          <span className={s.fieldHead}>
            <span className="label">last service</span>
            <span className={s.hint}>{lastDays === 0 ? 'today' : `${lastDays} days ago`}</span>
          </span>
          <Choice
            label="Last service"
            value={lastPreset ? String(lastPreset.days) : 'date'}
            onChange={(v) => {
              if (v === 'date') return;
              const days = Number(v);
              setLastService(days === 0 ? new Date() : atDay(addDays(now, -days), now));
            }}
            options={[
              ...LAST_PRESETS.map((p) => ({ value: String(p.days), label: p.label })),
              { value: 'date', label: 'date', name: 'specific date' },
            ]}
          />
          <input
            className={s.date}
            type="date"
            value={formatISODate(lastService)}
            max={formatISODate(now)}
            aria-label="Last service date"
            onChange={(event) => {
              const day = parseISODate(event.target.value);
              if (!day) return;
              setLastService(day.getTime() > now.getTime() ? new Date() : atDay(day, now));
            }}
          />
        </div>

        <div className={s.field}>
          <span className={s.fieldHead}>
            <span className="label">criticality</span>
            <span className={s.hint}>{CRITICALITY_HINT[criticality]}</span>
          </span>
          <Choice
            label="Criticality"
            value={criticality}
            onChange={setCriticality}
            options={CRITICALITIES.map((c) => ({
              value: c,
              label: CRITICALITY_LABEL[c],
              status: c === 'low' ? 'stable' : c === 'medium' ? 'watch' : c === 'high' ? 'due' : 'critical',
            }))}
          />
        </div>

        <div className={s.field}>
          <span className={s.fieldHead}>
            <span className="label">est. duration</span>
            <span className={s.hint}>{durationLabel(duration) ?? 'optional'}</span>
          </span>
          <Choice
            label="Estimated duration"
            value={duration ? String(duration) : 'none'}
            onChange={(v) => setDuration(v === 'none' ? undefined : Number(v))}
            options={[
              { value: 'none', label: '—', name: 'no estimate' },
              ...DURATION_PRESETS.map((m) => ({ value: String(m), label: durationLabel(m) ?? '' })),
            ]}
          />
        </div>

        <button type="button" className={s.more} onClick={() => setDetails((v) => !v)} aria-expanded={details}>
          {details ? '− details' : '+ description & notes'}
        </button>
        <AnimatePresence initial={false}>
          {details && (
            <motion.div
              className={s.details}
              initial={{ clipPath: 'inset(0% 0% 100% 0%)', y: -8 }}
              animate={{ clipPath: 'inset(0% 0% 0% 0%)', y: 0, transition: { duration: 0.45, ease: easings.out } }}
              exit={{ clipPath: 'inset(0% 0% 100% 0%)', y: -8, transition: { duration: 0.25 } }}
            >
              <label className={s.field}>
                <span className="label">description</span>
                <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={2} />
              </label>
              <label className={s.field}>
                <span className="label">notes</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="// model numbers, where the filter is, who to call…"
                />
              </label>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <p className={s.error} role="alert">
            ! {error}
          </p>
        )}

        <button type="submit" className={s.submit} disabled={saving}>
          {existing ? 'commit changes' : 'register system'}
        </button>
      </form>
    </Sheet>
  );
}

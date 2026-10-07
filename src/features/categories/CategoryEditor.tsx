import { useState, type FormEvent } from 'react';
import { closeOverlay, currentRoute, navigate, pathFor, waitForNavigation } from '../../app/router';
import { useSystemData } from '../../app/SystemData';
import { uiActions } from '../../app/ui';
import { CategorySymbol, SYMBOL_LABEL } from '../../components/CategorySymbol';
import { Choice } from '../../components/Choice';
import { HoldButton } from '../../components/HoldButton';
import { Sheet } from '../../components/Sheet';
import { IDENTITY_COLORS, SYMBOL_KEYS, type IdentityColor, type SymbolKey } from '../../db/types';
import { CATEGORY_NAME_MAX, categoriesRepository } from '../../repositories/categories';
import { FALLBACK_CATEGORY_ID } from '../../services/defaults';
import { plural } from '../../services/format';
import { haptic } from '../../services/haptics';
import { errorMessage } from '../maintenance/actions';
import { CategoryOrganism } from './CategoryOrganism';
import s from './CategoryEditor.module.css';

/** Create or edit an area: name, glyph and a soft identity hue. */
export function CategoryEditor({ target }: { target: string }) {
  const { categoryById, byCategory, categorySummaries } = useSystemData();
  const existing = target === 'new' ? undefined : categoryById.get(target);
  const [name, setName] = useState(existing?.name ?? '');
  const [symbol, setSymbol] = useState<SymbolKey>(existing?.symbol ?? 'leaf');
  const [color, setColor] = useState<IdentityColor>(existing?.color ?? 'violet');
  const [error, setError] = useState<string | null>(null);
  const systems = existing ? (byCategory.get(existing.id)?.length ?? 0) : 0;
  const close = () => closeOverlay(['area']);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    try {
      if (existing) {
        await categoriesRepository.update(existing.id, { name, symbol, color });
        uiActions.toast({ tone: 'ok', title: 'AREA UPDATED', detail: `${name.trim().toUpperCase()}/` });
      } else {
        const created = await categoriesRepository.create({ name, symbol, color });
        uiActions.toast({ tone: 'ok', title: 'AREA CREATED', detail: `${created.name.toUpperCase()}/` });
      }
      haptic('confirm');
      close();
    } catch (failure) {
      setError(errorMessage(failure));
      haptic('warn');
    }
  };

  const remove = async () => {
    if (!existing) return;
    try {
      const wasViewing = currentRoute().id === existing.id;
      close();
      await waitForNavigation();
      const moved = await categoriesRepository.remove(existing.id);
      uiActions.toast({
        tone: 'info',
        title: 'AREA REMOVED',
        detail: moved ? `${plural(moved, 'system')} moved to OTHER/` : existing.name.toUpperCase(),
      });
      if (wasViewing) navigate(pathFor('system'), { replace: true });
    } catch (failure) {
      uiActions.toast({ tone: 'warn', title: 'REMOVE FAILED', detail: errorMessage(failure) });
    }
  };

  const preview = { ...(existing ?? { id: `draft-${name}`, order: 0, builtIn: false, createdAt: new Date(), updatedAt: new Date() }), name, symbol, color };

  return (
    <Sheet
      label={existing ? `Edit area ${existing.name}` : 'Create an area'}
      onClose={close}
      seed={`area-${target}`}
      header={
        <>
          <span className={s.heading}>
            <span className="slash">{'>'}</span> {existing ? 'edit area' : 'new area'}
          </span>
          <button type="button" className={s.cancel} onClick={close}>
            cancel
          </button>
        </>
      }
    >
      <form className={s.form} onSubmit={save} noValidate>
        <div className={s.preview}>
          <CategoryOrganism category={preview} summary={existing ? categorySummaries.get(existing.id) : undefined} size={92} alive />
          <span className={s.previewName} data-identity={color}>
            {(name.trim() || 'unnamed').toUpperCase()}
            <span className="slash">/</span>
          </span>
        </div>

        <label className={s.field}>
          <span className="label">name</span>
          <input
            className={s.input}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={CATEGORY_NAME_MAX}
            placeholder="e.g. Garden"
            autoComplete="off"
            data-autofocus=""
          />
        </label>

        <div className={s.field}>
          <span className="label">glyph</span>
          <Choice
            label="Glyph"
            wrap
            value={symbol}
            onChange={setSymbol}
            options={SYMBOL_KEYS.map((key) => ({
              value: key,
              name: SYMBOL_LABEL[key],
              label: <CategorySymbol symbol={key} size={20} />,
            }))}
          />
        </div>

        <div className={s.field}>
          <span className="label">identity</span>
          <Choice
            label="Identity color"
            wrap
            value={color}
            onChange={setColor}
            options={IDENTITY_COLORS.map((key) => ({
              value: key,
              name: key,
              label: <span className={s.swatch} data-identity={key} />,
            }))}
          />
        </div>

        {error && (
          <p className={s.error} role="alert">
            ! {error}
          </p>
        )}

        <button type="submit" className={s.submit}>
          {existing ? 'save area' : 'create area'}
        </button>

        {existing && existing.id !== FALLBACK_CATEGORY_ID && (
          <div className={s.danger}>
            <p className={s.dangerText}>
              {systems ? `${plural(systems, 'system')} will move to OTHER/.` : 'This area has no systems.'}
            </p>
            <HoldButton label="remove area" holdingLabel="removing…" onConfirm={() => void remove()} />
          </div>
        )}
      </form>
    </Sheet>
  );
}

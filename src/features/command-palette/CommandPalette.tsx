import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { navigate, openOverlay, withQuery } from '../../app/router';
import { useSystemData } from '../../app/SystemData';
import { uiActions, useUI } from '../../app/ui';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { settingsRepository } from '../../repositories/settings';
import { easings } from '../../motion/springs';
import { isAppleDevice } from '../../services/platform';
import { maintenanceActions } from '../maintenance/actions';
import { pickAndImport, runExport } from '../settings/transferActions';
import { helpSuggestions, suggest, type Suggestion } from './commands';
import s from './CommandPalette.module.css';

function Highlighted({ suggestion }: { suggestion: Suggestion }) {
  const marks = new Set(suggestion.indices);
  const parts: ReactNode[] = [];
  const { text, verbLength } = suggestion;
  for (let i = 0; i < text.length; i++) {
    const cls = [i < verbLength ? s.verb : '', marks.has(i) ? s.match : ''].join(' ').trim();
    parts.push(
      <span key={i} className={cls || undefined}>
        {text[i]}
      </span>,
    );
  }
  return <>{parts}</>;
}

function Panel() {
  const seed = useUI((state) => state.paletteSeed);
  const data = useSystemData();
  const [input, setInput] = useState(seed);
  const [index, setIndex] = useState(0);
  const [help, setHelp] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const close = () => uiActions.closePalette();

  useFocusTrap(panelRef, true, close);

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const context = useMemo(
    () => ({ evaluated: data.evaluated, categories: data.categories, categoryName: data.categoryName }),
    [data.evaluated, data.categories, data.categoryName],
  );
  const { list, ghost } = useMemo(
    () => (help ? { list: helpSuggestions(), ghost: '' } : suggest(input, context)),
    [help, input, context],
  );
  const active = Math.min(index, Math.max(0, list.length - 1));

  const fill = (text: string) => {
    setHelp(false);
    setInput(text);
    setIndex(0);
    inputRef.current?.focus();
  };

  const run = (suggestion: Suggestion | undefined) => {
    if (!suggestion) return;
    const action = suggestion.action;
    switch (action.type) {
      case 'complete': {
        const entry = data.byId.get(action.itemId);
        close();
        if (entry) void maintenanceActions.service(entry.item, entry.cycle.status);
        return;
      }
      case 'open-item':
        close();
        maintenanceActions.open(action.itemId);
        return;
      case 'edit':
        close();
        maintenanceActions.edit(action.itemId);
        return;
      case 'navigate':
        close();
        navigate(action.to);
        return;
      case 'create':
        close();
        maintenanceActions.create({ title: action.title });
        return;
      case 'show':
        close();
        navigate(withQuery('#/queue', { f: action.filter === 'all' ? null : action.filter }));
        return;
      case 'search':
        close();
        navigate(withQuery('#/queue', { q: action.query }));
        return;
      case 'export':
        close();
        void runExport();
        return;
      case 'import':
        // The file picker must open inside this keypress/tap.
        void pickAndImport();
        close();
        return;
      case 'check':
        close();
        uiActions.requestCheck();
        return;
      case 'new-area':
        close();
        openOverlay({ area: 'new' });
        return;
      case 'motion':
        void settingsRepository.set('motion', action.value);
        uiActions.toast({ tone: 'info', title: 'MOTION', detail: `preference set to ${action.value}` });
        close();
        return;
      case 'help':
        setHelp(true);
        setInput('');
        setIndex(0);
        return;
      case 'fill':
        fill(action.text);
        return;
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setIndex((i) => (list.length ? (Math.min(i, list.length - 1) + 1) % list.length : 0));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setIndex((i) => (list.length ? (Math.min(i, list.length - 1) - 1 + list.length) % list.length : 0));
    } else if (event.key === 'Tab' || (event.key === 'ArrowRight' && event.currentTarget.selectionStart === input.length)) {
      const target = list[active];
      if (!target) return;
      event.preventDefault();
      if (target.action.type === 'fill') fill(target.action.text);
      else fill(target.text.endsWith('/') || target.text.includes(' ') ? target.text : `${target.text} `);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      run(list[active]);
    }
  };

  return (
    <div className={s.layer}>
      <motion.div
        className={s.scrim}
        onClick={close}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        aria-hidden="true"
      />
      <motion.div
        ref={panelRef}
        className={s.panel}
        role="dialog"
        aria-modal="true"
        aria-label="Command terminal"
        initial={{ clipPath: 'inset(0% 0% 100% 0%)', y: -10 }}
        animate={{ clipPath: 'inset(0% 0% 0% 0%)', y: 0, transition: { duration: 0.36, ease: easings.out } }}
        exit={{ clipPath: 'inset(0% 0% 100% 0%)', y: -6, transition: { duration: 0.2, ease: easings.in } }}
      >
        <div className={s.promptRow}>
          <span className={s.prompt} aria-hidden="true">
            LIFE<span className="slash">/</span>
            <span className={s.chevron}>&gt;</span>
          </span>
          <div className={s.inputWrap}>
            <input
              ref={inputRef}
              className={s.input}
              value={input}
              onChange={(event) => {
                setHelp(false);
                setInput(event.target.value);
                setIndex(0);
              }}
              onKeyDown={onKeyDown}
              role="combobox"
              aria-expanded="true"
              aria-controls="lm-palette-list"
              aria-activedescendant={list[active] ? `lm-palette-${active}` : undefined}
              aria-autocomplete="list"
              aria-label="Command"
              placeholder={help ? 'pick a command' : 'type a command or a system'}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="go"
            />
            <span className={s.ghost} aria-hidden="true">
              <span className={s.ghostTyped}>{input}</span>
              {ghost}
            </span>
          </div>
          <button type="button" className={s.esc} onClick={close}>
            esc
          </button>
        </div>

        <ul id="lm-palette-list" role="listbox" className={s.list} aria-label="Suggestions">
          {list.map((suggestion, i) => (
            <li
              key={suggestion.key}
              id={`lm-palette-${i}`}
              role="option"
              aria-selected={i === active}
              className={s.option}
              data-status={suggestion.status}
              onPointerMove={() => i !== active && setIndex(i)}
              onClick={() => run(suggestion)}
            >
              <span className={s.caret} aria-hidden="true">
                {i === active ? '▸' : ''}
              </span>
              <span className={s.text}>
                <Highlighted suggestion={suggestion} />
              </span>
              {suggestion.hint && <span className={s.hint}>{suggestion.hint}</span>}
            </li>
          ))}
        </ul>

        <p className={s.keys} aria-hidden="true">
          <kbd>⇥</kbd> complete <kbd>↵</kbd> run <kbd>↑↓</kbd> select <kbd>{isAppleDevice() ? '⌘K' : 'Ctrl K'}</kbd> toggle
        </p>
      </motion.div>
    </div>
  );
}

/** The terminal. ⌘K / Ctrl+K on desktop; the >_ node (tap or flick up) on mobile. */
export function CommandPalette() {
  const open = useUI((state) => state.paletteOpen);
  return createPortal(<AnimatePresence>{open && <Panel key="palette" />}</AnimatePresence>, document.body);
}

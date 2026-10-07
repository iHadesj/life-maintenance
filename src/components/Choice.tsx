import { motion } from 'framer-motion';
import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { springs } from '../motion/springs';
import { haptic } from '../services/haptics';
import s from './Choice.module.css';

export interface ChoiceOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Accessible name when the label is not plain text. */
  name?: string;
  status?: string;
}

interface Props<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<ChoiceOption<T>>;
  onChange: (value: T) => void;
  className?: string;
  /** Wrap onto several lines instead of scrolling horizontally. */
  wrap?: boolean;
}

/**
 * A radio group whose selection is a cursor bar that travels between options.
 */
export function Choice<T extends string>({ label, value, options, onChange, className, wrap = false }: Props<T>) {
  const id = useId();
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const select = (next: T, index: number, focus = false) => {
    if (next !== value) {
      haptic('tick');
      onChange(next);
    }
    if (focus) refs.current[index]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const nextIndex = (index + delta + options.length) % options.length;
    select(options[nextIndex].value, nextIndex, true);
  };

  const anyChecked = options.some((option) => option.value === value);

  return (
    <div role="radiogroup" aria-label={label} className={[s.group, wrap ? s.wrap : '', className ?? ''].join(' ')}>
      {options.map((option, index) => {
        const checked = option.value === value;
        const tabbable = checked || (!anyChecked && index === 0);
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.name}
            tabIndex={tabbable ? 0 : -1}
            className={s.option}
            data-status={option.status}
            onClick={() => select(option.value, index)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            <span className={s.text}>{option.label}</span>
            {checked && <motion.span layoutId={`${id}-cursor`} className={s.cursor} transition={springs.snappy} />}
          </button>
        );
      })}
    </div>
  );
}

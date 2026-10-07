import { AnimatePresence, motion } from 'framer-motion';
import { useEffect } from 'react';
import { uiActions, useUI, type Toast } from '../app/ui';
import { easings } from '../motion/springs';
import s from './ConsoleToasts.module.css';

const PREFIX: Record<Toast['tone'], string> = { ok: '✓', info: '›', warn: '!' };

function ConsoleLine({ toast }: { toast: Toast }) {
  useEffect(() => {
    const timer = window.setTimeout(() => uiActions.dismissToast(toast.id), toast.ttl);
    return () => window.clearTimeout(timer);
  }, [toast.id, toast.ttl]);

  return (
    <motion.div
      layout="position"
      className={s.line}
      data-tone={toast.tone}
      initial={{ clipPath: 'inset(0% 100% 0% 0%)', x: -10 }}
      animate={{ clipPath: 'inset(0% 0% 0% 0%)', x: 0, transition: { duration: 0.45, ease: easings.out } }}
      exit={{ clipPath: 'inset(0% 0% 0% 100%)', x: 14, transition: { duration: 0.28, ease: easings.in } }}
    >
      <span className={s.prefix} aria-hidden="true">
        {PREFIX[toast.tone]}
      </span>
      <span className={s.text}>
        <span className={s.title}>{toast.title}</span>
        {toast.detail && <span className={s.detail}>{toast.detail}</span>}
      </span>
      {toast.action && (
        <button
          type="button"
          className={s.action}
          onClick={() => {
            toast.action?.run();
            uiActions.dismissToast(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
      <motion.span
        className={s.timer}
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0, transition: { duration: toast.ttl / 1000, ease: 'linear' } }}
        aria-hidden="true"
      />
    </motion.div>
  );
}

/** System messages print from the rail upward, like console output. */
export function ConsoleToasts() {
  const toasts = useUI((state) => state.toasts);
  return (
    <div className={s.stack}>
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ConsoleLine key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}

export function LiveRegion() {
  const message = useUI((state) => state.announcement);
  return (
    <div className="visually-hidden" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}

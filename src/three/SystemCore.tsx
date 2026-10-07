import { useEffect, useRef } from 'react';
import { getCore } from './coreScene';

interface Props {
  instability: number;
  reduced: boolean;
  onReady: () => void;
  onFail: () => void;
}

/**
 * React shell around the singleton WebGL core. Lazy-loaded: Three.js is only
 * fetched once the SYSTEM page has painted and the boot line has finished.
 */
export default function SystemCore({ instability, reduced, onReady, onFail }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const callbacks = useRef({ onReady, onFail });
  callbacks.current = { onReady, onFail };

  useEffect(() => {
    const core = getCore();
    const container = ref.current;
    if (core.failed || !container) {
      callbacks.current.onFail();
      return;
    }
    core.onFail = () => callbacks.current.onFail();
    core.setReduced(reduced);
    core.setState({ instability });
    core.attach(container);
    callbacks.current.onReady();
    return () => {
      core.onFail = null;
      core.detach();
    };
    // Attach once per mount; state changes flow through the effects below.
  }, []);

  useEffect(() => {
    getCore().setState({ instability });
  }, [instability]);

  useEffect(() => {
    getCore().setReduced(reduced);
  }, [reduced]);

  return (
    <div
      ref={ref}
      style={{ position: 'absolute', inset: 0 }}
      onPointerDown={(event) => {
        drag.current = { x: event.clientX, y: event.clientY };
        getCore().ping();
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const dx = event.clientX - drag.current.x;
        const dy = event.clientY - drag.current.y;
        drag.current = { x: event.clientX, y: event.clientY };
        getCore().spin(dx * 0.0016, dy * 0.0008);
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onPointerLeave={() => (drag.current = null)}
    />
  );
}

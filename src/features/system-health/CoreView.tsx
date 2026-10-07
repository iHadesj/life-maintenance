import { lazy, Suspense, useEffect, useState } from 'react';
import { useSystemData } from '../../app/SystemData';
import { useUI } from '../../app/ui';
import { webglAvailable } from '../../services/platform';
import { CoreFallback } from './CoreFallback';
import s from './CoreView.module.css';

const SystemCore = lazy(() => import('../../three/SystemCore'));

interface Props {
  instability: number;
  dormant?: boolean;
}

/**
 * Chooses the core's body: the WebGL organism when it is allowed and
 * available, the SVG one otherwise. The SVG core is always painted first and
 * cross-fades out once the 3D frame is on screen — no blank moment.
 */
export function CoreView({ instability, dormant = false }: Props) {
  const { settings, reduced } = useSystemData();
  const boot = useUI((state) => state.boot);
  const [supported] = useState(() => webglAvailable());
  const [failed, setFailed] = useState(false);
  const [armed, setArmed] = useState(false);
  const [ready, setReady] = useState(false);
  const want3d = !dormant && settings.coreRenderer === 'auto' && supported && !failed;

  useEffect(() => {
    if (!want3d || boot !== 'done') return;
    // Let the page finish its entrance before fetching and compiling Three.js.
    const timer = window.setTimeout(() => setArmed(true), 380);
    return () => window.clearTimeout(timer);
  }, [want3d, boot]);

  useEffect(() => {
    if (!want3d) setReady(false);
  }, [want3d]);

  return (
    <div className={s.view} data-core-anchor="">
      <div className={s.fallback} data-hidden={(want3d && ready) || undefined}>
        <CoreFallback instability={instability} dormant={dormant} />
      </div>
      {want3d && armed && (
        <Suspense fallback={null}>
          <div className={s.gl} data-ready={ready || undefined}>
            <SystemCore instability={instability} reduced={reduced} onReady={() => setReady(true)} onFail={() => setFailed(true)} />
          </div>
        </Suspense>
      )}
    </div>
  );
}

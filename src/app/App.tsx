import { AnimatePresence, LayoutGroup, MotionConfig } from 'framer-motion';
import { useRef } from 'react';
import { ConsoleToasts, LiveRegion } from '../components/ConsoleToasts';
import { DataHUD } from '../components/DataHUD';
import { SystemHeader } from '../components/SystemHeader';
import { SystemNav } from '../components/SystemNav';
import { CategoryEditor } from '../features/categories/CategoryEditor';
import { CommandPalette } from '../features/command-palette/CommandPalette';
import { MaintenanceDetail } from '../features/maintenance/MaintenanceDetail';
import { MaintenanceEditor } from '../features/maintenance/MaintenanceEditor';
import { BootSequence } from '../features/onboarding/BootSequence';
import { ImportSheet } from '../features/settings/ImportSheet';
import type { PageTransition } from '../motion/transitions';
import { CategoryPage } from '../pages/CategoryPage';
import { LogPage } from '../pages/LogPage';
import { QueuePage } from '../pages/QueuePage';
import { SettingsPage } from '../pages/SettingsPage';
import { SystemPage } from '../pages/SystemPage';
import { Backdrop, ScanBeam, SystemCheckSweep } from './Effects';
import { computeTransition, pageScrollY } from './pageTransition';
import { useLocationSnapshot, useRoute, type NavState, type Route } from './router';
import { SystemDataProvider, useSystemData } from './SystemData';
import { UpdateNotice } from './UpdateNotice';
import { useBootstrap, useKeyboardShortcuts } from './useAppEffects';
import s from './App.module.css';

/** Decides the choreography once per page change (stable for the page's life). */
function usePageTransition(route: Route, nav: NavState | null, reduced: boolean): PageTransition {
  const previous = useRef<Route | null>(null);
  const current = useRef<PageTransition | null>(null);
  if (!current.current || previous.current?.pageKey !== route.pageKey) {
    current.current = computeTransition(previous.current, route, nav, reduced);
    previous.current = route;
    pageScrollY.set(0);
  }
  return current.current;
}

function PageSwitch({ route, transition }: { route: Route; transition: PageTransition }) {
  switch (route.name) {
    case 'category':
      return <CategoryPage id={route.id ?? ''} transition={transition} />;
    case 'queue':
      return <QueuePage transition={transition} query={route.query} />;
    case 'log':
      return <LogPage transition={transition} />;
    case 'settings':
      return <SettingsPage transition={transition} />;
    default:
      return <SystemPage transition={transition} />;
  }
}

function Overlays({ route }: { route: Route }) {
  const { item, edit, area, cat, title, preset } = route.query;
  return (
    <>
      <AnimatePresence>{item && <MaintenanceDetail key={`item-${item}`} itemId={item} scope={route.pageKey} />}</AnimatePresence>
      <AnimatePresence>
        {edit && (
          <MaintenanceEditor
            key={`edit-${edit}`}
            target={edit}
            presetCategory={cat}
            presetTitle={title}
            preset={preset}
            scope={route.pageKey}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>{area && <CategoryEditor key={`area-${area}`} target={area} />}</AnimatePresence>
    </>
  );
}

function Shell() {
  const data = useSystemData();
  const route = useRoute();
  const { state } = useLocationSnapshot();
  useBootstrap(data);
  useKeyboardShortcuts();
  const transition = usePageTransition(route, state, data.reduced);

  return (
    <MotionConfig reducedMotion={data.reduced ? 'always' : 'never'}>
      <LayoutGroup>
        <div className={s.shell} data-route={route.name}>
          <Backdrop />
          <input id="lm-focus-proxy" className={s.focusProxy} aria-hidden="true" tabIndex={-1} readOnly />
          {data.ready && (
            <>
              <SystemHeader route={route} />
              <AnimatePresence custom={transition} initial={false}>
                <PageSwitch key={route.pageKey} route={route} transition={transition} />
              </AnimatePresence>
              {!data.desktop && <SystemNav route={route} variant="rail" />}
              <ScanBeam key={`beam-${route.pageKey}`} transition={transition} />
              <ConsoleToasts />
              <SystemCheckSweep />
              <Overlays route={route} />
              <ImportSheet />
              <CommandPalette />
              <DataHUD />
              {import.meta.env.PROD && <UpdateNotice />}
            </>
          )}
          <LiveRegion />
        </div>
        <BootSequence />
      </LayoutGroup>
    </MotionConfig>
  );
}

export function App() {
  return (
    <SystemDataProvider>
      <Shell />
    </SystemDataProvider>
  );
}

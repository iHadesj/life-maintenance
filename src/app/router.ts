import { useMemo, useSyncExternalStore } from 'react';
import type { Point } from '../motion/transitions';

/**
 * Hash router. Hash URLs work from any static host and from the service
 * worker's navigation fallback; history state carries choreography hints
 * (where a "dive" started) so back/forward replay the right transition.
 */

export type RouteName = 'system' | 'category' | 'queue' | 'log' | 'settings';

export interface Route {
  name: RouteName;
  id?: string;
  query: Record<string, string>;
  /** Path without query: identifies the page for transitions. */
  pageKey: string;
}

export interface NavState {
  lmDepth: number;
  origin?: Point | null;
  /** How many overlay entries are stacked on top of the page entry. */
  overlayDepth?: number;
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/';
  const [path = '/', search = ''] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(search));
  const segments = path.split('/').filter(Boolean);

  if (segments[0] === 'c' && segments[1]) {
    const id = decodeURIComponent(segments[1]);
    return { name: 'category', id, query, pageKey: `category:${id}` };
  }
  if (segments[0] === 'queue') return { name: 'queue', query, pageKey: 'queue' };
  if (segments[0] === 'log') return { name: 'log', query, pageKey: 'log' };
  if (segments[0] === 'settings') return { name: 'settings', query, pageKey: 'settings' };
  return { name: 'system', query, pageKey: 'system' };
}

export function pathFor(name: RouteName, id?: string): string {
  switch (name) {
    case 'category':
      return `#/c/${encodeURIComponent(id ?? '')}`;
    case 'queue':
      return '#/queue';
    case 'log':
      return '#/log';
    case 'settings':
      return '#/settings';
    default:
      return '#/';
  }
}

export function withQuery(path: string, query: Record<string, string | null | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== null && value !== undefined && value !== '') params.set(key, value);
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

// ── location store ──────────────────────────────────────────────────────────

interface LocationSnapshot {
  hash: string;
  state: NavState | null;
}

const read = (): LocationSnapshot => ({
  hash: window.location.hash || '#/',
  state: (window.history.state as NavState | null) ?? null,
});

let snapshot: LocationSnapshot = read();
const listeners = new Set<() => void>();

function sync(): void {
  const next = read();
  if (next.hash === snapshot.hash && next.state === snapshot.state) return;
  snapshot = next;
  listeners.forEach((listener) => listener());
}

if (typeof window !== 'undefined') {
  if (!window.history.state) window.history.replaceState({ lmDepth: 0 } satisfies NavState, '');
  snapshot = read();
  window.addEventListener('popstate', sync);
  window.addEventListener('hashchange', sync);
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function currentRoute(): Route {
  return parseHash(snapshot.hash);
}

export function navigate(to: string, options: { replace?: boolean; state?: Omit<NavState, 'lmDepth'> } = {}): void {
  if (to === (window.location.hash || '#/') && !options.replace) return;
  const depth = snapshot.state?.lmDepth ?? 0;
  const state: NavState = { ...options.state, lmDepth: options.replace ? depth : depth + 1 };
  if (options.replace) window.history.replaceState(state, '', to);
  else window.history.pushState(state, '', to);
  sync();
}

/** Resolves after the next history traversal settles (or a short timeout). */
export function waitForNavigation(timeout = 450): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      window.removeEventListener('popstate', done);
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(done, timeout);
    window.addEventListener('popstate', done);
  });
}

export function useLocationSnapshot(): LocationSnapshot {
  return useSyncExternalStore(subscribe, () => snapshot, () => snapshot);
}

export function useRoute(): Route {
  const { hash } = useLocationSnapshot();
  return useMemo(() => parseHash(hash), [hash]);
}

// ── overlays (?item=, ?edit=) live on top of the current page ───────────────

function basePath(route: Route): string {
  return pathFor(route.name, route.id);
}

const OVERLAY_KEYS = ['item', 'edit', 'cat', 'title', 'area'] as const;

export function openOverlay(params: Record<string, string>): void {
  const route = currentRoute();
  navigate(withQuery(basePath(route), { ...route.query, ...params }), {
    state: { overlayDepth: (snapshot.state?.overlayDepth ?? 0) + 1, origin: snapshot.state?.origin },
  });
}

/** Closes the top overlay: pops its history entry when we pushed one. */
export function closeOverlay(keys: readonly string[]): void {
  const route = currentRoute();
  if ((snapshot.state?.overlayDepth ?? 0) > 0) {
    window.history.back();
    return;
  }
  const query: Record<string, string | null> = { ...route.query };
  for (const key of keys) query[key] = null;
  navigate(withQuery(basePath(route), query), { replace: true });
}

/** Closes every overlay at once (e.g. after deleting the system they showed). */
export function closeAllOverlays(): void {
  const depth = snapshot.state?.overlayDepth ?? 0;
  if (depth > 0) {
    window.history.go(-depth);
    return;
  }
  const route = currentRoute();
  const query: Record<string, string | null> = { ...route.query };
  for (const key of OVERLAY_KEYS) query[key] = null;
  navigate(withQuery(basePath(route), query), { replace: true });
}

/** Replaces query params without adding history (filters, search). */
export function setQuery(params: Record<string, string | null>): void {
  const route = currentRoute();
  navigate(withQuery(basePath(route), { ...route.query, ...params }), {
    replace: true,
    state: { overlayDepth: snapshot.state?.overlayDepth, origin: snapshot.state?.origin },
  });
}

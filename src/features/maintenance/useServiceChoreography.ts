import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useUI } from '../../app/ui';
import type { MaintenanceStatus } from '../../services/cycle';
import type { EvaluatedItem } from '../../services/health';

/**
 * A serviced system should be *seen* resetting before it travels to its new
 * place. While any service is fresh, the list keeps its previous order and the
 * serviced item keeps its previous section; when the window closes, everything
 * settles with layout animation — it drifts back to the stable position.
 */
export function useServiceChoreography(entries: readonly EvaluatedItem[]) {
  const serviced = useUI((state) => state.serviced);
  const lastOrder = useRef<string[]>([]);
  const frozen = useRef<string[] | null>(null);
  const pinned = Object.keys(serviced).length > 0;

  const ordered = useMemo(() => {
    if (!pinned) {
      frozen.current = null;
      return [...entries];
    }
    if (!frozen.current) frozen.current = lastOrder.current;
    const index = new Map(frozen.current.map((id, i) => [id, i]));
    return [...entries].sort(
      (a, b) => (index.get(a.item.id) ?? Number.MAX_SAFE_INTEGER) - (index.get(b.item.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [entries, pinned]);

  useEffect(() => {
    lastOrder.current = ordered.map((e) => e.item.id);
  });

  const displayStatus = useCallback(
    (entry: EvaluatedItem): MaintenanceStatus => serviced[entry.item.id]?.prevStatus ?? entry.cycle.status,
    [serviced],
  );

  return { entries: ordered, displayStatus, serviced };
}

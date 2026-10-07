import { PageFrame } from '../app/PageFrame';
import { useSystemData } from '../app/SystemData';
import { PageTitle } from '../components/PageTitle';
import { LogStats } from '../features/timeline/LogStats';
import { MaintenanceTimeline } from '../features/timeline/MaintenanceTimeline';
import type { PageTransition } from '../motion/transitions';
import { plural } from '../services/format';

export function LogPage({ transition }: { transition: PageTransition }) {
  const { logs } = useSystemData();
  return (
    <PageFrame transition={transition} label="Maintenance log">
      <PageTitle primary="MAINTENANCE" secondary="LOG/" kicker={`${plural(logs.length, 'entry', 'entries')} · newest first`} />
      {logs.length > 0 && <LogStats />}
      <MaintenanceTimeline />
    </PageFrame>
  );
}

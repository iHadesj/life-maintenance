import { PageFrame } from '../app/PageFrame';
import { PageTitle } from '../components/PageTitle';
import { AreasPanel, BackupPanel, PreferencesPanel, StoragePanel, SystemPanel } from '../features/settings/SettingsPanels';
import type { PageTransition } from '../motion/transitions';

export function SettingsPage({ transition }: { transition: PageTransition }) {
  return (
    <PageFrame transition={transition} label="Settings">
      <PageTitle primary="SYSTEM" secondary="SETTINGS/" kicker="config · stored on this device" />
      <BackupPanel />
      <AreasPanel />
      <PreferencesPanel />
      <StoragePanel />
      <SystemPanel />
    </PageFrame>
  );
}

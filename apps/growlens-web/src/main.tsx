import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AccountSyncWidget from './AccountSyncWidget';
import App from './App';
import CameraObservationWidget from './CameraObservationWidget';
import CompleteBackupWidget from './CompleteBackupWidget';
import CultivationAnalyticsWidget from './CultivationAnalyticsWidget';
import CultivationRecordsWidget from './CultivationRecordsWidget';
import ErrorBoundary from './ErrorBoundary';
import ExternalStateBridge from './ExternalStateBridge';
import PhotoComparisonWidget from './PhotoComparisonWidget';
import ReportsHistoryWidget from './ReportsHistoryWidget';
import SafeSyncWidget from './SafeSyncWidget';
import TaskRoutineWidget from './TaskRoutineWidget';
import './styles.css';
import './account.css';
import './camera.css';
import './reports.css';
import './backup.css';
import './routines.css';
import './photo-comparison.css';
import './cultivation-records.css';
import './cultivation-analytics.css';
import './safe-sync.css';
import './accessibility.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <SafeSyncWidget />
      <CultivationAnalyticsWidget />
      <CultivationRecordsWidget />
      <TaskRoutineWidget />
      <CompleteBackupWidget />
      <ReportsHistoryWidget />
      <CameraObservationWidget />
      <PhotoComparisonWidget />
      <AccountSyncWidget />
      <ExternalStateBridge />
    </ErrorBoundary>
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // The app remains fully usable when service-worker registration is blocked.
    });
  });
}

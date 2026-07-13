import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AccountSyncWidget from './AccountSyncWidget';
import App from './App';
import CameraObservationWidget from './CameraObservationWidget';
import ErrorBoundary from './ErrorBoundary';
import ExternalStateBridge from './ExternalStateBridge';
import './styles.css';
import './account.css';
import './camera.css';
import './accessibility.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <CameraObservationWidget />
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

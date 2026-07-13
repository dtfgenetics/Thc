import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AccountSyncWidget from './AccountSyncWidget';
import App from './App';
import ErrorBoundary from './ErrorBoundary';
import './styles.css';
import './account.css';
import './accessibility.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <AccountSyncWidget />
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

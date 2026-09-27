import { useCallback, useEffect, useState } from 'react';
import { useModalFocusTrap } from './useModalFocusTrap';

type StorageHealth = {
  supported: boolean;
  usage: number | null;
  quota: number | null;
  persisted: boolean | null;
};

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return 'Unavailable';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

async function readStorageHealth(): Promise<StorageHealth> {
  if (!navigator.storage?.estimate) {
    return { supported: false, usage: null, quota: null, persisted: null };
  }
  try {
    const estimate = await navigator.storage.estimate();
    const persisted = navigator.storage.persisted
      ? await navigator.storage.persisted().catch(() => null)
      : null;
    return {
      supported: true,
      usage: Number.isFinite(estimate.usage) ? Number(estimate.usage) : null,
      quota: Number.isFinite(estimate.quota) ? Number(estimate.quota) : null,
      persisted,
    };
  } catch {
    return { supported: true, usage: null, quota: null, persisted: null };
  }
}

export default function PwaHealthWidget() {
  const [open, setOpen] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [storage, setStorage] = useState<StorageHealth>({ supported: false, usage: null, quota: null, persisted: null });
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [message, setMessage] = useState('');
  const modalRef = useModalFocusTrap<HTMLElement>(open, () => setOpen(false));

  const refreshStorage = useCallback(async () => {
    setStorage(await readStorageHealth());
  }, []);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    void refreshStorage();

    let active = true;
    let stateListener: (() => void) | null = null;
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        if (!active) return;
        setRegistration(reg);
        if (reg.waiting && navigator.serviceWorker.controller) setWaiting(reg.waiting);
        const onUpdateFound = () => {
          const worker = reg.installing;
          if (!worker) return;
          const onStateChange = () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) setWaiting(worker);
          };
          worker.addEventListener('statechange', onStateChange);
          stateListener = () => worker.removeEventListener('statechange', onStateChange);
        };
        reg.addEventListener('updatefound', onUpdateFound);
        const previousCleanup = stateListener;
        stateListener = () => {
          previousCleanup?.();
          reg.removeEventListener('updatefound', onUpdateFound);
        };
      }).catch(() => {});
    }

    return () => {
      active = false;
      stateListener?.();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [refreshStorage]);

  async function requestPersistence(): Promise<void> {
    if (!navigator.storage?.persist) {
      setMessage('Persistent-storage requests are not supported in this browser.');
      return;
    }
    try {
      const granted = await navigator.storage.persist();
      setMessage(granted
        ? 'Browser storage is now marked persistent where supported.'
        : 'The browser did not grant persistent storage. Keep using complete backups for recovery.');
      await refreshStorage();
    } catch {
      setMessage('The persistent-storage request could not be completed.');
    }
  }

  async function checkForUpdate(): Promise<void> {
    if (!registration) {
      setMessage('Service-worker update checks are unavailable in this browser session.');
      return;
    }
    try {
      await registration.update();
      setWaiting(registration.waiting && navigator.serviceWorker.controller ? registration.waiting : null);
      setMessage(registration.waiting ? 'A GrowLens update is ready to install.' : 'GrowLens is using the latest downloaded app shell.');
    } catch {
      setMessage('GrowLens could not check for an app-shell update while offline or restricted.');
    }
  }

  function applyUpdate(): void {
    if (!waiting) return;
    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange, { once: true });
    waiting.postMessage({ type: 'SKIP_WAITING' });
    setMessage('Installing the downloaded GrowLens update…');
  }

  const percent = storage.usage !== null && storage.quota
    ? Math.min(100, Math.max(0, (storage.usage / storage.quota) * 100))
    : null;

  return (
    <>
      <button className={`pwa-health-launcher ${online ? 'online' : 'offline'} ${waiting ? 'update' : ''}`} type="button" onClick={() => { setOpen(true); void refreshStorage(); }} aria-label="Open GrowLens offline and storage status">
        <span aria-hidden="true">{waiting ? '↑' : online ? '◉' : '○'}</span>
        <strong>{waiting ? 'Update ready' : online ? 'Offline ready' : 'Offline'}</strong>
      </button>

      {open ? (
        <div className="pwa-health-overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
          <section ref={modalRef} className="pwa-health-panel" role="dialog" aria-modal="true" aria-labelledby="pwa-health-title">
            <header>
              <div><span className="eyebrow">Offline reliability & local storage</span><h2 id="pwa-health-title">GrowLens app health</h2></div>
              <button className="account-close" type="button" onClick={() => setOpen(false)} aria-label="Close app health">×</button>
            </header>

            {message ? <div className="account-message success" role="status">{message}</div> : null}

            <div className="pwa-health-grid">
              <article><span>Connection</span><strong>{online ? 'Online' : 'Offline'}</strong><small>{online ? 'Network features can run.' : 'Local records and cached app shell remain available.'}</small></article>
              <article><span>App shell</span><strong>{waiting ? 'Update ready' : registration ? 'Registered' : 'Checking'}</strong><small>{waiting ? 'A downloaded version is waiting for approval.' : 'GrowLens uses a service worker for offline shell recovery.'}</small></article>
              <article><span>Storage policy</span><strong>{storage.persisted === true ? 'Persistent' : storage.persisted === false ? 'Best effort' : 'Unknown'}</strong><small>Complete backups remain the disaster-recovery source regardless of browser policy.</small></article>
            </div>

            <section className="pwa-health-section">
              <h3>Browser storage</h3>
              <p>Storage estimates cover this site origin, not only GrowLens. Browsers may report approximate values.</p>
              <div className="pwa-storage-meter" role="meter" aria-label="Approximate site storage used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent === null ? undefined : Math.round(percent)}>
                <span style={{ width: `${percent ?? 0}%` }} />
              </div>
              <div className="pwa-storage-values"><strong>{formatBytes(storage.usage)} used</strong><span>{formatBytes(storage.quota)} quota</span></div>
              <div className="pwa-health-actions">
                <button className="secondary-button" type="button" onClick={() => void refreshStorage()}>Refresh storage estimate</button>
                <button className="secondary-button" type="button" disabled={storage.persisted === true} onClick={() => void requestPersistence()}>{storage.persisted === true ? 'Persistent storage active' : 'Request persistent storage'}</button>
              </div>
            </section>

            <section className="pwa-health-section">
              <h3>App updates</h3>
              <p>GrowLens never forces a downloaded service-worker update into an active session. Apply it when you are ready so unsaved form work is not unexpectedly interrupted.</p>
              <div className="pwa-health-actions">
                <button className="secondary-button" type="button" onClick={() => void checkForUpdate()}>Check for update</button>
                {waiting ? <button className="primary-button" type="button" onClick={applyUpdate}>Install downloaded update</button> : null}
              </div>
            </section>

            <div className="warning-note"><strong>Recovery boundary</strong><span>Offline caching and persistent-storage requests reduce risk; they do not replace complete local backups or server-side backups.</span></div>
          </section>
        </div>
      ) : null}
    </>
  );
}

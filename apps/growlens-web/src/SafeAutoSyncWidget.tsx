import { useEffect, useState } from 'react';
import {
  clearQueuedSync,
  forgetSyncBaseline,
  getQueuedSync,
  queueCurrentStateForSync,
  runQueuedSync,
} from './backgroundSyncCoordinator';
import { loadSyncMetadata } from './syncMetadata';
import type { SyncIntent } from './syncIntentStore';
import { AUTO_SYNC_CHANNEL, AUTO_SYNC_STATUS_EVENT } from './syncEvents';
import { STATE_SAVED_EVENT } from './storage';

const AUTO_SYNC_SETTING_KEY = 'growlens-safe-auto-sync-enabled-v1';

function loadEnabled(): boolean {
  try {
    return window.localStorage.getItem(AUTO_SYNC_SETTING_KEY) === 'true';
  } catch {
    return false;
  }
}

function saveEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(AUTO_SYNC_SETTING_KEY, String(enabled));
  } catch {
    // The toggle remains usable for the current page even if settings cannot persist.
  }
}

function statusText(intent: SyncIntent | null, enabled: boolean): { label: string; detail: string; tone: string } {
  if (!enabled) return { label: 'Auto-sync off', detail: 'Enable automatic synchronization while GrowLens is open and online.', tone: 'idle' };
  if (!loadSyncMetadata()) return { label: 'Connect account', detail: 'Sign in and reconcile this device once before automatic synchronization can start.', tone: 'warning' };
  if (!intent) return { label: 'Auto-sync ready', detail: 'No local changes are waiting to upload.', tone: 'ready' };
  if (intent.status === 'blocked-conflict') return { label: 'Sync conflict', detail: intent.lastError || 'Another device changed the account copy.', tone: 'danger' };
  if (intent.status === 'blocked-auth') return { label: 'Sign in again', detail: intent.lastError || 'The account session needs attention.', tone: 'warning' };
  if (intent.status === 'failed') return { label: 'Retry scheduled', detail: intent.lastError || 'A network attempt failed and will retry while the app is active.', tone: 'warning' };
  if (intent.status === 'syncing') return { label: 'Syncing…', detail: 'Comparing the latest device and account revisions.', tone: 'working' };
  return { label: 'Changes queued', detail: 'GrowLens will sync when the app is online and active.', tone: 'working' };
}

export default function SafeAutoSyncWidget() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(loadEnabled);
  const [intent, setIntent] = useState<SyncIntent | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh(): Promise<void> {
    setIntent(await getQueuedSync());
  }

  async function queueAndRun(): Promise<void> {
    if (!enabled || busy) return;
    setBusy(true);
    try {
      const queued = await queueCurrentStateForSync();
      if (!queued) return;
      const result = await runQueuedSync();
      if (result) setMessage(result.message);
    } finally {
      await refresh();
      setBusy(false);
    }
  }

  useEffect(() => {
    void refresh();
    const onStatus = (event: Event) => {
      const custom = event as CustomEvent<{ message?: string }>;
      if (custom.detail?.message) setMessage(custom.detail.message);
      void refresh();
    };
    window.addEventListener(AUTO_SYNC_STATUS_EVENT, onStatus);
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(AUTO_SYNC_CHANNEL) : null;
    if (channel) channel.onmessage = (event) => {
      if (event.data?.message) setMessage(String(event.data.message));
      void refresh();
    };
    return () => {
      window.removeEventListener(AUTO_SYNC_STATUS_EVENT, onStatus);
      channel?.close();
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { void queueAndRun(); }, 650);
    };
    const attemptExisting = () => { void runQueuedSync().then(() => refresh()); };
    const onVisibility = () => { if (document.visibilityState === 'visible') attemptExisting(); };

    window.addEventListener(STATE_SAVED_EVENT, schedule);
    window.addEventListener('storage', schedule);
    window.addEventListener('online', attemptExisting);
    window.addEventListener('focus', attemptExisting);
    document.addEventListener('visibilitychange', onVisibility);
    void queueAndRun();

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(STATE_SAVED_EVENT, schedule);
      window.removeEventListener('storage', schedule);
      window.removeEventListener('online', attemptExisting);
      window.removeEventListener('focus', attemptExisting);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);

  async function toggleEnabled(): Promise<void> {
    const next = !enabled;
    setEnabled(next);
    saveEnabled(next);
    setMessage(next
      ? 'Safe auto-sync enabled for this browser while GrowLens is open.'
      : 'Safe auto-sync disabled. Manual account controls remain available.');
    if (!next) {
      await clearQueuedSync('Safe auto-sync disabled and its pending intent was cleared.');
      await refresh();
    }
  }

  async function resetBaseline(): Promise<void> {
    forgetSyncBaseline();
    await clearQueuedSync('Saved sync baseline cleared. Reconcile the account copy before automatic sync resumes.');
    await refresh();
  }

  function openAccountControls(): void {
    document.querySelector<HTMLButtonElement>('.account-launcher')?.click();
  }

  const status = statusText(intent, enabled);

  return (
    <>
      <button
        className={`safe-sync-launcher ${status.tone}`}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open safe auto-sync settings"
      >
        <span aria-hidden="true">⇅</span>
        <strong>{status.label}</strong>
      </button>

      {open ? (
        <div className="safe-sync-overlay" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setOpen(false);
        }}>
          <section className="safe-sync-panel" role="dialog" aria-modal="true" aria-labelledby="safe-sync-title">
            <header>
              <div><span className="eyebrow">Conflict-safe account automation</span><h2 id="safe-sync-title">Safe auto-sync</h2></div>
              <button className="account-close" type="button" onClick={() => setOpen(false)} aria-label="Close safe auto-sync settings">×</button>
            </header>

            {message ? <div className="account-message success" role="status">{message}</div> : null}

            <div className={`safe-sync-status ${status.tone}`}>
              <span aria-hidden="true">{status.tone === 'danger' ? '!' : status.tone === 'ready' ? '✓' : '↻'}</span>
              <div><strong>{status.label}</strong><p>{status.detail}</p></div>
            </div>

            <label className="safe-sync-toggle">
              <span><strong>Automatically sync this browser</strong><small>Runs on app start, local changes, reconnect, focus, and visibility while GrowLens is open.</small></span>
              <input type="checkbox" checked={enabled} onChange={() => void toggleEnabled()} />
            </label>

            <div className="safe-sync-actions">
              <button className="primary-button" type="button" disabled={!enabled || busy} onClick={() => void queueAndRun()}>{busy ? 'Checking…' : 'Sync safely now'}</button>
              <button className="secondary-button" type="button" onClick={openAccountControls}>Open account controls</button>
              <button className="text-button" type="button" onClick={() => void resetBaseline()}>Reset saved baseline</button>
            </div>

            <div className="warning-note"><strong>No silent overwrite</strong><span>GrowLens uploads automatically only when the server still matches the last reconciled revision. Authentication changes and revision conflicts stop the queue for manual review.</span></div>
            <p className="safe-sync-boundary">This is active-page synchronization, not a closed-app background promise. Passwords, cookies, CSRF tokens, private paths, and photo bytes are never stored in the intent queue.</p>
          </section>
        </div>
      ) : null}
    </>
  );
}

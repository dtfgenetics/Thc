import { useCallback, useEffect, useState } from 'react';
import { processCurrentStateSync, type SyncRunResult, type SyncRunStatus } from './syncCoordinator';
import {
  AUTO_SYNC_ENABLED_KEY,
  SYNC_STATUS_EVENT,
  clearSyncIntent,
  enqueueCurrentStateSync,
  getSyncIntent,
  isAutoSyncEnabled,
  readSyncBaseline,
  setAutoSyncEnabled,
  type SyncIntent,
} from './syncIntentQueue';
import { STATE_SAVED_EVENT, type StateSavedDetail } from './storage';

const RETRY_INTERVAL_MS = 5 * 60 * 1000;

function statusLabel(status: SyncRunStatus): string {
  switch (status) {
    case 'synced': return 'Synced';
    case 'uploaded': return 'Uploaded';
    case 'downloaded': return 'Updated';
    case 'conflict': return 'Needs review';
    case 'offline': return 'Offline queue';
    case 'signed-out': return 'Sign in';
    case 'queued': return 'Queued';
    case 'busy': return 'Other tab';
    case 'error': return 'Retry queued';
    default: return 'Safe sync';
  }
}

function readableTime(value: string | null | undefined): string {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function SafeSyncWidget() {
  const [open, setOpen] = useState(false);
  const [enabled, setEnabled] = useState(() => isAutoSyncEnabled());
  const [intent, setIntent] = useState<SyncIntent | null>(null);
  const [result, setResult] = useState<SyncRunResult>({ status: 'idle', message: 'Safe synchronization is disabled.' });
  const [busy, setBusy] = useState(false);

  const refreshIntent = useCallback(async () => {
    try {
      setIntent(await getSyncIntent());
    } catch (error) {
      setResult({ status: 'error', message: error instanceof Error ? error.message : 'Could not read the sync queue.' });
    }
  }, []);

  const processQueue = useCallback(async (force = false) => {
    if (!isAutoSyncEnabled() && !force) return;
    setBusy(true);
    try {
      const next = await processCurrentStateSync({ force });
      setResult(next);
      await refreshIntent();
    } finally {
      setBusy(false);
    }
  }, [refreshIntent]);

  const queueAndProcess = useCallback(async (force = false) => {
    await enqueueCurrentStateSync();
    await refreshIntent();
    await processQueue(force);
  }, [processQueue, refreshIntent]);

  useEffect(() => {
    void refreshIntent();
    if (enabled) void queueAndProcess(false);
  }, [enabled, queueAndProcess, refreshIntent]);

  useEffect(() => {
    let timer: number | null = null;
    const schedule = () => {
      if (!isAutoSyncEnabled()) return;
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => void queueAndProcess(false), 500);
    };
    const handleSaved = (event: Event) => {
      const detail = (event as CustomEvent<StateSavedDetail>).detail;
      if (detail?.source !== 'sync') schedule();
    };
    const handleOnline = () => schedule();
    const handleFocus = () => schedule();
    const handleVisibility = () => { if (document.visibilityState === 'visible') schedule(); };
    const handleWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === 'growlens-sync-requested') schedule();
    };
    const handleStatus = (event: Event) => {
      const detail = (event as CustomEvent<SyncRunResult>).detail;
      if (detail?.status) setResult(detail);
    };
    const channel = 'BroadcastChannel' in globalThis ? new BroadcastChannel('growlens-sync-v1') : null;
    if (channel) channel.onmessage = (event) => { if (event.data?.status) setResult(event.data as SyncRunResult); };

    window.addEventListener(STATE_SAVED_EVENT, handleSaved);
    window.addEventListener('storage', handleOnline);
    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener(SYNC_STATUS_EVENT, handleStatus);
    navigator.serviceWorker?.addEventListener('message', handleWorkerMessage);
    const interval = window.setInterval(() => {
      if (isAutoSyncEnabled() && document.visibilityState === 'visible') void queueAndProcess(false);
    }, RETRY_INTERVAL_MS);

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      window.clearInterval(interval);
      window.removeEventListener(STATE_SAVED_EVENT, handleSaved);
      window.removeEventListener('storage', handleOnline);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener(SYNC_STATUS_EVENT, handleStatus);
      navigator.serviceWorker?.removeEventListener('message', handleWorkerMessage);
      channel?.close();
    };
  }, [queueAndProcess]);

  async function enable(): Promise<void> {
    setAutoSyncEnabled(true);
    setEnabled(true);
    setResult({ status: 'queued', message: 'Establishing a trusted device/account baseline.' });
    await queueAndProcess(true);
  }

  async function disable(): Promise<void> {
    setAutoSyncEnabled(false);
    setEnabled(false);
    await clearSyncIntent();
    setIntent(null);
    setResult({ status: 'idle', message: 'Safe synchronization is disabled. Manual account sync remains available.' });
  }

  async function tryNow(): Promise<void> {
    await queueAndProcess(true);
  }

  const baseline = readSyncBaseline();
  const buttonStatus = enabled ? statusLabel(result.status) : 'Safe sync';
  const needsReview = result.status === 'conflict';

  return <>
    <button
      className={`safe-sync-launcher ${needsReview ? 'blocked' : ''}`}
      type="button"
      aria-label="Open safe synchronization queue"
      aria-expanded={open}
      onClick={() => { void refreshIntent(); setOpen(true); }}
    ><span aria-hidden="true">⇄</span><strong>{buttonStatus}</strong></button>
    {open ? <div className="safe-sync-overlay" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
      <section className="safe-sync-panel" role="dialog" aria-modal="true" aria-labelledby="safe-sync-title">
        <header className="safe-sync-header"><div><span className="eyebrow">No blind request replay</span><h2 id="safe-sync-title">Safe synchronization queue</h2><p>GrowLens checks a fresh session, CSRF token, remote state, and revision before every write. If both copies changed, it stops without overwriting either one.</p></div><button type="button" className="account-close" aria-label="Close safe synchronization" onClick={() => setOpen(false)}>×</button></header>
        <div className={`safe-sync-status ${needsReview ? 'blocked' : ''}`} role="status"><strong>{statusLabel(result.status)}</strong><span>{result.message}</span></div>
        <div className="safe-sync-grid">
          <article><span>Automatic queue</span><strong>{enabled ? 'Enabled' : 'Disabled'}</strong><small>Runs on app start, local save, online, focus, visibility, and periodic active-page checks.</small></article>
          <article><span>Pending intent</span><strong>{intent ? intent.status : 'None'}</strong><small>{intent ? `Queued ${readableTime(intent.queuedAt)} · ${intent.attempts} failed attempt${intent.attempts === 1 ? '' : 's'}` : 'No current-state sync intent is stored.'}</small></article>
          <article><span>Trusted baseline</span><strong>{baseline ? `Revision ${baseline.revision}` : 'Not established'}</strong><small>{baseline ? `Account ${baseline.userId.slice(0, 12)}… · ${readableTime(baseline.updatedAt)}` : 'Connect and reconcile through Account before automatic writes can be trusted.'}</small></article>
          <article><span>Browser scope</span><strong>Open or active app</strong><small>The queue survives offline periods. Closed-app authenticated writes are not performed by the service worker.</small></article>
        </div>
        {intent?.lastError ? <div className="safe-sync-error"><strong>Queue detail</strong><span>{intent.lastError}</span></div> : null}
        <div className="safe-sync-actions">
          {enabled ? <button className="secondary-button" type="button" disabled={busy} onClick={() => void disable()}>Disable automatic queue</button> : <button className="primary-button" type="button" disabled={busy} onClick={() => void enable()}>Enable safe synchronization</button>}
          <button className="secondary-button" type="button" disabled={busy || !enabled} onClick={() => void tryNow()}>{busy ? 'Checking…' : 'Try queued sync now'}</button>
          <button className="secondary-button" type="button" onClick={() => window.dispatchEvent(new CustomEvent('growlens:open-account'))}>Open Account controls</button>
        </div>
        <div className="warning-note"><strong>Conflict rule</strong><span>Automatic upload occurs only when the account still matches the trusted baseline. Automatic download occurs only when this device still matches it. Any two-sided change requires manual resolution.</span></div>
      </section>
    </div> : null}
  </>;
}

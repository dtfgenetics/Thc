import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import {
  growLensRemoteStore,
  GrowLensApiError,
  GrowLensSyncConflictError,
  type AuthenticatedSession,
  type GrowLensRemoteStore,
  type RemoteSnapshot,
} from './remoteStore';
import {
  loadState,
  saveState,
  serializeBackup,
  STATE_SAVED_EVENT,
} from './storage';
import {
  hasGrowLensRecords,
  mergeGrowLensStates,
  statesEqual,
  summarizeGrowLensState,
} from './syncMerge';
import type { GrowLensState } from './types';

type ServiceStatus = 'checking' | 'local' | 'available' | 'authenticated' | 'unavailable';
type AuthMode = 'login' | 'register';
type ResolutionContext = {
  local: GrowLensState;
  remote: RemoteSnapshot;
  reason: 'connected' | 'conflict' | 'pull';
};

type Props = {
  remoteStore?: GrowLensRemoteStore;
};

function downloadJson(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function todayInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function readableError(error: unknown): string {
  if (error instanceof GrowLensApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'The account request failed.';
}

export default function AccountSyncWidget({ remoteStore = growLensRemoteStore }: Props) {
  const [open, setOpen] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<ServiceStatus>('checking');
  const [session, setSession] = useState<AuthenticatedSession | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [resolution, setResolution] = useState<ResolutionContext | null>(null);

  const localSummary = useMemo(() => summarizeGrowLensState(loadState()), [open, dirty, resolution]);
  const remoteSummary = useMemo(
    () => resolution ? summarizeGrowLensState(resolution.remote.state) : null,
    [resolution],
  );

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const current = await remoteStore.getSession();
        if (cancelled) return;
        if (!current.authenticated) {
          setServiceStatus('available');
          return;
        }

        setSession(current);
        setServiceStatus('authenticated');
        const remote = await remoteStore.pull();
        if (cancelled) return;
        const local = loadState();
        setSession((value) => value ? {
          ...value,
          revision: remote.revision,
          updatedAt: remote.updatedAt,
        } : value);
        setDirty(!statesEqual(local, remote.state));
      } catch (error) {
        if (cancelled) return;
        if (error instanceof GrowLensApiError && [404, 405, 502, 503].includes(error.status)) {
          setServiceStatus('unavailable');
        } else {
          setServiceStatus('local');
          setErrorMessage(readableError(error));
        }
      }
    }

    initialize();
    return () => {
      cancelled = true;
    };
  }, [remoteStore]);

  useEffect(() => {
    const markDirty = () => {
      if (session) setDirty(true);
    };
    window.addEventListener(STATE_SAVED_EVENT, markDirty);
    window.addEventListener('storage', markDirty);
    return () => {
      window.removeEventListener(STATE_SAVED_EVENT, markDirty);
      window.removeEventListener('storage', markDirty);
    };
  }, [session]);

  function clearMessages(): void {
    setMessage('');
    setErrorMessage('');
  }

  function updateSessionRevision(revision: number, updatedAt: string): void {
    setSession((current) => current ? { ...current, revision, updatedAt } : current);
  }

  function replaceLocalState(state: GrowLensState, messageText: string): void {
    saveState(state);
    setDirty(false);
    setResolution(null);
    setMessage(messageText);
    window.setTimeout(() => window.location.reload(), 80);
  }

  function backupLocal(): void {
    downloadJson(`growlens-before-sync-${todayInput()}.json`, serializeBackup(loadState()));
    setMessage('Local backup downloaded.');
  }

  async function submitAuth(event: FormEvent): Promise<void> {
    event.preventDefault();
    clearMessages();
    setBusy(true);
    try {
      const result = authMode === 'register'
        ? await remoteStore.register(email.trim(), password)
        : await remoteStore.login(email.trim(), password);
      const nextSession: AuthenticatedSession = {
        authenticated: true,
        user: result.user,
        csrfToken: result.csrfToken,
        revision: result.revision,
        updatedAt: result.updatedAt,
      };
      setSession(nextSession);
      setServiceStatus('authenticated');
      setPassword('');

      const local = loadState();
      if (statesEqual(local, result.state)) {
        setDirty(false);
        setMessage('Account connected. This device matches the server copy.');
      } else if (!hasGrowLensRecords(local)) {
        replaceLocalState(result.state, 'Account connected. Server data loaded on this device.');
      } else {
        setDirty(true);
        setResolution({ local, remote: result, reason: 'connected' });
        setMessage('Account connected. Choose how to reconcile this device with the account copy.');
      }
    } catch (error) {
      setErrorMessage(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  async function pushLocal(): Promise<void> {
    if (!session) return;
    clearMessages();
    setBusy(true);
    try {
      const local = loadState();
      const saved = await remoteStore.push(local, session.revision, session.csrfToken);
      updateSessionRevision(saved.revision, saved.updatedAt);
      setDirty(false);
      setResolution(null);
      setMessage(`Synced to revision ${saved.revision}.`);
    } catch (error) {
      if (error instanceof GrowLensSyncConflictError) {
        try {
          const remote = await remoteStore.pull();
          updateSessionRevision(remote.revision, remote.updatedAt);
          setResolution({ local: loadState(), remote, reason: 'conflict' });
          setDirty(true);
          setMessage('Another device changed the account copy. Choose which data to keep or merge.');
        } catch (pullError) {
          setErrorMessage(readableError(pullError));
        }
      } else {
        setErrorMessage(readableError(error));
      }
    } finally {
      setBusy(false);
    }
  }

  async function requestPull(): Promise<void> {
    if (!session) return;
    clearMessages();
    setBusy(true);
    try {
      const remote = await remoteStore.pull();
      updateSessionRevision(remote.revision, remote.updatedAt);
      const local = loadState();
      if (statesEqual(local, remote.state)) {
        setDirty(false);
        setResolution(null);
        setMessage('This device already matches the account copy.');
      } else if (!hasGrowLensRecords(local)) {
        replaceLocalState(remote.state, 'Account data loaded on this device.');
      } else {
        setResolution({ local, remote, reason: 'pull' });
        setDirty(true);
        setMessage('This device differs from the account copy. Choose how to continue.');
      }
    } catch (error) {
      setErrorMessage(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  async function keepDeviceCopy(): Promise<void> {
    if (!session || !resolution) return;
    clearMessages();
    setBusy(true);
    try {
      const saved = await remoteStore.push(
        resolution.local,
        resolution.remote.revision,
        session.csrfToken,
      );
      updateSessionRevision(saved.revision, saved.updatedAt);
      setDirty(false);
      setResolution(null);
      setMessage(`Device copy uploaded as revision ${saved.revision}.`);
    } catch (error) {
      setErrorMessage(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  async function mergeCopies(): Promise<void> {
    if (!session || !resolution) return;
    clearMessages();
    setBusy(true);
    try {
      const merged = mergeGrowLensStates(resolution.local, resolution.remote.state);
      const saved = await remoteStore.push(
        merged,
        resolution.remote.revision,
        session.csrfToken,
      );
      updateSessionRevision(saved.revision, saved.updatedAt);
      saveState(merged);
      setDirty(false);
      setResolution(null);
      setMessage(`Copies merged and saved as revision ${saved.revision}.`);
      window.setTimeout(() => window.location.reload(), 80);
    } catch (error) {
      setErrorMessage(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  function useServerCopy(): void {
    if (!resolution) return;
    updateSessionRevision(resolution.remote.revision, resolution.remote.updatedAt);
    replaceLocalState(
      resolution.remote.state,
      'Server copy loaded. The previous local copy can be restored from a downloaded backup.',
    );
  }

  async function logout(): Promise<void> {
    if (!session) return;
    clearMessages();
    setBusy(true);
    try {
      await remoteStore.logout(session.csrfToken);
      setSession(null);
      setResolution(null);
      setDirty(false);
      setServiceStatus('available');
      setMessage('Signed out. Local GrowLens records remain on this device.');
    } catch (error) {
      setErrorMessage(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  async function deleteAccount(): Promise<void> {
    if (!session || !deletePassword) return;
    const confirmed = window.confirm(
      'Delete this GrowLens account and all server-stored records? Local records on this device are not automatically deleted.',
    );
    if (!confirmed) return;

    clearMessages();
    setBusy(true);
    try {
      await remoteStore.deleteAccount(deletePassword, session.csrfToken);
      setSession(null);
      setResolution(null);
      setDirty(false);
      setDeletePassword('');
      setServiceStatus('available');
      setMessage('Account deleted. Local records remain available on this device.');
    } catch (error) {
      setErrorMessage(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  const buttonLabel = serviceStatus === 'authenticated'
    ? dirty ? 'Sync needed' : 'Synced'
    : serviceStatus === 'unavailable'
      ? 'Local only'
      : 'Account';

  return (
    <>
      <button
        className={`account-launcher ${dirty ? 'dirty' : ''}`}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span aria-hidden="true">↻</span>
        <strong>{buttonLabel}</strong>
      </button>

      {open ? (
        <div className="account-overlay" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setOpen(false);
        }}>
          <aside className="account-panel" role="dialog" aria-modal="true" aria-labelledby="account-title">
            <div className="account-panel-header">
              <div>
                <span className="eyebrow">Optional cross-device backup</span>
                <h2 id="account-title">GrowLens account</h2>
              </div>
              <button className="account-close" type="button" onClick={() => setOpen(false)} aria-label="Close account panel">×</button>
            </div>

            {message ? <div className="account-message success" role="status">{message}</div> : null}
            {errorMessage ? <div className="account-message error" role="alert">{errorMessage}</div> : null}

            {serviceStatus === 'checking' ? (
              <div className="account-loading">Checking account service…</div>
            ) : null}

            {serviceStatus === 'unavailable' ? (
              <div className="account-local-card">
                <strong>Local mode is active</strong>
                <p>The account API is not deployed at this address yet. All current GrowLens features and local backups still work.</p>
                <button className="secondary-button" type="button" onClick={() => window.location.reload()}>Check again</button>
              </div>
            ) : null}

            {!session && ['available', 'local'].includes(serviceStatus) ? (
              <>
                <div className="account-tabs" role="tablist" aria-label="Account action">
                  <button type="button" role="tab" aria-selected={authMode === 'login'} className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>Sign in</button>
                  <button type="button" role="tab" aria-selected={authMode === 'register'} className={authMode === 'register' ? 'active' : ''} onClick={() => setAuthMode('register')}>Create account</button>
                </div>
                <form className="stack-form account-form" onSubmit={submitAuth}>
                  <label>Email<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
                  <label>Password<input type="password" minLength={12} autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
                  <small>Use at least 12 characters. Your password is never stored in browser data or exported grow records.</small>
                  <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Working…' : authMode === 'login' ? 'Sign in' : 'Create account'}</button>
                </form>
              </>
            ) : null}

            {session ? (
              <div className="account-authenticated">
                <div className="account-identity">
                  <span className={`connection-dot ${dirty ? '' : 'online'}`} />
                  <div><strong>{session.user.email}</strong><small>Server revision {session.revision}{dirty ? ' · unsynced local changes' : ' · device is current'}</small></div>
                </div>

                <div className="account-summary-grid">
                  <div><span>Local records</span><strong>{localSummary.records}</strong></div>
                  <div><span>Plants</span><strong>{localSummary.plants}</strong></div>
                  <div><span>Diary</span><strong>{localSummary.diary}</strong></div>
                  <div><span>Tasks</span><strong>{localSummary.tasks}</strong></div>
                </div>

                <div className="account-actions">
                  <button className="primary-button" type="button" onClick={pushLocal} disabled={busy || Boolean(resolution)}>{busy ? 'Working…' : 'Upload this device'}</button>
                  <button className="secondary-button" type="button" onClick={requestPull} disabled={busy || Boolean(resolution)}>Check account copy</button>
                  <button className="secondary-button" type="button" onClick={backupLocal}>Download local backup</button>
                  <a className="secondary-button" href={remoteStore.exportUrl()} download>Export account data</a>
                </div>

                {resolution && remoteSummary ? (
                  <section className="sync-resolution" aria-labelledby="sync-resolution-title">
                    <h3 id="sync-resolution-title">Choose how to resolve different copies</h3>
                    <p>Nothing has been overwritten. Download a backup first when these records matter.</p>
                    <div className="copy-comparison">
                      <div><span>This device</span><strong>{localSummary.records} records</strong><small>{localSummary.plants} plants · {localSummary.diary} diary</small></div>
                      <div><span>Account copy</span><strong>{remoteSummary.records} records</strong><small>{remoteSummary.plants} plants · {remoteSummary.diary} diary · revision {resolution.remote.revision}</small></div>
                    </div>
                    <div className="resolution-actions">
                      <button className="secondary-button" type="button" onClick={backupLocal}>1. Back up this device</button>
                      <button className="secondary-button" type="button" onClick={useServerCopy} disabled={busy}>Use account copy</button>
                      <button className="secondary-button" type="button" onClick={keepDeviceCopy} disabled={busy}>Keep this device</button>
                      <button className="primary-button" type="button" onClick={mergeCopies} disabled={busy}>Merge both copies</button>
                    </div>
                    <small>Merge keeps every unique record ID. When the same ID differs, this device's version is kept.</small>
                  </section>
                ) : null}

                <details className="account-danger-zone">
                  <summary>Account and session controls</summary>
                  <div className="account-danger-content">
                    <button className="secondary-button" type="button" onClick={logout} disabled={busy}>Sign out</button>
                    <label>Current password<input type="password" autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} placeholder="Required to delete account" /></label>
                    <button className="danger-button" type="button" onClick={deleteAccount} disabled={busy || deletePassword.length === 0}>Delete server account</button>
                    <small>Deleting the server account does not erase this browser's local records. Use Settings to delete local data separately.</small>
                  </div>
                </details>
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}

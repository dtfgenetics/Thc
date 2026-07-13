import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from 'react';
import {
  MAX_COMPLETE_BACKUP_BYTES,
  mergeCompleteBackup,
  parseCompleteBackup,
  serializeCompleteBackup,
  type ParsedCompleteBackup,
} from './completeBackup';
import {
  listPhotos,
  replacePhotos,
  type LocalPhotoAsset,
} from './photoStore';
import { loadState, saveState } from './storage';
import { summarizeGrowLensState } from './syncMerge';
import type { GrowLensState } from './types';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function dateFilename(): string {
  return new Date().toISOString().slice(0, 10);
}

function downloadArchive(contents: string): void {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `growlens-complete-backup-${dateFilename()}.growlens.json`;
  link.click();
  URL.revokeObjectURL(url);
}

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'The complete-backup action failed.';
}

export default function CompleteBackupWidget() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localPhotos, setLocalPhotos] = useState<LocalPhotoAsset[]>([]);
  const [pending, setPending] = useState<ParsedCompleteBackup | null>(null);
  const [pendingFilename, setPendingFilename] = useState('');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const localState = loadState();
  const localSummary = useMemo(() => summarizeGrowLensState(localState), [open, localPhotos, pending]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listPhotos()
      .then((photos) => {
        if (!cancelled) setLocalPhotos(photos);
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(readableError(error));
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  function clearMessages(): void {
    setMessage('');
    setErrorMessage('');
  }

  async function exportCompleteBackup(): Promise<void> {
    clearMessages();
    setBusy(true);
    try {
      const photos = await listPhotos();
      const archive = await serializeCompleteBackup(loadState(), photos);
      downloadArchive(archive);
      setLocalPhotos(photos);
      setMessage(`Complete backup downloaded with ${photos.length} local photo${photos.length === 1 ? '' : 's'}.`);
    } catch (error) {
      setErrorMessage(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  async function chooseImport(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    clearMessages();
    setPending(null);
    if (file.size > MAX_COMPLETE_BACKUP_BYTES) {
      setErrorMessage('Complete backup exceeds the 200 MB archive limit.');
      return;
    }

    setBusy(true);
    try {
      const parsed = await parseCompleteBackup(await file.text());
      setPending(parsed);
      setPendingFilename(file.name);
      setMessage('Backup validated. Nothing has been imported yet. Choose Replace or Merge.');
    } catch (error) {
      setErrorMessage(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  async function applyArchive(mode: 'replace' | 'merge'): Promise<void> {
    if (!pending) return;
    clearMessages();
    const currentState = loadState();
    const currentPhotos = await listPhotos();
    const target = mode === 'merge'
      ? mergeCompleteBackup(currentState, currentPhotos, pending)
      : { state: pending.state, photos: pending.photos };
    const confirmed = window.confirm(
      mode === 'replace'
        ? 'Replace this device’s grow records and local photos with the validated backup? Download a current backup first if needed.'
        : 'Merge the validated backup into this device? Matching IDs keep the current device version.',
    );
    if (!confirmed) return;

    setBusy(true);
    try {
      await replacePhotos(target.photos);
      saveState(target.state, window.localStorage, 'external');
      setLocalPhotos(target.photos);
      setPending(null);
      setPendingFilename('');
      setMessage(mode === 'merge'
        ? `Backup merged: ${target.photos.length} local photos are now available.`
        : `Backup restored: ${target.photos.length} local photos are now available.`);
    } catch (error) {
      try {
        await replacePhotos(currentPhotos);
        saveState(currentState, window.localStorage, 'app');
      } catch {
        setErrorMessage('Restore failed and automatic rollback was incomplete. Do not close this browser; import the last known-good complete backup again.');
        setBusy(false);
        return;
      }
      setErrorMessage(`Restore failed and previous local data was restored: ${readableError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="backup-launcher" type="button" onClick={() => setOpen(true)} aria-label="Open GrowLens complete backups">
        <span aria-hidden="true">⇩</span>
        <strong>Backup</strong>
      </button>

      {open ? (
        <div className="backup-overlay" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setOpen(false);
        }}>
          <section className="backup-panel" role="dialog" aria-modal="true" aria-labelledby="backup-title">
            <header className="backup-header">
              <div><span className="eyebrow">Records and local photo recovery</span><h2 id="backup-title">Complete backups</h2></div>
              <button className="account-close" type="button" onClick={() => setOpen(false)} aria-label="Close complete backups">×</button>
            </header>

            {message ? <div className="account-message success" role="status">{message}</div> : null}
            {errorMessage ? <div className="account-message error" role="alert">{errorMessage}</div> : null}

            <div className="backup-summary-grid">
              <article><span>Local records</span><strong>{localSummary.records}</strong></article>
              <article><span>Local photos</span><strong>{localPhotos.length}</strong></article>
              <article><span>Photo bytes</span><strong>{formatBytes(localPhotos.reduce((sum, photo) => sum + photo.bytes, 0))}</strong></article>
            </div>

            <section className="backup-section">
              <h3>Download a complete local backup</h3>
              <p>Packages the normalized grow state and every compressed IndexedDB photo into one versioned archive. Private server-only images that are not stored on this device are not included.</p>
              <button className="primary-button" type="button" onClick={exportCompleteBackup} disabled={busy}>{busy ? 'Preparing…' : 'Download complete backup'}</button>
            </section>

            <section className="backup-section">
              <h3>Validate and restore a complete backup</h3>
              <p>The entire archive is parsed and validated before GrowLens offers any import action. No data changes occur when merely choosing a file.</p>
              <label className="backup-file-button">Choose .growlens.json archive<input type="file" accept="application/json,.json,.growlens.json" onChange={chooseImport} disabled={busy} /></label>
            </section>

            {pending ? (
              <section className="backup-pending" aria-labelledby="backup-pending-title">
                <div><h3 id="backup-pending-title">Validated backup</h3><small>{pendingFilename} · exported {new Date(pending.exportedAt).toLocaleString()}</small></div>
                <div className="backup-summary-grid imported">
                  <article><span>Imported records</span><strong>{pending.summary.records}</strong></article>
                  <article><span>Imported photos</span><strong>{pending.summary.photos}</strong></article>
                  <article><span>Photo bytes</span><strong>{formatBytes(pending.summary.photoBytes)}</strong></article>
                </div>
                <div className="backup-choice-grid">
                  <button className="secondary-button" type="button" onClick={() => applyArchive('replace')} disabled={busy}>Replace this device</button>
                  <button className="primary-button" type="button" onClick={() => applyArchive('merge')} disabled={busy}>Merge with this device</button>
                </div>
                <small>Merge keeps every unique record and photo ID. When the same ID differs, this device’s current version is kept. Imported photos are marked pending for private upload on this device.</small>
              </section>
            ) : null}

            <div className="warning-note"><strong>Backup boundary</strong><span>Account JSON export and CSV files do not contain image bytes. Use this complete local backup plus the Hostinger private-directory backup for full disaster recovery.</span></div>
          </section>
        </div>
      ) : null}
    </>
  );
}

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { diagnoseSymptoms, symptomOptions } from './diagnostics';
import { processImage, type ProcessedImage } from './imageProcessor';
import { growLensPhotoApi } from './photoApi';
import {
  deletePhoto,
  listPhotos,
  markPhotoUploaded,
  putPhoto,
  type LocalPhotoAsset,
} from './photoStore';
import {
  growLensRemoteStore,
  GrowLensApiError,
  type AuthenticatedSession,
} from './remoteStore';
import { createId, loadState, saveState } from './storage';

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'The photo action failed.';
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CameraObservationWidget() {
  const [open, setOpen] = useState(false);
  const [plantId, setPlantId] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [processed, setProcessed] = useState<ProcessedImage | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [assets, setAssets] = useState<LocalPhotoAsset[]>([]);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [session, setSession] = useState<AuthenticatedSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const state = loadState();
  const diagnosisResults = useMemo(() => diagnoseSymptoms(selectedSymptoms), [selectedSymptoms]);
  const referencedPhotoIds = useMemo(() => {
    const ids = new Set<string>();
    for (const observation of state.observations) {
      for (const photoId of observation.photoIds ?? []) ids.add(photoId);
    }
    for (const asset of assets) ids.add(asset.id);
    return [...ids];
  }, [assets, state.observations]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    listPhotos()
      .then((photos) => {
        if (!cancelled) setAssets(photos);
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(readableError(error));
      });
    growLensRemoteStore.getSession()
      .then((current) => {
        if (!cancelled) setSession(current.authenticated ? current : null);
      })
      .catch(() => {
        if (!cancelled) setSession(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    const nextUrls: Record<string, string> = {};
    for (const asset of assets) nextUrls[asset.id] = URL.createObjectURL(asset.blob);
    setAssetUrls(nextUrls);
    return () => {
      for (const url of Object.values(nextUrls)) URL.revokeObjectURL(url);
    };
  }, [assets]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function clearMessages(): void {
    setMessage('');
    setErrorMessage('');
  }

  function toggleSymptom(code: string): void {
    setSelectedSymptoms((current) => current.includes(code)
      ? current.filter((symptom) => symptom !== code)
      : [...current, code]);
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file) return;
    clearMessages();
    setBusy(true);
    try {
      const result = await processImage(file);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setProcessed(result);
      setPreviewUrl(URL.createObjectURL(result.blob));
      setSourceName(file.name);
      setMessage(`Photo prepared: ${result.width} × ${result.height}, ${formatBytes(result.outputBytes)}.`);
    } catch (error) {
      setProcessed(null);
      setSourceName('');
      setErrorMessage(readableError(error));
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  }

  async function uploadAsset(asset: LocalPhotoAsset, activeSession: AuthenticatedSession): Promise<void> {
    await growLensPhotoApi.upload(asset, activeSession.csrfToken);
    await markPhotoUploaded(asset.id, true);
  }

  async function saveObservation(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!processed) {
      setErrorMessage('Choose or capture a photo first.');
      return;
    }

    clearMessages();
    setBusy(true);
    const observationId = createId('observation');
    const photoId = createId('photo');
    const capturedAt = new Date().toISOString();
    const asset: LocalPhotoAsset = {
      id: photoId,
      blob: processed.blob,
      plantId: plantId || null,
      observationId,
      capturedAt,
      width: processed.width,
      height: processed.height,
      mimeType: processed.mimeType,
      bytes: processed.outputBytes,
      uploaded: false,
    };

    try {
      await putPhoto(asset);
      const current = loadState();
      const plant = current.plants.find((candidate) => candidate.id === plantId);
      const next = {
        ...current,
        observations: [...current.observations, {
          id: observationId,
          plantId: plantId || null,
          symptoms: selectedSymptoms,
          notes: notes.trim(),
          possibleCauses: diagnosisResults.map((result) => result.cause),
          photoIds: [photoId],
          createdAt: capturedAt,
        }],
        diary: [...current.diary, {
          id: createId('entry'),
          plantId: plantId || null,
          cycleId: plant?.cycleId || null,
          type: 'photo' as const,
          title: plant ? `Photo observation · ${plant.name}` : 'Photo observation',
          notes: notes.trim() || selectedSymptoms.join(', '),
          createdAt: capturedAt,
        }],
      };
      saveState(next);

      let uploaded = false;
      if (session) {
        try {
          await uploadAsset(asset, session);
          uploaded = true;
        } catch {
          uploaded = false;
        }
      }

      const refreshed = await listPhotos();
      setAssets(refreshed);
      setProcessed(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl('');
      setSourceName('');
      setNotes('');
      setSelectedSymptoms([]);
      setMessage(uploaded
        ? 'Observation saved locally and uploaded privately.'
        : 'Observation saved locally. Private upload remains pending.');
    } catch (error) {
      setErrorMessage(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  async function uploadPending(asset: LocalPhotoAsset): Promise<void> {
    clearMessages();
    setBusy(true);
    try {
      const current = session ?? await growLensRemoteStore.getSession();
      if (!current.authenticated) throw new Error('Sign in to upload this photo privately.');
      setSession(current);
      await uploadAsset(asset, current);
      setAssets(await listPhotos());
      setMessage('Pending photo uploaded privately.');
    } catch (error) {
      setErrorMessage(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto(photoId: string): Promise<void> {
    if (!window.confirm('Delete this photo from this device, its private account copy, and its observation link?')) return;
    clearMessages();
    setBusy(true);
    try {
      const local = assets.find((asset) => asset.id === photoId);
      const mayHavePrivateCopy = !local || local.uploaded;
      let activeSession = session;

      if (mayHavePrivateCopy && !activeSession) {
        const current = await growLensRemoteStore.getSession();
        if (!current.authenticated) {
          throw new Error('Sign in before deleting a photo that may have a private account copy.');
        }
        activeSession = current;
        setSession(current);
      }

      if (mayHavePrivateCopy && activeSession) {
        try {
          await growLensPhotoApi.remove(photoId, activeSession.csrfToken);
        } catch (error) {
          if (!(error instanceof GrowLensApiError && error.status === 404)) {
            throw error;
          }
        }
      }

      if (local) await deletePhoto(photoId);
      const current = loadState();
      saveState({
        ...current,
        observations: current.observations.map((observation) => ({
          ...observation,
          photoIds: (observation.photoIds ?? []).filter((id) => id !== photoId),
        })),
      });
      setAssets(await listPhotos());
      setMessage(mayHavePrivateCopy
        ? 'Photo removed from this device and the private account store.'
        : 'Photo removed from this device.');
    } catch (error) {
      setErrorMessage(readableError(error));
    } finally {
      setBusy(false);
    }
  }

  function photoSource(photoId: string): string {
    return assetUrls[photoId] ?? (session ? growLensPhotoApi.imageUrl(photoId) : '');
  }

  return (
    <>
      <button className="camera-launcher" type="button" onClick={() => setOpen(true)} aria-label="Open camera observation">
        <span aria-hidden="true">◉</span>
        <strong>Observe</strong>
      </button>

      {open ? (
        <div className="camera-overlay" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) setOpen(false);
        }}>
          <section className="camera-panel" role="dialog" aria-modal="true" aria-labelledby="camera-title">
            <div className="camera-header">
              <div><span className="eyebrow">Fast evidence capture</span><h2 id="camera-title">Camera observation</h2></div>
              <button className="account-close" type="button" onClick={() => setOpen(false)} aria-label="Close camera observation">×</button>
            </div>

            {message ? <div className="account-message success" role="status">{message}</div> : null}
            {errorMessage ? <div className="account-message error" role="alert">{errorMessage}</div> : null}

            <div className="camera-columns">
              <form className="camera-form" onSubmit={saveObservation}>
                <label>Plant<select value={plantId} onChange={(event) => setPlantId(event.target.value)}><option value="">Unassigned observation</option>{state.plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name} · {plant.strain}</option>)}</select></label>
                <label className="camera-file-input">Photo<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handleFile} /><span>{busy ? 'Processing…' : 'Use camera or choose photo'}</span></label>
                {previewUrl ? <figure className="camera-preview"><img src={previewUrl} alt="Prepared plant observation" /><figcaption>{sourceName} · metadata removed by re-encoding</figcaption></figure> : null}
                <fieldset className="symptom-grid"><legend>Visible symptoms</legend>{symptomOptions.map(([code, label]) => <label className={selectedSymptoms.includes(code) ? 'symptom-option selected' : 'symptom-option'} key={code}><input type="checkbox" checked={selectedSymptoms.includes(code)} onChange={() => toggleSymptom(code)} /><span>{label}</span></label>)}</fieldset>
                <label>Context notes<textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Location, progression, recent changes, pH/EC, pests, irrigation…" /></label>
                <button className="primary-button" type="submit" disabled={busy || !processed}>{busy ? 'Saving…' : 'Save photo observation'}</button>
              </form>

              <aside className="camera-analysis">
                <h3>Current possibilities</h3>
                {diagnosisResults.length ? diagnosisResults.map((result) => <article className="camera-diagnosis" key={result.cause}><div><strong>{result.cause}</strong><span className={`confidence ${result.confidence}`}>{result.confidence}</span></div><small>{result.verifyNext[0]}</small></article>) : <p>Select visible symptoms to compare possible causes. A photo alone does not confirm a deficiency, pest, or disease.</p>}
                <div className="warning-note"><strong>Evidence rule</strong><span>Verify root-zone conditions, environment, symptom location, and pest evidence before treatment.</span></div>
              </aside>
            </div>

            <div className="camera-gallery-heading"><div><h3>Observation photos</h3><p>Local images work offline. Account images remain private and require your session.</p></div><span>{referencedPhotoIds.length} photo{referencedPhotoIds.length === 1 ? '' : 's'}</span></div>
            {referencedPhotoIds.length ? <div className="camera-gallery">{referencedPhotoIds.map((photoId) => {
              const asset = assets.find((candidate) => candidate.id === photoId);
              const source = photoSource(photoId);
              return <article className="camera-photo-card" key={photoId}>{source ? <img src={source} alt="Saved plant observation" /> : <div className="camera-photo-placeholder">Sign in to load private image</div>}<div><small>{asset ? `${asset.width} × ${asset.height} · ${formatBytes(asset.bytes)}` : 'Account copy'}</small><span className={asset?.uploaded ? 'photo-status uploaded' : 'photo-status'}>{asset?.uploaded ? 'Private copy uploaded' : asset ? 'Upload pending' : 'Private account image'}</span>{asset && !asset.uploaded ? <button className="secondary-button" type="button" disabled={busy} onClick={() => uploadPending(asset)}>Upload privately</button> : null}<button className="text-button danger-text" type="button" disabled={busy} onClick={() => removePhoto(photoId)}>Delete photo</button></div></article>;
            })}</div> : <div className="empty-state"><strong>No observation photos</strong><span>Capture a clear whole-plant and close-up image before changing treatment.</span></div>}
          </section>
        </div>
      ) : null}
    </>
  );
}

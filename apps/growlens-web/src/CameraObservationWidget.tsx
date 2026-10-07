import { useModalFocusTrap } from './useModalFocusTrap';
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
  putPhotos,
  type LocalPhotoAsset,
} from './photoStore';
import {
  growLensRemoteStore,
  GrowLensApiError,
  type AuthenticatedSession,
} from './remoteStore';
import { createId, loadState, saveState } from './storage';
import type { ObservationPlantLocation, ObservationSeverity, ObservationTissue } from './types';
import {
  createGrowLensObservationArtifacts,
  publishGrowLensCanonicalObservation,
} from './canonicalObservation';

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'The photo action failed.';
}

type PreparedPhoto = {
  processed: ProcessedImage;
  previewUrl: string;
  sourceName: string;
};

const MAX_OBSERVATION_PHOTOS = 6;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CameraObservationWidget() {
  const [open, setOpen] = useState(false);
  const modalRef = useModalFocusTrap<HTMLElement>(open, () => setOpen(false));
  const [plantId, setPlantId] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [severity, setSeverity] = useState<ObservationSeverity | ''>('');
  const [locationOnPlant, setLocationOnPlant] = useState<ObservationPlantLocation | ''>('');
  const [tissue, setTissue] = useState<ObservationTissue | ''>('');
  const [notes, setNotes] = useState('');
  const [preparedPhotos, setPreparedPhotos] = useState<PreparedPhoto[]>([]);
  const [assets, setAssets] = useState<LocalPhotoAsset[]>([]);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [session, setSession] = useState<AuthenticatedSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const state = loadState();
  const diagnosisResults = useMemo(() => diagnoseSymptoms(selectedSymptoms, { locationOnPlant, tissue }), [selectedSymptoms, locationOnPlant, tissue]);
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
    for (const photo of preparedPhotos) URL.revokeObjectURL(photo.previewUrl);
  }, [preparedPhotos]);

  function clearMessages(): void {
    setMessage('');
    setErrorMessage('');
  }

  function toggleSymptom(code: string): void {
    setSelectedSymptoms((current) => current.includes(code)
      ? current.filter((symptom) => symptom !== code)
      : [...current, code]);
  }

  async function resolveAuthenticatedSession(): Promise<AuthenticatedSession | null> {
    if (session) return session;
    try {
      const current = await growLensRemoteStore.getSession();
      if (!current.authenticated) return null;
      setSession(current);
      return current;
    } catch {
      return null;
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(event.target.files ?? []).slice(0, MAX_OBSERVATION_PHOTOS);
    if (!files.length) return;
    clearMessages();
    setBusy(true);
    try {
      const processedBatch = await Promise.all(files.map(async (source) => ({
        processed: await processImage(source),
        sourceName: source.name,
      })));
      for (const photo of preparedPhotos) URL.revokeObjectURL(photo.previewUrl);
      const next = processedBatch.map(({ processed, sourceName }) => ({
        processed,
        sourceName,
        previewUrl: URL.createObjectURL(processed.blob),
      }));
      setPreparedPhotos(next);
      const totalBytes = next.reduce((sum, photo) => sum + photo.processed.outputBytes, 0);
      setMessage(`${next.length} photo${next.length === 1 ? '' : 's'} prepared · ${formatBytes(totalBytes)} total. Capture a whole-plant view plus close-ups when useful.`);
    } catch (error) {
      for (const photo of preparedPhotos) URL.revokeObjectURL(photo.previewUrl);
      setPreparedPhotos([]);
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
    if (!preparedPhotos.length) {
      setErrorMessage('Choose or capture at least one photo first.');
      return;
    }

    clearMessages();
    setBusy(true);
    const observationId = createId('observation');
    const capturedAt = new Date().toISOString();
    const observationAssets: LocalPhotoAsset[] = preparedPhotos.map(({ processed }) => ({
      id: createId('photo'),
      blob: processed.blob,
      plantId: plantId || null,
      observationId,
      capturedAt,
      width: processed.width,
      height: processed.height,
      mimeType: processed.mimeType,
      bytes: processed.outputBytes,
      uploaded: false,
    }));

    try {
      await putPhotos(observationAssets);
      const current = loadState();
      const artifacts = createGrowLensObservationArtifacts({
        id: observationId,
        plantId: plantId || null,
        symptoms: selectedSymptoms,
        notes,
        candidateDifferentials: diagnosisResults.map((result) => result.cause),
        severity,
        locationOnPlant,
        tissue,
        photoIds: observationAssets.map((asset) => asset.id),
        observedAt: capturedAt,
      }, current);
      const next = {
        ...current,
        observations: [...current.observations, artifacts.observation],
        diary: [...current.diary, artifacts.diary],
      };
      saveState(next);
      publishGrowLensCanonicalObservation(artifacts.canonicalRecord);

      let uploadedCount = 0;
      const activeSession = await resolveAuthenticatedSession();
      if (activeSession) {
        const uploads = await Promise.allSettled(
          observationAssets.map((asset) => uploadAsset(asset, activeSession)),
        );
        uploadedCount = uploads.filter((result) => result.status === 'fulfilled').length;
      }

      const refreshed = await listPhotos();
      setAssets(refreshed);
      for (const photo of preparedPhotos) URL.revokeObjectURL(photo.previewUrl);
      setPreparedPhotos([]);
      setNotes('');
      setSelectedSymptoms([]);
      setSeverity('');
      setLocationOnPlant('');
      setTissue('');
      setMessage(uploadedCount === observationAssets.length
        ? `Observation saved with ${observationAssets.length} photo${observationAssets.length === 1 ? '' : 's'} and all private uploads completed.`
        : uploadedCount > 0
          ? `Observation saved with ${observationAssets.length} photos; ${uploadedCount} uploaded privately and the rest remain pending.`
          : `Observation saved locally with ${observationAssets.length} photo${observationAssets.length === 1 ? '' : 's'}. Private uploads remain pending.`);
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
      const activeSession = await resolveAuthenticatedSession();
      if (!activeSession) throw new Error('Sign in to upload this photo privately.');
      await uploadAsset(asset, activeSession);
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
      const activeSession = mayHavePrivateCopy ? await resolveAuthenticatedSession() : null;

      if (mayHavePrivateCopy && !activeSession) {
        throw new Error('Sign in before deleting a photo that may have a private account copy.');
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
          <section ref={modalRef} className="camera-panel" role="dialog" aria-modal="true" aria-labelledby="camera-title">
            <div className="camera-header">
              <div><span className="eyebrow">Fast evidence capture</span><h2 id="camera-title">Camera observation</h2></div>
              <button className="account-close" type="button" onClick={() => setOpen(false)} aria-label="Close camera observation">×</button>
            </div>

            {message ? <div className="account-message success" role="status">{message}</div> : null}
            {errorMessage ? <div className="account-message error" role="alert">{errorMessage}</div> : null}

            <div className="camera-columns">
              <form className="camera-form" onSubmit={saveObservation}>
                <label>Plant<select value={plantId} onChange={(event) => setPlantId(event.target.value)}><option value="">Unassigned observation</option>{state.plants.map((plant) => <option key={plant.id} value={plant.id}>{plant.name} · {plant.strain}</option>)}</select></label>
                <label className="camera-file-input">Photos<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple onChange={handleFile} /><span>{busy ? 'Processing…' : `Use camera or choose up to ${MAX_OBSERVATION_PHOTOS} photos`}</span></label>
                {preparedPhotos.length ? <div className="camera-gallery" aria-label="Prepared observation photos">{preparedPhotos.map((photo, index) => <figure className="camera-preview" key={photo.previewUrl}><img src={photo.previewUrl} alt={`Prepared plant observation ${index + 1} of ${preparedPhotos.length}`} /><figcaption>{photo.sourceName} · {photo.processed.width} × {photo.processed.height} · metadata removed</figcaption></figure>)}</div> : null}
                <fieldset className="symptom-grid"><legend>Visible symptoms</legend>{symptomOptions.map(([code, label]) => <label className={selectedSymptoms.includes(code) ? 'symptom-option selected' : 'symptom-option'} key={code}><input type="checkbox" checked={selectedSymptoms.includes(code)} onChange={() => toggleSymptom(code)} /><span>{label}</span></label>)}</fieldset>
                <label>Observed severity<select value={severity} onChange={(event) => setSeverity(event.target.value as ObservationSeverity | '')}><option value="">Not recorded</option><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select></label>
                <label>Location on plant<select value={locationOnPlant} onChange={(event) => setLocationOnPlant(event.target.value as ObservationPlantLocation | '')}><option value="">Not recorded</option><option value="new-growth">New growth</option><option value="upper-canopy">Upper canopy</option><option value="middle-canopy">Middle canopy</option><option value="lower-canopy">Lower canopy</option><option value="whole-plant">Whole plant</option><option value="flowers">Flowers</option><option value="root-zone">Root zone</option></select></label>
                <label>Observed tissue<select value={tissue} onChange={(event) => setTissue(event.target.value as ObservationTissue | '')}><option value="">Not recorded</option><option value="leaf">Leaf</option><option value="stem">Stem</option><option value="flower">Flower</option><option value="root">Root</option><option value="whole-plant">Whole plant</option></select></label>
                <label>Context notes<textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Location, progression, recent changes, pH/EC, pests, irrigation…" /></label>
                <button className="primary-button" type="submit" disabled={busy || preparedPhotos.length === 0}>{busy ? 'Saving…' : `Save observation · ${preparedPhotos.length} photo${preparedPhotos.length === 1 ? '' : 's'}`}</button>
              </form>

              <aside className="camera-analysis">
                <h3>Current possibilities</h3>
                {diagnosisResults.length ? diagnosisResults.map((result) => <article className="camera-diagnosis" key={result.cause}><div><strong>{result.cause}</strong><span className={`confidence ${result.confidence}`}>{result.confidence} · {result.evidenceQuality}</span></div><small>{result.verifyNext[0]}</small></article>) : <p>Select visible symptoms to compare possible causes. A photo alone does not confirm a deficiency, pest, or disease.</p>}
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

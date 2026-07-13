import { useEffect, useMemo, useState } from 'react';
import { growLensPhotoApi, type RemotePhotoMetadata } from './photoApi';
import { listPhotos, type LocalPhotoAsset } from './photoStore';
import { growLensRemoteStore } from './remoteStore';
import { loadState, STATE_SAVED_EVENT } from './storage';
import type { Observation } from './types';

type PhotoView = {
  id: string;
  source: string;
  plantId: string | null;
  plantName: string;
  observation: Observation | null;
  capturedAt: string;
  width: number;
  height: number;
  bytes: number;
  local: boolean;
  remote: boolean;
};

function readableError(error: unknown): string {
  return error instanceof Error ? error.message : 'Photo history could not be loaded.';
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unknown date'
    : date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return 'Size unavailable';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function daysBetween(first: string, second: string): number | null {
  const firstTime = new Date(first).getTime();
  const secondTime = new Date(second).getTime();
  if (!Number.isFinite(firstTime) || !Number.isFinite(secondTime)) return null;
  return Math.max(0, Math.round(Math.abs(secondTime - firstTime) / 86_400_000));
}

export default function PhotoComparisonWidget() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(() => loadState());
  const [localPhotos, setLocalPhotos] = useState<LocalPhotoAsset[]>([]);
  const [remotePhotos, setRemotePhotos] = useState<RemotePhotoMetadata[]>([]);
  const [localUrls, setLocalUrls] = useState<Record<string, string>>({});
  const [authenticated, setAuthenticated] = useState(false);
  const [selectedPlantId, setSelectedPlantId] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const refreshState = () => setState(loadState());
    window.addEventListener(STATE_SAVED_EVENT, refreshState as EventListener);
    window.addEventListener('storage', refreshState);
    return () => {
      window.removeEventListener(STATE_SAVED_EVENT, refreshState as EventListener);
      window.removeEventListener('storage', refreshState);
    };
  }, []);

  useEffect(() => {
    const nextUrls: Record<string, string> = {};
    for (const asset of localPhotos) nextUrls[asset.id] = URL.createObjectURL(asset.blob);
    setLocalUrls(nextUrls);
    return () => {
      for (const url of Object.values(nextUrls)) URL.revokeObjectURL(url);
    };
  }, [localPhotos]);

  async function refreshPhotos(): Promise<void> {
    setLoading(true);
    setErrorMessage('');
    setState(loadState());
    const errors: string[] = [];

    try {
      setLocalPhotos(await listPhotos());
    } catch (error) {
      setLocalPhotos([]);
      errors.push(`Device photos: ${readableError(error)}`);
    }

    try {
      const session = await growLensRemoteStore.getSession();
      setAuthenticated(session.authenticated);
      if (session.authenticated) {
        try {
          setRemotePhotos(await growLensPhotoApi.list());
        } catch (error) {
          setRemotePhotos([]);
          errors.push(`Private account photos: ${readableError(error)}`);
        }
      } else {
        setRemotePhotos([]);
      }
    } catch {
      setAuthenticated(false);
      setRemotePhotos([]);
    } finally {
      setLoading(false);
      setErrorMessage(errors.join(' '));
    }
  }

  useEffect(() => {
    if (!open) return;
    void refreshPhotos();
  }, [open]);

  const photos = useMemo<PhotoView[]>(() => {
    const remoteById = new Map(remotePhotos.map((photo) => [photo.id, photo]));
    const localById = new Map(localPhotos.map((photo) => [photo.id, photo]));
    const observationByPhotoId = new Map<string, Observation>();
    for (const observation of state.observations) {
      for (const photoId of observation.photoIds ?? []) observationByPhotoId.set(photoId, observation);
    }

    const ids = new Set<string>([
      ...localById.keys(),
      ...remoteById.keys(),
    ]);

    return [...ids].map((id) => {
      const local = localById.get(id);
      const remote = remoteById.get(id);
      const observation = observationByPhotoId.get(id) ?? null;
      const plantId = local?.plantId ?? remote?.plantId ?? observation?.plantId ?? null;
      const plant = state.plants.find((candidate) => candidate.id === plantId);
      return {
        id,
        source: localUrls[id] ?? (authenticated && remote ? growLensPhotoApi.imageUrl(id) : ''),
        plantId,
        plantName: plant?.name ?? (plantId ? 'Archived or unavailable plant' : 'Unassigned observation'),
        observation,
        capturedAt: local?.capturedAt ?? remote?.capturedAt ?? observation?.createdAt ?? '',
        width: local?.width ?? remote?.width ?? 0,
        height: local?.height ?? remote?.height ?? 0,
        bytes: local?.bytes ?? remote?.bytes ?? 0,
        local: Boolean(local),
        remote: Boolean(remote) || Boolean(local?.uploaded),
      };
    }).sort((first, second) => second.capturedAt.localeCompare(first.capturedAt));
  }, [authenticated, localPhotos, localUrls, remotePhotos, state.observations, state.plants]);

  useEffect(() => {
    const availableIds = new Set(photos.map((photo) => photo.id));
    setSelectedIds((current) => current.filter((id) => availableIds.has(id)));
  }, [photos]);

  const plantOptions = useMemo(() => {
    const ids = new Set(photos.map((photo) => photo.plantId).filter((id): id is string => Boolean(id)));
    return state.plants.filter((plant) => ids.has(plant.id));
  }, [photos, state.plants]);

  const filteredPhotos = selectedPlantId
    ? photos.filter((photo) => photo.plantId === selectedPlantId)
    : photos;

  const selectedPhotos = selectedIds
    .map((id) => photos.find((photo) => photo.id === id))
    .filter((photo): photo is PhotoView => Boolean(photo))
    .sort((first, second) => first.capturedAt.localeCompare(second.capturedAt));

  const comparisonDays = selectedPhotos.length === 2
    ? daysBetween(selectedPhotos[0].capturedAt, selectedPhotos[1].capturedAt)
    : null;

  function toggleSelected(photoId: string): void {
    setSelectedIds((current) => {
      if (current.includes(photoId)) return current.filter((id) => id !== photoId);
      if (current.length < 2) return [...current, photoId];
      return [current[1], photoId];
    });
  }

  function closePanel(): void {
    setOpen(false);
    setErrorMessage('');
  }

  return (
    <>
      <button
        className="photo-history-launcher"
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open photo history and comparison"
      >
        <span aria-hidden="true">▧</span>
        <strong>Photos</strong>
      </button>

      {open ? (
        <div className="photo-history-overlay" role="presentation" onMouseDown={(event) => {
          if (event.currentTarget === event.target) closePanel();
        }}>
          <section className="photo-history-panel" role="dialog" aria-modal="true" aria-labelledby="photo-history-title">
            <div className="photo-history-header">
              <div>
                <span className="eyebrow">Visual progress records</span>
                <h2 id="photo-history-title">Photo history and comparison</h2>
                <p>Compare consistent views over time. Local images remain on this device; private account images require an authenticated session.</p>
              </div>
              <button className="account-close" type="button" onClick={closePanel} aria-label="Close photo history and comparison">×</button>
            </div>

            {errorMessage ? <div className="account-message error" role="alert">{errorMessage}</div> : null}

            <div className="photo-history-toolbar">
              <label>
                Plant
                <select value={selectedPlantId} onChange={(event) => {
                  setSelectedPlantId(event.target.value);
                  setSelectedIds([]);
                }}>
                  <option value="">All plants</option>
                  {plantOptions.map((plant) => <option key={plant.id} value={plant.id}>{plant.name} · {plant.strain}</option>)}
                </select>
              </label>
              <div>
                <span>{filteredPhotos.length} visible photo{filteredPhotos.length === 1 ? '' : 's'}</span>
                <button className="secondary-button" type="button" disabled={loading} onClick={() => void refreshPhotos()}>{loading ? 'Refreshing…' : 'Refresh'}</button>
              </div>
            </div>

            <section className="photo-comparison-stage" aria-labelledby="photo-comparison-heading">
              <div className="photo-comparison-heading">
                <div>
                  <h3 id="photo-comparison-heading">Progress comparison</h3>
                  <p>Select two photos below. GrowLens orders them from earlier to later.</p>
                </div>
                <div>
                  {comparisonDays !== null ? <span>{comparisonDays === 0 ? 'Same day' : `${comparisonDays} day${comparisonDays === 1 ? '' : 's'} apart`}</span> : null}
                  <button className="text-button" type="button" disabled={selectedIds.length === 0} onClick={() => setSelectedIds([])}>Clear</button>
                </div>
              </div>

              <div className="photo-comparison-grid">
                {[0, 1].map((index) => {
                  const photo = selectedPhotos[index];
                  if (!photo) {
                    return <div className="photo-comparison-placeholder" key={index}><strong>{index === 0 ? 'Earlier photo' : 'Later photo'}</strong><span>Select a photo from the gallery.</span></div>;
                  }
                  return (
                    <figure className="photo-comparison-figure" key={photo.id}>
                      {photo.source ? <img src={photo.source} alt={`${index === 0 ? 'Earlier' : 'Later'} observation for ${photo.plantName}`} /> : <div className="photo-comparison-placeholder">Image unavailable in this session</div>}
                      <figcaption>
                        <span>{index === 0 ? 'Earlier' : 'Later'}</span>
                        <strong>{photo.plantName}</strong>
                        <small>{formatDateTime(photo.capturedAt)}</small>
                        {photo.observation?.notes ? <p>{photo.observation.notes}</p> : null}
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
              <small className="photo-consistency-note">Best comparisons use the same angle, distance, lighting, and background. A visual change does not prove its cause.</small>
            </section>

            {filteredPhotos.length ? (
              <div className="photo-history-grid">
                {filteredPhotos.map((photo) => {
                  const selected = selectedIds.includes(photo.id);
                  return (
                    <button
                      className={selected ? 'photo-history-card selected' : 'photo-history-card'}
                      type="button"
                      key={photo.id}
                      aria-pressed={selected}
                      aria-label={`${selected ? 'Remove' : 'Select'} photo from ${formatDateTime(photo.capturedAt)} for comparison`}
                      onClick={() => toggleSelected(photo.id)}
                    >
                      {photo.source ? <img src={photo.source} alt={`Observation for ${photo.plantName}`} /> : <div className="photo-history-placeholder">Image unavailable</div>}
                      <span className="photo-history-card-body">
                        <span className="photo-history-card-top"><strong>{photo.plantName}</strong><b>{selected ? 'Selected' : 'Compare'}</b></span>
                        <small>{formatDateTime(photo.capturedAt)}</small>
                        <small>{photo.width && photo.height ? `${photo.width} × ${photo.height} · ` : ''}{formatBytes(photo.bytes)}</small>
                        <span className="photo-history-storage"><i className={photo.local ? 'available' : ''}>Device</i><i className={photo.remote ? 'available' : ''}>Private account</i></span>
                        {photo.observation?.symptoms.length ? <span className="photo-history-symptoms">{photo.observation.symptoms.slice(0, 3).join(' · ')}</span> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="empty-state">
                <strong>{loading ? 'Loading photo history…' : 'No photos match this filter'}</strong>
                <span>Capture observations from the camera tool, then return here to compare progress.</span>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}

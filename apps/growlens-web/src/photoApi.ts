import { GrowLensApiError } from './remoteStore';
import type { LocalPhotoAsset } from './photoStore';

export type RemotePhotoMetadata = {
  id: string;
  plantId: string | null;
  observationId: string;
  capturedAt: string;
  mimeType: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
};

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type ApiPayload = Record<string, unknown> & {
  ok?: boolean;
  error?: string;
};

async function readPayload(response: Response): Promise<ApiPayload> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return {
      ok: false,
      error: (await response.text().catch(() => '')).trim() || `Unexpected server response (${response.status}).`,
    };
  }
  const payload: unknown = await response.json().catch(() => null);
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload)
    ? payload as ApiPayload
    : { ok: false, error: 'The server returned invalid JSON.' };
}

function requireSuccess(response: Response, payload: ApiPayload): ApiPayload {
  if (!response.ok || payload.ok !== true) {
    throw new GrowLensApiError(
      typeof payload.error === 'string' ? payload.error : `Photo request failed (${response.status}).`,
      response.status,
      payload,
    );
  }
  return payload;
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '') || './api';
}

function normalizeMetadata(value: unknown): RemotePhotoMetadata {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new GrowLensApiError('The server returned invalid photo metadata.', 502);
  }
  const metadata = value as Record<string, unknown>;
  if (typeof metadata.id !== 'string' || typeof metadata.observationId !== 'string') {
    throw new GrowLensApiError('The server returned invalid photo metadata.', 502);
  }
  return {
    id: metadata.id,
    plantId: typeof metadata.plantId === 'string' && metadata.plantId !== '' ? metadata.plantId : null,
    observationId: metadata.observationId,
    capturedAt: typeof metadata.capturedAt === 'string' ? metadata.capturedAt : '',
    mimeType: typeof metadata.mimeType === 'string' ? metadata.mimeType : 'image/jpeg',
    width: Number(metadata.width) || 0,
    height: Number(metadata.height) || 0,
    bytes: Number(metadata.bytes) || 0,
    createdAt: typeof metadata.createdAt === 'string' ? metadata.createdAt : '',
  };
}

export function createPhotoApi(options: { baseUrl?: string; fetcher?: FetchLike } = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? './api');
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);

  async function upload(asset: LocalPhotoAsset, csrfToken: string): Promise<RemotePhotoMetadata> {
    const form = new FormData();
    form.set('photoId', asset.id);
    form.set('plantId', asset.plantId ?? '');
    form.set('observationId', asset.observationId);
    form.set('capturedAt', asset.capturedAt);
    form.set('image', asset.blob, `${asset.id}.jpg`);

    const response = await fetcher(`${baseUrl}/upload-image.php`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: form,
    });
    const payload = requireSuccess(response, await readPayload(response));
    return normalizeMetadata(payload.image);
  }

  async function list(): Promise<RemotePhotoMetadata[]> {
    const response = await fetcher(`${baseUrl}/list-images.php`, {
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    });
    const payload = requireSuccess(response, await readPayload(response));
    const images = Array.isArray(payload.images) ? payload.images : [];
    return images.map(normalizeMetadata);
  }

  async function remove(photoId: string, csrfToken: string): Promise<void> {
    const response = await fetcher(`${baseUrl}/delete-image.php`, {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({ photoId }),
    });
    requireSuccess(response, await readPayload(response));
  }

  function imageUrl(photoId: string): string {
    return `${baseUrl}/image.php?id=${encodeURIComponent(photoId)}`;
  }

  return { upload, list, remove, imageUrl };
}

export const growLensPhotoApi = createPhotoApi();

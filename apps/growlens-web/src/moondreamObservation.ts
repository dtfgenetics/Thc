import { GrowLensApiError } from './remoteStore';

export type MoondreamVisualObservation = {
  provider: 'moondream';
  mode: 'visual-observation';
  summary: string;
  fields: Record<string, string>;
  requestId?: string;
  analyzedAt: string;
};

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type ApiPayload = Record<string, unknown> & {
  ok?: boolean;
  error?: string;
};

function cleanText(value: unknown, max = 2000): string {
  return typeof value === 'string'
    ? value.trim().replace(/\s+/g, ' ').slice(0, max)
    : '';
}

export function normalizeMoondreamObservation(value: unknown): MoondreamVisualObservation {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new GrowLensApiError('The vision service returned an invalid observation.', 502);
  }

  const record = value as Record<string, unknown>;
  const rawFields = typeof record.fields === 'object' && record.fields !== null && !Array.isArray(record.fields)
    ? record.fields as Record<string, unknown>
    : {};
  const fields: Record<string, string> = {};
  for (const [key, fieldValue] of Object.entries(rawFields)) {
    const normalized = cleanText(fieldValue, 500);
    if (normalized) fields[key] = normalized;
  }

  const summary = cleanText(record.summary, 4000);
  if (!summary) {
    throw new GrowLensApiError('The vision service returned an empty observation.', 502);
  }

  return {
    provider: 'moondream',
    mode: 'visual-observation',
    summary,
    fields,
    ...(cleanText(record.requestId, 200) ? { requestId: cleanText(record.requestId, 200) } : {}),
    analyzedAt: cleanText(record.analyzedAt, 80) || new Date().toISOString(),
  };
}

async function readPayload(response: Response): Promise<ApiPayload> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return {
      ok: false,
      error: (await response.text().catch(() => '')).trim() || 'Unexpected server response (' + response.status + ').',
    };
  }
  const payload: unknown = await response.json().catch(() => null);
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload)
    ? payload as ApiPayload
    : { ok: false, error: 'The server returned invalid JSON.' };
}

export function createMoondreamObservationApi(options: { baseUrl?: string; fetcher?: FetchLike } = {}) {
  const baseUrl = (options.baseUrl ?? './api').trim().replace(/\/+$/, '') || './api';
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);

  async function analyze(image: Blob, csrfToken: string): Promise<MoondreamVisualObservation> {
    const form = new FormData();
    form.set('image', image, 'growlens-observation.jpg');

    const response = await fetcher(baseUrl + '/vision-observe.php', {
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: form,
    });
    const payload = await readPayload(response);
    if (!response.ok || payload.ok !== true) {
      throw new GrowLensApiError(
        typeof payload.error === 'string' ? payload.error : 'Vision request failed (' + response.status + ').',
        response.status,
        payload,
      );
    }
    return normalizeMoondreamObservation(payload.observation);
  }

  return { analyze };
}

export const growLensVisionApi = createMoondreamObservationApi();

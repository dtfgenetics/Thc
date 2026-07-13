import { normalizeState } from './storage';
import type { GrowLensState } from './types';

export type RemoteUser = {
  id: string;
  email: string;
  createdAt: string;
};

export type RemoteSnapshot = {
  user: RemoteUser;
  revision: number;
  updatedAt: string;
  state: GrowLensState;
};

export type AuthenticatedSession = {
  authenticated: true;
  user: RemoteUser;
  csrfToken: string;
  revision: number;
  updatedAt: string;
};

export type AnonymousSession = {
  authenticated: false;
};

export type RemoteSession = AuthenticatedSession | AnonymousSession;

type ApiPayload = Record<string, unknown> & {
  ok?: boolean;
  error?: string;
};

export class GrowLensApiError extends Error {
  readonly status: number;
  readonly payload: ApiPayload;

  constructor(message: string, status: number, payload: ApiPayload = {}) {
    super(message);
    this.name = 'GrowLensApiError';
    this.status = status;
    this.payload = payload;
  }
}

export class GrowLensSyncConflictError extends GrowLensApiError {
  readonly revision: number;
  readonly updatedAt: string;

  constructor(payload: ApiPayload, status = 409) {
    super(typeof payload.error === 'string' ? payload.error : 'Sync conflict.', status, payload);
    this.name = 'GrowLensSyncConflictError';
    this.revision = toNonNegativeInteger(payload.revision);
    this.updatedAt = typeof payload.updatedAt === 'string' ? payload.updatedAt : '';
  }
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export type GrowLensRemoteStore = ReturnType<typeof createGrowLensRemoteStore>;

function toNonNegativeInteger(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function toRemoteUser(value: unknown): RemoteUser {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new GrowLensApiError('The server returned an invalid user record.', 502);
  }
  const user = value as Record<string, unknown>;
  if (typeof user.id !== 'string' || typeof user.email !== 'string') {
    throw new GrowLensApiError('The server returned an invalid user record.', 502);
  }
  return {
    id: user.id,
    email: user.email,
    createdAt: typeof user.createdAt === 'string' ? user.createdAt : '',
  };
}

async function readPayload(response: Response): Promise<ApiPayload> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const text = await response.text().catch(() => '');
    return {
      ok: false,
      error: text.trim() || `Unexpected server response (${response.status}).`,
    };
  }

  const payload: unknown = await response.json().catch(() => null);
  return typeof payload === 'object' && payload !== null && !Array.isArray(payload)
    ? payload as ApiPayload
    : { ok: false, error: 'The server returned invalid JSON.' };
}

function requireSuccess(response: Response, payload: ApiPayload): ApiPayload {
  if (response.status === 409 && payload.conflict === true) {
    throw new GrowLensSyncConflictError(payload, response.status);
  }
  if (!response.ok || payload.ok !== true) {
    throw new GrowLensApiError(
      typeof payload.error === 'string' ? payload.error : `GrowLens request failed (${response.status}).`,
      response.status,
      payload,
    );
  }
  return payload;
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '') || './api';
}

export function createGrowLensRemoteStore(options: {
  baseUrl?: string;
  fetcher?: FetchLike;
} = {}) {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? './api');
  const fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);

  async function request(path: string, init: RequestInit = {}): Promise<ApiPayload> {
    const headers = new Headers(init.headers);
    if (init.body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    headers.set('Accept', 'application/json');

    const response = await fetcher(`${baseUrl}/${path.replace(/^\/+/, '')}`, {
      ...init,
      headers,
      credentials: 'include',
      cache: 'no-store',
    });
    const payload = await readPayload(response);
    return requireSuccess(response, payload);
  }

  function snapshotFromPayload(payload: ApiPayload): RemoteSnapshot {
    return {
      user: toRemoteUser(payload.user),
      revision: toNonNegativeInteger(payload.revision),
      updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : '',
      state: normalizeState(payload.state),
    };
  }

  async function register(email: string, password: string): Promise<RemoteSnapshot & { csrfToken: string }> {
    const payload = await request('register.php', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return {
      ...snapshotFromPayload(payload),
      csrfToken: typeof payload.csrfToken === 'string' ? payload.csrfToken : '',
    };
  }

  async function login(email: string, password: string): Promise<RemoteSnapshot & { csrfToken: string }> {
    const payload = await request('login.php', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    return {
      ...snapshotFromPayload(payload),
      csrfToken: typeof payload.csrfToken === 'string' ? payload.csrfToken : '',
    };
  }

  async function getSession(): Promise<RemoteSession> {
    const payload = await request('session.php');
    if (payload.authenticated !== true) {
      return { authenticated: false };
    }
    return {
      authenticated: true,
      user: toRemoteUser(payload.user),
      csrfToken: typeof payload.csrfToken === 'string' ? payload.csrfToken : '',
      revision: toNonNegativeInteger(payload.revision),
      updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : '',
    };
  }

  async function pull(): Promise<RemoteSnapshot> {
    return snapshotFromPayload(await request('sync.php'));
  }

  async function push(
    state: GrowLensState,
    expectedRevision: number,
    csrfToken: string,
  ): Promise<{ revision: number; updatedAt: string; state: GrowLensState }> {
    const payload = await request('sync.php', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ expectedRevision, state }),
    });
    return {
      revision: toNonNegativeInteger(payload.revision),
      updatedAt: typeof payload.updatedAt === 'string' ? payload.updatedAt : '',
      state: normalizeState(payload.state),
    };
  }

  async function logout(csrfToken: string): Promise<void> {
    await request('logout.php', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({}),
    });
  }

  async function deleteAccount(password: string, csrfToken: string): Promise<void> {
    await request('delete-account.php', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
      body: JSON.stringify({ password }),
    });
  }

  function exportUrl(): string {
    return `${baseUrl}/export.php`;
  }

  return {
    register,
    login,
    getSession,
    pull,
    push,
    logout,
    deleteAccount,
    exportUrl,
  };
}

export const growLensRemoteStore = createGrowLensRemoteStore();

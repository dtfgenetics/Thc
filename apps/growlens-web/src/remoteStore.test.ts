import { describe, expect, it, vi } from 'vitest';
import {
  createGrowLensRemoteStore,
  GrowLensApiError,
  GrowLensSyncConflictError,
} from './remoteStore';
import { emptyState } from './storage';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

describe('GrowLens remote store', () => {
  it('registers with same-origin credentials and returns a normalized snapshot', async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      ok: true,
      user: { id: 'user-1', email: 'grower@example.com', createdAt: '2026-07-13T00:00:00Z' },
      csrfToken: 'csrf-1',
      revision: 0,
      updatedAt: '2026-07-13T00:00:00Z',
      state: emptyState,
    }, 201));
    const store = createGrowLensRemoteStore({ baseUrl: '/growlens/api/', fetcher });

    const result = await store.register('grower@example.com', 'a-long-password');

    expect(result.user.email).toBe('grower@example.com');
    expect(result.csrfToken).toBe('csrf-1');
    expect(result.state).toEqual(emptyState);
    expect(fetcher).toHaveBeenCalledWith('/growlens/api/register.php', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      cache: 'no-store',
    }));
  });

  it('sends CSRF and the expected revision on writes', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('X-CSRF-Token')).toBe('csrf-token');
      expect(JSON.parse(String(init?.body))).toEqual({
        expectedRevision: 4,
        state: emptyState,
      });
      return jsonResponse({
        ok: true,
        revision: 5,
        updatedAt: '2026-07-13T01:00:00Z',
        state: emptyState,
      });
    });
    const store = createGrowLensRemoteStore({ fetcher });

    const result = await store.push(emptyState, 4, 'csrf-token');

    expect(result.revision).toBe(5);
    expect(result.state).toEqual(emptyState);
  });

  it('raises a typed conflict error without hiding the server revision', async () => {
    const fetcher = vi.fn(async () => jsonResponse({
      ok: false,
      error: 'Sync conflict.',
      conflict: true,
      revision: 9,
      updatedAt: '2026-07-13T02:00:00Z',
    }, 409));
    const store = createGrowLensRemoteStore({ fetcher });

    await expect(store.push(emptyState, 3, 'csrf-token')).rejects.toMatchObject({
      name: 'GrowLensSyncConflictError',
      revision: 9,
      updatedAt: '2026-07-13T02:00:00Z',
    });

    try {
      await store.push(emptyState, 3, 'csrf-token');
    } catch (error) {
      expect(error).toBeInstanceOf(GrowLensSyncConflictError);
    }
  });

  it('returns anonymous session state without inventing a user', async () => {
    const store = createGrowLensRemoteStore({
      fetcher: vi.fn(async () => jsonResponse({ ok: true, authenticated: false })),
    });

    await expect(store.getSession()).resolves.toEqual({ authenticated: false });
  });

  it('surfaces non-JSON server errors as API errors', async () => {
    const store = createGrowLensRemoteStore({
      fetcher: vi.fn(async () => new Response('Gateway unavailable', {
        status: 502,
        headers: { 'Content-Type': 'text/plain' },
      })),
    });

    await expect(store.pull()).rejects.toBeInstanceOf(GrowLensApiError);
    await expect(store.pull()).rejects.toMatchObject({ status: 502 });
  });
});

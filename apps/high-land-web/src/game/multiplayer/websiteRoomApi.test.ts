import { describe, expect, it, vi } from 'vitest';
import { HIGH_LAND_ROOM_API_VERSION, defaultWebsiteRoomApiBase, postWebsiteRoomApi } from './websiteRoomApi';

describe('website room api contract', () => {
  it('pins the deployed room API semantic version', () => {
    expect(HIGH_LAND_ROOM_API_VERSION).toBe('1.1.0');
  });

  it('rejects an explicitly incompatible room API version', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      room: { apiVersion: '2.0.0', code: 'ABC123', players: [] }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    await expect(postWebsiteRoomApi('/api/', 'create-room.php', {})).rejects.toThrow(/incompatible/);
    vi.unstubAllGlobals();
  });

  it('temporarily accepts a version-less legacy room snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      ok: true,
      room: { code: 'ABC123', players: [] }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })));
    const room = await postWebsiteRoomApi('/api/', 'create-room.php', {});
    expect(room.code).toBe('ABC123');
    vi.unstubAllGlobals();
  });
  it('uses the High Land api folder on the live route', () => {
    vi.stubGlobal('location', new URL('https://dtfseeds.com/games/high-land/') as unknown as Location);
    expect(defaultWebsiteRoomApiBase()).toBe('https://dtfseeds.com/games/high-land/api/');
    vi.unstubAllGlobals();
  });

  it('uses the same api folder when the live route has no trailing slash', () => {
    vi.stubGlobal('location', new URL('https://dtfseeds.com/games/high-land') as unknown as Location);
    expect(defaultWebsiteRoomApiBase()).toBe('https://dtfseeds.com/games/high-land/api/');
    vi.unstubAllGlobals();
  });
});

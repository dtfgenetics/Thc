import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialGame } from '../systems/gameEngine';
import type { HighLandRoomPlayer } from './roomState';
import { createWebsiteRoomTransport, getOrCreateWebsiteRoomCredential } from './websiteRoomTransport';

afterEach(() => {
  vi.unstubAllGlobals();
});

const credential = 'c'.repeat(64);

function player(id = 'player-1', host = true): HighLandRoomPlayer {
  return {
    id,
    name: host ? 'Host Player' : 'Guest Player',
    token: host ? 'tokenA' : 'tokenB',
    color: host ? '#ef4444' : '#22c55e',
    host,
    connected: true,
    joinedAt: 'now'
  };
}

function roomResponse(players = [player('player-1', true), player('player-2', false)]) {
  const gameState = createInitialGame(2);
  gameState.players[0] = { ...gameState.players[0], id: players[0]?.id ?? 'player-1', name: players[0]?.name ?? 'Host Player' };
  gameState.players[1] = { ...gameState.players[1], id: players[1]?.id ?? 'player-2', name: players[1]?.name ?? 'Guest Player' };
  return {
    ok: true,
    room: {
      code: 'ABC123',
      status: 'playing',
      players,
      state: gameState,
      createdAt: 'now',
      updatedAt: 'now'
    }
  };
}

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    clear() { values.clear(); },
    getItem(key: string) { return values.get(key) ?? null; },
    key(index: number) { return Array.from(values.keys())[index] ?? null; },
    removeItem(key: string) { values.delete(key); },
    setItem(key: string, value: string) { values.set(key, value); }
  };
}

describe('website room transport credentials', () => {
  it('sends the scoped credential for create, join, state update, and event append requests', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => new Response(JSON.stringify(roomResponse()), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));
    vi.stubGlobal('fetch', fetchMock);

    const transport = createWebsiteRoomTransport({
      apiBaseUrl: 'https://dtfseeds.com/games/high-land/api/',
      credentialProvider: () => credential,
      credentialStorage: memoryStorage(),
      legacyCredentialStorage: memoryStorage()
    });

    const host = player('player-1', true);
    const guest = player('player-2', false);
    const gameState = createInitialGame(2);
    gameState.players[0] = { ...gameState.players[0], id: host.id };
    gameState.players[1] = { ...gameState.players[1], id: guest.id };

    await transport.createRoom(host);
    await transport.joinRoom('ABC123', guest);
    await transport.updateGameState('ABC123', gameState, host.id);
    await transport.appendEvent('ABC123', {
      id: 'event-1',
      name: 'game_started',
      roomCode: 'ABC123',
      playerId: host.id,
      createdAt: 'now',
      payload: { playerCount: 2 }
    }, host.id);

    expect(fetchMock).toHaveBeenCalledTimes(5);
    const postRequests = fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'POST')
      .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);
    expect(postRequests).toHaveLength(4);
    for (const request of postRequests) {
      expect(request.credential).toBe(credential);
    }
    expect(postRequests[0]).toMatchObject({ playerId: 'player-1', credential });
    expect(postRequests[1]).toMatchObject({ playerId: 'player-2', credential });
    expect(postRequests[2]).toMatchObject({ playerId: 'player-1', credential });
    expect(postRequests[3]).toMatchObject({ playerId: 'player-1', credential });
  });

  it('creates distinct scoped credentials for different room players', async () => {
    const generated = ['a'.repeat(64), 'b'.repeat(64)];
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'GET') {
        return new Response(JSON.stringify(roomResponse([player('player-1', true)])), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify(roomResponse()), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const transport = createWebsiteRoomTransport({
      apiBaseUrl: 'https://dtfseeds.com/games/high-land/api/',
      credentialProvider: () => generated.shift() ?? 'f'.repeat(64),
      credentialStorage: memoryStorage(),
      legacyCredentialStorage: memoryStorage()
    });

    await transport.createRoom(player('player-1', true));
    await transport.joinRoom('ABC123', player('player-2', false));

    const postRequests = fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'POST')
      .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);
    expect(postRequests[0]?.credential).toBe('a'.repeat(64));
    expect(postRequests[1]?.credential).toBe('b'.repeat(64));
  });

  it('migrates an existing player from the legacy browser credential', async () => {
    const legacyCredential = 'd'.repeat(64);
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => new Response(JSON.stringify(roomResponse()), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));
    vi.stubGlobal('fetch', fetchMock);

    const scopedStorage = memoryStorage();
    const legacyStorage = memoryStorage({ 'high-land-room-credential-v1': legacyCredential });
    const transport = createWebsiteRoomTransport({
      apiBaseUrl: 'https://dtfseeds.com/games/high-land/api/',
      credentialProvider: () => 'e'.repeat(64),
      credentialStorage: scopedStorage,
      legacyCredentialStorage: legacyStorage
    });

    await transport.joinRoom('abc123', player('player-2', false));
    const joinRequest = fetchMock.mock.calls
      .filter(([, init]) => init?.method === 'POST')
      .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>)[0];

    expect(joinRequest).toMatchObject({
      roomCode: 'ABC123',
      playerId: 'player-2',
      credential: legacyCredential
    });
    expect(scopedStorage.getItem('high-land-room-player-credential-v2:ABC123:player-2')).toBe(legacyCredential);
  });

  it('refuses an event append without an authenticated actor', async () => {
    const transport = createWebsiteRoomTransport({
      apiBaseUrl: 'https://dtfseeds.com/games/high-land/api/',
      credentialProvider: () => credential,
      credentialStorage: memoryStorage(),
      legacyCredentialStorage: memoryStorage()
    });

    await expect(transport.appendEvent('ABC123', {
      id: 'event-system',
      name: 'game_started',
      roomCode: 'ABC123',
      playerId: null,
      createdAt: 'now',
      payload: { playerCount: 2 }
    })).rejects.toThrow('Authenticated player id is required');
  });

  it('reuses a persisted legacy 256-bit browser credential for compatibility', () => {
    const storage = memoryStorage();
    const first = getOrCreateWebsiteRoomCredential(storage);
    const second = getOrCreateWebsiteRoomCredential(storage);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
  });
});

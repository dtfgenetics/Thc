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

describe('website room subscription lifecycle', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(['success', 'failure'] as const)('ignores a late %s after leaving while another room remains active', async (outcome) => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    let resolveOld!: (response: Response) => void;
    let rejectOld!: (error: Error) => void;
    const pendingOld = new Promise<Response>((resolve, reject) => {
      resolveOld = resolve;
      rejectOld = reject;
    });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes('room=OLD123')) return pendingOld;
      const payload = roomResponse();
      payload.room.code = 'NEW123';
      return new Response(JSON.stringify(payload), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const transport = createWebsiteRoomTransport({
      apiBaseUrl: 'https://dtfseeds.com/games/high-land/api/',
      credentialStorage: null,
      legacyCredentialStorage: null
    });
    const oldSnapshot = vi.fn();
    const newSnapshot = vi.fn();
    const leaveOld = transport.subscribe('OLD123', oldSnapshot);
    leaveOld();
    const leaveNew = transport.subscribe('NEW123', newSnapshot);

    if (outcome === 'success') resolveOld(new Response(JSON.stringify(roomResponse()), { status: 200 }));
    else rejectOld(new Error('Old room request failed'));
    await vi.advanceTimersByTimeAsync(0);

    expect(oldSnapshot).not.toHaveBeenCalled();
    expect(newSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      status: 'connected', room: expect.objectContaining({ code: 'NEW123' })
    }));
    await vi.advanceTimersByTimeAsync(2000);
    expect(fetchMock.mock.calls.filter(([input]) => String(input).includes('room=OLD123'))).toHaveLength(1);
    expect(newSnapshot).toHaveBeenCalledTimes(2);
    leaveNew();
    await vi.advanceTimersByTimeAsync(4000);
    expect(newSnapshot).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});

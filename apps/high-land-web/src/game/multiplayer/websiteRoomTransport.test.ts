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

function roomResponse() {
  const gameState = createInitialGame(2);
  gameState.players[0] = { ...gameState.players[0], id: 'player-1', name: 'Host Player' };
  gameState.players[1] = { ...gameState.players[1], id: 'player-2', name: 'Guest Player' };
  return {
    ok: true,
    room: {
      code: 'ABC123',
      status: 'playing',
      players: [player('player-1', true), player('player-2', false)],
      state: gameState,
      createdAt: 'now',
      updatedAt: 'now'
    }
  };
}

describe('website room transport credentials', () => {
  it('sends a credential for create, join, state update, and event append requests', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(roomResponse()), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));
    vi.stubGlobal('fetch', fetchMock);

    const transport = createWebsiteRoomTransport({
      apiBaseUrl: 'https://dtfseeds.com/games/high-land/api/',
      credentialProvider: () => credential
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

    expect(fetchMock).toHaveBeenCalledTimes(4);
    const requests = fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);
    for (const request of requests) {
      expect(request.credential).toBe(credential);
    }
    expect(requests[0]).toMatchObject({ playerId: 'player-1', credential });
    expect(requests[1]).toMatchObject({ playerId: 'player-2', credential });
    expect(requests[2]).toMatchObject({ playerId: 'player-1', credential });
    expect(requests[3]).toMatchObject({ playerId: 'player-1', credential });
  });

  it('refuses an event append without an authenticated actor', async () => {
    const transport = createWebsiteRoomTransport({
      apiBaseUrl: 'https://dtfseeds.com/games/high-land/api/',
      credentialProvider: () => credential
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

  it('reuses a persisted 256-bit browser credential', () => {
    const values = new Map<string, string>();
    const storage = {
      get length() { return values.size; },
      clear() { values.clear(); },
      getItem(key: string) { return values.get(key) ?? null; },
      key(index: number) { return Array.from(values.keys())[index] ?? null; },
      removeItem(key: string) { values.delete(key); },
      setItem(key: string, value: string) { values.set(key, value); }
    } satisfies Storage;

    const first = getOrCreateWebsiteRoomCredential(storage);
    const second = getOrCreateWebsiteRoomCredential(storage);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toBe(first);
  });
});

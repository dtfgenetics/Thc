import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialGame } from '../systems/gameEngine';
import { createWebsiteRoomTransport } from './websiteRoomTransport';
import type { HighLandRoomPlayer } from './roomState';

const authKey = 'ab'.repeat(32);

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function makePlayer(id = 'player-1', name = 'Host'): HighLandRoomPlayer {
  return {
    id,
    name,
    token: 'tokenA',
    color: '#22c55e',
    host: true,
    connected: true,
    joinedAt: 'now'
  };
}

function roomResponse(player = makePlayer(), status = 'waiting') {
  return new Response(JSON.stringify({
    ok: true,
    room: {
      code: 'ABC123',
      status,
      players: [player],
      state: status === 'playing' ? createInitialGame(2) : null,
      createdAt: 'now',
      updatedAt: 'now'
    }
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('website room transport secure sessions', () => {
  it('generates and stores a private credential when creating a room', async () => {
    const storage = new MemoryStorage();
    const fetchMock = vi.fn(async () => roomResponse());
    vi.stubGlobal('fetch', fetchMock);

    const transport = createWebsiteRoomTransport({
      apiBaseUrl: 'https://dtfseeds.com/games/high-land/api/',
      authStorage: storage,
      createAuthKey: () => authKey
    });
    const player = makePlayer();
    const room = await transport.createRoom(player);

    expect(room.code).toBe('ABC123');
    const request = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.[1]?.body));
    expect(body).toMatchObject({ playerId: player.id, authKey });
    expect(storage.getItem('high-land-room-auth-v1:ABC123:player-1')).toBe(authKey);
    expect(JSON.stringify(room)).not.toContain(authKey);
  });

  it('reuses the stored room credential when reconnecting the same player', async () => {
    const storage = new MemoryStorage();
    storage.setItem('high-land-room-auth-v1:ABC123:player-1', authKey);
    const fetchMock = vi.fn(async () => roomResponse());
    vi.stubGlobal('fetch', fetchMock);

    const transport = createWebsiteRoomTransport({
      apiBaseUrl: 'https://dtfseeds.com/games/high-land/api/',
      authStorage: storage,
      createAuthKey: () => {
        throw new Error('should not generate a replacement credential');
      }
    });
    await transport.joinRoom('abc123', makePlayer());

    const request = fetchMock.mock.calls[0];
    expect(String(request?.[0])).toContain('join-room.php');
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      roomCode: 'ABC123',
      playerId: 'player-1',
      authKey
    });
  });

  it('sends the stored credential with synchronized game-state mutations', async () => {
    const storage = new MemoryStorage();
    storage.setItem('high-land-room-auth-v1:ABC123:player-1', authKey);
    const gameState = createInitialGame(2);
    const fetchMock = vi.fn(async () => roomResponse(makePlayer(), 'playing'));
    vi.stubGlobal('fetch', fetchMock);

    const transport = createWebsiteRoomTransport({
      apiBaseUrl: 'https://dtfseeds.com/games/high-land/api/',
      authStorage: storage
    });
    await transport.updateGameState('ABC123', gameState, 'player-1');

    const request = fetchMock.mock.calls[0];
    expect(String(request?.[0])).toContain('update-room.php');
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      roomCode: 'ABC123',
      playerId: 'player-1',
      authKey
    });
  });

  it('sends the stored credential with authenticated room events', async () => {
    const storage = new MemoryStorage();
    storage.setItem('high-land-room-auth-v1:ABC123:player-1', authKey);
    const fetchMock = vi.fn(async () => roomResponse());
    vi.stubGlobal('fetch', fetchMock);

    const transport = createWebsiteRoomTransport({
      apiBaseUrl: 'https://dtfseeds.com/games/high-land/api/',
      authStorage: storage
    });
    await transport.appendEvent('ABC123', {
      id: 'event-1',
      name: 'game_started',
      roomCode: 'ABC123',
      playerId: 'player-1',
      createdAt: 'now',
      payload: { playerCount: 2 }
    });

    const request = fetchMock.mock.calls[0];
    expect(String(request?.[0])).toContain('append-event.php');
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({
      roomCode: 'ABC123',
      playerId: 'player-1',
      authKey
    });
  });

  it('fails closed before network mutation when the secure session credential is missing', async () => {
    const storage = new MemoryStorage();
    const gameState = createInitialGame(2);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const transport = createWebsiteRoomTransport({
      apiBaseUrl: 'https://dtfseeds.com/games/high-land/api/',
      authStorage: storage
    });

    await expect(transport.updateGameState('ABC123', gameState, 'player-1')).rejects.toThrow('Secure room session is missing');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses unauthenticated event identities before network mutation', async () => {
    const storage = new MemoryStorage();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const transport = createWebsiteRoomTransport({
      apiBaseUrl: 'https://dtfseeds.com/games/high-land/api/',
      authStorage: storage
    });

    await expect(transport.appendEvent('ABC123', {
      id: 'event-2',
      name: 'game_started',
      roomCode: 'ABC123',
      playerId: null,
      createdAt: 'now',
      payload: { playerCount: 2 }
    })).rejects.toThrow('must identify the authenticated player');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

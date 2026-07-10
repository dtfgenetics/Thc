import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServerRoomTransport } from './serverRoomTransport';
import type { HighLandRoomPlayer } from './roomState';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
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
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.values.delete(key);
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const hostPlayer: HighLandRoomPlayer = {
  id: 'browser-host',
  name: 'Host',
  token: 'tokenA',
  color: '#22c55e',
  host: true,
  connected: true,
  joinedAt: '2026-07-10T12:00:00.000Z'
};

function room(version: number, status: 'waiting' | 'playing' = 'waiting') {
  return {
    id: 'room-id',
    code: 'ABC234',
    gameSlug: 'high-land',
    status,
    hostPlayerId: 'server-host',
    maxPlayers: 10,
    version,
    players: [{ ...hostPlayer, id: 'server-host', ready: true, lastSeenAt: 'now' }],
    gameState: null,
    createdAt: 'now',
    updatedAt: 'now',
    expiresAt: 'later'
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('server room transport', () => {
  it('stores the server session and automatically marks a created player ready', async () => {
    const storage = new MemoryStorage();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        room: room(1),
        playerId: 'server-host',
        reconnectToken: 'private-token'
      }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, room: room(2) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
    vi.stubGlobal('fetch', fetchMock);

    const transport = createServerRoomTransport({ apiBaseUrl: 'https://api.example/api/v1', storage });
    const createdRoom = await transport.createRoom(hostPlayer);

    expect(createdRoom.code).toBe('ABC234');
    expect(transport.getLocalPlayerId?.('ABC234')).toBe('server-host');
    expect(JSON.parse(storage.getItem('high-land-room-session:ABC234') ?? '{}')).toEqual({
      playerId: 'server-host',
      reconnectToken: 'private-token'
    });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/rooms/ABC234/ready');
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ ready: true, expectedVersion: 1 });
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
      'X-Player-Id': 'server-host',
      'X-Session-Token': 'private-token'
    });
  });

  it('uses the latest server version and an idempotency key for dice actions', async () => {
    const storage = new MemoryStorage();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ok: true,
        room: room(1),
        playerId: 'server-host',
        reconnectToken: 'private-token'
      }), { status: 201, headers: { 'Content-Type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, room: room(2) }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, room: room(3, 'playing') }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }));
    vi.stubGlobal('fetch', fetchMock);

    const transport = createServerRoomTransport({ apiBaseUrl: 'https://api.example/api/v1', storage });
    await transport.createRoom(hostPlayer);
    await transport.rollDice?.('ABC234', 'server-host');

    const actionBody = JSON.parse(String(fetchMock.mock.calls[2]?.[1]?.body));
    expect(actionBody).toMatchObject({ type: 'ROLL_DICE', expectedVersion: 2 });
    expect(actionBody.actionId).toEqual(expect.any(String));
  });

  it('reconnects an existing browser session instead of creating a duplicate player', async () => {
    const storage = new MemoryStorage();
    storage.setItem('high-land-room-session:ABC234', JSON.stringify({
      playerId: 'server-host',
      reconnectToken: 'private-token'
    }));
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, room: room(4, 'playing') }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));
    vi.stubGlobal('fetch', fetchMock);

    const transport = createServerRoomTransport({ apiBaseUrl: 'https://api.example/api/v1', storage });
    const reconnected = await transport.joinRoom('ABC234', hostPlayer);

    expect(reconnected.status).toBe('playing');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/rooms/ABC234/reconnect');
  });
});

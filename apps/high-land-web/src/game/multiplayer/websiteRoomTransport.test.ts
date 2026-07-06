import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInitialGame } from '../systems/gameEngine';
import { createWebsiteRoomTransport } from './websiteRoomTransport';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('website room transport', () => {
  it('sends the requesting player id when updating synchronized game state', async () => {
    const gameState = createInitialGame(2);
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      return new Response(JSON.stringify({
        ok: true,
        room: {
          code: 'ABC123',
          status: 'playing',
          players: gameState.players.map((player, index) => ({
            id: player.id,
            name: player.name,
            token: player.token,
            color: player.color,
            host: index === 0,
            connected: true,
            joinedAt: 'now'
          })),
          state: gameState,
          createdAt: 'now',
          updatedAt: 'now'
        }
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const transport = createWebsiteRoomTransport({ apiBaseUrl: 'https://dtfseeds.com/games/high-land/api/' });
    await transport.updateGameState('ABC123', gameState, 'player-1');

    const request = fetchMock.mock.calls[0];
    expect(String(request?.[0])).toContain('update-room.php');
    expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({ roomCode: 'ABC123', playerId: 'player-1' });
  });
});

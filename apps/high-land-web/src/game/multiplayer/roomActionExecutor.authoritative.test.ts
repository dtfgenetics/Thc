import { describe, expect, it } from 'vitest';
import { createLocalRoomTransport } from './localRoomTransport';
import { createLocalTestPlayer } from './localRoomFlow';
import { startRoomWithTransport, rollRoomWithTransport } from './roomActionExecutor';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

function player(index: number, host: boolean) {
  return { ...createLocalTestPlayer(index), joinedAt: 'now', connected: true, host };
}

describe('authoritative room transport snapshots', () => {
  it('returns committed server state for start and roll rather than an optimistic copy', async () => {
    const transport = createLocalRoomTransport(new MemoryStorage());
    const created = await transport.createRoom(player(0, true));
    const joined = await transport.joinRoom(created.code, player(1, false));
    const serverNormalizingTransport = {
      ...transport,
      async updateGameState(...args: Parameters<typeof transport.updateGameState>) {
        const committed = await transport.updateGameState(...args);
        return {
          ...committed,
          gameState: committed.gameState ? { ...committed.gameState, message: 'Server-confirmed snapshot' } : null
        };
      }
    };

    const started = await startRoomWithTransport(joined, serverNormalizingTransport, 'local-player-1');
    expect(started.gameState?.message).toBe('Server-confirmed snapshot');
    const rolled = await rollRoomWithTransport(started, serverNormalizingTransport, 'local-player-1', () => 0);
    expect(rolled.gameState?.message).toBe('Server-confirmed snapshot');
    expect(rolled.gameState?.lastRoll).toBe(1);
  });
});

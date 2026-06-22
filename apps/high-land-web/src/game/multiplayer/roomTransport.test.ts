import { describe, expect, it } from 'vitest';
import { createOfflineRoomTransport } from './roomTransport';

describe('room transport', () => {
  it('reports offline snapshots when Supabase is not connected', () => {
    const transport = createOfflineRoomTransport('offline test');
    const snapshots: string[] = [];

    const unsubscribe = transport.subscribe('ABCD23', (snapshot) => {
      snapshots.push(`${snapshot.status}:${snapshot.error}`);
    });
    unsubscribe();

    expect(snapshots).toEqual(['offline:offline test']);
  });

  it('rejects writes while offline', async () => {
    const transport = createOfflineRoomTransport('offline test');

    await expect(transport.appendEvent('ABCD23', {} as never)).rejects.toThrow('offline test');
  });
});

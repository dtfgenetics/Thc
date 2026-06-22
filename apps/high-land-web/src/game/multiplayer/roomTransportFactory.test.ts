import { describe, expect, it } from 'vitest';
import { createRoomTransport } from './roomTransportFactory';

describe('room transport factory', () => {
  it('creates an offline transport explicitly', async () => {
    const transport = createRoomTransport('offline');
    const statuses: string[] = [];

    const unsubscribe = transport.subscribe('ABCD23', (snapshot) => statuses.push(snapshot.status));
    unsubscribe();

    expect(statuses).toEqual(['offline']);
  });

  it('creates a supabase transport stub safely', async () => {
    const transport = createRoomTransport('supabase');

    await expect(transport.appendEvent('ABCD23', {} as never)).rejects.toThrow();
  });
});

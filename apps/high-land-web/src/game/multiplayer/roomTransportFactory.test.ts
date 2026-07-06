import { describe, expect, it } from 'vitest';
import { createRoomTransport, isRoomTransportMode } from './roomTransportFactory';

describe('room transport factory', () => {
  it('creates an offline transport explicitly', async () => {
    const transport = createRoomTransport('offline');
    const statuses: string[] = [];

    const unsubscribe = transport.subscribe('ABCD23', (snapshot) => statuses.push(snapshot.status));
    unsubscribe();

    expect(statuses).toEqual(['offline']);
  });

  it('does not expose paid/external service transport modes', () => {
    expect(isRoomTransportMode('local')).toBe(true);
    expect(isRoomTransportMode('website')).toBe(true);
    expect(isRoomTransportMode('offline')).toBe(true);
    expect(isRoomTransportMode('supabase')).toBe(false);
    expect(isRoomTransportMode('firebase')).toBe(false);
  });
});

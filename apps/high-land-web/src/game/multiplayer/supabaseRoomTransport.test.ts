import { describe, expect, it } from 'vitest';
import { createSupabaseRoomTransport, getSupabaseRoomTransportStatus } from './supabaseRoomTransport';

describe('supabase room transport', () => {
  it('returns a safe status string', () => {
    expect(['not_configured', 'configured_not_implemented']).toContain(getSupabaseRoomTransportStatus());
  });

  it('does not pretend live room sync is implemented', async () => {
    const transport = createSupabaseRoomTransport();

    await expect(transport.appendEvent('ABCD23', {} as never)).rejects.toThrow();
  });
});

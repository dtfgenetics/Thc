import { createLocalRoomTransport } from './localRoomTransport';
import { createOfflineRoomTransport, type RoomTransport } from './roomTransport';
import { createSupabaseRoomTransport } from './supabaseRoomTransport';

export type RoomTransportMode = 'local' | 'supabase' | 'offline';

export function createRoomTransport(mode: RoomTransportMode = 'local'): RoomTransport {
  if (mode === 'local') return createLocalRoomTransport();
  if (mode === 'supabase') return createSupabaseRoomTransport();
  return createOfflineRoomTransport();
}

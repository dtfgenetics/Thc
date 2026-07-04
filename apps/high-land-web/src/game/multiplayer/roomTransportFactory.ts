import { createLocalRoomTransport } from './localRoomTransport';
import { createOfflineRoomTransport, type RoomTransport } from './roomTransport';
import { createSupabaseRoomTransport } from './supabaseRoomTransport';
import { createWebsiteRoomTransport } from './websiteRoomTransport';

export type RoomTransportMode = 'local' | 'website' | 'supabase' | 'offline';

export function createRoomTransport(mode: RoomTransportMode = resolveDefaultRoomTransportMode()): RoomTransport {
  if (mode === 'local') return createLocalRoomTransport();
  if (mode === 'website') return createWebsiteRoomTransport();
  if (mode === 'supabase') return createSupabaseRoomTransport();
  return createOfflineRoomTransport();
}

export function resolveDefaultRoomTransportMode(): RoomTransportMode {
  if (typeof window === 'undefined') return 'local';

  const transportOverride = new URLSearchParams(window.location.search).get('transport');
  if (isRoomTransportMode(transportOverride)) return transportOverride;

  const { hostname, pathname } = window.location;
  if (hostname === 'dtfseeds.com' && pathname.startsWith('/games/high-land/')) return 'website';

  return 'local';
}

export function isRoomTransportMode(value: string | null): value is RoomTransportMode {
  return value === 'local' || value === 'website' || value === 'supabase' || value === 'offline';
}

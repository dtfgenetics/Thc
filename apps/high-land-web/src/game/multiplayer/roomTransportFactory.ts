import { createLocalRoomTransport } from './localRoomTransport';
import { createOfflineRoomTransport, type RoomTransport } from './roomTransport';
import { createWebsiteRoomTransport } from './websiteRoomTransport';

export type RoomTransportMode = 'local' | 'website' | 'offline';

export function createRoomTransport(mode: RoomTransportMode = resolveDefaultRoomTransportMode()): RoomTransport {
  if (mode === 'local') return createLocalRoomTransport();
  if (mode === 'website') return createWebsiteRoomTransport();
  return createOfflineRoomTransport();
}

export function resolveDefaultRoomTransportMode(): RoomTransportMode {
  if (typeof location === 'undefined') return 'local';

  const transportOverride = new URLSearchParams(location.search).get('transport');
  if (isRoomTransportMode(transportOverride)) return transportOverride;

  const { hostname, pathname } = location;
  if (hostname === 'dtfseeds.com' && pathname.startsWith('/games/high-land/')) return 'website';

  return 'local';
}

export function isRoomTransportMode(value: string | null): value is RoomTransportMode {
  return value === 'local' || value === 'website' || value === 'offline';
}

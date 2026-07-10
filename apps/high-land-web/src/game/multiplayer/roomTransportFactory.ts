import { createLocalRoomTransport } from './localRoomTransport';
import { createOfflineRoomTransport, type RoomTransport } from './roomTransport';
import { createServerRoomTransport } from './serverRoomTransport';
import { createWebsiteRoomTransport } from './websiteRoomTransport';

export type RoomTransportMode = 'local' | 'website' | 'server' | 'offline';

export function createRoomTransport(mode: RoomTransportMode = resolveDefaultRoomTransportMode()): RoomTransport {
  if (mode === 'local') return createLocalRoomTransport();
  if (mode === 'website') return createWebsiteRoomTransport();
  if (mode === 'server') return createServerRoomTransport();
  return createOfflineRoomTransport();
}

export function resolveDefaultRoomTransportMode(): RoomTransportMode {
  if (typeof location === 'undefined') return 'local';

  const transportOverride = new URLSearchParams(location.search).get('transport');
  if (isRoomTransportMode(transportOverride)) return transportOverride;

  const configuredApi = import.meta.env.VITE_MULTIPLAYER_API_URL as string | undefined;
  if (configuredApi?.trim()) return 'server';

  const { hostname, pathname } = location;
  if ((hostname === 'dtf420.com' || hostname === 'www.dtf420.com') && pathname.startsWith('/')) return 'server';
  if ((hostname === 'dtfseeds.com' || hostname === 'www.dtfseeds.com') && pathname.startsWith('/games/high-land/')) return 'website';

  return 'local';
}

export function isRoomTransportMode(value: string | null): value is RoomTransportMode {
  return value === 'local' || value === 'website' || value === 'server' || value === 'offline';
}

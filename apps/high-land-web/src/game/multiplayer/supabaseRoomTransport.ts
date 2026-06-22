import { createOfflineRoomTransport, type RoomTransport } from './roomTransport';
import { getSupabaseBrowserConfig } from './supabaseClient';

export function createSupabaseRoomTransport(): RoomTransport {
  const config = getSupabaseBrowserConfig();

  if (!config.connected) {
    return createOfflineRoomTransport(config.reason);
  }

  return createOfflineRoomTransport('Supabase environment is configured, but live room sync is not implemented yet.');
}

export function getSupabaseRoomTransportStatus(): string {
  const config = getSupabaseBrowserConfig();
  return config.connected ? 'configured_not_implemented' : 'not_configured';
}

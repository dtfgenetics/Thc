export type HighLandRouteState = {
  roomCode: string | null;
  inviteUrl: string | null;
};

const PRIMARY_ROOM_CODE_QUERY_KEY = 'game';
const LEGACY_ROOM_CODE_QUERY_KEY = 'room';

export function parseHighLandRouteState(urlLike: string | URL = window.location.href): HighLandRouteState {
  const url = typeof urlLike === 'string' ? new URL(urlLike, window.location.origin) : urlLike;
  const rawRoomCode = url.searchParams.get(PRIMARY_ROOM_CODE_QUERY_KEY) ?? url.searchParams.get(LEGACY_ROOM_CODE_QUERY_KEY);
  const roomCode = rawRoomCode ? normalizeRouteRoomCode(rawRoomCode) : null;

  return {
    roomCode,
    inviteUrl: roomCode ? createHighLandInviteUrl(roomCode, url.origin, url.pathname) : null
  };
}

export function createHighLandInviteUrl(roomCode: string, origin = window.location.origin, pathname = '/games/high-land/'): string {
  const normalizedRoomCode = normalizeRouteRoomCode(roomCode);
  const url = new URL(pathname, origin);
  url.searchParams.set(PRIMARY_ROOM_CODE_QUERY_KEY, normalizedRoomCode);
  url.searchParams.delete(LEGACY_ROOM_CODE_QUERY_KEY);
  return url.toString();
}

export function normalizeRouteRoomCode(roomCode: string): string {
  return roomCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
}

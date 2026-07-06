import { isValidRoomCode, normalizeRoomCode, requireValidRoomCode } from './roomCodes';

const PRIMARY_ROOM_QUERY_KEY = 'game';
const LEGACY_ROOM_QUERY_KEY = 'room';

export type HighLandInviteLink = {
  roomCode: string;
  url: string;
};

export function createInviteLink(
  roomCode: string,
  options: { origin?: string; pathname?: string } = {}
): HighLandInviteLink {
  const validRoomCode = requireValidRoomCode(roomCode);
  const origin = options.origin ?? getBrowserOrigin();
  const pathname = options.pathname ?? '/games/high-land/';
  const url = new URL(pathname, origin);
  url.searchParams.set(PRIMARY_ROOM_QUERY_KEY, validRoomCode);

  return {
    roomCode: validRoomCode,
    url: url.toString()
  };
}

export function parseInviteLink(urlLike: string | URL): string | null {
  const url = typeof urlLike === 'string' ? new URL(urlLike, getBrowserOrigin()) : urlLike;
  const rawRoomCode = url.searchParams.get(PRIMARY_ROOM_QUERY_KEY) ?? url.searchParams.get(LEGACY_ROOM_QUERY_KEY);
  if (!rawRoomCode) return null;

  const normalized = normalizeRoomCode(rawRoomCode);
  return isValidRoomCode(normalized) ? normalized : null;
}

function getBrowserOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return 'https://dtfseeds.com';
}

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DEFAULT_CODE_LENGTH = 6;

export function normalizeInviteCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/[IO]/g, '1')
    .slice(0, DEFAULT_CODE_LENGTH);
}

export function createInviteCode(length = DEFAULT_CODE_LENGTH, random = Math.random): string {
  if (!Number.isInteger(length) || length < 4 || length > 12) {
    throw new Error('Invite code length must be an integer from 4 to 12.');
  }

  let code = '';
  for (let index = 0; index < length; index += 1) {
    const charIndex = Math.floor(random() * INVITE_ALPHABET.length) % INVITE_ALPHABET.length;
    code += INVITE_ALPHABET[charIndex];
  }
  return code;
}

export function createInviteUrl(origin: string, inviteCode: string, path = '/games/high-land/'): string {
  const url = new URL(path, origin);
  url.searchParams.set('room', normalizeInviteCode(inviteCode));
  return url.toString();
}

export function readInviteCodeFromUrl(url: string): string | null {
  const parsed = new URL(url);
  const value = parsed.searchParams.get('room') ?? parsed.searchParams.get('invite');
  if (!value) return null;
  const normalized = normalizeInviteCode(value);
  return normalized.length > 0 ? normalized : null;
}

export type MultiplayerRoomStatus = 'local_placeholder' | 'waiting' | 'playing' | 'closed';

export type MultiplayerRoomSummary = {
  inviteCode: string;
  inviteUrl: string;
  status: MultiplayerRoomStatus;
  playerCount: number;
  maxPlayers: number;
};

/**
 * Client-side summary only. Real multiplayer still needs a server-authoritative room
 * using Colyseus or boardgame.io. This helper gives the UI a stable invite shape
 * without pretending local state is real multiplayer.
 */
export function createLocalInviteSummary(origin: string, playerCount: number, maxPlayers = 4): MultiplayerRoomSummary {
  const inviteCode = createInviteCode();
  return {
    inviteCode,
    inviteUrl: createInviteUrl(origin, inviteCode),
    status: 'local_placeholder',
    playerCount,
    maxPlayers
  };
}

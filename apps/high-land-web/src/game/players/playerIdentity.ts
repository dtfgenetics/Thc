import type { Player, PlayerToken } from '../types/gameTypes';

export type PlayerNameValidation = {
  valid: boolean;
  value: string;
  error: string | null;
};

export type LocalPlayerIdentity = {
  id: string;
  name: string;
  token: PlayerToken;
  color: string;
};

const LOCAL_PLAYER_ID_KEY = 'high-land-local-player-id';
const MIN_PLAYER_NAME_LENGTH = 2;
const MAX_PLAYER_NAME_LENGTH = 24;

const tokenOrder: PlayerToken[] = [
  'tokenA',
  'tokenB',
  'tokenC',
  'tokenD',
  'tokenE',
  'tokenF',
  'tokenG',
  'tokenH',
  'tokenI',
  'tokenJ'
];

const tokenColors = [
  '#ef4444',
  '#22c55e',
  '#3b82f6',
  '#facc15',
  '#a855f7',
  '#f97316',
  '#14b8a6',
  '#ec4899',
  '#ffffff',
  '#94a3b8'
];

export function validatePlayerName(input: string): PlayerNameValidation {
  const value = input.trim().replace(/\s+/g, ' ');

  if (value.length < MIN_PLAYER_NAME_LENGTH) {
    return {
      valid: false,
      value,
      error: `Player name must be at least ${MIN_PLAYER_NAME_LENGTH} characters.`
    };
  }

  if (value.length > MAX_PLAYER_NAME_LENGTH) {
    return {
      valid: false,
      value: value.slice(0, MAX_PLAYER_NAME_LENGTH),
      error: `Player name must be ${MAX_PLAYER_NAME_LENGTH} characters or fewer.`
    };
  }

  return { valid: true, value, error: null };
}

export function getOrCreateLocalPlayerId(storage: Storage = window.localStorage): string {
  const saved = storage.getItem(LOCAL_PLAYER_ID_KEY);
  if (saved) return saved;

  const id = createGuestPlayerId();
  storage.setItem(LOCAL_PLAYER_ID_KEY, id);
  return id;
}

export function createGuestPlayerId(random: () => number = Math.random): string {
  const entropy = Math.floor(random() * Number.MAX_SAFE_INTEGER).toString(36);
  return `guest_${Date.now().toString(36)}_${entropy}`;
}

export function createLocalPlayerIdentity(name: string, slotIndex: number, storage?: Storage): LocalPlayerIdentity {
  const validation = validatePlayerName(name);
  if (!validation.valid) {
    throw new Error(validation.error ?? 'Invalid player name.');
  }

  const tokenIndex = Math.max(0, slotIndex) % tokenOrder.length;

  return {
    id: storage ? getOrCreateLocalPlayerId(storage) : createGuestPlayerId(),
    name: validation.value,
    token: tokenOrder[tokenIndex],
    color: tokenColors[tokenIndex]
  };
}

export function applyIdentityToPlayer(player: Player, identity: LocalPlayerIdentity): Player {
  return {
    ...player,
    id: identity.id,
    name: identity.name,
    token: identity.token,
    color: identity.color
  };
}

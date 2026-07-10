export const HIGH_LAND_BOARD_SPACE_COUNT = 109;
export const HIGH_LAND_FINISH_INDEX = HIGH_LAND_BOARD_SPACE_COUNT - 1;
export const HIGH_LAND_MIN_PLAYERS = 2;
export const HIGH_LAND_MAX_PLAYERS = 10;

export type RoomStatus = 'waiting' | 'playing' | 'complete' | 'abandoned';
export type GamePhase = 'ready' | 'game_over';

export type GamePlayer = {
  id: string;
  name: string;
  token: string;
  color: string;
  positionIndex: number;
  skipTurns: number;
  protectedFromBackward: number;
};

export type PlayerMove = {
  playerId: string;
  fromIndex: number;
  toIndex: number;
  traversedIndexes: number[];
};

export type AuthoritativeGameState = {
  players: GamePlayer[];
  currentPlayerIndex: number;
  phase: GamePhase;
  turnDirection: 1 | -1;
  reverseTurnsRemaining: number;
  lastRoll: number | null;
  lastMove: PlayerMove | null;
  lastCard: null;
  message: string;
  winnerId: string | null;
  cardCursor: number;
};

export type RoomPlayer = {
  id: string;
  name: string;
  token: string;
  color: string;
  host: boolean;
  ready: boolean;
  connected: boolean;
  joinedAt: string;
  lastSeenAt: string;
  reconnectTokenHash: string;
};

export type StoredRoom = {
  id: string;
  code: string;
  gameSlug: 'high-land';
  status: RoomStatus;
  hostPlayerId: string;
  maxPlayers: number;
  version: number;
  players: RoomPlayer[];
  gameState: AuthoritativeGameState | null;
  processedActionIds: string[];
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
};

export type PublicRoomPlayer = Omit<RoomPlayer, 'reconnectTokenHash'>;

export type PublicRoom = Omit<StoredRoom, 'players' | 'processedActionIds'> & {
  players: PublicRoomPlayer[];
};

export type PlayerSessionResult = {
  room: PublicRoom;
  playerId: string;
  reconnectToken: string;
};

export type RoomMutationContext = {
  playerId: string;
  reconnectToken: string;
  expectedVersion?: number;
  actionId?: string;
};

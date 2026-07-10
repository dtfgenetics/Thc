export const HIGH_LAND_BOARD_SPACE_COUNT = 109;
export const HIGH_LAND_FINISH_INDEX = HIGH_LAND_BOARD_SPACE_COUNT - 1;
export const HIGH_LAND_MIN_PLAYERS = 2;
export const HIGH_LAND_MAX_PLAYERS = 10;

export type RoomStatus = 'waiting' | 'playing' | 'complete' | 'abandoned';
export type GamePhase = 'ready' | 'resolving_card' | 'game_over';
export type SpaceColor = 'red' | 'yellow' | 'green' | 'blue' | 'purple';
export type TurnDirection = 1 | -1;

export type ActionCardEffect =
  | { type: 'move'; amount: number }
  | { type: 'skip_turns'; amount: number }
  | { type: 'go_to_space'; index: number }
  | { type: 'swap_position'; target: 'leader' | 'random' | 'behind' | 'last_place' }
  | { type: 'roll_again' }
  | { type: 'move_to_color'; color: SpaceColor; direction: 'next' | 'previous' }
  | { type: 'move_all'; amount: number; filter: 'everyone' | 'except_current' | 'ahead' | 'behind' }
  | { type: 'move_leader'; amount: number }
  | { type: 'reverse_turn_order'; turns: number }
  | { type: 'protect_from_backward'; uses: number }
  | { type: 'draw_again' }
  | { type: 'move_and_roll_again'; amount: number }
  | { type: 'move_and_draw_again'; amount: number }
  | { type: 'skip_others'; amount: number }
  | { type: 'choose_player_move'; currentAmount: number; targetAmount: number };

export type ActionCard = {
  id: string;
  title: string;
  text: string;
  imageSrc?: string;
  fallbackImageSrc?: string;
  imageAlt?: string;
  effect: ActionCardEffect;
};

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
  turnDirection: TurnDirection;
  reverseTurnsRemaining: number;
  lastRoll: number | null;
  lastMove: PlayerMove | null;
  lastCard: ActionCard | null;
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

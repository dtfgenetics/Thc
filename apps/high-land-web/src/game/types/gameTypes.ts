export type SpaceColor = 'red' | 'yellow' | 'green' | 'blue' | 'purple' | 'special';

export type BoardSpaceType = 'normal' | 'action' | 'skip' | 'start' | 'finish';

export type BoardSpace = {
  index: number;
  x: number;
  y: number;
  color: SpaceColor;
  type: BoardSpaceType;
  label?: string;
  zone?: string;
};

export type PlayerToken = 'tokenA' | 'tokenB' | 'tokenC' | 'tokenD';

export type Player = {
  id: string;
  name: string;
  token: PlayerToken;
  color: string;
  positionIndex: number;
  skipTurns: number;
};

export type ActionCardEffect =
  | { type: 'move'; amount: number }
  | { type: 'skip_turns'; amount: number }
  | { type: 'go_to_space'; index: number }
  | { type: 'swap_position'; target: 'leader' | 'random' }
  | { type: 'roll_again' };

export type ActionCard = {
  id: string;
  title: string;
  text: string;
  effect: ActionCardEffect;
};

export type GamePhase = 'setup' | 'ready' | 'rolling' | 'moving' | 'resolving_card' | 'game_over';

export type GameState = {
  players: Player[];
  currentPlayerIndex: number;
  phase: GamePhase;
  lastRoll: number | null;
  lastCard: ActionCard | null;
  message: string;
  winnerId: string | null;
  cardCursor: number;
};

export type MoveResult = {
  fromIndex: number;
  toIndex: number;
  traversedIndexes: number[];
};

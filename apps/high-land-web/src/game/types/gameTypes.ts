export type SpaceColor = 'red' | 'yellow' | 'green' | 'blue' | 'purple';

export type BoardSpaceType = 'normal' | 'action' | 'start' | 'finish';

export type BoardSpaceAction = 'draw_hit_card' | null;

export type BoardSpaceLabel = 'START' | 'HIT' | 'FINISH';

export type BoardSpaceBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type BoardSpace = {
  index: number;
  /** Center point where player tokens move. */
  x: number;
  y: number;
  /** Actual playable square boundary on the 800x900 board canvas. */
  bounds: BoardSpaceBounds;
  color: SpaceColor;
  type: BoardSpaceType;
  label?: BoardSpaceLabel;
  zone?: string;
  /** Explicit action trigger so visual labels do not drive gameplay rules. */
  action: BoardSpaceAction;
};

export type PlayerToken =
  | 'tokenA'
  | 'tokenB'
  | 'tokenC'
  | 'tokenD'
  | 'tokenE'
  | 'tokenF'
  | 'tokenG'
  | 'tokenH'
  | 'tokenI'
  | 'tokenJ';

export type Player = {
  id: string;
  name: string;
  token: PlayerToken;
  color: string;
  positionIndex: number;
  skipTurns: number;
  protectedFromBackward: number;
};

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
  | { type: 'move_and_roll_again'; amount: number };

export type ActionCard = {
  id: string;
  title: string;
  text: string;
  effect: ActionCardEffect;
};

export type GamePhase = 'setup' | 'ready' | 'rolling' | 'moving' | 'resolving_card' | 'game_over';

export type TurnDirection = 1 | -1;

export type GameState = {
  players: Player[];
  currentPlayerIndex: number;
  phase: GamePhase;
  turnDirection: TurnDirection;
  reverseTurnsRemaining: number;
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
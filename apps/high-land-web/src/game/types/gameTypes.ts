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
  /** Actual playable square boundary on the 1280x960 board canvas. */
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
  | { type: 'move_and_roll_again'; amount: number }
  | { type: 'move_and_draw_again'; amount: number }
  | { type: 'skip_others'; amount: number }
  | { type: 'choose_player_move'; currentAmount: number; targetAmount: number };

export type ActionCardSheetArt = {
  /** Full URL or public asset path for the source sheet. */
  src: string;
  /** Four columns per approved sheet. */
  column: 0 | 1 | 2 | 3;
  /** Two rows per approved sheet. */
  row: 0 | 1;
};

export type ActionCard = {
  id: string;
  title: string;
  text: string;
  /** Public asset path for the approved individual HIT card image. */
  imageSrc?: string;
  /** Temporary approved-sheet crop used while the individual master PNG package is missing from the deployed repo. */
  sheetArt?: ActionCardSheetArt;
  /** Public asset path used only as a final error state when neither approved art source can load. */
  fallbackImageSrc?: string;
  imageAlt?: string;
  effect: ActionCardEffect;
};

export type GamePhase = 'setup' | 'ready' | 'rolling' | 'moving' | 'resolving_card' | 'game_over';

export type TurnDirection = 1 | -1;

export type MoveResult = {
  fromIndex: number;
  toIndex: number;
  traversedIndexes: number[];
};

export type PlayerMoveResult = MoveResult & {
  playerId: string;
};

export type GameState = {
  players: Player[];
  currentPlayerIndex: number;
  phase: GamePhase;
  turnDirection: TurnDirection;
  reverseTurnsRemaining: number;
  lastRoll: number | null;
  lastMove: PlayerMoveResult | null;
  lastCard: ActionCard | null;
  message: string;
  winnerId: string | null;
  cardCursor: number;
};

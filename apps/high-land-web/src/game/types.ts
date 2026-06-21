export type BoardSpaceColor = 'red' | 'yellow' | 'green' | 'blue' | 'purple' | 'hit' | 'finish';

export type BoardSpaceType = 'normal' | 'hit' | 'finish';

export type BoardPoint = {
  x: number;
  y: number;
};

export type BoardSpace = BoardPoint & {
  position: number;
  color: BoardSpaceColor;
  type: BoardSpaceType;
  location: string;
  label: string;
};

export type PlayerPieceId = 'sprout-scout' | 'rosin-rocket' | 'munchie-mage' | 'cloud-crown';

export type PlayerPiece = {
  id: PlayerPieceId;
  name: string;
  shortName: string;
  description: string;
  suggestedColor: string;
};

export type HighLandPlayer = {
  id: string;
  name: string;
  pieceId: PlayerPieceId;
  position: number;
  skipTurns: number;
};

export type MoveReason = 'dice' | 'card' | 'test';

export type MoveRequest = {
  from: number;
  amount: number;
  reason: MoveReason;
};

export type MoveResult = {
  from: number;
  to: number;
  amount: number;
  reason: MoveReason;
  stepSequence: number[];
  landedSpace: BoardSpace | null;
  hitTriggered: boolean;
  won: boolean;
};

export type TokenRenderPosition = BoardPoint & {
  boardPosition: number;
  pieceId: PlayerPieceId;
  slotIndex: number;
};

export type PathValidationResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

export type BoardRenderBounds = {
  width: number;
  height: number;
};

export type BoardCoordinate = {
  x: number;
  y: number;
};

export const HIGH_LAND_BOARD_BOUNDS: BoardRenderBounds = {
  width: 800,
  height: 900
};

export function isCoordinateInsideBoard(coordinate: BoardCoordinate, bounds: BoardRenderBounds = HIGH_LAND_BOARD_BOUNDS): boolean {
  return coordinate.x >= 0 && coordinate.y >= 0 && coordinate.x <= bounds.width && coordinate.y <= bounds.height;
}

export function normalizeBoardCoordinate(coordinate: BoardCoordinate, bounds: BoardRenderBounds = HIGH_LAND_BOARD_BOUNDS): BoardCoordinate {
  return {
    x: coordinate.x / bounds.width,
    y: coordinate.y / bounds.height
  };
}

export function scaleBoardCoordinate(coordinate: BoardCoordinate, bounds: BoardRenderBounds): BoardCoordinate {
  return {
    x: coordinate.x * bounds.width,
    y: coordinate.y * bounds.height
  };
}

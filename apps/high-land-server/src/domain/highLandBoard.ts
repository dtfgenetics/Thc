import { HIGH_LAND_BOARD_SPACE_COUNT, type SpaceColor } from './roomTypes.js';

export const HIGH_LAND_ACTION_SPACE_INDEXES = new Set<number>([
  2, 8, 10, 16, 24, 26, 30, 37, 41, 47, 50,
  56, 61, 67, 70, 75, 81, 85, 91, 94, 103, 106
]);

export const HIGH_LAND_SPACE_COLORS: readonly SpaceColor[] = [
  'red', 'yellow', 'purple', 'green', 'red', 'purple', 'blue', 'yellow', 'purple', 'purple',
  'purple', 'yellow', 'red', 'green', 'yellow', 'purple', 'purple', 'blue', 'green', 'yellow',
  'purple', 'red', 'green', 'blue', 'purple', 'purple', 'purple', 'blue', 'green', 'yellow',
  'purple', 'blue', 'green', 'red', 'purple', 'yellow', 'yellow', 'purple', 'green', 'green',
  'blue', 'purple', 'red', 'purple', 'red', 'yellow', 'blue', 'purple', 'purple', 'green',
  'purple', 'yellow', 'red', 'green', 'purple', 'red', 'purple', 'blue', 'red', 'green',
  'blue', 'purple', 'yellow', 'red', 'green', 'blue', 'yellow', 'purple', 'red', 'green',
  'purple', 'blue', 'red', 'purple', 'yellow', 'purple', 'red', 'yellow', 'blue', 'purple',
  'red', 'purple', 'yellow', 'purple', 'red', 'purple', 'blue', 'green', 'red', 'purple',
  'yellow', 'purple', 'green', 'red', 'purple', 'blue', 'green', 'yellow', 'purple', 'red',
  'yellow', 'green', 'red', 'purple', 'yellow', 'blue', 'purple', 'green', 'blue'
];

if (HIGH_LAND_SPACE_COLORS.length !== HIGH_LAND_BOARD_SPACE_COUNT) {
  throw new Error(`High Land board metadata must contain ${HIGH_LAND_BOARD_SPACE_COUNT} spaces.`);
}

export function isHighLandActionSpace(index: number): boolean {
  return HIGH_LAND_ACTION_SPACE_INDEXES.has(index);
}

export function findColorSpace(positionIndex: number, color: SpaceColor, direction: 'next' | 'previous'): number | null {
  if (direction === 'next') {
    for (let index = positionIndex + 1; index < HIGH_LAND_SPACE_COLORS.length; index += 1) {
      if (HIGH_LAND_SPACE_COLORS[index] === color) return index;
    }
    return null;
  }

  for (let index = positionIndex - 1; index >= 0; index -= 1) {
    if (HIGH_LAND_SPACE_COLORS[index] === color) return index;
  }
  return null;
}

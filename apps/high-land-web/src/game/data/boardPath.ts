import type { BoardSpace, BoardSpaceLabel, BoardSpaceType, SpaceColor } from '../types/gameTypes';

export const boardWidth = 1280;
export const boardHeight = 960;
export const approvedBoardSpaceCount = 109;
export const approvedHitSpaceCount = 22;
export const approvedNonHitRoadSpaceCount = approvedBoardSpaceCount - approvedHitSpaceCount;

const defaultSpaceSize = 34;
type TilePoint = readonly [x: number, y: number, color: SpaceColor, size?: number];

/**
 * Centers calibrated against high-land-board.png at its 1280 x 960 Phaser
 * display size. The approved art has two long, uninterrupted painted spaces
 * that had previously been double-counted; each is represented once here so
 * the gameplay contract remains 109 spaces and 22 printed HIT spaces.
 */
const tilePoints: TilePoint[] = [
  [376, 800, 'red'], [421, 776, 'yellow'], [461, 736, 'purple'],
  [497, 697, 'green'], [546, 684, 'red'], [590, 692, 'purple'],
  [633, 716, 'blue'], [674, 754, 'yellow'], [720, 786, 'purple'],
  [770, 810, 'purple'], [822, 824, 'purple'], [879, 828, 'yellow'],
  [933, 822, 'red'], [976, 794, 'green'], [990, 746, 'yellow'],
  [967, 710, 'purple'], [890, 718, 'purple'], [829, 717, 'blue'],
  [777, 714, 'green'], [726, 699, 'yellow'], [684, 668, 'purple'],
  [672, 626, 'red'], [708, 597, 'green'], [758, 602, 'blue'],
  [810, 620, 'purple'], [865, 640, 'purple'], [916, 650, 'purple'],
  [964, 656, 'blue'], [1018, 654, 'green'], [1060, 630, 'yellow'],
  [1079, 584, 'purple'], [1074, 535, 'blue'], [1043, 504, 'green'],
  [999, 494, 'red'], [953, 500, 'purple'], [900, 520, 'yellow'],
  [850, 520, 'yellow'], [801, 512, 'purple'], [750, 485, 'green'],
  [727, 470, 'green'], [682, 450, 'blue'], [633, 442, 'purple'],
  [586, 442, 'red'], [543, 454, 'purple'], [508, 483, 'red'],
  [482, 522, 'yellow'], [456, 565, 'blue'], [420, 607, 'purple'],
  [370, 635, 'purple'], [305, 652, 'green'], [240, 653, 'purple'],
  [184, 632, 'yellow'], [140, 599, 'red'], [127, 550, 'green'],
  [144, 506, 'purple'], [182, 483, 'red'], [230, 481, 'purple'],
  [279, 489, 'blue'], [337, 504, 'red'], [389, 482, 'green'],
  [387, 434, 'blue'], [347, 404, 'purple'], [305, 378, 'yellow'],
  [301, 336, 'red'], [334, 304, 'green'], [382, 293, 'blue'],
  [431, 298, 'yellow'], [478, 315, 'purple'], [523, 333, 'red'],
  [571, 355, 'green'], [625, 378, 'purple'], [675, 392, 'blue'],
  [726, 406, 'red'], [775, 416, 'purple'], [827, 422, 'yellow'],
  [887, 428, 'purple'], [949, 423, 'red'], [1008, 409, 'yellow'],
  [1050, 376, 'blue'], [1063, 331, 'purple'], [1045, 291, 'red'],
  [1002, 268, 'purple'], [958, 244, 'yellow'], [927, 193, 'purple'],
  [888, 171, 'red'], [838, 191, 'purple'], [800, 250, 'blue'],
  [785, 289, 'green'], [742, 318, 'red'], [687, 320, 'purple'],
  [631, 306, 'yellow'], [584, 284, 'purple'], [539, 254, 'green'],
  [489, 237, 'red'], [415, 232, 'purple'], [330, 243, 'blue'],
  [278, 249, 'green'], [227, 240, 'yellow'], [182, 213, 'purple'],
  [161, 171, 'red'], [166, 124, 'yellow'], [194, 87, 'green'],
  [240, 69, 'red'], [287, 69, 'purple'], [335, 82, 'yellow'],
  [379, 106, 'blue'], [423, 133, 'purple'], [471, 156, 'green'],
  [520, 174, 'blue']
];

/** Printed HIT spaces in the approved board art, in gameplay path order. */
export const actionSpaceIndexes = [
  2, 8, 10, 16, 24, 26, 30, 37, 41, 47, 50,
  56, 61, 67, 70, 75, 81, 85, 91, 94, 103, 106
] as const;

const actionSpaceIndexSet = new Set<number>(actionSpaceIndexes);

function zoneForIndex(index: number): string {
  if (index < 16) return 'Rolling Hills';
  if (index < 31) return 'Dankwood Forest';
  if (index < 47) return 'Rosin Rail Station';
  if (index < 62) return 'Munchie Mountain';
  if (index < 78) return 'Kief Caves';
  if (index < 94) return 'Trichome Towers';
  return 'Cloud 9 Citadel';
}

function makeBoardSpace([x, y, color, customSize]: TilePoint, index: number): BoardSpace {
  const isStart = index === 0;
  const isFinish = index === tilePoints.length - 1;
  const isAction = actionSpaceIndexSet.has(index);
  const size = customSize ?? defaultSpaceSize;
  const type: BoardSpaceType = isStart ? 'start' : isFinish ? 'finish' : isAction ? 'action' : 'normal';
  const label: BoardSpaceLabel | undefined = isStart ? 'START' : isFinish ? 'FINISH' : isAction ? 'HIT' : undefined;

  return {
    index,
    x,
    y,
    bounds: {
      x: x - size / 2,
      y: y - size / 2,
      width: size,
      height: size
    },
    color,
    type,
    zone: zoneForIndex(index),
    label,
    action: isAction ? 'draw_hit_card' : null
  };
}

export const boardPath: BoardSpace[] = tilePoints.map(makeBoardSpace);
export const finishIndex = boardPath.length - 1;

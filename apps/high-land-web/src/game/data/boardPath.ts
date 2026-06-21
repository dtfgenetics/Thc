import type { BoardSpace, SpaceColor } from '../types/gameTypes';

export const boardWidth = 1280;
export const boardHeight = 960;

type TilePoint = readonly [x: number, y: number, color: Exclude<SpaceColor, 'special'> | 'hit'];

// Centers extracted from the authored 1280x960 path, ordered from START to FINISH.
const tilePoints: TilePoint[] = [
  [237.6, 907.9, 'purple'], [304.1, 900.8, 'red'], [366.2, 871.1, 'yellow'],
  [415.2, 824.6, 'blue'], [462.7, 777.1, 'green'], [521.8, 757.3, 'red'],
  [578.1, 766.0, 'purple'], [628.7, 794.5, 'blue'], [674.0, 835.1, 'yellow'],
  [722.6, 874.6, 'red'], [778.8, 907.8, 'purple'], [842.8, 907.8, 'purple'],
  [903.3, 917.8, 'yellow'], [964.9, 913.9, 'red'], [1016.3, 884.7, 'green'],
  [1023.9, 834.0, 'yellow'], [978.8, 801.4, 'purple'], [917.8, 796.0, 'red'],
  [856.8, 796.6, 'blue'], [797.6, 793.7, 'green'], [737.8, 777.5, 'yellow'],
  [686.7, 744.0, 'purple'], [672.2, 691.6, 'red'], [715.9, 657.6, 'green'],
  [776.1, 666.7, 'blue'], [834.6, 684.6, 'yellow'], [893.6, 703.3, 'purple'],
  [948.6, 726.0, 'hit'], [1013.5, 734.4, 'blue'], [1071.6, 735.0, 'green'],
  [1123.2, 711.5, 'yellow'], [1154.2, 660.6, 'red'], [1150.4, 599.0, 'blue'],
  [1112.6, 558.6, 'green'], [1057.2, 547.9, 'red'], [995.3, 563.3, 'purple'],
  [925.3, 581.6, 'yellow'], [858.9, 585.7, 'purple'], [801.4, 561.5, 'red'],
  [747.5, 530.0, 'green'], [693.3, 507.4, 'blue'], [636.1, 495.9, 'yellow'],
  [578.5, 500.1, 'red'], [525.0, 515.6, 'purple'], [481.1, 549.6, 'red'],
  [447.4, 597.2, 'yellow'], [413.9, 646.7, 'blue'], [371.3, 690.0, 'red'],
  [315.6, 722.6, 'purple'], [251.7, 737.9, 'green'], [189.2, 736.8, 'blue'],
  [130.5, 716.5, 'yellow'], [83.3, 676.1, 'red'], [67.0, 617.5, 'green'],
  [87.9, 569.0, 'purple'], [131.3, 544.1, 'red'], [184.2, 540.7, 'yellow'],
  [238.1, 557.4, 'blue'], [301.7, 572.9, 'red'], [360.9, 546.4, 'green'],
  [357.2, 490.0, 'blue'], [308.5, 459.9, 'green'], [262.4, 426.6, 'yellow'],
  [257.2, 373.3, 'red'], [299.9, 333.8, 'green'], [358.6, 320.5, 'blue'],
  [416.7, 325.4, 'yellow'], [472.1, 344.9, 'purple'], [523.9, 371.3, 'red'],
  [577.7, 399.2, 'green'], [635.3, 432.0, 'hit'], [696.1, 443.2, 'blue'],
  [754.9, 458.3, 'red'], [814.0, 468.7, 'purple'], [873.1, 476.2, 'yellow'],
  [933.0, 481.9, 'blue'], [997.7, 477.8, 'red'], [1061.9, 456.2, 'yellow'],
  [1115.9, 419.7, 'blue'], [1137.1, 365.4, 'purple'], [1116.8, 310.5, 'red'],
  [1066.2, 277.8, 'blue'], [1014.2, 243.3, 'yellow'], [976.2, 190.1, 'hit'],
  [925.1, 157.1, 'red'], [872.6, 168.6, 'purple'], [835.3, 210.1, 'yellow'],
  [813.5, 264.2, 'blue'], [788.5, 315.7, 'green'], [746.0, 357.3, 'red'],
  [688.1, 365.3, 'purple'], [632.6, 347.7, 'yellow'], [583.3, 317.7, 'blue'],
  [534.1, 285.7, 'green'], [479.2, 261.9, 'red'], [420.8, 251.5, 'purple'],
  [366.0, 260.9, 'hit'], [300.3, 268.0, 'blue'], [240.6, 275.0, 'green'],
  [180.4, 263.8, 'yellow'], [128.0, 233.1, 'purple'], [101.1, 179.9, 'red'],
  [108.3, 121.7, 'yellow'], [145.6, 78.6, 'green'], [202.3, 54.9, 'red'],
  [261.1, 55.2, 'purple'], [318.2, 72.7, 'yellow'], [369.4, 103.0, 'blue'],
  [419.2, 134.1, 'red'], [475.1, 163.6, 'green'], [536.9, 187.3, 'blue']
];

export const actionSpaceIndexes = tilePoints
  .map(([, , color], index) => color === 'hit' ? index : -1)
  .filter((index) => index >= 0);

function zoneForIndex(index: number): string {
  if (index < 16) return 'Rolling Hills';
  if (index < 32) return 'Dankwood Forest';
  if (index < 48) return 'Rosin Rail Station';
  if (index < 64) return 'Munchie Mountain';
  if (index < 80) return 'Kief Caves';
  if (index < 96) return 'Trichome Towers';
  return 'Cloud 9 Citadel';
}

export const boardPath: BoardSpace[] = tilePoints.map(([x, y, printedColor], index) => {
  const isStart = index === 0;
  const isFinish = index === tilePoints.length - 1;
  const isAction = printedColor === 'hit';
  return {
    index,
    x,
    y,
    color: isStart || isFinish || isAction ? 'special' : printedColor,
    type: isStart ? 'start' : isFinish ? 'finish' : isAction ? 'action' : 'normal',
    zone: zoneForIndex(index),
    label: isStart ? 'START' : isFinish ? 'FINISH' : isAction ? 'HIT' : undefined
  };
});

export const finishIndex = boardPath.length - 1;

import type { BoardSpace, SpaceColor } from '../types/gameTypes';

export const boardWidth = 1280;
export const boardHeight = 960;

const colors: SpaceColor[] = ['red', 'yellow', 'green', 'blue', 'purple'];

// Percent coordinates follow the single printed route from START to FINISH.
const pathPercentCoordinates = [
  [35.6, 77.8], [39.7, 74.9], [44.2, 73.1], [49.2, 74.1], [53.7, 78.1],
  [58.1, 82.0], [63.2, 84.0], [68.7, 83.9], [74.1, 82.3], [78.0, 78.8],
  [78.0, 74.7], [73.0, 73.6], [67.5, 73.6], [61.8, 73.7], [56.1, 72.0],
  [52.4, 68.2], [52.4, 63.7], [56.9, 61.8], [62.1, 62.2], [67.7, 63.2],
  [73.4, 63.2], [79.3, 61.0], [84.0, 56.8], [84.5, 51.3], [80.6, 48.4],
  [74.9, 48.8], [68.9, 50.1], [63.2, 50.3], [57.4, 48.7], [51.7, 46.8],
  [46.0, 46.0], [41.0, 47.8], [37.5, 52.3], [34.8, 58.2], [31.1, 63.8],
  [26.1, 67.0], [20.4, 67.0], [14.8, 65.3], [9.9, 61.6], [8.4, 56.1],
  [10.9, 51.6], [16.4, 50.2], [22.2, 51.3], [27.5, 49.4], [30.2, 44.4],
  [28.0, 40.7], [23.7, 38.9], [21.6, 35.2], [24.9, 31.7], [30.7, 30.5],
  [36.6, 31.0], [42.4, 33.0], [48.2, 35.5], [54.0, 37.6], [60.0, 38.4],
  [65.9, 38.4], [71.8, 37.6], [78.0, 35.6], [83.2, 31.7], [84.2, 26.6],
  [80.6, 22.6], [75.2, 21.7], [70.5, 24.7], [67.4, 29.5], [62.4, 32.2],
  [56.6, 32.1], [50.8, 30.4], [45.0, 28.1], [39.4, 25.8], [33.7, 24.4],
  [27.8, 23.6], [21.7, 23.5], [16.0, 22.0], [11.9, 18.4], [12.6, 13.1],
  [17.2, 9.7], [23.1, 9.6], [28.7, 11.3], [34.3, 13.8], [40.0, 16.2],
  [40.1, 13.4], [40.2, 10.5], [40.3, 7.8]
];

export const actionSpaceIndexes = [4, 10, 15, 22, 28, 34, 41, 47, 53, 60, 66, 72, 78];
const actionIndexes = new Set(actionSpaceIndexes);

function zoneForIndex(index: number): string {
  if (index < 12) return 'Rolling Hills';
  if (index < 24) return 'Dankwood Forest';
  if (index < 36) return 'Rosin Rail Station';
  if (index < 48) return 'Munchie Mountain';
  if (index < 60) return 'Kief Caves';
  if (index < 76) return 'Trichome Towers';
  return 'Cloud 9 Citadel';
}

export const boardPath: BoardSpace[] = pathPercentCoordinates.map(([xPercent, yPercent], index) => {
  const isStart = index === 0;
  const isFinish = index === pathPercentCoordinates.length - 1;
  const isAction = actionIndexes.has(index);
  const type = isStart ? 'start' : isFinish ? 'finish' : isAction ? 'action' : 'normal';

  return {
    index,
    x: (xPercent / 100) * boardWidth,
    y: (yPercent / 100) * boardHeight,
    color: isStart || isFinish || isAction ? 'special' : colors[index % colors.length],
    type,
    zone: zoneForIndex(index),
    label: isStart ? 'START' : isFinish ? 'FINISH' : isAction ? 'HIT' : undefined
  };
});

export const finishIndex = boardPath.length - 1;

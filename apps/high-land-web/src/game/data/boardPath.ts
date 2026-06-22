import type { BoardSpace, SpaceColor } from '../types/gameTypes';

const colors: SpaceColor[] = ['red', 'yellow', 'green', 'blue', 'purple'];

const points = [
  [84, 548], [137, 518], [191, 493], [245, 469], [304, 448], [367, 428], [429, 411], [488, 390],
  [542, 361], [587, 323], [611, 278], [600, 233], [557, 203], [499, 192], [436, 202], [382, 231],
  [346, 274], [340, 323], [365, 369], [416, 401], [478, 415], [543, 430], [604, 455], [650, 495],
  [666, 543], [647, 589], [600, 621], [535, 637], [467, 641], [397, 632], [330, 616], [270, 596],
  [214, 575], [162, 553], [112, 526], [78, 486], [74, 438], [104, 395], [158, 365], [221, 343],
  [285, 322], [347, 297], [407, 267], [466, 238], [527, 216], [589, 209], [648, 229], [690, 269],
  [707, 320], [698, 373], [666, 423], [620, 466], [566, 502], [506, 532], [441, 556], [376, 576],
  [309, 594], [242, 613], [178, 638], [124, 676], [92, 728], [104, 781], [153, 812], [220, 818],
  [291, 803], [362, 781], [432, 756], [503, 735], [573, 722], [640, 726], [696, 755], [728, 806]
];

const actionIndexes = new Set([6, 13, 21, 28, 35, 42, 50, 58, 65]);
const skipIndexes = new Set([17, 47]);

function zoneForIndex(index: number): string {
  if (index < 10) return 'Rolling Hills';
  if (index < 20) return 'Dankwood Forest';
  if (index < 30) return 'Rosin Rail Station';
  if (index < 42) return 'Munchie Mountain';
  if (index < 53) return 'Kief Caves';
  if (index < 65) return 'Trichome Towers';
  return 'Cloud 9 Citadel';
}

export const boardPath: BoardSpace[] = points.map(([x, y], index) => {
  const isStart = index === 0;
  const isFinish = index === points.length - 1;
  const type = isStart
    ? 'start'
    : isFinish
      ? 'finish'
      : actionIndexes.has(index)
        ? 'action'
        : skipIndexes.has(index)
          ? 'skip'
          : 'normal';

  return {
    index,
    x,
    y,
    color: isStart || isFinish || type === 'action' || type === 'skip' ? 'special' : colors[index % colors.length],
    type,
    zone: zoneForIndex(index),
    label: isStart ? 'START' : isFinish ? 'FINISH' : type === 'action' ? 'HIT' : type === 'skip' ? 'SKIP' : undefined
  };
});

export const finishIndex = boardPath.length - 1;

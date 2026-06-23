import type { BoardSpace, SpaceColor } from '../types/gameTypes';

export const approvedBoardSpaceCount = 109;
export const approvedHitSpaceCount = 22;
export const approvedNonHitRoadSpaceCount = approvedBoardSpaceCount - approvedHitSpaceCount;

const colors: SpaceColor[] = ['red', 'yellow', 'green', 'blue', 'purple'];

/**
 * Approved High Land road manifest.
 *
 * The live/approved board image has:
 * - 109 total colored road spaces
 * - 22 HIT spaces
 * - 87 non-HIT colored road spaces
 *
 * START / FINISH plaques and the side TAKE A HIT card art are not counted as
 * road spaces. Index 0 and index 108 represent the first and last playable
 * road spaces on the path so movement still has a start and finish target.
 */
const points = [
  [84, 548], [119, 528], [156, 509], [193, 492], [230, 476], [268, 461],
  [306, 447], [345, 435], [384, 423], [423, 413], [462, 399], [499, 384],
  [535, 365], [567, 340], [594, 310], [610, 273], [600, 234], [567, 210],
  [529, 198], [489, 194], [449, 200], [412, 215], [378, 236], [351, 268],
  [342, 306], [351, 344], [375, 375], [410, 397], [448, 408], [488, 417],
  [528, 427], [566, 440], [604, 455], [635, 482], [656, 514], [662, 553],
  [646, 590], [612, 613], [575, 627], [535, 637], [494, 639], [453, 639],
  [412, 634], [372, 626], [333, 617], [294, 604], [256, 591], [220, 577],
  [184, 562], [149, 546], [113, 526], [85, 498], [74, 461], [84, 424],
  [107, 393], [141, 374], [179, 358], [217, 344], [256, 332], [295, 318],
  [333, 303], [370, 286], [406, 267], [443, 248], [481, 233], [519, 219],
  [559, 213], [599, 212], [636, 224], [670, 248], [695, 279], [705, 318],
  [700, 359], [682, 396], [655, 428], [626, 461], [594, 484], [558, 506],
  [522, 525], [484, 540], [446, 555], [407, 566], [368, 578], [329, 589],
  [289, 600], [250, 611], [212, 624], [176, 639], [143, 662], [114, 690],
  [94, 725], [97, 765], [122, 796], [160, 813], [202, 817], [243, 813],
  [284, 804], [324, 793], [364, 780], [403, 766], [441, 753], [480, 741],
  [520, 732], [560, 724], [600, 724], [641, 726], [677, 745], [706, 771],
  [728, 806]
];

const actionIndexes = new Set([
  5, 9, 14, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 84, 88, 92, 97, 102, 106
]);

function zoneForIndex(index: number): string {
  if (index < 15) return 'Rolling Hills';
  if (index < 31) return 'Dankwood Forest';
  if (index < 46) return 'Rosin Rail Station';
  if (index < 62) return 'Munchie Mountain';
  if (index < 78) return 'Kief Caves';
  if (index < 94) return 'Trichome Towers';
  return 'Cloud 9 Citadel';
}

export const boardPath: BoardSpace[] = points.map(([x, y], index) => {
  const isStart = index === 0;
  const isFinish = index === points.length - 1;
  const isAction = actionIndexes.has(index);
  const type = isStart ? 'start' : isFinish ? 'finish' : isAction ? 'action' : 'normal';

  return {
    index,
    x,
    y,
    color: isAction ? 'special' : colors[index % colors.length],
    type,
    zone: zoneForIndex(index),
    label: isAction ? 'HIT' : undefined
  };
});

export const finishIndex = boardPath.length - 1;

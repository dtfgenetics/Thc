import type { BoardSpace, BoardSpaceLabel, BoardSpaceType, SpaceColor } from '../types/gameTypes';

export const approvedBoardSpaceCount = 109;
export const approvedHitSpaceCount = 22;
export const approvedNonHitRoadSpaceCount = approvedBoardSpaceCount - approvedHitSpaceCount;

const defaultSpaceSize = 34;
const colors: SpaceColor[] = ['red', 'yellow', 'green', 'blue', 'purple'];

type BoardPoint = {
  x: number;
  y: number;
  size?: number;
};

const points: BoardPoint[] = [
  { x: 84, y: 548 }, { x: 119, y: 528 }, { x: 156, y: 509 }, { x: 193, y: 492 }, { x: 230, y: 476 }, { x: 268, y: 461 },
  { x: 306, y: 447 }, { x: 345, y: 435 }, { x: 384, y: 423 }, { x: 423, y: 413 }, { x: 462, y: 399 }, { x: 499, y: 384 },
  { x: 535, y: 365 }, { x: 567, y: 340 }, { x: 594, y: 310 }, { x: 610, y: 273 }, { x: 600, y: 234 }, { x: 567, y: 210 },
  { x: 529, y: 198 }, { x: 489, y: 194 }, { x: 449, y: 200 }, { x: 412, y: 215 }, { x: 378, y: 236 }, { x: 351, y: 268 },
  { x: 342, y: 306 }, { x: 351, y: 344 }, { x: 375, y: 375 }, { x: 410, y: 397 }, { x: 448, y: 408 }, { x: 488, y: 417 },
  { x: 528, y: 427 }, { x: 566, y: 440 }, { x: 604, y: 455 }, { x: 635, y: 482 }, { x: 656, y: 514 }, { x: 662, y: 553 },
  { x: 646, y: 590 }, { x: 612, y: 613 }, { x: 575, y: 627 }, { x: 535, y: 637 }, { x: 494, y: 639 }, { x: 453, y: 639 },
  { x: 412, y: 634 }, { x: 372, y: 626 }, { x: 333, y: 617 }, { x: 294, y: 604 }, { x: 256, y: 591 }, { x: 220, y: 577 },
  { x: 184, y: 562 }, { x: 149, y: 546 }, { x: 113, y: 526 }, { x: 85, y: 498 }, { x: 74, y: 461 }, { x: 84, y: 424 },
  { x: 107, y: 393 }, { x: 141, y: 374 }, { x: 179, y: 358 }, { x: 217, y: 344 }, { x: 256, y: 332 }, { x: 295, y: 318 },
  { x: 333, y: 303 }, { x: 370, y: 286 }, { x: 406, y: 267 }, { x: 443, y: 248 }, { x: 481, y: 233 }, { x: 519, y: 219 },
  { x: 559, y: 213 }, { x: 599, y: 212 }, { x: 636, y: 224 }, { x: 670, y: 248 }, { x: 695, y: 279 }, { x: 705, y: 318 },
  { x: 700, y: 359 }, { x: 682, y: 396 }, { x: 655, y: 428 }, { x: 626, y: 461 }, { x: 594, y: 484 }, { x: 558, y: 506 },
  { x: 522, y: 525 }, { x: 484, y: 540 }, { x: 446, y: 555 }, { x: 407, y: 566 }, { x: 368, y: 578 }, { x: 329, y: 589 },
  { x: 289, y: 600 }, { x: 250, y: 611 }, { x: 212, y: 624 }, { x: 176, y: 639 }, { x: 143, y: 662 }, { x: 114, y: 690 },
  { x: 94, y: 725 }, { x: 97, y: 765 }, { x: 122, y: 796 }, { x: 160, y: 813 }, { x: 202, y: 817 }, { x: 243, y: 813 },
  { x: 284, y: 804 }, { x: 324, y: 793 }, { x: 364, y: 780 }, { x: 403, y: 766 }, { x: 441, y: 753 }, { x: 480, y: 741 },
  { x: 520, y: 732 }, { x: 560, y: 724 }, { x: 600, y: 724 }, { x: 641, y: 726 }, { x: 677, y: 745 }, { x: 706, y: 771 },
  { x: 728, y: 806 }
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

function makeBoardSpace(point: BoardPoint, index: number): BoardSpace {
  const isStart = index === 0;
  const isFinish = index === points.length - 1;
  const isAction = actionIndexes.has(index);
  const size = point.size ?? defaultSpaceSize;
  const type: BoardSpaceType = isStart ? 'start' : isFinish ? 'finish' : isAction ? 'action' : 'normal';
  const label: BoardSpaceLabel | undefined = isStart ? 'START' : isFinish ? 'FINISH' : isAction ? 'HIT' : undefined;

  return {
    index,
    x: point.x,
    y: point.y,
    bounds: {
      x: point.x - size / 2,
      y: point.y - size / 2,
      width: size,
      height: size
    },
    color: colors[index % colors.length],
    type,
    zone: zoneForIndex(index),
    label,
    action: isAction ? 'draw_hit_card' : null
  };
}

export const boardPath: BoardSpace[] = points.map(makeBoardSpace);

export const finishIndex = boardPath.length - 1;
import { findCueForPosition, findTransition, isBlocked } from './maps.js';

export const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

export function movePlayer(saveData, map, direction) {
  const delta = DIRECTIONS[direction];
  if (!delta) return { saveData, moved: false, transition: null, cue: null };

  const nextX = saveData.player.position.x + delta.x;
  const nextY = saveData.player.position.y + delta.y;

  if (isBlocked(map, nextX, nextY)) {
    return { saveData, moved: false, transition: null, cue: null };
  }

  const transition = findTransition(map, nextX, nextY, saveData.quests.flags);
  const cue = findCueForPosition(map, nextX, nextY);

  const nextSave = {
    ...saveData,
    player: {
      ...saveData.player,
      position: { x: nextX, y: nextY }
    },
    world: {
      ...saveData.world,
      cue: cue ?? saveData.world.cue
    }
  };

  return { saveData: nextSave, moved: true, transition, cue };
}

export function applyTransition(saveData, transition) {
  if (!transition) return saveData;

  return {
    ...saveData,
    player: {
      ...saveData.player,
      currentMap: transition.targetMap,
      position: { ...transition.targetPosition }
    }
  };
}

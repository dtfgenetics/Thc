export function getFacingPosition(player, direction = player.facing ?? 'down') {
  const deltas = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 }
  };
  const delta = deltas[direction] ?? deltas.down;
  return {
    x: player.position.x + delta.x,
    y: player.position.y + delta.y
  };
}

export function findNpcAt(map, position) {
  return (map.npcs ?? []).find((npc) => npc.x === position.x && npc.y === position.y) ?? null;
}

export function findObjectAt(map, position) {
  return (map.objects ?? []).find((object) => object.x === position.x && object.y === position.y) ?? null;
}

export function resolveInteraction({ map, saveData, direction }) {
  const targetPosition = getFacingPosition(saveData.player, direction);
  const npc = findNpcAt(map, targetPosition);

  if (npc) {
    return {
      type: 'npc',
      target: npc,
      dialogueId: npc.dialogueId ?? null,
      position: targetPosition
    };
  }

  const object = findObjectAt(map, targetPosition);
  if (object) {
    return {
      type: 'object',
      target: object,
      dialogueId: object.dialogueId ?? null,
      position: targetPosition
    };
  }

  return {
    type: 'none',
    target: null,
    dialogueId: null,
    position: targetPosition
  };
}

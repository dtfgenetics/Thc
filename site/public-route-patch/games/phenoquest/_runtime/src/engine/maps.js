export function getMap(maps, mapId) {
  return maps.find((map) => map.id === mapId) ?? null;
}

export function isBlocked(map, x, y) {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return true;
  return map.blocked?.some((tile) => tile.x === x && tile.y === y) ?? false;
}

export function findTransition(map, x, y, flags = {}) {
  return map.transitions?.find((transition) => {
    const matchesPosition = transition.x === x && transition.y === y;
    const allowed = !transition.requiresFlag || flags[transition.requiresFlag];
    return matchesPosition && allowed;
  }) ?? null;
}

export function findCueForPosition(map, x, y) {
  const zone = map.cueZones?.find((cueZone) => {
    return x >= cueZone.x && x < cueZone.x + cueZone.w && y >= cueZone.y && y < cueZone.y + cueZone.h;
  });

  return zone?.cue ?? null;
}

export function findEncounterZone(map, x, y) {
  return map.encounterZones?.find((zone) => {
    return x >= zone.x && x < zone.x + zone.w && y >= zone.y && y < zone.y + zone.h;
  }) ?? null;
}

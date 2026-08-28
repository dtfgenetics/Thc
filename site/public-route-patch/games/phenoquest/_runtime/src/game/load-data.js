import { fetchJson } from '../data/fetch-json.js';
import { GAME_CONFIG } from './config.js';

export async function loadGameData(paths = GAME_CONFIG.dataPaths) {
  const mapPaths = paths.maps ?? [];
  const scalarEntries = Object.entries(paths).filter(([key]) => key !== 'maps');

  const loadedEntries = await Promise.all(
    scalarEntries.map(async ([key, path]) => [key, await fetchJson(path)])
  );
  const maps = await Promise.all(mapPaths.map((path) => fetchJson(path)));

  return {
    ...Object.fromEntries(loadedEntries),
    maps
  };
}

export function getAllUnits(data) {
  return [...(data.starters ?? []), ...(data.extraUnits ?? [])];
}

export function getSpecies(data, speciesId) {
  return getAllUnits(data).find((unit) => unit.id === speciesId) ?? null;
}

export function getResultUnit(data, resultId) {
  return data.resultUnits?.find((unit) => unit.id === resultId) ?? null;
}

export function getDisplayName(data, id) {
  return getSpecies(data, id)?.displayName ?? getResultUnit(data, id)?.displayName ?? id;
}

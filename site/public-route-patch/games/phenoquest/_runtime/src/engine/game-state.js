export function setStarterChoice(saveData, starterId, starterUnit) {
  return {
    ...saveData,
    player: {
      ...saveData.player,
      starterChoice: starterId
    },
    team: [starterUnit, ...saveData.team.filter((unit) => unit.speciesId !== starterId)]
  };
}

export function setWorldCondition(saveData, { weather, cue }) {
  return {
    ...saveData,
    world: {
      ...saveData.world,
      weather: weather ?? saveData.world.weather,
      cue: cue ?? saveData.world.cue
    }
  };
}

export function addTeamUnit(saveData, unit) {
  const team = [...saveData.team];
  if (team.length < 3) {
    team.push(unit);
  }

  return {
    ...saveData,
    team
  };
}

export function addStoredUnit(saveData, unit) {
  return {
    ...saveData,
    vaultGarden: {
      ...(saveData.vaultGarden ?? {}),
      rootedUnits: [...(saveData.vaultGarden?.rootedUnits ?? []), unit]
    }
  };
}

export function updateRegionProgress(saveData, regionId, value) {
  return {
    ...saveData,
    world: {
      ...saveData.world,
      regionProgress: {
        ...saveData.world.regionProgress,
        [regionId]: Math.max(saveData.world.regionProgress?.[regionId] ?? 0, value)
      }
    }
  };
}

export function updateArchiveProgress(saveData, branchId, value) {
  return {
    ...saveData,
    world: {
      ...saveData.world,
      archiveProgress: {
        ...saveData.world.archiveProgress,
        [branchId]: Math.max(saveData.world.archiveProgress?.[branchId] ?? 0, value)
      }
    }
  };
}

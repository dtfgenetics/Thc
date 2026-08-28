import { previewPairing } from './breeding.js';
import { getProgressionState } from './progression.js';

export function getLineageCandidates(saveData) {
  const candidates = [];

  for (const teamUnit of saveData.team ?? []) {
    candidates.push({
      source: 'team',
      speciesId: teamUnit.speciesId,
      unit: teamUnit
    });
  }

  for (const storedUnit of saveData.vaultGarden?.rootedUnits ?? []) {
    candidates.push({
      source: 'vault_garden',
      speciesId: storedUnit.speciesId,
      unit: storedUnit
    });
  }

  return candidates;
}

export function getLineagePreviews({ saveData, pairingRules }) {
  const candidates = getLineageCandidates(saveData);
  const previews = [];

  for (let i = 0; i < candidates.length; i += 1) {
    for (let j = i + 1; j < candidates.length; j += 1) {
      const preview = previewPairing({
        rules: pairingRules,
        parentA: candidates[i].speciesId,
        parentB: candidates[j].speciesId,
        playerState: getProgressionState(saveData)
      });

      if (preview.reason !== 'no_pairing_rule') {
        previews.push({
          parentA: candidates[i],
          parentB: candidates[j],
          preview
        });
      }
    }
  }

  return previews;
}

export function getFirstLineagePreview({ saveData, pairingRules }) {
  return getLineagePreviews({ saveData, pairingRules })[0] ?? null;
}

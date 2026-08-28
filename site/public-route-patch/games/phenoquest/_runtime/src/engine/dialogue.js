export function getDialogue(dialogueRecords, dialogueId) {
  return dialogueRecords.find((entry) => entry.id === dialogueId) ?? null;
}

export function canShowDialogue(dialogue, saveData) {
  if (!dialogue) return false;
  if (!dialogue.requiresQuest) return true;
  return saveData.quests.activeQuest === dialogue.requiresQuest;
}

export function applyDialogueEffects(saveData, dialogue) {
  if (!dialogue?.setsFlag) return saveData;

  return {
    ...saveData,
    quests: {
      ...saveData.quests,
      flags: {
        ...saveData.quests.flags,
        [dialogue.setsFlag]: true
      }
    }
  };
}

export function getDialogueText(dialogue) {
  if (!dialogue) return '';
  return dialogue.lines.join('\n');
}

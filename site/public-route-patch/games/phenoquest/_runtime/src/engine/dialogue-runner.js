export function getDialogueRecord(dialogueRecords, dialogueId) {
  return dialogueRecords.find((record) => record.id === dialogueId) ?? null;
}

export function canStartDialogue(record, saveData) {
  if (!record) return false;
  if (record.requiresQuest && saveData.quests?.activeQuest !== record.requiresQuest) return false;
  if (record.requiresFlag && saveData.quests?.flags?.[record.requiresFlag] !== true) return false;
  return true;
}

export function createDialogueSession(dialogueRecords, dialogueId, saveData) {
  const record = getDialogueRecord(dialogueRecords, dialogueId);

  if (!canStartDialogue(record, saveData)) {
    return {
      active: false,
      reason: record ? 'requirements_not_met' : 'missing_dialogue',
      record: null,
      lineIndex: 0,
      awaitingChoice: false
    };
  }

  return {
    active: true,
    reason: 'started',
    record,
    lineIndex: 0,
    awaitingChoice: false
  };
}

export function getCurrentDialogueLine(session) {
  if (!session?.active || !session.record) return null;
  return session.record.lines?.[session.lineIndex] ?? null;
}

export function hasDialogueChoices(session) {
  if (!session?.active || !session.record) return false;
  return Boolean(session.record.choices?.length) && session.lineIndex >= (session.record.lines?.length ?? 1) - 1;
}

export function getDialogueChoices(session) {
  return hasDialogueChoices(session) ? session.record.choices : [];
}

export function advanceDialogueSession(session, dialogueRecords) {
  if (!session?.active || !session.record) return session;

  const nextLineIndex = session.lineIndex + 1;
  const hasNextLine = nextLineIndex < (session.record.lines?.length ?? 0);

  if (hasNextLine) {
    return {
      ...session,
      lineIndex: nextLineIndex,
      awaitingChoice: false
    };
  }

  if (session.record.choices?.length) {
    return {
      ...session,
      awaitingChoice: true,
      reason: 'awaiting_choice'
    };
  }

  if (session.record.next) {
    const nextRecord = getDialogueRecord(dialogueRecords, session.record.next);
    return {
      active: Boolean(nextRecord),
      reason: nextRecord ? 'advanced_to_next_record' : 'missing_next_dialogue',
      record: nextRecord,
      lineIndex: 0,
      awaitingChoice: false
    };
  }

  return {
    ...session,
    active: false,
    reason: 'complete',
    awaitingChoice: false
  };
}

export function selectDialogueChoice(session, dialogueRecords, choiceId) {
  if (!session?.active || !session.record?.choices?.length) {
    return {
      session,
      choice: null
    };
  }

  const choice = session.record.choices.find((item) => item.id === choiceId) ?? null;
  if (!choice) {
    return {
      session,
      choice: null
    };
  }

  const nextRecord = choice.next ? getDialogueRecord(dialogueRecords, choice.next) : null;

  return {
    choice,
    session: {
      active: Boolean(nextRecord),
      reason: nextRecord ? 'choice_selected' : 'choice_completed',
      record: nextRecord,
      lineIndex: 0,
      awaitingChoice: false
    }
  };
}

export function applyDialogueEffects(saveData, recordOrChoice) {
  if (!recordOrChoice) return saveData;

  const flags = { ...(saveData.quests?.flags ?? {}) };
  if (recordOrChoice.setsFlag) flags[recordOrChoice.setsFlag] = true;

  return {
    ...saveData,
    quests: {
      ...saveData.quests,
      flags
    }
  };
}

export function getActiveQuest(quests, activeQuestId) {
  return quests.find((quest) => quest.id === activeQuestId) ?? null;
}

export function completeQuest(saveData, quest) {
  const completed = new Set(saveData.quests.completed);
  completed.add(quest.id);

  return {
    ...saveData,
    quests: {
      ...saveData.quests,
      activeQuest: quest.nextQuest,
      completed: Array.from(completed)
    }
  };
}

export function setQuestFlag(saveData, flag, value = true) {
  return {
    ...saveData,
    quests: {
      ...saveData.quests,
      flags: {
        ...saveData.quests.flags,
        [flag]: value
      }
    }
  };
}

export function hasQuestFlag(saveData, flag) {
  return Boolean(saveData.quests.flags?.[flag]);
}

export function isQuestCompleted(saveData, questId) {
  return saveData.quests.completed.includes(questId);
}

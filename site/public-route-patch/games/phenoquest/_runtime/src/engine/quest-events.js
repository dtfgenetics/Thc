const QUEST_EVENT_MAP = {
  starter_chosen: {
    activeQuest: 'choose_your_echo',
    nextQuest: 'first_field_test',
    flag: 'starter_chosen',
    extraFlags: ['terp_fields_access']
  },
  first_battle_won: {
    activeQuest: 'first_field_test',
    nextQuest: 'stolen_vault_tag',
    flag: 'tutorial_battle_complete'
  },
  first_material_earned: {
    activeQuest: 'first_material',
    nextQuest: 'root_first_unit',
    flag: 'first_material_earned'
  },
  first_result_claimed: {
    activeQuest: 'root_first_unit',
    nextQuest: 'nova_challenge',
    flag: 'first_result_claimed',
    playerRank: 'field_scout',
    unlockRegions: ['terp_fields'],
    extraFlags: ['lineage_preview_unlocked']
  },
  signal_clamp_cleared: {
    activeQuest: 'signal_clamp',
    nextQuest: 'aroma_trial',
    flag: 'signal_clamp_cleared'
  },
  aroma_trial_complete: {
    activeQuest: 'aroma_trial',
    nextQuest: 'demo_complete',
    flag: 'aroma_trial_complete',
    playerRank: 'pheno_hunter'
  }
};

function applyExtraFlags(flags, event) {
  const output = { ...flags, [event.flag]: true };
  for (const flag of event.extraFlags ?? []) {
    output[flag] = true;
  }
  return output;
}

function applyUnlockedRegions(world, event) {
  const unlockedRegions = new Set(world.unlockedRegions ?? []);
  for (const region of event.unlockRegions ?? []) {
    unlockedRegions.add(region);
  }
  return {
    ...world,
    unlockedRegions: Array.from(unlockedRegions)
  };
}

export function applyQuestEvent(saveData, eventId) {
  const event = QUEST_EVENT_MAP[eventId];
  if (!event) return saveData;

  const completed = new Set(saveData.quests.completed ?? []);
  if (saveData.quests.activeQuest === event.activeQuest) {
    completed.add(event.activeQuest);
  }

  return {
    ...saveData,
    player: {
      ...saveData.player,
      rank: event.playerRank ?? saveData.player.rank
    },
    world: applyUnlockedRegions(saveData.world, event),
    quests: {
      ...saveData.quests,
      activeQuest: saveData.quests.activeQuest === event.activeQuest ? event.nextQuest : saveData.quests.activeQuest,
      completed: Array.from(completed),
      flags: applyExtraFlags(saveData.quests.flags, event)
    }
  };
}

export function getQuestEventIds() {
  return Object.keys(QUEST_EVENT_MAP);
}

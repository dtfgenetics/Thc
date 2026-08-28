export const GAME_CONFIG = {
  title: 'PhenoQuest: The Living Seed Vault',
  version: '0.1.0',
  route: '/games/phenoquest',
  mvp: {
    startMap: 'seedling_town',
    firstRegion: 'terp_fields',
    defaultWeather: 'clear_bloom',
    defaultCue: 'light_exposure',
    cloneSlotsAtStart: 1
  },
  storage: {
    saveKey: 'phenoquest_save_v0_1'
  },
  dataPaths: {
    expressions: '/data/expressions/expression_matrix_mvp.json',
    starters: '/data/phenos/mvp_units.json',
    extraUnits: '/data/phenos/mvp_units_extra.json',
    encounters: '/data/encounters/terp_fields.json',
    items: '/data/items/mvp_items.json',
    abilities: '/data/moves/mvp_abilities.json',
    quests: '/data/quests/mvp_quests.json',
    dialogue: '/data/dialogue/mvp_dialogue.json',
    starterSlots: '/data/starter_slots.json',
    weatherStates: '/data/weather/weather_states.json',
    genotypeMarkers: '/data/breeding/genotype_markers.json',
    pairingRules: '/data/breeding/pairing_rules_mvp.json',
    resultUnits: '/data/breeding/result_units_mvp.json',
    fileManifest: '/data/system/file_manifest.json',
    assetManifest: '/data/system/asset_manifest.json',
    mechanicRegistry: '/data/system/mechanic_registry.json',
    maps: [
      '/data/maps/seedling_town.json',
      '/data/maps/greenhouse.json',
      '/data/maps/terp_fields.json',
      '/data/maps/aroma_trial_greenhouse.json'
    ]
  }
};

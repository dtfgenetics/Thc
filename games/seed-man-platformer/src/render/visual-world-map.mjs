const WORLD_TITLE_TO_VISUAL = Object.freeze({
  'greenhouse district': 'greenhouse-valley',
  rootworks: 'forest-ruins',
  'resin works': 'desert-canyon',
  'sky garden': 'frozen-peak',
  'genetic frontier': 'eco-city'
});

const THEME_HINTS = Object.freeze([
  ['greenhouse', 'greenhouse-valley'],
  ['nursery', 'greenhouse-valley'],
  ['reservoir', 'greenhouse-valley'],
  ['root', 'forest-ruins'],
  ['mycel', 'forest-ruins'],
  ['forest', 'forest-ruins'],
  ['kief', 'desert-canyon'],
  ['rosin', 'desert-canyon'],
  ['terpene', 'desert-canyon'],
  ['desert', 'desert-canyon'],
  ['frost', 'frozen-peak'],
  ['ice', 'frozen-peak'],
  ['cloud', 'frozen-peak'],
  ['sky', 'frozen-peak'],
  ['genetic', 'eco-city'],
  ['genome', 'eco-city'],
  ['allele', 'eco-city'],
  ['chromosome', 'eco-city'],
  ['mutation', 'eco-city'],
  ['city', 'eco-city']
]);

export const VISUAL_WORLD_KEYS = Object.freeze([
  'greenhouse-valley',
  'forest-ruins',
  'desert-canyon',
  'frozen-peak',
  'eco-city'
]);

function normalizedText(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function resolveVisualWorldKey(level = {}) {
  const explicit = normalizedText(level.visualWorldKey || level.visualWorld || level.visualTheme);
  if (VISUAL_WORLD_KEYS.includes(explicit)) return explicit;

  const worldTitle = normalizedText(level.worldTitle);
  if (WORLD_TITLE_TO_VISUAL[worldTitle]) return WORLD_TITLE_TO_VISUAL[worldTitle];

  const haystack = [level.theme, level.setting, level.title, level.id]
    .map(normalizedText)
    .filter(Boolean)
    .join(' ');

  for (const [hint, visualKey] of THEME_HINTS) {
    if (haystack.includes(hint)) return visualKey;
  }

  return 'greenhouse-valley';
}

export function getCampaignVisualWorldMap() {
  return Object.freeze({
    'Greenhouse District': 'greenhouse-valley',
    Rootworks: 'forest-ruins',
    'Resin Works': 'desert-canyon',
    'Sky Garden': 'frozen-peak',
    'Genetic Frontier': 'eco-city'
  });
}

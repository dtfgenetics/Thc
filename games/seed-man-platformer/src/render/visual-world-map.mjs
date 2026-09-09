const WORLD_TITLE_TO_VISUAL = Object.freeze({
  'greenhouse district': 'greenhouse-valley',
  rootworks: 'forest-ruins',
  'resin works': 'desert-canyon',
  'sky garden': 'frozen-peaks',
  'genetic frontier': 'eco-city'
});

const VISUAL_WORLD_ALIASES = Object.freeze({ 'frozen-peak': 'frozen-peaks' });

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
  ['frost', 'frozen-peaks'],
  ['ice', 'frozen-peaks'],
  ['cloud', 'frozen-peaks'],
  ['sky', 'frozen-peaks'],
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
  'frozen-peaks',
  'eco-city'
]);

function normalizedText(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function resolveVisualWorldKey(level = {}) {
  const explicit = normalizedText(level.visualWorldKey || level.visualWorld || level.visualTheme);
  const canonicalExplicit = VISUAL_WORLD_ALIASES[explicit] || explicit;
  if (VISUAL_WORLD_KEYS.includes(canonicalExplicit)) return canonicalExplicit;

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
    'Sky Garden': 'frozen-peaks',
    'Genetic Frontier': 'eco-city'
  });
}

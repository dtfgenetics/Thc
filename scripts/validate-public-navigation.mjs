import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const nav = JSON.parse(fs.readFileSync(path.join(root, 'data/public-navigation.json'), 'utf8'));
const apps = JSON.parse(fs.readFileSync(path.join(root, 'site/deployment/public-apps.json'), 'utf8'));
const hub = fs.readFileSync(path.join(root, 'site/public-route-patch/games/index.html'), 'utf8');

const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };

assert(Array.isArray(nav.primaryNavigation), 'primaryNavigation must be an array');
assert(nav.primaryNavigation.length <= nav.principles.maxPrimaryNavItems, `primary navigation exceeds ${nav.principles.maxPrimaryNavItems} items`);
assert(nav.primaryNavigation.some((item) => item.cta === 'primary'), 'one primary navigation CTA is required');

const allInternal = [
  ...nav.primaryNavigation,
  ...nav.utilityNavigation,
  ...nav.homeQuickActions,
  ...(nav.learn?.sections || [])
].map((item) => item.route).filter(Boolean);

for (const route of allInternal) assert(route.startsWith('/') && route.endsWith('/'), `internal route must start and end with /: ${route}`);

const primaryIds = nav.primaryNavigation.map((item) => item.id);
assert(new Set(primaryIds).size === primaryIds.length, 'primary navigation IDs must be unique');
const primaryRoutes = nav.primaryNavigation.map((item) => item.route);
assert(new Set(primaryRoutes).size === primaryRoutes.length, 'primary navigation routes must be unique');

const appById = new Map(apps.apps.map((app) => [app.id, app]));
const publicGames = nav.games.filter((game) => game.public);
const privateGames = nav.games.filter((game) => !game.public);
const hubPlayableCount = hub.match(/<strong>(\d+)<\/strong><span>playable browser games<\/span>/i);

assert(Boolean(hubPlayableCount), 'Game Hub must expose its playable-game count');
if (hubPlayableCount) {
  assert(Number(hubPlayableCount[1]) === publicGames.length, `Game Hub playable count ${hubPlayableCount[1]} does not match ${publicGames.length} public games`);
}

for (const game of publicGames) {
  assert(Boolean(game.route), `${game.id} is public but has no route`);
  const app = appById.get(game.id);
  assert(Boolean(app), `${game.id} is public but missing from site/deployment/public-apps.json`);
  if (app && game.route) assert(app.route === game.route, `${game.id} route mismatch: nav=${game.route} deployment=${app.route}`);
  if (game.route) assert(hub.includes(`href=\"${game.route}\"`) || hub.includes(`href='${game.route}'`), `${game.id} is public but Game Hub does not link ${game.route}`);
}

for (const game of privateGames) assert(!game.route, `${game.id} is not public but still has a public route`);

const validStatuses = new Set(nav.principles.statusLabels);
for (const game of nav.games) assert(validStatuses.has(game.status), `${game.id} has unknown status ${game.status}`);

const expectedExternal = nav.external.find((item) => item.id === 'discord');
assert(expectedExternal?.url === 'https://discord.gg/xJbUeHFPMt', 'official Discord URL must remain canonical');

if (errors.length) {
  console.error(`Public navigation validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log(`Public navigation validation passed: ${nav.primaryNavigation.length} primary buttons, ${publicGames.length} public games, ${privateGames.length} development-only games.`);

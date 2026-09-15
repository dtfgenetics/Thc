import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const nav = JSON.parse(fs.readFileSync(path.join(root, 'data/public-navigation.json'), 'utf8'));
const shell = JSON.parse(fs.readFileSync(path.join(root, 'data/site-navigation-v6.json'), 'utf8'));
const apps = JSON.parse(fs.readFileSync(path.join(root, 'site/deployment/public-apps.json'), 'utf8'));
const hub = fs.readFileSync(path.join(root, 'site/public-route-patch/games/index.html'), 'utf8');

const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };

const canonicalPrimary = [
  { id: 'genetics', label: 'Genetics', route: '/seeds/' },
  { id: 'learn', label: 'Learn', route: '/learn/' },
  { id: 'tools', label: 'Tools', route: '/tools/' },
  { id: 'games', label: 'Games', route: '/games/' },
  { id: 'community', label: 'Community', route: '/community/' },
  { id: 'shop', label: 'Shop', route: '/shop/' }
];

assert(shell.status === 'canonical', 'site-navigation-v6 must be marked canonical');
assert(shell.brandHome?.route === '/', 'DTF Genetics brand must remain the Home control');
assert(Array.isArray(shell.primaryNavigation), 'site-navigation-v6 primaryNavigation must be an array');
assert(shell.primaryNavigation.length === canonicalPrimary.length, `V6 primary navigation must contain exactly ${canonicalPrimary.length} canonical items`);

for (let index = 0; index < canonicalPrimary.length; index += 1) {
  const actual = shell.primaryNavigation[index];
  const expected = canonicalPrimary[index];
  assert(actual?.id === expected.id, `V6 primary navigation item ${index + 1} id must be '${expected.id}'`);
  assert(actual?.label === expected.label, `V6 primary navigation item ${index + 1} label must be '${expected.label}'`);
  assert(actual?.route === expected.route, `V6 primary navigation item ${index + 1} route must be '${expected.route}'`);
}

const primaryLabels = shell.primaryNavigation.map((item) => item.label);
for (const obsolete of ['Home', 'Seeds', 'Courses', 'Diagnostic']) {
  assert(!primaryLabels.includes(obsolete), `obsolete primary label '${obsolete}' must not appear in the V6 primary navigation`);
}
assert(shell.sectionOwnership?.learn?.includes('/courses/'), 'Courses must be owned by Learn');
assert(shell.sectionOwnership?.tools?.includes('/growlens/'), 'Tools must own GrowLens');
assert(shell.sectionOwnership?.tools?.includes('/thc-grow-doc/'), 'Tools must own THC Grow Doc');
assert(shell.sectionOwnership?.shop?.includes('/cart/'), 'Shop must own Cart');
assert(shell.sectionOwnership?.shop?.includes('/my-account/'), 'Shop must own Account');

// data/public-navigation.json remains the detailed public games/tools registry during
// the V6 migration. Its legacy primaryNavigation field is not a site-shell authority.
assert(nav.learn?.route === '/learn/', 'Learn registry root must remain /learn/');
assert(nav.courses?.route === '/courses/', 'Courses registry root must remain /courses/');
assert(nav.diagnostic?.route === '/tools/', 'Diagnostic registry data must remain owned by /tools/');
assert(!(nav.learn?.sections || []).some((item) => item.route === '/learn/academy/'), 'Legacy /learn/academy/ must not be promoted as the public Courses entry point');
assert((nav.courses?.sections || []).some((item) => item.route === '/learn/learning-hub/'), 'Courses must expose the Learning Hub as its structured course tree');
assert((nav.diagnostic?.tools || []).some((item) => item.route === '/growlens/'), 'Tools registry must include GrowLens');
assert((nav.diagnostic?.tools || []).some((item) => item.route === '/thc-grow-doc/'), 'Tools registry must include THC Grow Doc');

const allInternal = [
  ...shell.primaryNavigation,
  ...(shell.secondaryNavigation || []),
  ...(shell.utilityNavigation || []),
  ...(nav.footerNavigation || []),
  ...(nav.homeQuickActions || []),
  ...(nav.learn?.sections || []),
  ...(nav.courses?.sections || []),
  ...(nav.diagnostic?.tools || []),
  ...(nav.tools || [])
].map((item) => item.route).filter(Boolean);

for (const route of allInternal) assert(route.startsWith('/') && route.endsWith('/'), `internal route must start and end with /: ${route}`);

const primaryIds = shell.primaryNavigation.map((item) => item.id);
assert(new Set(primaryIds).size === primaryIds.length, 'V6 primary navigation IDs must be unique');
const primaryRoutes = shell.primaryNavigation.map((item) => item.route);
assert(new Set(primaryRoutes).size === primaryRoutes.length, 'V6 primary navigation routes must be unique');

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
for (const tool of nav.diagnostic?.tools || []) assert(validStatuses.has(tool.status), `${tool.id} has unknown status ${tool.status}`);

const expectedExternal = nav.external.find((item) => item.id === 'discord');
assert(expectedExternal?.url === 'https://discord.gg/xJbUeHFPMt', 'official Discord URL must remain canonical');

if (errors.length) {
  console.error(`Public navigation validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log(`Public navigation validation passed: ${shell.primaryNavigation.length} canonical V6 primary destinations, ${publicGames.length} public games, ${privateGames.length} development-only games.`);

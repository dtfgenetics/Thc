import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const nav = JSON.parse(fs.readFileSync(path.join(root, 'data/public-navigation.json'), 'utf8'));
const apps = JSON.parse(fs.readFileSync(path.join(root, 'site/deployment/public-apps.json'), 'utf8'));
const hub = fs.readFileSync(path.join(root, 'site/public-route-patch/games/index.html'), 'utf8');

const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };

const canonicalPrimary = [
  { id: 'home', label: 'Home', route: '/' },
  { id: 'seeds', label: 'Seeds', route: '/seeds/' },
  { id: 'learn', label: 'Learn', route: '/learn/' },
  { id: 'courses', label: 'Courses', route: '/courses/' },
  { id: 'diagnostic', label: 'Diagnostic', route: '/tools/' },
  { id: 'games', label: 'Games', route: '/games/' },
  { id: 'community', label: 'Community', route: '/community/' },
  { id: 'shop', label: 'Shop', route: '/shop/' }
];

assert(Array.isArray(nav.primaryNavigation), 'primaryNavigation must be an array');
assert(nav.primaryNavigation.length === canonicalPrimary.length, `primary navigation must contain exactly ${canonicalPrimary.length} canonical items`);
assert(nav.principles?.maxPrimaryNavItems === canonicalPrimary.length, `maxPrimaryNavItems must be ${canonicalPrimary.length}`);

for (let index = 0; index < canonicalPrimary.length; index += 1) {
  const actual = nav.primaryNavigation[index];
  const expected = canonicalPrimary[index];
  assert(actual?.id === expected.id, `primary navigation item ${index + 1} id must be '${expected.id}'`);
  assert(actual?.label === expected.label, `primary navigation item ${index + 1} label must be '${expected.label}'`);
  assert(actual?.route === expected.route, `primary navigation item ${index + 1} route must be '${expected.route}'`);
  assert(actual?.cta === undefined, `primary navigation item '${expected.id}' must not be used as a CTA; CTAs belong outside the canonical nav`);
}

assert(!nav.primaryNavigation.some((item) => item?.label === 'Genetics'), "primary navigation must use 'Seeds', not 'Genetics'");
assert(!nav.primaryNavigation.some((item) => item?.label === 'Tools'), "primary navigation must use 'Diagnostic', not 'Tools'");
assert(nav.principles?.primaryActionLocation === 'home-quick-actions', 'primaryAction must be explicitly separated from the shared primary navigation');

const roots = nav.informationArchitecture?.roots || [];
assert(Array.isArray(roots), 'informationArchitecture.roots must be an array');
assert(roots.length === canonicalPrimary.length, `information architecture must define exactly ${canonicalPrimary.length} roots`);
for (let index = 0; index < canonicalPrimary.length; index += 1) {
  const rootEntry = roots[index];
  const expected = canonicalPrimary[index];
  assert(rootEntry?.id === expected.id, `information architecture root ${index + 1} id must be '${expected.id}'`);
  assert(rootEntry?.label === expected.label, `information architecture root ${index + 1} label must be '${expected.label}'`);
  assert(rootEntry?.route === expected.route, `information architecture root ${index + 1} route must be '${expected.route}'`);
  assert(typeof rootEntry?.purpose === 'string' && rootEntry.purpose.trim().length > 0, `information architecture root '${expected.id}' requires a purpose`);
}

assert(nav.learn?.route === '/learn/', 'Learn registry root must remain /learn/');
assert(nav.courses?.route === '/courses/', 'Courses registry root must remain /courses/');
assert(nav.diagnostic?.route === '/tools/', 'Diagnostic registry root must remain /tools/');
assert(!(nav.learn?.sections || []).some((item) => item.route === '/learn/academy/'), 'Legacy /learn/academy/ must not be promoted as the public Courses entry point');
assert((nav.courses?.sections || []).some((item) => item.route === '/learn/learning-hub/'), 'Courses must expose the Learning Hub as its structured course tree');
assert((nav.diagnostic?.tools || []).some((item) => item.route === '/growlens/'), 'Diagnostic must include GrowLens');
assert((nav.diagnostic?.tools || []).some((item) => item.route === '/thc-grow-doc/'), 'Diagnostic must include THC Grow Doc');

const allInternal = [
  ...nav.primaryNavigation,
  ...(nav.utilityNavigation || []),
  ...(nav.footerNavigation || []),
  ...(nav.homeQuickActions || []),
  ...(nav.learn?.sections || []),
  ...(nav.courses?.sections || []),
  ...(nav.diagnostic?.tools || []),
  ...(nav.tools || [])
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
for (const tool of nav.diagnostic?.tools || []) assert(validStatuses.has(tool.status), `${tool.id} has unknown status ${tool.status}`);

const expectedExternal = nav.external.find((item) => item.id === 'discord');
assert(expectedExternal?.url === 'https://discord.gg/xJbUeHFPMt', 'official Discord URL must remain canonical');

if (errors.length) {
  console.error(`Public navigation validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log(`Public navigation validation passed: ${nav.primaryNavigation.length} canonical primary destinations, ${publicGames.length} public games, ${privateGames.length} development-only games.`);

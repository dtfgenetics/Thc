import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const nav = JSON.parse(fs.readFileSync(path.join(root, 'data/public-navigation.json'), 'utf8'));
const shell = JSON.parse(fs.readFileSync(path.join(root, 'data/site-navigation-v6.json'), 'utf8'));
const apps = JSON.parse(fs.readFileSync(path.join(root, 'site/deployment/public-apps.json'), 'utf8'));
const hub = fs.readFileSync(path.join(root, 'site/public-route-patch/games/index.html'), 'utf8');
const headerV5 = fs.readFileSync(path.join(root, 'scripts/lib/sitewide-header-template.mjs'), 'utf8');
const headerV6 = fs.readFileSync(path.join(root, 'scripts/lib/sitewide-header-template-v6.mjs'), 'utf8');

const deployableShellFiles = [
  'site/public-route-patch/projects/index.html',
  'site/public-route-patch/tools/index.html',
  'site/public-route-patch/games/index.html',
  'site/public-route-patch/games/high-life/index.html',
  'site/public-route-patch/games/high-iq/index.html',
  'site/public-route-patch/games/grower-conversations/index.html',
  'site/public-route-patch/games/seed-man-platformer/index.html',
];

function primaryNavMarkup(html) {
  return html.match(/<nav\b[^>]*aria-label=["']Primary(?: navigation)?["'][^>]*>[\s\S]*?<\/nav>/i)?.[0] || '';
}
const errors = [];
const assert = (condition, message) => { if (!condition) errors.push(message); };

const canonicalPrimary = [
  { id: 'seeds', label: 'Seeds', route: '/seeds/' },
  { id: 'learn', label: 'Learn', route: '/learn/' },
  { id: 'diagnostic', label: 'Tools', route: '/tools/' },
  { id: 'games', label: 'Games', route: '/games/' },
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
for (const required of ['Seeds', 'Learn', 'Tools', 'Games', 'Shop']) {
  assert(primaryLabels.includes(required), `required primary label '${required}' must appear in the V6 primary navigation`);
}
for (const obsolete of ['Home', 'Courses', 'Community', 'Genetics', 'Diagnostic']) {
  assert(!primaryLabels.includes(obsolete), `retired primary label '${obsolete}' must not appear in the V6 primary navigation`);
}

for (const rel of deployableShellFiles) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  const primary = primaryNavMarkup(html);
  assert(Boolean(primary), `${rel} must expose a canonical primary navigation`);
  if (!primary) continue;

  const normalizedPrimary = primary.replaceAll("'", '"').replace(/\s+/g, ' ');
  let lastIndex = -1;
  for (const item of canonicalPrimary) {
    const hrefIndex = normalizedPrimary.indexOf(`href="${item.route}"`);
    assert(hrefIndex >= 0, `${rel} primary navigation is missing route ${item.route}`);
    if (hrefIndex < 0) continue;
    const linkTail = normalizedPrimary.slice(hrefIndex, hrefIndex + 220);
    assert(linkTail.includes(`>${item.label}</a>`), `${rel} primary navigation route ${item.route} must be labeled ${item.label}`);
    assert(hrefIndex > lastIndex, `${rel} primary navigation order must match the canonical five-item sequence`);
    lastIndex = hrefIndex;
  }

  assert(!/>\s*Genetics\s*<\/a>/i.test(primary), `${rel} still exposes retired primary label Genetics`);
  assert(!/>\s*Diagnostic\s*<\/a>/i.test(primary), `${rel} still exposes retired primary label Diagnostic`);
}

for (const [label, source] of [['v5 WordPress header', headerV5], ['v6 WordPress header', headerV6]]) {
  assert(source.includes('data-dtf-sitewide-header="canonical-five-v1"'), `${label} must declare the canonical five-item header`);
  for (const item of canonicalPrimary) {
    assert(source.includes(`href="${item.route}"`), `${label} must include primary route ${item.route}`);
  }
  for (const retired of ['>Home</a>', '>Courses</a>', '>Community</a>']) {
    assert(!source.includes(retired), `${label} must not expose retired primary item ${retired}`);
  }
}
assert(headerV6.includes("if(group==='learn')active=/^\\/(learn|courses|education|yellow-leaves)\\//.test(path);"), 'v6 WordPress header must map Courses and Learning routes into Learn');
assert(headerV5.includes("if(a.dataset.dtfNavGroup==='learn')active=/^\\/(learn|courses)\\//.test(path);"), 'v5 WordPress header must map Courses and Learning routes into Learn');

assert(shell.sectionOwnership?.courses?.includes('/courses/'), 'Courses must own /courses/');
assert(shell.sectionOwnership?.courses?.includes('/learn/learning-hub/'), 'Courses must own historical Learning Hub course URLs');
assert(shell.sectionOwnership?.diagnostic?.includes('/growlens/'), 'Tools must own GrowLens');
assert(shell.sectionOwnership?.diagnostic?.includes('/thc-grow-doc/'), 'Tools must own THC Grow Doc');
assert(shell.sectionOwnership?.shop?.includes('/cart/'), 'Shop must own Cart');
assert(shell.sectionOwnership?.shop?.includes('/my-account/'), 'Shop must own Account');

// Both navigation registries are authoritative and must agree on the five-item primary row.
assert(JSON.stringify(nav.primaryNavigation) === JSON.stringify(shell.primaryNavigation), 'public-navigation and site-navigation-v6 primary navigation must match exactly');
assert(shell.brandHome?.route === '/', 'brand must remain the Home control');
assert((shell.secondaryNavigation || []).some((item) => item.route === '/courses/'), 'Courses must remain visible in secondary navigation');
assert((shell.secondaryNavigation || []).some((item) => item.route === '/community/'), 'Community must remain visible in secondary navigation');
assert(nav.learn?.route === '/learn/', 'Learn registry root must remain /learn/');
assert(nav.courses?.route === '/courses/', 'Courses registry root must remain /courses/');
assert(nav.diagnostic?.route === '/tools/', 'Tools registry data must remain owned by /tools/');
assert(!(nav.learn?.sections || []).some((item) => item.route === '/learn/academy/'), 'Legacy /learn/academy/ must not be promoted as the public Courses entry point');
assert((nav.courses?.sections || []).some((item) => item.route === '/learn/learning-hub/'), 'Courses must expose the Learning Hub as its structured course tree');
assert((nav.diagnostic?.tools || []).some((item) => item.route === '/growlens/'), 'Tools registry must include GrowLens');
assert((nav.diagnostic?.tools || []).some((item) => item.route === '/thc-grow-doc/'), 'Tools registry must include THC Grow Doc');
for (const route of ['/atlas/', '/terpene-atlas/', '/ph-meter/', '/tds-meter/', '/vpd-chart/', '/ppfd-chart/']) {
  assert((nav.diagnostic?.tools || []).some((item) => item.route === route), `Tools registry must include reference route ${route}`);
}
const toolsHub = fs.readFileSync(path.join(root, 'site/public-route-patch/tools/index.html'), 'utf8');
for (const route of ['/atlas/', '/terpene-atlas/', '/ph-meter/', '/tds-meter/', '/vpd-chart/', '/ppfd-chart/']) {
  assert(toolsHub.includes(`href="${route}"`) || toolsHub.includes(`href='${route}'`), `Tools hub must link reference route ${route}`);
}
for (const rel of ['site/public-route-patch/ph-meter/index.html', 'site/public-route-patch/tds-meter/index.html', 'site/public-route-patch/vpd-chart/index.html', 'site/public-route-patch/ppfd-chart/index.html']) {
  assert(fs.existsSync(path.join(root, rel)), `${rel} must exist as a standalone reference page`);
}

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
const hubLiveMultiplayerCount = hub.match(/<strong>(\d+)<\/strong><span>live multiplayer tables<\/span>/i);
const hubCandidateCount = hub.match(/<strong>(\d+)<\/strong><span>release\/runtime candidates<\/span>/i);
const publicMultiplayerGames = publicGames.filter((game) => game.status === 'multiplayer');
const releaseCandidates = privateGames.filter((game) => typeof game.candidateRoute === 'string' && game.candidateRoute.length > 0);

assert(Boolean(hubPlayableCount), 'Game Hub must expose its playable-game count');
if (hubPlayableCount) {
  assert(Number(hubPlayableCount[1]) === publicGames.length, `Game Hub playable count ${hubPlayableCount[1]} does not match ${publicGames.length} public games`);
}
assert(Boolean(hubLiveMultiplayerCount), 'Game Hub must expose its live-multiplayer count');
if (hubLiveMultiplayerCount) {
  assert(Number(hubLiveMultiplayerCount[1]) === publicMultiplayerGames.length, `Game Hub live multiplayer count ${hubLiveMultiplayerCount[1]} does not match ${publicMultiplayerGames.length} public multiplayer games`);
}
assert(Boolean(hubCandidateCount), 'Game Hub must expose its release/runtime candidate count');
if (hubCandidateCount) {
  assert(Number(hubCandidateCount[1]) === releaseCandidates.length, `Game Hub candidate count ${hubCandidateCount[1]} does not match ${releaseCandidates.length} registered candidates`);
}

for (const game of publicGames) {
  assert(Boolean(game.route), `${game.id} is public but has no route`);
  const app = appById.get(game.id);
  assert(Boolean(app), `${game.id} is public but missing from site/deployment/public-apps.json`);
  if (app && game.route) assert(app.route === game.route, `${game.id} route mismatch: nav=${game.route} deployment=${app.route}`);
  if (game.route) assert(hub.includes(`href=\"${game.route}\"`) || hub.includes(`href='${game.route}'`), `${game.id} is public but Game Hub does not link ${game.route}`);
}

for (const game of privateGames) {
  assert(!game.route, `${game.id} is not public but still has a public route`);
  if (game.candidateRoute) {
    const app = appById.get(game.id);
    assert(game.status === 'development', `${game.id} has candidateRoute but is not marked development`);
    assert(app?.status === 'runtime-integration' || app?.status === 'release-candidate' || app?.status === 'ready-to-package', `${game.id} candidateRoute has unexpected deployment status ${app?.status || '<missing>'}`);
    assert(app?.route === game.candidateRoute, `${game.id} candidateRoute mismatch: nav=${game.candidateRoute} deployment=${app?.route || '<none>'}`);
    assert(!hub.includes(`href="${game.candidateRoute}"`) && !hub.includes(`href='${game.candidateRoute}'`), `${game.id} is not public but Game Hub still links candidate route ${game.candidateRoute}`);
  }
}

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

console.log(`Public navigation validation passed: ${shell.primaryNavigation.length} core primary destinations plus secondary Courses/Community, ${publicGames.length} public games, ${privateGames.length} development-only games.`);

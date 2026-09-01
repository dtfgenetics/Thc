import assert from 'node:assert/strict';
import fs from 'node:fs';

const scope = fs.readFileSync('docs/DTF_GAME_SCOPE_MASTER.md', 'utf8');
const navigation = JSON.parse(fs.readFileSync('data/public-navigation.json', 'utf8'));
const registry = JSON.parse(fs.readFileSync('data/project-registry.json', 'utf8'));
const hub = fs.readFileSync('site/public-route-patch/games/index.html', 'utf8');

function section(markdown, heading) {
  const start = markdown.indexOf(`## ${heading}`);
  assert.notEqual(start, -1, `missing scope section: ${heading}`);
  const afterHeading = start + `## ${heading}`.length;
  const next = markdown.indexOf('\n## ', afterHeading);
  return markdown.slice(afterHeading, next === -1 ? markdown.length : next);
}

const publicGames = navigation.games.filter((game) => game.public === true);
assert.ok(publicGames.length > 0, 'public navigation must contain games');

const publicSection = section(scope, 'Public playable catalog');
const countMatch = publicSection.match(/exposes\s+(\d+)\s+playable browser games/i);
assert.ok(countMatch, 'scope must state the public playable-game count');
const scopeCount = Number(countMatch[1]);
assert.equal(scopeCount, publicGames.length, `scope says ${scopeCount} public games but navigation has ${publicGames.length}`);

for (const game of publicGames) {
  assert.ok(publicSection.includes(game.title), `public scope is missing navigation game: ${game.title}`);
}

const markerMatch = hub.match(/deployment-verification-marker:\s*(\d+)\s+playable browser games/i);
assert.ok(markerMatch, 'Game Hub is missing its playable-count deployment marker');
assert.equal(Number(markerMatch[1]), publicGames.length, 'Game Hub deployment marker disagrees with public navigation');

const heroCountMatch = hub.match(/<strong>(\d+)<\/strong><span>playable browser games<\/span>/i);
assert.ok(heroCountMatch, 'Game Hub hero is missing its playable-game count');
assert.equal(Number(heroCountMatch[1]), publicGames.length, 'Game Hub hero count disagrees with public navigation');

assert.ok(!scope.includes('## Missing outlined game slate'), 'shipped games must not remain under a Missing outlined game slate heading');

const shippedSection = section(scope, 'Formerly missing outlined slate — shipped');
const formerlyMissing = [
  'Strain Match',
  'Grow Room Bingo / Bongwater Bingo',
  'Lost in the Terps',
  'Spin the Strain',
  'Mystery Strain',
  'High Lines',
  'Grow Room Defense',
  'Harvest Hustle',
  'Pheno Draft',
  'Trichome Trials',
];

for (const title of formerlyMissing) {
  assert.ok(publicGames.some((game) => game.title === title), `formerly missing game is not public: ${title}`);
  assert.ok(shippedSection.includes(title), `shipped scope section is missing: ${title}`);
}

const rootCause = registry.projects.find((project) => project.id === 'root-cause');
assert.ok(rootCause, 'project registry is missing root-cause');
assert.equal(rootCause.status, 'browser-vertical-slice', 'Root Cause registry status changed; review scope before promotion');
assert.ok(!publicGames.some((game) => game.id === 'root-cause'), 'Root Cause was made public without updating the controlled scope decision');
assert.ok(section(scope, 'Built prototype not yet promoted').includes('Root Cause'), 'scope must record Root Cause as built but not promoted');

console.log(`Game scope verified: ${publicGames.length} public games; shipped expansion slate and Root Cause gate are synchronized.`);

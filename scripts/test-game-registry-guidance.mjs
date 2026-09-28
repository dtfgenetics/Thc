import assert from 'node:assert/strict';
import fs from 'node:fs';

const files = [
  'AGENTS.md',
  '.agents/skills/dtf-game-registry-reconciler/SKILL.md',
  '.agents/skills/dtf-game-canonical-release/SKILL.md',
  '.agents/skills/dtf-game-portfolio-upgrade/SKILL.md',
];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.includes('data/game-registry-v2.json'), `${file} must reference game-registry-v2`);
}

const canonicalRelease = fs.readFileSync('.agents/skills/dtf-game-canonical-release/SKILL.md', 'utf8');
assert.ok(/game-registry-v2\.json[\s\S]{0,800}(primary|authority|canonical)/i.test(canonicalRelease) ||
          /(primary|authority|canonical)[\s\S]{0,800}game-registry-v2\.json/i.test(canonicalRelease),
          'canonical release skill must identify v2 as the primary authority');

const reconciler = fs.readFileSync('.agents/skills/dtf-game-registry-reconciler/SKILL.md', 'utf8');
assert.ok(reconciler.includes('games:registry:check'));
assert.ok(reconciler.includes('games:registry:docs:check'));

const portfolio = fs.readFileSync('.agents/skills/dtf-game-portfolio-upgrade/SKILL.md', 'utf8');
assert.ok(portfolio.includes('release.status'));
assert.ok(portfolio.includes('quality.knownGaps'));

console.log('game registry guidance contract passed');

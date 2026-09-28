import assert from 'node:assert/strict';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
for (const scriptName of ['games:preflight', 'verify:project-os']) {
  const script = pkg.scripts?.[scriptName] || '';
  assert.ok(script.includes('games:registry:check'), `${scriptName} must run games:registry:check`);
}
assert.ok((pkg.scripts?.['games:preflight'] || '').includes('games:registry:docs:check'), 'games:preflight must run games:registry:docs:check');
console.log('game registry preflight contract passed');

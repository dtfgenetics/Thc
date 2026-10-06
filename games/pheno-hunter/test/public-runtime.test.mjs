import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(p)=>fs.readFileSync(p,'utf8');
const json=(p)=>JSON.parse(read(p));
const game=json('games/pheno-hunter/game.json');
const canonicalData=json('games/pheno-hunter/data/phenos.json');
const publicData=json('site/public-route-patch/games/pheno-hunter/data/phenos.json');
const canonicalEngine=read('games/pheno-hunter/src/engine.mjs');
const publicEngine=read('site/public-route-patch/games/pheno-hunter/engine.mjs');
const html=read('site/public-route-patch/games/pheno-hunter/index.html');
const css=read('site/public-route-patch/games/pheno-hunter/pheno-hunter.css');
const app=read('site/public-route-patch/games/pheno-hunter/app.js');

assert.equal(game.id,'pheno-hunter');
assert.equal(game.route,'/games/pheno-hunter/');
assert.equal(game.status,'browser-vertical-slice');
assert.equal(game.releaseGates.rulesTested,true);
assert.equal(game.releaseGates.browserTested,false);
assert.equal(game.releaseGates.mobileTested,false);
assert.equal(game.releaseGates.accessibilityReviewed,false);
assert.equal(game.releaseGates.deploymentRegistered,true);

assert.deepEqual(publicData,canonicalData,'public and canonical candidate data must match exactly');
assert.equal(publicEngine,canonicalEngine,'public and canonical deterministic engines must match exactly');
assert.equal(canonicalData.candidates.length,18);
assert.equal(canonicalData.briefs.length,6);
assert.match(html,/<link rel="canonical" href="https:\/\/dtfseeds\.com\/games\/pheno-hunter\/">/);
assert.match(html,/<script type="module" src="\.\/app\.js"><\/script>/);
assert.match(html,/Content boundary:/);
assert.match(html,/id="candidate-grid"/);
assert.match(html,/id="hunt-code"/);
assert.match(html,/aria-live="assertive"/);
assert.match(css,/min-height:100dvh/);
assert.match(css,/min-height:44px/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(css,/@media\(max-width:440px\)/);
assert.match(app,/data\.candidates\?\.length !== 18/);
assert.match(app,/data\.briefs\?\.length !== 6/);
assert.match(app,/crypto\.getRandomValues/);
assert.match(app,/navigator\.clipboard\.writeText/);
assert.doesNotMatch(app,/innerHTML\s*=\s*[^\n]*(?:location|searchParams|hunt-code)/i,'URL/user-controlled hunt code must not be injected as HTML');
assert.match(canonicalEngine,/OBSERVATION_BUDGET = 10/);
assert.match(canonicalEngine,/SHORTLIST_LIMIT = 3/);
assert.match(canonicalEngine,/score = Math\.min\(100,/);

console.log('Pheno Hunter public runtime contract passed.');

import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const publicRoot = new URL('../../../site/public-route-patch/games/seed-man-platformer/', import.meta.url);

const [campaignText, uiSource] = await Promise.all([
  readFile(new URL('data/campaign.json', root), 'utf8'),
  readFile(new URL('campaign-ui-v20.js', publicRoot), 'utf8')
]);

const campaign = JSON.parse(campaignText);
const levels = campaign.worlds.flatMap((world) => world.levels || []);
assert.equal(levels.length, 20, 'campaign progression chain must contain exactly 20 levels');
assert.deepStrictEqual(levels.map((level) => level.order), Array.from({ length: 20 }, (_, index) => index + 1), 'campaign orders must remain contiguous from 1 through 20');
assert.equal(new Set(levels.map((level) => level.id)).size, 20, 'campaign level ids must be unique');

function extractFunction(name) {
  const start = uiSource.indexOf(`function ${name}`);
  assert.ok(start >= 0, `campaign UI must define ${name}`);

  const paramsOpen = uiSource.indexOf('(', start);
  assert.ok(paramsOpen >= 0, `campaign UI ${name} must have parameters`);
  let parenDepth = 0;
  let paramsClose = -1;
  for (let index = paramsOpen; index < uiSource.length; index += 1) {
    const char = uiSource[index];
    if (char === '(') parenDepth += 1;
    else if (char === ')') {
      parenDepth -= 1;
      if (parenDepth === 0) { paramsClose = index; break; }
    }
  }
  assert.ok(paramsClose > paramsOpen, `campaign UI ${name} parameter list must close`);

  const open = uiSource.indexOf('{', paramsClose);
  assert.ok(open >= 0, `campaign UI ${name} must have a function body`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = open; index < uiSource.length; index += 1) {
    const char = uiSource[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return uiSource.slice(start, index + 1);
    }
  }
  throw new Error(`campaign UI ${name} body was not closed`);
}

const progressionContext = {
  window: {
    __SPROUT_CAMPAIGN__: {
      listLevels: () => levels.map((level) => ({ id: level.id, order: level.order, title: level.title }))
    }
  }
};
const getNextLevelId = vm.runInNewContext(`(${extractFunction('getNextLevelId')})`, progressionContext);

for (let index = 0; index < levels.length - 1; index += 1) {
  assert.equal(
    getNextLevelId(levels[index].id),
    levels[index + 1].id,
    `Level ${levels[index].order} must advance to Level ${levels[index + 1].order}`
  );
}
assert.equal(getNextLevelId(levels.at(-1).id), null, 'Level 20 must end the campaign instead of attempting a Level 21');
assert.equal(getNextLevelId('not-a-real-level'), null, 'unknown levels must not advance into the campaign');

const scoreForRun = vm.runInNewContext(`(${extractFunction('scoreForRun')})`);
const baseline = scoreForRun({ seconds: 100, collected: 5, deaths: 0, required: 10 });
assert.ok(scoreForRun({ seconds: 90, collected: 5, deaths: 0, required: 10 }) > baseline, 'faster clears must score higher');
assert.ok(scoreForRun({ seconds: 100, collected: 10, deaths: 0, required: 10 }) > baseline, 'collecting every seed must score higher');
assert.ok(scoreForRun({ seconds: 100, collected: 5, deaths: 2, required: 10 }) < baseline, 'falls must reduce score');
assert.ok(scoreForRun({ seconds: 100, collected: 10, deaths: 0, required: 10 }) > scoreForRun({ seconds: 100, collected: 9, deaths: 0, required: 10 }), 'all-seeds bonus must remain meaningful');

const finishSource = extractFunction('handleFinish');
for (const marker of ['markCompleted(completedId)', 'recordScore(completedId)', 'getNextLevelId(completedId)', 'selectNextLevel(completedId,nextId)']) {
  assert.ok(finishSource.includes(marker), `finish flow must retain ${marker}`);
}
assert.ok(finishSource.includes('seedman:campaign-complete'), 'Level 20 completion must emit the campaign-complete event');

console.log('Seed Man 20-level progression chain and deterministic score contract passed.');

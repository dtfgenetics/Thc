import assert from 'node:assert/strict';
import {buildWordPressPageQuery,requireSingleWordPressPage} from './wordpress-learning-page-query.mjs';

const root=buildWordPressPageQuery('learn');
assert.match(root,/slug=learn/);
assert.doesNotMatch(root,/parent=/);

const child=buildWordPressPageQuery('harvest-postharvest',{parentId:42});
assert.match(child,/slug=harvest-postharvest/);
assert.match(child,/parent=42/);
assert.equal(requireSingleWordPressPage([{id:7}],{slug:'harvest-postharvest',parentId:42}).id,7);
assert.throws(
  ()=>requireSingleWordPressPage([{id:7},{id:8}],{slug:'harvest-postharvest',parentId:42}),
  /under parent 42.*found 2/
);
assert.throws(
  ()=>requireSingleWordPressPage('bad',{slug:'outdoor',parentId:42}),
  /invalid response/
);
console.log('WordPress canonical Learning page query tests passed.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const script=fs.readFileSync('site/public-route-patch/games/bud-or-bluff/visual-state-v3.js','utf8');
const css=fs.readFileSync('site/public-route-patch/games/bud-or-bluff/visual-state-v3.css','utf8');
const html=fs.readFileSync('site/public-route-patch/games/bud-or-bluff/index.html','utf8');

assert.match(html,/visual-state-v3\.css\?v=20260912/,'visual-state stylesheet must be loaded');
assert.match(html,/visual-state-v3\.js\?v=20260912/,'visual-state runtime must be loaded');
assert.match(css,/locked-vote\[data-vote="BLUFF"\]/,'BLUFF lock needs a distinct visual state');
assert.match(css,/locked-vote\[data-vote="BUD"\]/,'BUD lock needs a distinct visual state');
assert.match(css,/data-urgency="critical"/,'critical timer state must be visible');
assert.match(css,/position:sticky/,'phone vote actions must remain reachable');
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/,'visual polish must respect reduced motion');

const makeNode=(extra={})=>({dataset:{},textContent:'',closest:()=>null,...extra});
const locked=makeNode();
const lockedText=makeNode({textContent:'BLUFF'});
const timer=makeNode({textContent:'4'});
const roundMeta=makeNode();
const card=makeNode();
const revealAnswer=makeNode({textContent:'BUD',closest:()=>null});
const revealPanel=makeNode();
const nodes={
  '#lockedVote':locked,
  '#lockedVoteText':lockedText,
  '#timerText':timer,
  '.round-meta':roundMeta,
  '#strainCard':card,
  '#revealAnswer':revealAnswer,
  '#revealPanel':revealPanel
};
class MutationObserver{constructor(callback){this.callback=callback}observe(){}disconnect(){}}
const document={documentElement:{dataset:{}},querySelector:(selector)=>nodes[selector]||null};
const window={};
vm.runInNewContext(script,{document,window,MutationObserver,Number,String,Object,console});

assert.equal(locked.dataset.vote,'BLUFF','locked BLUFF vote must not inherit BUD styling');
assert.equal(roundMeta.dataset.urgency,'critical','5 seconds or less must enter critical timer state');
assert.equal(card.dataset.answer,'BUD','visible reveal must expose the answer visual state');
assert.equal(document.documentElement.dataset.budOrBluffVisualState,'bud-or-bluff-visual-state-v3');

lockedText.textContent='BUD';timer.textContent='9';revealAnswer.textContent='BLUFF';
window.__BUD_OR_BLUFF_VISUAL_STATE__.sync();
assert.equal(locked.dataset.vote,'BUD');
assert.equal(roundMeta.dataset.urgency,'low');
assert.equal(card.dataset.answer,'BLUFF');

timer.textContent='∞';
window.__BUD_OR_BLUFF_VISUAL_STATE__.sync();
assert.equal(roundMeta.dataset.urgency,undefined,'no-timer rooms must not show false urgency');

console.log('Bud or Bluff gameplay visual-state regression passed.');

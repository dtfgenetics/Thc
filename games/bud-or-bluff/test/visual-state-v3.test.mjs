import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const script=fs.readFileSync('site/public-route-patch/games/bud-or-bluff/visual-state-v3.js','utf8');
const css=fs.readFileSync('site/public-route-patch/games/bud-or-bluff/visual-state-v3.css','utf8');
const baseCss=fs.readFileSync('site/public-route-patch/games/bud-or-bluff/styles.css','utf8');
const html=fs.readFileSync('site/public-route-patch/games/bud-or-bluff/index.html','utf8');

assert.match(html,/visual-state-v3\.css\?v=20260913/,'visual-state stylesheet must load the current responsive revision');
assert.match(html,/visual-state-v3\.js\?v=20260913/,'visual-state runtime must load with the current cache revision');
assert.match(css,/locked-vote\[data-vote="BLUFF"\]/,'BLUFF lock needs a distinct visual state');
assert.match(css,/locked-vote\[data-vote="BUD"\]/,'BUD lock needs a distinct visual state');
assert.match(css,/data-urgency="critical"/,'critical timer state must be visible');
assert.match(css,/position:sticky/,'phone vote actions must remain reachable');
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/,'visual polish must respect reduced motion');

assert.match(baseCss,/body\{[^}]*overflow-x:hidden/is,'test fixture must keep detecting the legacy base overflow mask until it is removed upstream');
assert.match(css,/body\{min-width:0;overflow-x:visible\}/,'late responsive layer must release the legacy page-root overflow mask');
assert.match(css,/\.home-view,.room-grid\{grid-template-columns:minmax\(0,1fr\)\}/,'tablet and phone gameplay must collapse to one intrinsic-width content column');
assert.match(css,/\.sidebar\{grid-template-columns:minmax\(0,1fr\);margin-top:2px\}/,'phone sidebar must collapse to one column');
assert.match(css,/\.icon-button,.secondary-action,.primary-action,.seg,.launch-form input,.launch-form select,.chat-form input,.chat-form button\{min-height:44px\}/,'interactive controls must preserve a 44px minimum touch target');
assert.match(css,/\.topbar,.shell\{width:min\(100% - 20px,1320px\)\}/,'narrow-phone shell must remain inside the viewport');

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

console.log('Bud or Bluff gameplay visual-state and responsive containment regression passed.');

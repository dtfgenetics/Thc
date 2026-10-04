import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const app=await readFile(new URL('../../../site/public-route-patch/games/strain-match/app.js',import.meta.url),'utf8');
const startMarker='// BEGIN STRAIN MATCH AGENT BRIDGE';
const endMarker='// END STRAIN MATCH AGENT BRIDGE';
const start=app.indexOf(startMarker);
const end=app.indexOf(endMarker);
assert.ok(start>=0,'Strain Match agent bridge start marker required');
assert.ok(end>start,'Strain Match agent bridge end marker required');
const bridge=app.slice(start,end+endMarker.length);
assert.match(bridge,/strain-match-agent-bridge-v1/);
assert.match(bridge,/__STRAIN_MATCH_AGENT__/);
assert.match(bridge,/__STRAIN_MATCH_GAME_STATE__/);
assert.match(bridge,/stallSuspected/);
assert.doesNotMatch(bridge,/pairId:\s*cards\[index\]/,'hidden pair identity must not be exposed');

const harness=`
function makeClassList(initial=[]){const s=new Set(initial);return{contains:v=>s.has(v),add:(...v)=>v.forEach(x=>s.add(x)),remove:(...v)=>v.forEach(x=>s.delete(x))};}
function makeButton(index){
  return {disabled:false,dataset:{},classList:makeClassList(),click(){this.classList.add('revealed');openCards.push({index});}};
}
const buttons=[makeButton(0),makeButton(1),makeButton(2),makeButton(3)];
const board={querySelectorAll(sel){return sel==='.match-card'?buttons:[];}};
const deckButtons=[
  {dataset:{deck:'deck-a'},click(){activeDeck=data.decks[0];}},
  {dataset:{deck:'deck-b'},click(){activeDeck=data.decks[1];}}
];
const deckPicker={querySelectorAll(){return deckButtons;}};
const data={decks:[
  {id:'deck-a',title:'Deck A',pairs:[{id:'p1'},{id:'p2'}]},
  {id:'deck-b',title:'Deck B',pairs:[{id:'p3'},{id:'p4'}]}
]};
let activeDeck=data.decks[0];
let cards=[
  {text:'Alpha',kind:'term',pairId:'p1'},
  {text:'Alpha clue',kind:'clue',pairId:'p1'},
  {text:'Beta',kind:'term',pairId:'p2'},
  {text:'Beta clue',kind:'clue',pairId:'p2'}
];
let openCards=[];
let locked=false;
let moves=0;
let matches=0;
let streak=0;
let bestStreak=0;
let roundStarted=false;
let roundToken=1;
let restartArmedUntil=0;
function elapsedSeconds(){return 0;}
const restartButton={click(){roundToken+=1;openCards=[];}};
const playAgainButton={click(){roundToken+=1;matches=0;}};
const listeners={};
const document={documentElement:{dataset:{}}};
const window={addEventListener(type,handler){(listeners[type] ||= []).push(handler);}};
${bridge}
globalThis.__HARNESS__={window,document,buttons,listeners,getActive:()=>activeDeck};
`;

const sandbox={console,Object,Number,String,Boolean,Math,Date,Set,Error,performance:{now:()=>1000}};
vm.createContext(sandbox);
vm.runInContext(harness,sandbox,{filename:'strain-match-agent-bridge-v1.js'});
const {window,document,buttons,listeners,getActive}=sandbox.__HARNESS__;
const api=window.__STRAIN_MATCH_AGENT__;
assert.equal(api.version,'strain-match-agent-bridge-v1');
assert.equal(document.documentElement.dataset.strainMatchAgentBridge,'strain-match-agent-bridge-v1');
assert.equal(listeners.error.length,1);
assert.equal(listeners.unhandledrejection.length,1);

let snapshot=api.snapshot();
assert.equal(snapshot.ready,true);
assert.equal(snapshot.deck.id,'deck-a');
assert.equal(snapshot.cards.length,4);
assert.equal(snapshot.cards[0].state,'hidden');
assert.equal(snapshot.cards[0].text,null);
assert.equal('pairId' in snapshot.cards[0],false);
assert.deepEqual(Array.from(snapshot.legalActions),['reveal','restart','select-deck']);

assert.equal(api.reveal(0),true);
snapshot=api.snapshot();
assert.equal(snapshot.cards[0].state,'revealed');
assert.equal(snapshot.cards[0].text,'Alpha');
assert.equal(snapshot.cards[0].kind,'term');
assert.equal('pairId' in snapshot.cards[0],false);
assert.throws(()=>api.reveal(99),/Unsupported Strain Match card index/);

assert.equal(api.selectDeck('deck-b'),true);
assert.equal(getActive().id,'deck-b');
assert.throws(()=>api.selectDeck('missing'),/Unsupported Strain Match deck/);

listeners.error[0]({message:'synthetic',filename:'app.js',target:window});
listeners.unhandledrejection[0]({reason:new Error('synthetic rejection')});
snapshot=api.snapshot();
assert.equal(snapshot.telemetry.errors.length,2);
assert.equal(snapshot.telemetry.errors[0].kind,'runtime-error');
assert.equal(snapshot.telemetry.errors[1].kind,'unhandled-rejection');
assert.ok(snapshot.telemetry.recentActions.some(event=>event.action==='reveal'));
assert.equal(snapshot.telemetry.stallThresholdMs,8000);

console.log('Strain Match autonomous playtest bridge contract passed.');

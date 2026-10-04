import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const app=await readFile(new URL('../../../site/public-route-patch/games/lost-in-the-terps/app.js',import.meta.url),'utf8');
const startMarker='// BEGIN LOST IN THE TERPS AGENT BRIDGE';
const endMarker='// END LOST IN THE TERPS AGENT BRIDGE';
const startIndex=app.indexOf(startMarker), endIndex=app.indexOf(endMarker);
assert.ok(startIndex>=0&&endIndex>startIndex,'Lost in the Terps agent bridge markers required');
const bridge=app.slice(startIndex,endIndex+endMarker.length);
assert.match(bridge,/lost-in-the-terps-agent-bridge-v1/);
assert.match(bridge,/__LOST_TERPS_AGENT__/);
assert.match(bridge,/__LOST_TERPS_GAME_STATE__/);
assert.match(bridge,/stallSuspected/);
assert.doesNotMatch(bridge,/start:\s*entry\.start/,'solution start coordinates must not be exposed');
assert.doesNotMatch(bridge,/end:\s*entry\.end/,'solution end coordinates must not be exposed');

const harness=`
function makeClassList(initial=[]){const s=new Set(initial);return{contains:v=>s.has(v),add:(...v)=>v.forEach(x=>s.add(x)),remove:(...v)=>v.forEach(x=>s.delete(x))};}
const puzzleA={id:'a',title:'Mission A',description:'A',size:2,grid:['AB','CD'],words:[{word:'AB',start:[0,0],end:[0,1]}]};
const puzzleB={id:'b',title:'Mission B',description:'B',size:2,grid:['EF','GH'],words:[{word:'EF',start:[0,0],end:[0,1]}]};
const data={puzzles:[puzzleA,puzzleB]};
let puzzle=puzzleA;
let start=null;
let found=new Set();
let attempts=0,hintsRemaining=3,hintsUsed=0,missionToken=1,pendingMissionId=null,resetArmedUntil=0;
const cellSelector=([r,c])=>'[data-r="'+r+'"][data-c="'+c+'"]';
const cells=new Map();
for(let r=0;r<2;r++)for(let c=0;c<2;c++){const key=String(r)+','+String(c);cells.set(key,{classList:makeClassList(),click(){start=[r,c];}});}
const gridEl={querySelector(sel){const m=sel.match(/data-r="(\\d+)"\\]\\[data-c="(\\d+)"/);return m?cells.get(String(m[1])+','+String(m[2])):null;}};
const missionButtons=[
  {dataset:{id:'a'},click(){puzzle=puzzleA;found=new Set();}},
  {dataset:{id:'b'},click(){puzzle=puzzleB;found=new Set();}}
];
const missions={querySelector(sel){const m=sel.match(/data-id="([^"]+)"/);return missionButtons.find(b=>b.dataset.id===m?.[1])||null;}};
const complete={hidden:true};
const hintButton={click(){hintsRemaining-=1;hintsUsed+=1;cells.get('0,0').classList.add('hint');}};
const resetButton={click(){found=new Set();start=null;attempts=0;}};
const againButton={click(){found=new Set();start=null;complete.hidden=true;}};
const message={textContent:''};
function clearStart(){start=null;}
const listeners={};
const document={documentElement:{dataset:{}}};
const window={addEventListener(type,handler){(listeners[type] ||= []).push(handler);}};
${bridge}
globalThis.__HARNESS__={window,document,listeners,cells,getPuzzle:()=>puzzle,getStart:()=>start};
`;
const sandbox={console,Object,Number,String,Boolean,Math,Date,Set,Map,Error,performance:{now:()=>1000}};
vm.createContext(sandbox);
vm.runInContext(harness,sandbox,{filename:'lost-terps-agent-bridge-v1.js'});
const {window,document,listeners,getPuzzle,getStart}=sandbox.__HARNESS__;
const api=window.__LOST_TERPS_AGENT__;
assert.equal(api.version,'lost-in-the-terps-agent-bridge-v1');
assert.equal(document.documentElement.dataset.lostTerpsAgentBridge,'lost-in-the-terps-agent-bridge-v1');
let snapshot=api.snapshot();
assert.equal(snapshot.ready,true);
assert.equal(snapshot.mission.id,'a');
assert.equal(snapshot.grid[0][0].letter,'A');
assert.equal(snapshot.visibleWords[0].word,'AB');
assert.equal('start' in snapshot.visibleWords[0],false);
assert.equal('end' in snapshot.visibleWords[0],false);
assert.equal(api.selectCell(0,0),true);
assert.deepEqual(getStart(),[0,0]);
assert.throws(()=>api.selectCell(9,9),/Unsupported Lost in the Terps cell/);
assert.equal(api.hint(),true);
snapshot=api.snapshot();
assert.equal(snapshot.round.hintsRemaining,2);
assert.equal(snapshot.grid[0][0].hinted,true);
assert.equal(api.selectMission('b'),true);
assert.equal(getPuzzle().id,'b');
assert.throws(()=>api.selectMission('missing'),/Unsupported Lost in the Terps mission/);
listeners.error[0]({message:'synthetic',filename:'app.js',target:window});
listeners.unhandledrejection[0]({reason:new Error('synthetic rejection')});
snapshot=api.snapshot();
assert.equal(snapshot.telemetry.errors.length,2);
assert.equal(snapshot.telemetry.stallThresholdMs,8000);
console.log('Lost in the Terps autonomous playtest bridge contract passed.');

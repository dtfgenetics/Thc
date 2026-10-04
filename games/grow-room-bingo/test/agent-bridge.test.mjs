import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const app=await readFile(new URL('../../../site/public-route-patch/games/grow-room-bingo/app.js',import.meta.url),'utf8');
const a=app.indexOf('// BEGIN GROW ROOM BINGO AGENT BRIDGE');
const b=app.indexOf('// END GROW ROOM BINGO AGENT BRIDGE');
assert.ok(a>=0&&b>a,'Bingo agent bridge markers required');
const bridge=app.slice(a,b+'// END GROW ROOM BINGO AGENT BRIDGE'.length);
assert.match(bridge,/grow-room-bingo-agent-bridge-v1/);
assert.match(bridge,/__GROW_ROOM_BINGO_AGENT__/);
assert.match(bridge,/__GROW_ROOM_BINGO_GAME_STATE__/);
assert.match(bridge,/stallSuspected/);

const harness=`
function classList(values=[]){const s=new Set(values);return{contains:v=>s.has(v),add:(...v)=>v.forEach(x=>s.add(x)),remove:(...v)=>v.forEach(x=>s.delete(x)),toggle(v,on){if(on)s.add(v);else s.delete(v);}};}
let mode='grow-room',code='ABC234',cells=Array.from({length:24},(_,i)=>({text:'Prompt '+i})),marked=new Set([12]),clearArmedUntil=0;
const data={modes:[{id:'grow-room',title:'Grow Room'},{id:'mixed',title:'Mixed'}]};
const patterns=[[0,1,2,3,4]];
function wins(){return patterns.filter(p=>p.every(i=>marked.has(i)));}
function readBest(){return 1;}
function normalizeCardCode(v){return String(v||'').toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g,'').slice(0,6);}
function isValidCardCode(v){return normalizeCardCode(v).length===6;}
function loadCard(v){code=normalizeCardCode(v);return true;}
const buttons=Array.from({length:25},(_,index)=>({textContent:index===12?'FREE · DTF':'Prompt '+index,disabled:index===12,classList:classList(),click(){if(index!==12){if(marked.has(index))marked.delete(index);else marked.add(index);}}}));
const board={querySelectorAll(sel){return sel==='.cell'?buttons:[];}};
const modeButtons=[{dataset:{mode:'grow-room'},click(){mode='grow-room';}},{dataset:{mode:'mixed'},click(){mode='mixed';}}];
const modesEl={querySelectorAll(){return modeButtons;}};
const codeInput={value:''};
const newButton={click(){code='NEW234';}};
const clearButton={click(){if(clearArmedUntil>Date.now()){marked=new Set([12]);clearArmedUntil=0;}else clearArmedUntil=Date.now()+3500;}};
const listeners={};
const document={documentElement:{dataset:{}}};
const window={addEventListener(type,fn){(listeners[type] ||= []).push(fn);}};
${bridge}
globalThis.__H={window,document,listeners,getMode:()=>mode,getCode:()=>code,getMarked:()=>marked};
`;
const sandbox={console,Object,Number,String,Boolean,Math,Date,Set,Array,Error,performance:{now:()=>1000}};
vm.createContext(sandbox); vm.runInContext(harness,sandbox);
const {window,document,listeners,getMode,getCode,getMarked}=sandbox.__H;
const api=window.__GROW_ROOM_BINGO_AGENT__;
assert.equal(api.version,'grow-room-bingo-agent-bridge-v1');
assert.equal(document.documentElement.dataset.growRoomBingoAgentBridge,'grow-room-bingo-agent-bridge-v1');
let s=api.snapshot();
assert.equal(s.ready,true); assert.equal(s.card.code,'ABC234'); assert.equal(s.card.cells.length,25); assert.equal(s.card.cells[12].free,true);
assert.equal(api.toggleCell(0),true); assert.equal(getMarked().has(0),true);
assert.equal(api.toggleCell(12),false);
assert.throws(()=>api.toggleCell(25),/Unsupported Bingo cell index/);
assert.equal(api.selectMode('mixed'),true); assert.equal(getMode(),'mixed');
assert.throws(()=>api.selectMode('bad'),/Unsupported Bingo mode/);
assert.equal(api.loadCode('DEF567'),true); assert.equal(getCode(),'DEF567');
assert.throws(()=>api.loadCode('x'),/Unsupported Bingo card code/);
assert.equal(api.clearMarks(),true); assert.equal(api.snapshot().card.clearArmed,true);
assert.equal(api.clearMarks(),true); assert.equal(getMarked().size,1);
listeners.error[0]({message:'synthetic',filename:'app.js',target:window});
listeners.unhandledrejection[0]({reason:new Error('reject')});
s=api.snapshot(); assert.equal(s.telemetry.errors.length,2); assert.equal(s.telemetry.stallThresholdMs,8000);
console.log('Grow Room Bingo autonomous playtest bridge contract passed.');

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const app=await readFile(new URL('../../../site/public-route-patch/games/grower-conversations/app.js',import.meta.url),'utf8');
const a=app.indexOf('// BEGIN GROWER CONVERSATIONS AGENT BRIDGE');
const b=app.indexOf('// END GROWER CONVERSATIONS AGENT BRIDGE');
assert.ok(a>=0&&b>a,'Grow Room Confessions agent bridge markers required');
const bridge=app.slice(a,b+'// END GROWER CONVERSATIONS AGENT BRIDGE'.length);
assert.match(bridge,/grower-conversations-agent-bridge-v1/);
assert.match(bridge,/__GROWER_CONVERSATIONS_AGENT__/);
assert.match(bridge,/__GROWER_CONVERSATIONS_GAME_STATE__/);
assert.doesNotMatch(bridge,/current\.id/,'agent state must not expose internal card ids');
assert.doesNotMatch(bridge,/currentId/,'agent state must not expose internal card ids');

const harness=`
const categoryLabels={community:'Community',future:'Future'};
const cards=Array.from({length:96},(_,i)=>({id:'secret-'+i,category:i%2?'community':'future',categoryLabel:i%2?'Community':'Future',depth:i%3===0?'easy':i%3===1?'reflective':'technical',prompt:'Prompt '+i}));
let used=new Set();
let current=null;
function element(value='all'){return{value,disabled:false,dispatchEvent(){syncCurrentToFilters();},click(){}};}
const ui={
 category:element('all'),depth:element('all'),
 next:element(),shuffle:element(),reset:element(),copy:element(),
};
function matchesActiveFilters(card){if(!card)return false;if(ui.category.value!=='all'&&card.category!==ui.category.value)return false;if(ui.depth.value!=='all'&&card.depth!==ui.depth.value)return false;return true;}
function pool(){return cards.filter(matchesActiveFilters);}
function remaining(){return pool().filter(card=>!used.has(card.id));}
function syncCurrentToFilters(){if(current&&!matchesActiveFilters(current))current=null;}
function draw(){const available=remaining();if(!available.length)return;current=available[0];used.add(current.id);}
function resetUsed(){used.clear();current=null;}
function shuffleDeck(){used.clear();current=null;draw();}
ui.next.click=draw;ui.shuffle.click=shuffleDeck;ui.reset.click=resetUsed;ui.copy.click=()=>{};
const listeners={};
const document={documentElement:{dataset:{}}};
const window={addEventListener(type,fn){(listeners[type] ||= []).push(fn);}};
${bridge}
globalThis.__H={window,document,listeners,getCurrent:()=>current,getUsed:()=>used};
`;
const sandbox={console,Object,Number,String,Boolean,Math,Date,Set,Array,Error,Event:class Event{},performance:{now:()=>1000}};
vm.createContext(sandbox);vm.runInContext(harness,sandbox);
const {window,document,listeners,getCurrent,getUsed}=sandbox.__H;
const api=window.__GROWER_CONVERSATIONS_AGENT__;
assert.equal(api.version,'grower-conversations-agent-bridge-v1');
assert.equal(document.documentElement.dataset.growerConversationsAgentBridge,'grower-conversations-agent-bridge-v1');
let s=api.snapshot();
assert.equal(s.ready,true);assert.equal(s.current,null);assert.equal(s.deck.total,96);
assert.equal(api.draw(),true);s=api.snapshot();assert.equal(s.current.prompt,'Prompt 0');assert.equal('id' in s.current,false);
assert.equal(getUsed().size,1);
assert.equal(api.setCategory('community'),true);assert.equal(api.snapshot().filters.category,'community');
assert.throws(()=>api.setCategory('secret'),/Unsupported Grow Room Confessions set-category/);
assert.equal(api.setDepth('technical'),true);assert.equal(api.snapshot().filters.depth,'technical');
assert.throws(()=>api.setDepth('hidden'),/Unsupported Grow Room Confessions set-depth/);
assert.equal(api.shuffle(),true);assert.ok(getCurrent());assert.equal(getUsed().size,1);
assert.equal(api.reset(),true);assert.equal(getUsed().size,0);
listeners.error[0]({message:'synthetic',filename:'app.js',target:window});
listeners.unhandledrejection[0]({reason:new Error('reject')});
s=api.snapshot();assert.equal(s.telemetry.errors.length,2);assert.equal(s.telemetry.stallThresholdMs,8000);
console.log('Grow Room Confessions autonomous playtest bridge contract passed.');

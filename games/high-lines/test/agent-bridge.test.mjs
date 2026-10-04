import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const runtime=await readFile(new URL('../../../site/public-route-patch/games/high-lines/runtime.mjs',import.meta.url),'utf8');
const a=runtime.indexOf('// BEGIN HIGH LINES AGENT BRIDGE');
const b=runtime.indexOf('// END HIGH LINES AGENT BRIDGE');
assert.ok(a>=0&&b>a,'High Lines agent bridge markers required');
const bridge=runtime.slice(a,b+'// END HIGH LINES AGENT BRIDGE'.length);
assert.match(bridge,/high-lines-agent-bridge-v1/);
assert.match(bridge,/__HIGH_LINES_AGENT__/);
assert.match(bridge,/__HIGH_LINES_GAME_STATE__/);
assert.match(bridge,/stallSuspected/);
assert.doesNotMatch(bridge,/hiddenObjects\.map/,'agent state must not expose hidden object ids or locations');
assert.doesNotMatch(bridge,/data-hidden/,'agent bridge must not enumerate hidden SVG targets');

const harness=`
let resetArmed=false,zoom=1;
const data={palette:[{id:'green',label:'Green',hex:'#0f0'},{id:'gold',label:'Gold',hex:'#fc0'}],scenes:[{id:'scene-1',title:'Scene One',description:'Visible scene',regions:['leaf','pot'],hiddenObjects:[{id:'secret-1'},{id:'secret-2'},{id:'secret-3'}]}]};
let state={code:'ABC234',sceneId:'scene-1',selectedColorId:'green',paletteOrder:['green','gold'],prompt:'Visible prompt',fills:{},foundHidden:[],score:0,undoStack:[]};
const colorById=new Map(data.palette.map(c=>[c.id,c]));
function currentScene(){return data.scenes[0];}
function progressForState(s){const colored=Object.keys(s.fills).length,found=s.foundHidden.length;return{colored,totalRegions:2,found,totalHidden:3,percent:Math.round(((colored+found)/5)*100),complete:colored===2&&found===3};}
function selectColor(s,id){return{...s,selectedColorId:id};}
function fillRegion(s,id,color){return{...s,fills:{...s.fills,[id]:color},undoStack:[...s.undoStack,{id}],score:s.score+(s.fills[id]?0:10)};}
function normalizeSceneCode(v){return String(v||'').toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g,'').slice(0,6);}
function isValidSceneCode(v){return normalizeSceneCode(v).length===6;}
function persistExperience(){}
function renderPalette(){}
function refreshSvgState(){}
function render(){}
function resetExperience(code){state={...state,code:normalizeSceneCode(code),fills:{},foundHidden:[],undoStack:[]};}
const ui={undo:{click(){state={...state,undoStack:[],fills:{}};}},reset:{click(){resetArmed=!resetArmed;}},newScene:{click(){resetExperience('NEW234');}},zoomIn:{click(){zoom=Math.min(2.5,zoom+.25);}},zoomOut:{click(){zoom=Math.max(1,zoom-.25);}},zoomReset:{click(){zoom=1;}}};
const listeners={};
const document={documentElement:{dataset:{}}};
const window={addEventListener(type,fn){(listeners[type] ||= []).push(fn);}};
${bridge}
globalThis.__H={window,document,listeners,getState:()=>state,getZoom:()=>zoom};
`;
const sandbox={console,Object,Number,String,Boolean,Math,Date,Map,Array,Error,performance:{now:()=>1000}};
vm.createContext(sandbox);vm.runInContext(harness,sandbox);
const {window,document,listeners,getState,getZoom}=sandbox.__H;
const api=window.__HIGH_LINES_AGENT__;
assert.equal(api.version,'high-lines-agent-bridge-v1');
assert.equal(document.documentElement.dataset.highLinesAgentBridge,'high-lines-agent-bridge-v1');
let s=api.snapshot();
assert.equal(s.ready,true);assert.equal(s.scene.code,'ABC234');assert.equal(s.scene.regions.length,2);
assert.deepEqual(Object.keys(s.scene.hidden).sort(),['complete','found','total'].sort());
assert.equal(api.selectColor('gold'),true);assert.equal(getState().selectedColorId,'gold');
assert.throws(()=>api.selectColor('secret'),/Unsupported High Lines color/);
assert.equal(api.fillRegion('leaf'),true);assert.equal(getState().fills.leaf,'gold');
assert.throws(()=>api.fillRegion('secret-region'),/Unsupported High Lines region/);
assert.equal(api.loadCode('DEF567'),true);assert.equal(getState().code,'DEF567');
assert.throws(()=>api.loadCode('x'),/Unsupported High Lines scene code/);
api.zoomIn();assert.equal(getZoom(),1.25);api.zoomReset();assert.equal(getZoom(),1);
listeners.error[0]({message:'synthetic',filename:'runtime.mjs',target:window});
listeners.unhandledrejection[0]({reason:new Error('reject')});
s=api.snapshot();assert.equal(s.telemetry.errors.length,2);assert.equal(s.telemetry.stallThresholdMs,8000);
console.log('High Lines autonomous playtest bridge contract passed.');

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const app = await readFile(new URL('../../../site/public-route-patch/games/high-iq/app-v3.js', import.meta.url), 'utf8');
const startMarker='// BEGIN HIGH IQ AGENT BRIDGE';
const endMarker='// END HIGH IQ AGENT BRIDGE';
const start=app.indexOf(startMarker);
const end=app.indexOf(endMarker);
assert.ok(start>=0,'High IQ agent bridge start marker is required');
assert.ok(end>start,'High IQ agent bridge end marker is required');
const bridge=app.slice(start,end+endMarker.length);

assert.match(bridge,/high-iq-agent-bridge-v1/);
assert.match(bridge,/__HIGH_IQ_AGENT__/);
assert.match(bridge,/__HIGH_IQ_GAME_STATE__/);
assert.match(bridge,/stallSuspected/);
assert.match(bridge,/resource-error/);
assert.doesNotMatch(bridge,/correctLetter:\s*question\.correctLetter/,'agent state must not expose answer key');
assert.doesNotMatch(bridge,/correctAnswer:\s*question\.correctAnswer/,'agent state must not expose answer text as hidden truth');

const harness=`
const LETTERS=['A','B','C','D'];
const state={
  manifest:{datasetVersion:'2.4'},
  questions:[{id:'Q1',category:'Plant Biology',difficulty:'Easy',points:1,question:'Visible prompt?',choices:{A:'Alpha',B:'Beta',C:'Gamma',D:'Delta'},correctLetter:'B',correctAnswer:'Beta'}],
  sources:new Map([['S1',{}]]),
  session:[],
  index:0,
  selectedLetter:null,
  locked:false,
  score:0,
  possible:0,
  answered:0,
  correct:0,
  streak:0,
  bestStreak:0,
  answers:[],
  runMode:'balanced',
  loadErrors:[]
};
const listeners={};
function element(extra={}){return {hidden:false,disabled:false,value:'',options:[],dispatchEvent(){},click(){},...extra};}
const answerButton=element({dataset:{letter:'A'},click(){state.selectedLetter=this.dataset.letter;}});
const ui={
  results:element({hidden:true}),
  quiz:element({hidden:true}),
  setup:element({hidden:false}),
  fallback:element({hidden:true}),
  category:element({value:'all',options:[{value:'all'}]}),
  difficulty:element({value:'all',options:[{value:'all'}]}),
  mode:element({value:'balanced',options:[{value:'balanced'},{value:'random'}]}),
  count:element({value:'1',options:[{value:'1'}]}),
  answers:{querySelector(selector){const m=selector.match(/data-letter="([A-D])"/); if(!m)return null; return element({dataset:{letter:m[1]},click(){state.selectedLetter=m[1];}});}},
  start:element({click(){state.session=state.questions.slice();state.possible=1;ui.setup.hidden=true;ui.quiz.hidden=false;}}),
  daily:element({click(){state.runMode='daily';state.session=state.questions.slice();state.possible=1;ui.setup.hidden=true;ui.quiz.hidden=false;}}),
  lock:element({disabled:false,click(){state.locked=true;state.answered=1;state.answers.push({correct:state.selectedLetter==='B'});}}),
  next:element({hidden:false,click(){state.index+=1;ui.quiz.hidden=true;ui.results.hidden=false;}}),
  restart:element({click(){ui.results.hidden=true;ui.setup.hidden=false;state.session=[];state.index=0;state.locked=false;state.selectedLetter=null;}}),
  practiceMissed:element({hidden:true}),
  retry:element()
};
function filterPool(){return state.questions;}
function currentQuestion(){return state.session[state.index]||null;}
function updateCountOptions(count){ui.count.value=String(count);}
const document={documentElement:{dataset:{}}};
const window={addEventListener(type,handler){(listeners[type] ||= []).push(handler);}};
${bridge}
globalThis.__HARNESS__={state,ui,window,document,listeners};
`;

const sandbox={console,Object,Number,String,Boolean,Math,Date,Map,Error,Event:class Event{},performance:{now:()=>1000}};
vm.createContext(sandbox);
vm.runInContext(harness,sandbox,{filename:'high-iq-agent-bridge-v1.js'});
const {state,ui,window,document,listeners}=sandbox.__HARNESS__;
const api=window.__HIGH_IQ_AGENT__;
assert.equal(api.version,'high-iq-agent-bridge-v1');
assert.equal(document.documentElement.dataset.highIqAgentBridge,'high-iq-agent-bridge-v1');
assert.equal(listeners.error.length,1);
assert.equal(listeners.unhandledrejection.length,1);

let snapshot=api.snapshot();
assert.equal(snapshot.stage,'setup');
assert.deepEqual(Array.from(snapshot.legalActions),['configure','start','daily']);
assert.equal(snapshot.dataset.version,'2.4');
assert.equal(snapshot.telemetry.stallThresholdMs,8000);

assert.equal(api.start(),true);
snapshot=api.snapshot();
assert.equal(snapshot.stage,'question');
assert.equal(snapshot.session.currentQuestion.id,'Q1');
assert.equal(snapshot.session.currentQuestion.prompt,'Visible prompt?');
assert.equal(snapshot.session.currentQuestion.choices.B,'Beta');
assert.equal('correctLetter' in snapshot.session.currentQuestion,false);
assert.equal('correctAnswer' in snapshot.session.currentQuestion,false);

assert.equal(api.select('A'),true);
assert.equal(state.selectedLetter,'A');
assert.equal(api.lock(),true);
snapshot=api.snapshot();
assert.equal(snapshot.stage,'review');
assert.equal(snapshot.session.lastOutcome,false);
assert.equal(api.next(),true);
snapshot=api.snapshot();
assert.equal(snapshot.stage,'results');
assert.equal(snapshot.session.completed,true);
assert.equal(api.restart(),true);
assert.equal(api.snapshot().stage,'setup');

assert.throws(()=>api.select('Z'),/Unsupported High IQ answer/);
listeners.error[0]({message:'synthetic',filename:'app-v3.js',target:window});
listeners.unhandledrejection[0]({reason:new Error('synthetic rejection')});
snapshot=api.snapshot();
assert.equal(snapshot.telemetry.errors.length,2);
assert.equal(snapshot.telemetry.errors[0].kind,'runtime-error');
assert.equal(snapshot.telemetry.errors[1].kind,'unhandled-rejection');
assert.ok(snapshot.telemetry.recentActions.some(event=>event.action==='start'));
assert.ok(snapshot.telemetry.recentActions.some(event=>event.action==='select'));

console.log('High IQ autonomous playtest bridge contract passed.');

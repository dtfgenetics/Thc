import assert from 'node:assert/strict';
import fs from 'node:fs';

const root='site/public-route-patch/applied-learning';
const data=JSON.parse(fs.readFileSync(root+'/data.json','utf8'));
const source=fs.readFileSync(root+'/app.js','utf8');
const elements=new Map();
class Element {
  value='';
  textContent='';
  children=[];
  listeners=new Map();
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=children;}
  addEventListener(type,listener){this.listeners.set(type,listener);}
}
const globals={fetch:globalThis.fetch,document:globalThis.document,FormData:globalThis.FormData};
let requests=0;
try {
  globalThis.document={
    querySelector(selector){
      if(!elements.has(selector)) elements.set(selector,new Element());
      return elements.get(selector);
    },
    createElement(){return new Element();}
  };
  globalThis.FormData=class {
    constructor(form){this.values=form.values;}
    entries(){return Object.entries(this.values);}
    get(key){return this.values[key];}
  };
  globalThis.fetch=async url=>{
    assert.equal(url,'./data.json','runtime must not transmit local observations');
    requests++;
    return {ok:true,json:async()=>data};
  };
  await import('data:text/javascript,'+encodeURIComponent(source));
  assert.equal(elements.get('#graph-nodes').children.length,50);
  assert.equal(elements.get('#hypotheses').children.length,3);
  assert.equal(elements.get('#systems-tool-select').children.length,6);
  assert.match(elements.get('#systems-tool-title').textContent,/Grow Room Blueprint Lab/);
  assert.match(elements.get('#graph-relationship').textContent,/CLAIM-ENV-VPD-001/);
  const filter=elements.get('#graph-filter');
  filter.value='VPD';
  filter.listeners.get('input')();
  assert.ok(elements.get('#graph-nodes').children.length>0);
  assert.ok(elements.get('#graph-nodes').children.length<50);
  const submit=(id,values)=>{
    let prevented=false;
    elements.get(id).listeners.get('submit')({preventDefault(){prevented=true;},currentTarget:{values}});
    assert.ok(prevented,'form must render locally without a navigation');
  };
  submit('#dli-form',{ppfd:'500',hours:'18'});
  assert.match(elements.get('#dli-result').textContent,/^32\.40 /);
  submit('#dli-form',{ppfd:'500',hours:'25'});
  assert.equal(elements.get('#dli-result').textContent,'Check the input values.');
  submit('#measurement-form',{temperatureC:'24',relativeHumidityPct:'60',sensorLocation:'canopy',biasNotes:'none'});
  const observation=JSON.parse(elements.get('#measurement-output').textContent);
  assert.equal(observation.status,'local-learning-evidence');
  assert.equal(observation.sourceSha,data.sourceSha);

  submit('#systems-tool-form',{roomLengthFt:'10',roomWidthFt:'10',accessNotes:'training'});
  const blueprint=JSON.parse(elements.get('#systems-tool-output').textContent);
  assert.equal(blueprint.toolId,'ALTOOL-GROW-ROOM-BLUEPRINT-001');
  assert.equal(blueprint.result.floorAreaSqFt,100);
  assert.equal(blueprint.status,'local-learning-record');

  const selector=elements.get('#systems-tool-select');
  selector.value='ALTOOL-CALIBRATION-BENCH-001';
  selector.listeners.get('change')();
  submit('#systems-tool-form',{deviceId:'SIM-PH-1',verificationResult:'fail',notes:'check failed'});
  const calibration=JSON.parse(elements.get('#systems-tool-output').textContent);
  assert.match(calibration.result.decision,/recalibrate-or-service/);

  assert.equal(requests,1,'local interactions must not transmit observations');
  globalThis.fetch=async()=>({ok:true,json:async()=>({...data,sourceSha:'wrong-revision'})});
  await assert.rejects(import('data:text/javascript,'+encodeURIComponent(source+'\n// mismatch fixture')),/source pin mismatch/);
  console.log('Applied Learning runtime: graph/filter, hypotheses, DLI, six systems tools, local privacy and revision rejection passed.');
} finally {
  for(const [key,value] of Object.entries(globals)){
    if(value===undefined) delete globalThis[key];
    else globalThis[key]=value;
  }
}

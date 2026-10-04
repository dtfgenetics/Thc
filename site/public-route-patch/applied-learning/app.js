const SOURCE_SHA='9ce4c11da8f7749775e2b886d57c303ea6723a61';

const data=await fetch('./data.json',{cache:'no-store'}).then(response=>{
  if(!response.ok) throw new Error('Applied Learning data unavailable');
  return response.json();
});
if(data.sourceSha!==SOURCE_SHA) throw new Error('Applied Learning source pin mismatch');

const filter=document.querySelector('#graph-filter');
const list=document.querySelector('#graph-nodes');
function renderGraph(){
  const q=filter.value.trim().toLowerCase();
  const visible=data.graph.nodes.filter(node=>!q||[node.canonicalId,node.canonicalType,node.kind].filter(Boolean).some(value=>String(value).toLowerCase().includes(q)));
  list.replaceChildren(...visible.map(node=>{
    const li=document.createElement('li');
    const strong=document.createElement('strong'); strong.textContent=node.canonicalId;
    const small=document.createElement('span'); small.textContent=node.canonicalType;
    li.append(strong,small); return li;
  }));
  document.querySelector('#graph-stats').textContent=`${visible.length} of ${data.graph.nodes.length} canonical IDs shown`;
}
filter.addEventListener('input',renderGraph);
renderGraph();
document.querySelector('#graph-relationship').textContent=data.graph.edges
  .map(edge=>`${edge.source.replace(/^ALNODE-/,'')} → ${edge.relationship} → ${edge.target.replace(/^ALNODE-/,'')} · evidence ${(edge.evidenceIds||[]).join(', ')}`)
  .join('\n');

const measurementForm=document.querySelector('#measurement-form');
measurementForm.addEventListener('submit',event=>{
  event.preventDefault();
  const values=Object.fromEntries(new FormData(event.currentTarget).entries());
  document.querySelector('#measurement-output').textContent=JSON.stringify({
    activityId:data.measurement.id,
    status:'local-learning-evidence',
    sourceSha:SOURCE_SHA,
    values,
    note:'Stored nowhere; not credential evidence.'
  },null,2);
});

document.querySelector('#dli-form').addEventListener('submit',event=>{
  event.preventDefault();
  const fd=new FormData(event.currentTarget);
  const ppfd=Number(fd.get('ppfd'));
  const hours=Number(fd.get('hours'));
  const out=document.querySelector('#dli-result');
  if(!Number.isFinite(ppfd)||ppfd<0||!Number.isFinite(hours)||hours<=0||hours>24){
    out.textContent='Check the input values.';
    return;
  }
  const dli=ppfd*hours*3600/1_000_000;
  out.textContent=`${dli.toFixed(2)} ${data.calculator.output.unit}`;
});

const wrap=document.querySelector('#hypotheses');
wrap.replaceChildren(...data.differential.hypotheses.map(h=>{
  const article=document.createElement('article');
  const title=document.createElement('h3'); title.textContent=h.label;
  const why=document.createElement('p'); why.textContent=h.whyPlausible;
  const upTitle=document.createElement('h4'); upTitle.textContent='Raises confidence';
  const up=document.createElement('ul');
  up.replaceChildren(...h.evidenceThatRaisesConfidence.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
  const downTitle=document.createElement('h4'); downTitle.textContent='Lowers confidence';
  const down=document.createElement('ul');
  down.replaceChildren(...h.evidenceThatLowersConfidence.map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
  article.append(title,why,upTitle,up,downTitle,down);
  return article;
}));

const systemsSelect=document.querySelector('#systems-tool-select');
const systemsForm=document.querySelector('#systems-tool-form');
let activeSystemTool=null;

function createSystemField(field){
  const label=document.createElement('label');
  label.textContent=field.label+(field.unit?` (${field.unit})`:'');
  let input;
  if(field.type==='choice'){
    input=document.createElement('select');
    const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Select…';input.append(placeholder);
    for(const option of field.options||[]){const row=document.createElement('option');row.value=option;row.textContent=option;input.append(row);}
  }else{
    input=document.createElement('input');
    input.type=field.type==='number'?'number':field.type==='timestamp'?'datetime-local':'text';
    if(input.type==='number') input.step='any';
  }
  input.name=field.id;
  input.required=field.required===true;
  label.append(input);
  return label;
}
function renderSystemTool(tool){
  activeSystemTool=tool;
  document.querySelector('#systems-tool-title').textContent=tool.title;
  document.querySelector('#systems-tool-summary').textContent=tool.summary;
  document.querySelector('#systems-tool-boundary').textContent=tool.boundary;
  document.querySelector('#systems-tool-output').textContent='';
  document.querySelector('#systems-tool-steps').replaceChildren(...tool.steps.map(step=>{
    const li=document.createElement('li');li.textContent=step.instruction;return li;
  }));
  document.querySelector('#systems-tool-fields').replaceChildren(...tool.fields.map(createSystemField));
}
function evaluateSystemTool(tool,values){
  if(tool.kind==='blueprint'){
    const length=Number(values.roomLengthFt),width=Number(values.roomWidthFt);
    if(!(length>0&&width>0&&length<=1000&&width<=1000)) return {error:'Room dimensions must be positive and within the training range.'};
    return {toolId:tool.id,status:'local-learning-preview',result:{floorAreaSqFt:length*width},values,note:tool.boundary};
  }
  if(tool.kind==='calibration'){
    return {toolId:tool.id,status:'local-learning-preview',result:{decision:values.verificationResult==='pass'?'measurement-eligible-for-contextual-interpretation':'stop-recalibrate-or-service-and-repeat-verification'},values,note:tool.boundary};
  }
  return {toolId:tool.id,status:'local-learning-record',values,note:'Stored nowhere; not credential evidence or a controlled facility record.'};
}
const tools=data.tools||[];
systemsSelect.replaceChildren(...tools.map(tool=>{const option=document.createElement('option');option.value=tool.id;option.textContent=tool.title;return option;}));
if(tools.length) renderSystemTool(tools[0]);
systemsSelect.addEventListener('change',()=>{
  const tool=tools.find(row=>row.id===systemsSelect.value);
  if(tool) renderSystemTool(tool);
});
systemsForm.addEventListener('submit',event=>{
  event.preventDefault();
  if(!activeSystemTool) return;
  const values=Object.fromEntries(new FormData(event.currentTarget).entries());
  document.querySelector('#systems-tool-output').textContent=JSON.stringify(evaluateSystemTool(activeSystemTool,values),null,2);
});

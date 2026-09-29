import {evaluateTelemetryRules,normalizeTelemetryRule} from './thc-telemetry-rules-core-v1.mjs';

const validDeviceIds=records=>[...new Set((Array.isArray(records)?records:[])
  .filter(row=>Number.isFinite(Date.parse(row?.observedAt)))
  .map(row=>String(row?.deviceId??'').trim())
  .filter(Boolean))].sort((a,b)=>a.localeCompare(b));

export function buildAlertBoardModel(records,rules,{previousStates={}}={}){
  const normalized=(Array.isArray(rules)?rules:[]).map(normalizeTelemetryRule);
  const devices=validDeviceIds(records);
  const evaluations=[];
  const nextStates={};

  if(!devices.length){
    for(const result of evaluateTelemetryRules(records,normalized,{previousStates})){
      evaluations.push({...result,deviceId:'',zone:''});
      nextStates['::'+result.ruleId]=result;
    }
  }else{
    for(const deviceId of devices){
      const deviceRows=(Array.isArray(records)?records:[]).filter(row=>String(row?.deviceId??'').trim()===deviceId);
      const latest=deviceRows.filter(row=>Number.isFinite(Date.parse(row?.observedAt))).sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt)).at(-1);
      const zone=String(latest?.zone??'').trim();
      for(const rule of normalized){
        if(rule.deviceId&&rule.deviceId!==deviceId)continue;
        if(rule.zone&&rule.zone!==zone)continue;
        const scoped={...rule,deviceId:rule.deviceId||deviceId};
        const key=deviceId+'::'+rule.id;
        const result=evaluateTelemetryRules(deviceRows,[scoped],{previousStates:{[rule.id]:previousStates[key]}})[0];
        const item={...result,deviceId,zone};
        evaluations.push(item);
        nextStates[key]=result;
      }
    }
  }

  const summary={active:0,pending:0,unknown:0,normal:0,disabled:0};
  for(const item of evaluations)summary[item.state]=(summary[item.state]||0)+1;
  const items=evaluations.filter(item=>item.state!=='normal'&&item.state!=='disabled');
  return {summary,items,evaluations,nextStates};
}

const clear=node=>{while(node?.firstChild)node.removeChild(node.firstChild)};
const cell=(doc,row,value)=>{
  const td=doc.createElement('td');
  td.textContent=value===null||value===undefined||value===''?'—':String(value);
  row.appendChild(td);
};

export function mountTelemetryAlertBoard({
  container,
  getRecords=()=>[],
  getRules=()=>[]
}={}){
  if(!container||typeof container.querySelector!=='function')throw new Error('Telemetry alert board requires a container.');
  container.innerHTML=
    '<div class="panel"><h2>Telemetry alerts</h2>'+
    '<p class="muted">Advisory alerts use your entered guardrails. Sustained samples and hysteresis reduce one-reading noise. No hardware is controlled.</p>'+
    '<div class="toolbar"><button class="btn primary" type="button" data-alert-refresh>Refresh alerts</button></div>'+
    '<div class="metric-grid" data-alert-summary></div>'+
    '<div class="result" data-alert-status aria-live="polite">No alert evaluation yet.</div>'+
    '<div class="table-wrap" tabindex="0"><table><thead><tr><th>Device</th><th>Zone</th><th>Rule</th><th>State</th><th>Direction</th><th>Value</th><th>Samples</th></tr></thead><tbody data-alert-body></tbody></table></div></div>';

  const doc=container.ownerDocument;
  const button=container.querySelector('[data-alert-refresh]');
  const summaryNode=container.querySelector('[data-alert-summary]');
  const status=container.querySelector('[data-alert-status]');
  const body=container.querySelector('[data-alert-body]');
  let previousStates={};

  const refresh=()=>{
    let model;
    try{
      model=buildAlertBoardModel(getRecords(),getRules(),{previousStates});
      previousStates=model.nextStates;
    }catch(error){
      status.textContent=error instanceof Error?error.message:'Could not evaluate telemetry alerts.';
      return null;
    }

    clear(summaryNode);
    for(const [value,label] of [[model.summary.active,'Active'],[model.summary.pending,'Pending'],[model.summary.unknown,'Unknown'],[model.summary.normal,'Normal']]){
      const card=doc.createElement('div'); card.className='metric';
      const b=doc.createElement('b'); b.textContent=String(value);
      const span=doc.createElement('span'); span.textContent=label;
      card.appendChild(b);card.appendChild(span);summaryNode.appendChild(card);
    }

    clear(body);
    for(const item of model.items){
      const row=doc.createElement('tr');
      cell(doc,row,item.deviceId||'Unspecified');
      cell(doc,row,item.zone||'Unspecified');
      cell(doc,row,item.ruleId);
      cell(doc,row,item.state);
      cell(doc,row,item.direction);
      cell(doc,row,item.value);
      cell(doc,row,item.count);
      body.appendChild(row);
    }
    status.textContent=model.summary.active
      ? model.summary.active+' active alert'+(model.summary.active===1?'':'s')+'. Review the affected devices before changing conditions.'
      : model.summary.pending
        ? model.summary.pending+' pending alert'+(model.summary.pending===1?'':'s')+' waiting for sustained samples.'
        : 'No active sustained alerts in the loaded telemetry snapshot.';
    return model;
  };

  button.addEventListener('click',refresh);
  return {refresh};
}

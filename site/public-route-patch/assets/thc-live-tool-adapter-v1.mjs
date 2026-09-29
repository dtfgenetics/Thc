import {normalizeTelemetryPacket,telemetryFreshness,packetToToolFields} from './thc-live-data-core-v1.mjs';

export function parseLiveJsonPacket(text,options={}){
  let value;
  try{value=JSON.parse(String(text??''))}catch{throw new Error('Telemetry JSON could not be parsed.')}
  if(!value||Array.isArray(value)||typeof value!=='object')throw new Error('Telemetry JSON must contain one object packet.');
  return normalizeTelemetryPacket(value,options);
}

export function applyPacketFields(packet,tool,resolveField=id=>globalThis.document?.getElementById(id)){
  const mapped=packetToToolFields(packet,tool);
  const applied={};
  for(const [id,value] of Object.entries(mapped)){
    if(!Number.isFinite(value))continue;
    const field=resolveField(id);
    if(!field)continue;
    field.value=String(value);
    applied[id]=value;
    if(typeof field.dispatchEvent==='function'&&typeof globalThis.Event==='function'){
      field.dispatchEvent(new Event('input',{bubbles:true}));
    }else if(Array.isArray(field.events)){
      field.events.push('input');
    }
  }
  return applied;
}

const safeSlug=value=>String(value||'tool').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'tool';

export function mountLiveToolAdapter({
  container,
  tool,
  zoneField=null,
  title='Live sensor adapter',
  staleMinutes=10,
  onApplied=()=>{}
}={}){
  if(!container||typeof container.querySelector!=='function')throw new Error('Live tool adapter requires a container.');
  const slug=safeSlug(tool);
  container.innerHTML=
    '<section class="panel" data-live-tool-adapter="'+slug+'">'+
    '<h2>'+title+'</h2>'+
    '<p class="muted">Paste one read-only telemetry JSON packet. Preview it, then apply mapped measurements to this tool. Nothing is saved automatically.</p>'+
    '<div class="fields">'+
    '<div class="field"><label>Source label</label><input data-live-source value="json-adapter" autocomplete="off"></div>'+
    '<div class="field"><label>Device / sensor ID</label><input data-live-device value="sensor-1" autocomplete="off"></div>'+
    '<div class="field"><label>Stale after (minutes)</label><input data-live-stale type="number" min="1" step="1" value="'+Math.max(1,Number(staleMinutes)||10)+'"></div>'+
    '</div>'+
    '<div class="field"><label>Telemetry JSON</label><textarea data-live-json rows="6" spellcheck="false" placeholder=\'{"createdAt":"2026-09-28T19:00:00Z","temperatureC":25,"humidity":60}\'></textarea></div>'+
    '<div class="toolbar"><button class="btn" data-live-preview type="button">Preview packet</button><button class="btn primary" data-live-apply type="button">Apply packet</button></div>'+
    '<div class="result" data-live-status aria-live="polite">No live packet previewed.</div>'+
    '<p class="muted">No API keys, bearer tokens, passwords, connection URLs, or packets are stored here.</p>'+
    '</section>';

  const source=container.querySelector('[data-live-source]');
  const device=container.querySelector('[data-live-device]');
  const stale=container.querySelector('[data-live-stale]');
  const json=container.querySelector('[data-live-json]');
  const status=container.querySelector('[data-live-status]');
  const previewButton=container.querySelector('[data-live-preview]');
  const applyButton=container.querySelector('[data-live-apply]');
  let packet=null;

  const preview=()=>{
    try{
      const raw=JSON.parse(String(json.value||''));
      if(!raw||Array.isArray(raw)||typeof raw!=='object')throw new Error('Telemetry JSON must contain one object packet.');
      const zone=zoneField?.value?.trim?.()||raw.zone||raw.room||'';
      packet=normalizeTelemetryPacket(raw,{
        sourceId:source.value.trim()||'json-adapter',
        deviceId:device.value.trim()||undefined,
        zone
      });
      const metrics=Object.keys(packet.metrics);
      if(!metrics.length)throw new Error('No recognized numeric telemetry metrics were found.');
      const fresh=telemetryFreshness(packet,{staleAfterMs:Math.max(1,Number(stale.value)||10)*60*1000});
      status.textContent=(packet.sourceId||'source')+' · '+(packet.deviceId||'device')+' · '+fresh.state+' · '+metrics.length+' mapped metric'+(metrics.length===1?'':'s')+(packet.observedAt?' · observed '+new Date(packet.observedAt).toLocaleString():' · source timestamp unavailable');
      return packet;
    }catch(error){
      packet=null;
      status.textContent=error instanceof Error?error.message:'Could not parse telemetry JSON.';
      return null;
    }
  };

  previewButton.addEventListener('click',preview);
  applyButton.addEventListener('click',()=>{
    const current=packet||preview();
    if(!current)return;
    const applied=applyPacketFields(current,tool,id=>container.ownerDocument?.getElementById(id));
    if(current.zone&&zoneField)zoneField.value=current.zone;
    onApplied({packet:current,applied});
    const count=Object.keys(applied).length;
    status.textContent='Applied '+count+' mapped field'+(count===1?'':'s')+' from '+current.deviceId+'. Review values and use this tool’s normal save action if you want a permanent record.';
  });

  return {preview,apply:()=>applyButton.click(),getPacket:()=>packet};
}

import {
  normalizeTelemetryPacket,
  telemetryFreshness,
  packetToToolFields,
  createRestPollingAdapter,
  createWebSocketAdapter
} from './thc-live-data-core-v1.mjs';

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
    '<p class="muted">Use one manual JSON packet, a read-only HTTP endpoint, or a WebSocket feed. Incoming measurements update this form only when you apply them or enable auto-apply. Nothing is saved to tool history automatically.</p>'+
    '<div class="fields">'+
    '<div class="field"><label>Source label</label><input data-live-source value="json-adapter" autocomplete="off"></div>'+
    '<div class="field"><label>Device / sensor ID</label><input data-live-device value="sensor-1" autocomplete="off"></div>'+
    '<div class="field"><label>Stale after (minutes)</label><input data-live-stale type="number" min="1" step="1" value="'+Math.max(1,Number(staleMinutes)||10)+'"></div>'+
    '<div class="field"><label>Transport</label><select data-live-transport><option value="manual">Manual JSON</option><option value="http">HTTP polling · GET only</option><option value="ws">WebSocket</option></select></div>'+
    '<div class="field" data-live-endpoint-wrap hidden><label>Read-only endpoint</label><input data-live-endpoint type="url" inputmode="url" autocomplete="off" placeholder="https://gateway.example/telemetry"></div>'+
    '<div class="field" data-live-interval-wrap hidden><label>HTTP poll interval (seconds)</label><input data-live-interval type="number" min="1" step="1" value="10"></div>'+
    '</div>'+
    '<div class="field" data-live-json-wrap><label>Telemetry JSON</label><textarea data-live-json rows="6" spellcheck="false" placeholder=\'{"createdAt":"2026-09-28T19:00:00Z","temperatureC":25,"humidity":60}\'></textarea></div>'+
    '<div class="field"><label><input data-live-auto-apply type="checkbox"> Auto-apply incoming live packets to the form (never auto-save history)</label></div>'+
    '<div class="live-status-board" aria-label="Live telemetry connection status">'+
    '<div class="live-status-card"><span>Connection</span><strong data-live-state>Manual</strong></div>'+
    '<div class="live-status-card"><span>Source / device</span><strong data-live-identity>Not connected</strong></div>'+
    '<div class="live-status-card"><span>Last observation</span><strong data-live-observed>—</strong></div>'+
    '<div class="live-status-card"><span>Packet age</span><strong data-live-age>—</strong></div>'+
    '<div class="live-status-card"><span>Mapped metrics</span><strong data-live-metrics>0</strong></div>'+
    '</div>'+
    '<div class="toolbar"><button class="btn" data-live-preview type="button">Preview packet</button><button class="btn primary" data-live-apply type="button">Apply latest</button><button class="btn" data-live-start type="button" disabled>Start live connection</button><button class="btn" data-live-stop type="button" disabled>Stop</button></div>'+
    '<div class="result" data-live-status aria-live="polite">No live packet previewed.</div>'+
    '<p class="muted">Connection settings and packets are not stored. Do not put API keys, bearer tokens, passwords, or other secrets in endpoint URLs. HTTP mode is forced to GET and is subject to browser CORS. WebSocket mode sends no application messages.</p>'+
    '</section>';

  const source=container.querySelector('[data-live-source]');
  const device=container.querySelector('[data-live-device]');
  const stale=container.querySelector('[data-live-stale]');
  const transport=container.querySelector('[data-live-transport]');
  const endpointWrap=container.querySelector('[data-live-endpoint-wrap]');
  const endpoint=container.querySelector('[data-live-endpoint]');
  const intervalWrap=container.querySelector('[data-live-interval-wrap]');
  const interval=container.querySelector('[data-live-interval]');
  const jsonWrap=container.querySelector('[data-live-json-wrap]');
  const json=container.querySelector('[data-live-json]');
  const autoApply=container.querySelector('[data-live-auto-apply]');
  const status=container.querySelector('[data-live-status]');
  const stateOut=container.querySelector('[data-live-state]');
  const identityOut=container.querySelector('[data-live-identity]');
  const observedOut=container.querySelector('[data-live-observed]');
  const ageOut=container.querySelector('[data-live-age]');
  const metricsOut=container.querySelector('[data-live-metrics]');
  const previewButton=container.querySelector('[data-live-preview]');
  const applyButton=container.querySelector('[data-live-apply]');
  const startButton=container.querySelector('[data-live-start]');
  const stopButton=container.querySelector('[data-live-stop]');
  let packet=null,connection=null;

  const normalizeOptions=()=>({
    sourceId:source.value.trim()||transport.value||'json-adapter',
    deviceId:device.value.trim()||undefined,
    zone:zoneField?.value?.trim?.()||''
  });

  const formatAge=ageMs=>{
    if(!Number.isFinite(ageMs))return 'Unknown';
    const seconds=Math.round(ageMs/1000);
    if(seconds<60)return seconds+' sec';
    const minutes=Math.round(seconds/60);
    if(minutes<60)return minutes+' min';
    const hours=Math.round(minutes/60);
    return hours+' hr';
  };
  const updateStatusBoard=(current,{connectionState=null}={})=>{
    const metrics=Object.keys(current?.metrics||{});
    const fresh=current?telemetryFreshness(current,{staleAfterMs:Math.max(1,Number(stale.value)||10)*60*1000}):null;
    const mode=transport.value;
    stateOut.textContent=connectionState||(!current?(mode==='manual'?'Manual':'Disconnected'):(fresh?.state==='stale'?'Stale':mode==='manual'?'Preview':'Live data'));
    stateOut.dataset.state=(connectionState||fresh?.state||mode).toLowerCase().replace(/[^a-z]+/g,'-');
    identityOut.textContent=current?((current.sourceId||'source')+' / '+(current.deviceId||'device')):(source.value.trim()||mode);
    observedOut.textContent=current?.observedAt?new Date(current.observedAt).toLocaleString():'—';
    ageOut.textContent=fresh?formatAge(fresh.ageMs):'—';
    metricsOut.textContent=String(metrics.length);
  };
  const packetSummary=current=>{
    const metrics=Object.keys(current?.metrics||{});
    const fresh=telemetryFreshness(current,{staleAfterMs:Math.max(1,Number(stale.value)||10)*60*1000});
    return (current?.sourceId||'source')+' · '+(current?.deviceId||'device')+' · '+fresh.state+' · '+metrics.length+' mapped metric'+(metrics.length===1?'':'s')+(current?.observedAt?' · observed '+new Date(current.observedAt).toLocaleString():' · source timestamp unavailable');
  };

  const applyCurrent=(current=packet,{announce=true}={})=>{
    if(!current)return {};
    const applied=applyPacketFields(current,tool,id=>container.ownerDocument?.getElementById(id));
    if(current.zone&&zoneField)zoneField.value=current.zone;
    onApplied({packet:current,applied});
    const count=Object.keys(applied).length;
    if(announce)status.textContent='Applied '+count+' mapped field'+(count===1?'':'s')+' from '+current.deviceId+'. Review values and use this tool’s normal save action if you want a permanent record.';
    return applied;
  };

  const receivePacket=current=>{
    packet=current;
    updateStatusBoard(current,{connectionState:telemetryFreshness(current,{staleAfterMs:Math.max(1,Number(stale.value)||10)*60*1000}).state==='stale'?'Stale':'Live data'});
    if(autoApply.checked){
      const applied=applyCurrent(current,{announce:false});
      status.textContent=packetSummary(current)+' · auto-applied '+Object.keys(applied).length+' field'+(Object.keys(applied).length===1?'':'s')+' · not saved';
    }else{
      status.textContent=packetSummary(current)+' · latest packet ready to apply';
    }
  };

  const preview=()=>{
    try{
      const raw=JSON.parse(String(json.value||''));
      if(!raw||Array.isArray(raw)||typeof raw!=='object')throw new Error('Telemetry JSON must contain one object packet.');
      packet=normalizeTelemetryPacket(raw,{
        ...normalizeOptions(),
        zone:zoneField?.value?.trim?.()||raw.zone||raw.room||''
      });
      if(!Object.keys(packet.metrics).length)throw new Error('No recognized numeric telemetry metrics were found.');
      updateStatusBoard(packet,{connectionState:telemetryFreshness(packet,{staleAfterMs:Math.max(1,Number(stale.value)||10)*60*1000}).state==='stale'?'Stale':'Preview'});
      status.textContent=packetSummary(packet);
      return packet;
    }catch(error){
      packet=null;
      updateStatusBoard(null,{connectionState:'Invalid packet'});
      status.textContent=error instanceof Error?error.message:'Could not parse telemetry JSON.';
      return null;
    }
  };

  const stopConnection=()=>{
    if(connection){
      if(typeof connection.stop==='function')connection.stop();
      if(typeof connection.close==='function')connection.close();
    }
    connection=null;
    if(transport.value!=='manual')updateStatusBoard(packet,{connectionState:'Disconnected'});
    startButton.disabled=transport.value==='manual';
    stopButton.disabled=true;
  };

  const startConnection=()=>{
    stopConnection();
    const mode=transport.value;
    if(mode==='manual'){
      status.textContent='Manual JSON mode does not open a live connection.';
      return null;
    }
    const url=endpoint.value.trim();
    if(!url){
      status.textContent='Enter a read-only telemetry endpoint first.';
      return null;
    }
    const onError=error=>{status.textContent=error instanceof Error?error.message:'Live telemetry connection error.'};
    try{
      if(mode==='http'){
        connection=createRestPollingAdapter({
          url,
          intervalMs:Math.max(1,Number(interval.value)||10)*1000,
          normalizeOptions:normalizeOptions(),
          onPacket:receivePacket,
          onError
        });
        connection.start();
        updateStatusBoard(packet,{connectionState:'Connecting'});
        status.textContent='HTTP polling started. Waiting for a recognized telemetry packet…';
      }else{
        connection=createWebSocketAdapter({
          url,
          normalizeOptions:normalizeOptions(),
          onPacket:receivePacket,
          onError,
          onState:state=>{
            if(state?.state)updateStatusBoard(packet,{connectionState:state.state});
            if(state?.state==='stale'||state?.state==='offline')status.textContent='WebSocket '+state.state+'. Waiting for fresh telemetry…';
          }
        });
        connection.connect();
        updateStatusBoard(packet,{connectionState:'Connecting'});
        status.textContent='WebSocket connection started. Waiting for a recognized telemetry packet…';
      }
      startButton.disabled=true;
      stopButton.disabled=false;
      return connection;
    }catch(error){
      connection=null;
      startButton.disabled=false;
      stopButton.disabled=true;
      status.textContent=error instanceof Error?error.message:'Could not start live telemetry connection.';
      return null;
    }
  };

  const refreshTransportUi=()=>{
    stopConnection();
    const mode=transport.value;
    const manual=mode==='manual';
    jsonWrap.hidden=!manual;
    previewButton.hidden=!manual;
    endpointWrap.hidden=manual;
    intervalWrap.hidden=mode!=='http';
    startButton.disabled=manual;
    endpoint.placeholder=mode==='ws'?'wss://gateway.example/telemetry':'https://gateway.example/telemetry';
    source.value=manual?'json-adapter':mode==='http'?'http-poll':'websocket';
    updateStatusBoard(packet,{connectionState:manual?'Manual':'Disconnected'});
    status.textContent=manual?'Manual JSON mode ready.':'Enter a read-only '+(mode==='http'?'HTTP':'WebSocket')+' endpoint, then start the connection.';
  };

  previewButton.addEventListener('click',preview);
  applyButton.addEventListener('click',()=>applyCurrent(packet||preview()));
  startButton.addEventListener('click',startConnection);
  stopButton.addEventListener('click',()=>{stopConnection();status.textContent='Live connection stopped. Latest packet remains available to apply.'});
  transport.addEventListener('change',refreshTransportUi);
  refreshTransportUi();

  return {
    preview,
    apply:()=>applyCurrent(packet||preview()),
    start:startConnection,
    stop:stopConnection,
    getPacket:()=>packet,
    getConnection:()=>connection
  };
}

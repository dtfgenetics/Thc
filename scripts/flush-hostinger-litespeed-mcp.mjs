// Purge Hostinger/LiteSpeed cache through the authenticated WordPress MCP endpoint.
const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
if(!username||!password) throw new Error('WordPress credentials are required');

const endpoint=`${siteUrl}/wp-json/hostinger-ai-assistant/v1/mcp`;
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
let sessionId='';

function parseBody(text){
  try{return JSON.parse(text)}catch{}
  const dataLines=text.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trim()).filter(Boolean);
  for(const line of dataLines){try{return JSON.parse(line)}catch{}}
  return {raw:text.slice(0,2000)};
}

async function rpc(payload){
  const headers={Authorization:auth,Accept:'application/json, text/event-stream','Content-Type':'application/json','Cache-Control':'no-cache'};
  if(sessionId) headers['Mcp-Session-Id']=sessionId;
  const response=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify(payload)});
  const next=response.headers.get('mcp-session-id')||response.headers.get('Mcp-Session-Id');
  if(next) sessionId=next;
  const text=await response.text();
  const body=parseBody(text);
  if(!response.ok || body?.error) throw new Error(`MCP request failed (${response.status}): ${JSON.stringify(body?.error||body).slice(0,1200)}`);
  return body;
}

let initialized;
for(const protocolVersion of ['2025-06-18','2025-03-26','2024-11-05']){
  try{
    initialized=await rpc({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion,capabilities:{},clientInfo:{name:'DTFSeedsCacheRepair',version:'1.0.0'}}});
    break;
  }catch(error){
    if(protocolVersion==='2024-11-05') throw error;
  }
}

try{await rpc({jsonrpc:'2.0',method:'notifications/initialized',params:{}})}catch{}
// Discover the currently exposed Hostinger cache operation instead of assuming
// that the plugin's MCP tool name is permanently stable.
const listed=await rpc({jsonrpc:'2.0',id:2,method:'tools/list',params:{}});
const advertised=listed?.result?.tools;
if(!Array.isArray(advertised)) throw new Error('Hostinger MCP did not return a tool inventory. Cache has NOT been purged.');
const candidates=advertised.filter(tool=>{
  const name=String(tool?.name||'').toLowerCase();
  const description=String(tool?.description||'').toLowerCase();
  return name.includes('hostinger')
    && /(cache|litespeed)/.test(name)
    && /(purge|flush|clear)/.test(name+' '+description)
    && !/(disable|delete|reset|uninstall)/.test(name);
});
if(candidates.length!==1) {
  console.error(JSON.stringify({cacheToolCandidates:candidates.map(x=>x.name),advertisedToolCount:advertised.length}));
  throw new Error('Expected exactly one authorized Hostinger cache purge tool; no cache mutation performed.');
}
const selected=candidates[0];
const schema=selected.inputSchema||selected.input_schema||{};
if(Array.isArray(schema.required)&&schema.required.length) {
  throw new Error('Selected Hostinger cache tool requires explicit parameters; refusing an unverified request.');
}
console.log('Discovered authorized Hostinger cache purge operation: '+selected.name);
const result=await rpc({jsonrpc:'2.0',id:3,method:'tools/call',params:{name:selected.name,arguments:{}}});
if (!result?.result || result.result.isError === true || result.result.error) {
  throw new Error('Hostinger LiteSpeed cache flush returned a missing or failed tool result.');
}
console.log('Hostinger LiteSpeed cache flush tool returned without an error.');
console.log(JSON.stringify({result:result?.result||null},null,2).slice(0,3000));

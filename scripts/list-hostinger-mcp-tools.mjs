// Read-only MCP capability audit for the production WordPress Hostinger assistant.
const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
if(!username||!password) throw new Error('WordPress credentials are required');
const endpoint=`${siteUrl}/wp-json/hostinger-ai-assistant/v1/mcp`;
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
let sessionId='';

async function rpc(payload){
  const headers={Authorization:auth,Accept:'application/json, text/event-stream','Content-Type':'application/json','Cache-Control':'no-cache'};
  if(sessionId) headers['Mcp-Session-Id']=sessionId;
  const response=await fetch(endpoint,{method:'POST',headers,body:JSON.stringify(payload)});
  const nextSession=response.headers.get('mcp-session-id')||response.headers.get('Mcp-Session-Id');
  if(nextSession) sessionId=nextSession;
  const text=await response.text();
  let body=text;
  try{body=JSON.parse(text)}catch{}
  return {status:response.status,ok:response.ok,sessionIdPresent:Boolean(nextSession),contentType:response.headers.get('content-type'),body};
}

const protocolVersions=['2025-06-18','2025-03-26','2024-11-05'];
let initialized=null;
for(const protocolVersion of protocolVersions){
  const attempt=await rpc({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion,capabilities:{},clientInfo:{name:'DTFSeedsRepairAudit',version:'1.0.1'}}});
  if(attempt.ok && !(attempt.body&&attempt.body.error)){
    initialized={protocolVersion,attempt};
    break;
  }
  initialized={protocolVersion,attempt};
}

const output={generatedAt:new Date().toISOString(),initialized,tools:null};
if(initialized?.attempt?.ok && !(initialized.attempt.body&&initialized.attempt.body.error)){
  try{await rpc({jsonrpc:'2.0',method:'notifications/initialized',params:{}})}catch{}
  output.tools=await rpc({jsonrpc:'2.0',id:2,method:'tools/list',params:{}});
}

function sanitize(value){
  if(Array.isArray(value)) return value.map(sanitize);
  if(value&&typeof value==='object'){
    const clean={};
    for(const [key,val] of Object.entries(value)){
      if(/token|secret|password|credential|cookie|authorization|session/i.test(key)) continue;
      clean[key]=sanitize(val);
    }
    return clean;
  }
  return value;
}
console.log(JSON.stringify(sanitize(output),null,2));

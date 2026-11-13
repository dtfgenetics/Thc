import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {publicHeaders} from './diagnose-lighthouse-access.mjs';

const TARGET='https://dtfseeds.com/';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export function safeNavigationEvent(event,origin='https://dtfseeds.com'){
  if(event?.method!=='Network.responseReceived'||event.params?.type!=='Document')return null;
  const response=event.params.response||{};
  let url;
  try{url=new URL(response.url);}catch{return null;}
  if(url.origin!==origin)return null;
  const raw=response.headers||{};
  const headers={get(name){
    const key=Object.keys(raw).find(k=>k.toLowerCase()===name.toLowerCase());
    return key?String(raw[key]):null;
  }};
  return {path:url.pathname,status:Number(response.status)||0,headers:publicHeaders(headers)};
}

export async function runChromeNavigationProbe(chromePath,{target=TARGET,timeoutMs=18000}={}){
  const scratch=await fs.mkdtemp(path.join(os.tmpdir(),'dtf-chrome-access-'));
  const result={schemaVersion:1,client:'chrome-cdp',targetPath:new URL(target).pathname,documents:[],state:'unmeasured'};
  let chrome,ws;
  try{
    chrome=spawn(chromePath,[
      '--headless=new','--no-sandbox','--disable-dev-shm-usage','--no-first-run',
      '--no-default-browser-check','--disable-background-networking',
      '--remote-debugging-port=0',`--user-data-dir=${scratch}`,'about:blank'
    ],{stdio:'ignore'});
    const deadline=Date.now()+timeoutMs;
    let port;
    while(Date.now()<deadline){
      if(chrome.exitCode!==null)throw Error('ChromeExited');
      try{
        const data=await fs.readFile(path.join(scratch,'DevToolsActivePort'),'utf8');
        port=Number(data.split(/\r?\n/)[0]);
        if(Number.isInteger(port)&&port>0)break;
      }catch{}
      await pause(100);
    }
    if(!port)throw Error('ChromeDebuggerUnavailable');
    const descriptor=await fetch(`http://127.0.0.1:${port}/json/version`);
    if(!descriptor.ok)throw Error('ChromeDebuggerUnavailable');
    const info=await descriptor.json();
    ws=new WebSocket(info.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{
      ws.addEventListener('open',resolve,{once:true});
      ws.addEventListener('error',()=>reject(Error('ChromeWebSocketError')),{once:true});
      setTimeout(()=>reject(Error('ChromeWebSocketTimeout')),4000);
    });
    let seq=0,sessionId;
    const pending=new Map();
    ws.addEventListener('message',event=>{
      let msg;try{msg=JSON.parse(String(event.data));}catch{return;}
      if(msg.id&&pending.has(msg.id)){
        const done=pending.get(msg.id);pending.delete(msg.id);
        if(msg.error)done.reject(Error('ChromeProtocolError'));else done.resolve(msg.result||{});
      }else if(msg.sessionId===sessionId){
        const record=safeNavigationEvent(msg,new URL(target).origin);
        if(record)result.documents.push(record);
        if(msg.method==='Network.loadingFailed'&&msg.params?.canceled===false){
          result.networkFailed=true;
        }
      }
    });
    const command=(method,params={},session)=>{
      const id=++seq;
      return new Promise((resolve,reject)=>{
        pending.set(id,{resolve,reject});
        ws.send(JSON.stringify({id,method,params,...(session?{sessionId:session}:{})}));
        setTimeout(()=>{if(pending.has(id)){pending.delete(id);reject(Error('ChromeProtocolTimeout'));}},6000);
      });
    };
    const {targetId}=await command('Target.createTarget',{url:'about:blank'});
    const attached=await command('Target.attachToTarget',{targetId,flatten:true});
    sessionId=attached.sessionId;
    await command('Network.enable',{},sessionId);
    await command('Page.enable',{},sessionId);
    await command('Page.navigate',{url:target},sessionId);
    const end=Math.min(deadline,Date.now()+8000);
    while(Date.now()<end&&!result.documents.length&&!result.networkFailed)await pause(150);
    // A redirect chain may emit a second document response shortly after the first.
    if(result.documents.length)await pause(350);
    result.state=result.documents.length?'captured':result.networkFailed?'navigation-failed':'no-document-response';
  }catch(error){
    result.state='probe-error';
    result.errorName=String(error?.message||'ProbeError').replace(/[^A-Za-z]/g,'').slice(0,48);
  }finally{
    try{ws?.close();}catch{}
    if(chrome&&!chrome.killed)chrome.kill('SIGKILL');
    await fs.rm(scratch,{recursive:true,force:true,maxRetries:3,retryDelay:100}).catch(()=>{});
  }
  return result;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const output=process.env.WEB_QA_ARTIFACT_DIR||'.artifacts/web-qa';
  const report=await runChromeNavigationProbe(process.env.CHROME_PATH||'/usr/bin/chromium');
  await fs.mkdir(output,{recursive:true});
  await fs.writeFile(path.join(output,'lighthouse-chrome-navigation.json'),JSON.stringify(report,null,2)+'\n');
  console.log('Sanitized Chrome document navigation diagnostic:');
  console.log(JSON.stringify(report,null,2));
  // The original Lighthouse 403 remains fatal; this never replaces LHCI.
}

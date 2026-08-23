import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_V3_CASCADE_FIX||'').toLowerCase()==='true';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/dtf-v3-cascade-fix';
if(!username||!password) throw new Error('WordPress credentials are required');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-V3-Cascade-Fix/1.0'};
const backupDir=join(backupRoot,`cascade-${Date.now()}`);await mkdir(backupDir,{recursive:true});
const raw=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
async function request(path,options={}){const r=await fetch(`${siteUrl}${path}`,{...options,headers:{...headers,...(options.body?{'Content-Type':'application/json'}:{})},signal:AbortSignal.timeout(60000)});const t=await r.text();let b;try{b=t?JSON.parse(t):null}catch{b=t}if(!r.ok)throw new Error(`${options.method||'GET'} ${path} failed (${r.status}): ${typeof b==='string'?b.slice(0,500):JSON.stringify(b).slice(0,500)}`);return b}
async function getPage(slug){const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`);if(!Array.isArray(rows)||rows.length!==1)throw new Error(`Expected one ${slug} page`);return rows[0]}
const pattern=/<style\s+id=["']dtf-visual-polish-v3["'][^>]*>[\s\S]*?<\/style>/gi;
function moveLast(content){const text=raw(content);const blocks=text.match(pattern)||[];if(!blocks.length)return {content:text,found:false};const style=blocks.at(-1);const clean=text.replace(pattern,'').trim();return {content:`${clean}\n${style}`,found:true}}
const pages=await Promise.all([getPage('home'),getPage('learn')]);const changed=[];let found=0;
for(const p of pages){const next=moveLast(p.content);if(!next.found)continue;found++;await writeFile(join(backupDir,`page-${p.id}-${p.slug}-before.json`),`${JSON.stringify(p,null,2)}\n`);if(apply)await request(`/wp-json/wp/v2/pages/${p.id}`,{method:'POST',body:JSON.stringify({content:next.content,status:'publish'})});changed.push({id:p.id,slug:p.slug,endsWithV3:next.content.trim().endsWith('</style>')})}
const report={generatedAt:new Date().toISOString(),siteUrl,apply,found,changed};await writeFile(join(backupDir,'cascade-report.json'),`${JSON.stringify(report,null,2)}\n`);console.log(JSON.stringify(report,null,2));
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_GENETICS_LINE_PAGES||'').toLowerCase()==='true';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/wordpress-genetics-line-pages';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const catalog=JSON.parse(await readFile(process.env.GENETICS_CATALOG||'data/genetics/catalog.json','utf8'));
const products=JSON.parse(await readFile(process.env.GENETICS_PRODUCTS||'site/wordpress/products/genetics.json','utf8'));
const wanted=['blue-mango','blue-bubblegum'];
const lines=wanted.map(id=>catalog.lines?.find(line=>line.id===id));
if(lines.some(line=>!line)) throw new Error('Missing required genetics catalog lines.');
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`genetics-lines-${stamp}`);
await mkdir(backupDir,{recursive:true});
const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
const esc=(value='')=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');

async function request(path,options={},attempts=5){
  let last;
  for(let attempt=1;attempt<=attempts;attempt+=1){
    try{
      const response=await fetch(`${siteUrl}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(30000),headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Genetics-Line-Publisher/1.0',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
      const text=await response.text();let body=null;try{body=text?JSON.parse(text):null;}catch{body={raw:text.slice(0,1000)};}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${body?.message||body?.raw||'request failed'}`);
      return body;
    }catch(error){last=error;if(attempt<attempts) await sleep(attempt*1800);}
  }
  throw last;
}
async function publicHtml(path,marker){
  for(let attempt=1;attempt<=6;attempt+=1){
    try{
      const response=await fetch(`${siteUrl}${path}?dtf_genetics_line=${Date.now()}-${attempt}`,{redirect:'follow',signal:AbortSignal.timeout(30000),headers:{'Cache-Control':'no-cache, no-store, max-age=0','Pragma':'no-cache','User-Agent':'DTFSeeds-Genetics-Line-Public-Verify/1.0'}});
      const html=await response.text();
      if(response.ok&&html.includes(marker)) return html;
    }catch{}
    await sleep(attempt*2500);
  }
  throw new Error(`Public verification failed for ${path}`);
}
function parentCards(line){
  return (line.parents||[]).map((parent,index)=>`<article style="padding:18px;border:1px solid #d7e2d9;border-radius:18px;background:${index===0?'#fff3e4':'#eef1ff'}"><p style="margin:0 0 5px;color:#617267;font-size:.7rem;font-weight:900;letter-spacing:.09em;text-transform:uppercase">${index===0?'Seed parent':'Pollen parent'}</p><h3 style="margin:0;color:#102b1a;font-size:1.25rem">${esc(parent.name)}</h3></article>`).join('');
}
function traitCards(line){
  const items=Array.isArray(line.breedingDirection)?line.breedingDirection:[];
  if(!items.length) return '';
  return `<section style="padding:54px 0"><div style="display:flex;justify-content:space-between;gap:20px;align-items:end;flex-wrap:wrap;margin-bottom:20px"><div><p style="margin:0 0 8px;color:#1d7040;font-size:.75rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase">Breeding direction</p><h2 style="margin:0;color:#102b1a;font-size:clamp(2rem,4vw,3.2rem);letter-spacing:-.035em">What the project is selected toward</h2></div><p style="max-width:520px;margin:0;color:#526557;line-height:1.7">These are documented selection directions, not promises that every seed will express every trait.</p></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:14px">${items.map(item=>`<article style="padding:18px;border:1px solid #d7e2d9;border-radius:18px;background:#fff"><strong style="color:#102b1a">${esc(item)}</strong></article>`).join('')}</div></section>`;
}
function generationBlock(line,releases){
  const known=Array.isArray(line.knownGenerationForms)?line.knownGenerationForms:[];
  const rows=known.length?known.map(item=>`${item.generation}${item.seedType&&item.seedType!=='unspecified'?` · ${item.seedType}`:''}`):releases.map(item=>`${item.generation} · ${item.seedType}`);
  return `<section style="padding:34px 0"><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px"><article style="padding:22px;border-radius:22px;background:#102b1a;color:#fff"><p style="margin:0 0 7px;color:#d6b75c;font-size:.72rem;font-weight:900;letter-spacing:.11em;text-transform:uppercase">Documented forms</p><h2 style="margin:0 0 14px;font-size:1.8rem">Generation context</h2><div style="display:flex;gap:8px;flex-wrap:wrap">${rows.map(row=>`<span style="padding:8px 11px;border:1px solid rgba(255,255,255,.18);border-radius:999px;background:rgba(255,255,255,.06);font-size:.82rem;font-weight:800">${esc(row)}</span>`).join('')}</div></article><article style="padding:22px;border:1px solid #d7e2d9;border-radius:22px;background:#fff"><p style="margin:0 0 7px;color:#1d7040;font-size:.72rem;font-weight:900;letter-spacing:.11em;text-transform:uppercase">Release rule</p><h2 style="margin:0 0 10px;color:#102b1a;font-size:1.8rem">The listing is the transaction source</h2><p style="margin:0;color:#526557;line-height:1.7">Generation, seed type, pack size, price, inventory, and fulfillment details belong to the specific live product listing.</p></article></div></section>`;
}
function releaseCards(releases){
  if(!releases.length) return `<p style="color:#526557">No current retail listing is represented in the canonical product registry.</p>`;
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px">${releases.map(item=>`<article style="padding:22px;border:1px solid #d7e2d9;border-radius:22px;background:#fff;box-shadow:0 12px 30px rgba(13,55,29,.06)"><p style="margin:0 0 7px;color:#1d7040;font-size:.72rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase">${esc(item.generation)} · ${esc(item.seedType)}</p><h3 style="margin:0 0 9px;color:#102b1a;font-size:1.35rem">${esc(item.liveStoreLabel)}</h3><p style="margin:0 0 16px;color:#526557;line-height:1.65">${esc(item.lineage)}</p><a href="${esc(item.productPath)}" style="display:inline-flex;padding:10px 14px;border-radius:999px;background:#102b1a;color:#fff;text-decoration:none;font-weight:900">Open live listing</a></article>`).join('')}</div>`;
}
function pageHtml(line,releases){
  const marker=`genetics-line-${line.id}-v1`;
  const flowering=line.floweringWindowWeeks?`<div style="padding:18px;border-left:4px solid #d6b75c;border-radius:15px;background:#f7f2df"><strong style="display:block;color:#102b1a">Planning range: ${esc(line.floweringWindowWeeks.minimum)}–${esc(line.floweringWindowWeeks.maximum)} weeks</strong><span style="display:block;margin-top:6px;color:#526557;line-height:1.6">${esc(line.floweringWindowWeeks.qualifier)}</span></div>`:'';
  return `<div data-dtf-genetics-line-page="${esc(marker)}" style="background:#f7f4ea;color:#173420"><section style="background:radial-gradient(circle at 84% 12%,rgba(214,183,92,.2),transparent 28%),linear-gradient(145deg,#081b11,#0d2a19);color:#fff"><div style="max-width:1220px;margin:auto;padding:70px 22px 58px;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:34px;align-items:center"><div><p style="margin:0 0 10px;color:#d6b75c;font-size:.76rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase">DTF Genetics · line record</p><h1 style="margin:0;font-size:clamp(3rem,7vw,5.6rem);line-height:.94;letter-spacing:-.055em">${esc(line.name)}</h1><p style="max-width:720px;margin:20px 0 0;color:#d5e2d9;font-size:1.1rem;line-height:1.75">${esc(line.publicDescription)}</p><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:25px"><a href="#current-releases" style="padding:11px 17px;border-radius:999px;background:#d6b75c;color:#081b11;text-decoration:none;font-weight:900">Current releases</a><a href="/seeds/" style="padding:11px 17px;border:1px solid rgba(255,255,255,.3);border-radius:999px;color:#fff;text-decoration:none;font-weight:850">All genetics</a></div></div><div style="padding:22px;border:1px solid rgba(255,255,255,.16);border-radius:26px;background:rgba(255,255,255,.05)"><p style="margin:0 0 10px;color:#d6b75c;font-size:.72rem;font-weight:900;letter-spacing:.11em;text-transform:uppercase">Documented lineage</p><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px">${parentCards(line)}<div style="display:grid;place-items:center;padding:16px;border:1px solid rgba(255,255,255,.18);border-radius:18px;background:#173c25"><strong style="font-size:1.5rem">→</strong><span style="display:block;text-align:center;font-weight:900">${esc(line.name)}</span></div></div><p style="margin:13px 0 0;color:#c9d9ce;font-size:.86rem;line-height:1.6">${esc(line.lineage)}</p></div></div></section><main style="max-width:1220px;margin:auto;padding:0 22px 72px">${traitCards(line)}${flowering}${generationBlock(line,releases)}<section id="current-releases" style="padding:50px 0 24px"><p style="margin:0 0 8px;color:#1d7040;font-size:.75rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase">Current DTF release routes</p><h2 style="margin:0 0 20px;color:#102b1a;font-size:clamp(2rem,4vw,3.2rem);letter-spacing:-.035em">Shop the exact release</h2>${releaseCards(releases)}</section><section style="margin-top:38px;padding:26px;border:1px solid #d7e2d9;border-radius:24px;background:#eef3ea"><h2 style="margin:0 0 10px;color:#102b1a">Variation is part of the biology.</h2><p style="margin:0;color:#526557;line-height:1.75">Lineage and breeding direction describe the project. They do not guarantee phenotype, yield, potency, aroma, flavor, structure, uniformity, or finish date for every seed.</p></section></main></div>`;
}

const seedsRows=await request('/wp-json/wp/v2/pages?slug=seeds&context=edit&per_page=10');
if(!Array.isArray(seedsRows)||seedsRows.length!==1) throw new Error(`Expected one Seeds page, found ${Array.isArray(seedsRows)?seedsRows.length:'invalid response'}`);
const seedsPage=seedsRows[0];
const results=[];
for(const line of lines){
  const releases=(products.products||[]).filter(product=>product.canonicalName===line.name);
  const existing=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(line.id)}&context=edit&per_page=10`);
  if(!Array.isArray(existing)||existing.length>1) throw new Error(`${line.id}: expected zero or one WordPress page, found ${Array.isArray(existing)?existing.length:'invalid response'}`);
  const before=existing[0]||null;
  await writeFile(join(backupDir,`${line.id}-before.json`),`${JSON.stringify(before,null,2)}\n`,'utf8');
  const payload={title:line.name,slug:line.id,parent:seedsPage.id,status:'publish',excerpt:`${line.name}: ${line.lineage}. DTF Genetics lineage, breeding direction, generation context, and current release routes.`,content:pageHtml(line,releases)};
  let page=before;
  if(apply) page=before?await request(`/wp-json/wp/v2/pages/${before.id}`,{method:'POST',body:JSON.stringify(payload)}):await request('/wp-json/wp/v2/pages',{method:'POST',body:JSON.stringify(payload)});
  const route=`/seeds/${line.id}/`;
  if(apply){
    const html=await publicHtml(route,`data-dtf-genetics-line-page=\"genetics-line-${line.id}-v1\"`);
    if(!html.includes(line.lineage)) throw new Error(`${line.id}: public lineage text missing.`);
    for(const release of releases) if(!html.includes(release.productPath)) throw new Error(`${line.id}: public release link missing ${release.productPath}`);
  }
  results.push({id:line.id,pageId:page?.id||null,route,lineage:line.lineage,releases:releases.length,verified:apply});
}
const report={generatedAt:new Date().toISOString(),siteUrl,apply,backupDir,results};
await writeFile('wordpress-genetics-line-pages-report.json',`${JSON.stringify(report,null,2)}\n`,'utf8');
console.log(JSON.stringify(report,null,2));

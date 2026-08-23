import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/wordpress-learn-visible-backups';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers={Authorization:auth,Accept:'application/json','Content-Type':'application/json','User-Agent':'DTFSeeds-Learn-Infographic-Entry/1.0'};

async function request(path,options={}){
  const response=await fetch(`${siteUrl}${path}`,{...options,headers:{...headers,...(options.headers||{})},redirect:'follow',signal:AbortSignal.timeout(60000)});
  const text=await response.text();
  let body=null; try{body=text?JSON.parse(text):null}catch{body=text}
  if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,500):JSON.stringify(body).slice(0,500)}`);
  return body;
}

async function allEducationMedia(){
  const rows=[];
  for(let page=1;page<=8;page++){
    try{
      const batch=await request(`/wp-json/wp/v2/media?context=edit&per_page=100&page=${page}`);
      if(!Array.isArray(batch)||!batch.length) break;
      rows.push(...batch);
      if(batch.length<100) break;
    }catch(error){
      if(/invalid_page|400/i.test(error.message)) break;
      throw error;
    }
  }
  return rows.filter(m=>String(m.slug||'').startsWith('dtf-edu-')&&m.source_url);
}

function title(m){return String(m?.title?.rendered||m?.alt_text||'THC infographic').replace(/<[^>]+>/g,'').trim();}
function esc(v=''){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;');}
function pick(media,needles){
  return media.find(m=>{
    const hay=`${m.slug||''} ${title(m)} ${m.source_url||''}`.toLowerCase();
    return needles.every(n=>hay.includes(n.toLowerCase()));
  })||null;
}

const pages=await request('/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=10');
if(!Array.isArray(pages)||pages.length!==1) throw new Error(`Expected one Learn page; found ${Array.isArray(pages)?pages.length:'invalid'}`);
const learn=pages[0];
const media=await allEducationMedia();
if(media.length<20) throw new Error(`Only ${media.length} canonical education media items found`);

const selections=[
  {label:'Plant anatomy',route:'/learn/plant-biology/',media:pick(media,['cannabis','plant','anatomy'])||pick(media,['whole','plant','atlas'])},
  {label:'Nutrition & media',route:'/learn/nutrition-media/',media:pick(media,['nutrition','science'])||pick(media,['nutrient','uptake'])},
  {label:'Environment & VPD',route:'/learn/environment-vpd/',media:pick(media,['air','vpd'])||pick(media,['vapor','pressure','deficit'])},
  {label:'Plant health & IPM',route:'/learn/ipm/',media:pick(media,['beneficial','insects'])||pick(media,['spider','mite'])},
  {label:'Lifecycle & propagation',route:'/learn/lifecycle-propagation/',media:pick(media,['life','cycle'])||pick(media,['cloning','guide'])},
  {label:'Training & canopy',route:'/learn/training-canopy/',media:pick(media,['plant','training','basics'])||pick(media,['training','recovery'])},
].filter(x=>x.media);
if(selections.length<5) throw new Error(`Only ${selections.length} Learn visual selections resolved`);

const count=media.length;
const cards=selections.map(({label,route,media:m})=>`<a href="${route}" style="display:block;text-decoration:none;color:#143b25;background:#fff;border:1px solid #d8e5dc;border-radius:18px;overflow:hidden;box-shadow:0 12px 30px rgba(18,50,31,.08)"><span style="display:flex;align-items:center;justify-content:center;aspect-ratio:4/5;padding:10px;background:linear-gradient(180deg,#f6faf7 0%,#edf5ef 100%)"><img src="${esc(m.source_url)}" alt="${esc(title(m))}" loading="lazy" decoding="async" style="display:block;width:100%;height:100%;object-fit:contain;border-radius:10px"></span><span style="display:block;padding:13px 14px 15px"><strong style="display:block;line-height:1.3">${esc(label)}</strong><span style="display:block;color:#2b7a4a;font-size:.84rem;font-weight:800;margin-top:5px">Open topic →</span></span></a>`).join('');

const block=`<!-- dtf-learn-infographic-entry:start --><section id="thc-infographic-entry" style="background:linear-gradient(135deg,#0d2e1a 0%,#174a2b 62%,#1f6038 100%);color:#fff;margin:0 0 42px"><div style="max-width:1240px;margin:auto;padding:52px 22px 48px"><span style="display:inline-block;padding:7px 11px;border:1px solid rgba(255,255,255,.22);border-radius:999px;background:rgba(255,255,255,.08);font-size:.76rem;font-weight:900;text-transform:uppercase;letter-spacing:.11em">Teaching Healthy Cultivation · Visual Library</span><h2 style="font-size:clamp(2.2rem,5vw,4.25rem);line-height:1;letter-spacing:-.04em;margin:16px 0 14px;color:#fff">Browse ${count} THC Infographics</h2><p style="font-size:1.05rem;line-height:1.7;max-width:800px;color:#d8e7dc;margin:0">Explore plant anatomy, environment, lighting, nutrition, diagnostics, IPM, propagation, training, genetics, harvest science, and more through the visual learning library.</p><div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:22px"><a href="/learn/infographics/" style="display:inline-block;padding:12px 17px;border-radius:999px;background:#fff;color:#12351f;text-decoration:none;font-weight:900">Open all ${count} infographics</a><a href="/thc-grow-doc/" style="display:inline-block;padding:12px 17px;border-radius:999px;border:1px solid rgba(255,255,255,.35);color:#fff;text-decoration:none;font-weight:900">Open THC Grow Doc</a></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(185px,1fr));gap:14px;margin-top:30px;color:#143b25">${cards}</div></div></section><!-- dtf-learn-infographic-entry:end -->`;

const raw=String(learn.content?.raw??learn.content?.rendered??'');
const marker=/<!-- dtf-learn-infographic-entry:start -->[\s\S]*?<!-- dtf-learn-infographic-entry:end -->/;
const updated=marker.test(raw)?raw.replace(marker,block):`${block}${raw}`;
const featured=(pick(media,['cannabis','plant','anatomy'])||pick(media,['whole','plant','atlas'])||selections[0].media).id;

const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`learn-visible-${stamp}`);
await mkdir(backupDir,{recursive:true});
await writeFile(join(backupDir,'learn-before.json'),JSON.stringify({id:learn.id,slug:learn.slug,featured_media:learn.featured_media,content:raw},null,2));

const result=await request(`/wp-json/wp/v2/pages/${learn.id}`,{method:'POST',body:JSON.stringify({content:updated,featured_media:featured,status:'publish'})});
const verifyRaw=String(result.content?.raw??result.content?.rendered??'');
if(!verifyRaw.includes(`Browse ${count} THC Infographics`)) throw new Error('Learn infographic entry was not preserved by WordPress update');

const report={generatedAt:new Date().toISOString(),pageId:learn.id,educationMediaCount:count,featuredMediaId:featured,selectionIds:selections.map(x=>({label:x.label,id:x.media.id,route:x.route,url:x.media.source_url})),backupDir};
await writeFile(join(backupDir,'learn-visible-report.json'),JSON.stringify(report,null,2));
await writeFile(join(backupRoot,'learn-visible-backup-path.txt'),`${backupDir}\n`);
console.log(JSON.stringify(report,null,2));

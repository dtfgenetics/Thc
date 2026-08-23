import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_PREMIUM_TITLE_NORMALIZATION||'').toLowerCase()==='true';
const backupRoot=process.env.BACKUP_ROOT||'/tmp/wordpress-premium-title-backups';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const stamp=new Date().toISOString().replace(/[-:.]/g,'');
const backupDir=join(backupRoot,`premium-title-${stamp}`);
await mkdir(backupDir,{recursive:true});
const sleep=(ms)=>new Promise(r=>setTimeout(r,ms));

// Each page may temporarily exist in canonical editorial form or in its richer
// visual-rebuild form. Both are intentionally designed pages with their own H1.
// Accept only known exact hero markers so the normalizer still fails closed if
// a page is unexpectedly replaced with unrelated content.
const targets=[
  {slug:'seeds',markers:['From breeding notes to current releases.']},
  {slug:'learn',markers:['Learn the plant as a connected system.','Understand the plant. Build the environment. Make better decisions.']},
  {slug:'community',markers:['Grow together. Learn together. Build together.']},
  {slug:'gallery',markers:['DTF Visual Library','See the plant science, genetics, tools, games, and community work.']}
];

const STYLE_ID='dtf-premium-theme-title-suppression';
const STYLE=`<style id="${STYLE_ID}">
/* These four pages provide their own designed hero heading. Suppress only the WordPress/theme-generated duplicate title on the page where this style is embedded. */
body.page h1.entry-title,
body.page .entry-header > h1.entry-title,
body.page .page-header > h1.page-title,
body.page h1.wp-block-post-title,
body.page .wp-site-blocks > main > h1.wp-block-post-title,
body.page main > .wp-block-group:first-child > h1.wp-block-post-title{display:none!important}
body.page .entry-header:has(> h1.entry-title:only-child){margin:0!important;padding:0!important;min-height:0!important}
</style>`;

async function request(path,options={}){
  let last;
  for(let attempt=1;attempt<=6;attempt+=1){
    try{
      const response=await fetch(`${siteUrl}${path}`,{...options,redirect:'follow',signal:AbortSignal.timeout(60000),headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Premium-Title-Normalizer/1.2',...(options.body?{'Content-Type':'application/json'}:{}),...(options.headers||{})}});
      const text=await response.text();let body=null;try{body=text?JSON.parse(text):null;}catch{body=text;}
      if((response.status>=500||response.status===429)&&attempt<6){await sleep(attempt*1800);continue;}
      if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,500):JSON.stringify(body).slice(0,500)}`);
      return body;
    }catch(error){last=error;if(attempt<6){await sleep(attempt*1800);continue;}}
  }
  throw last;
}
function rendered(value){return typeof value==='string'?value:(value?.raw||value?.rendered||'');}
function knownMarker(content,target){return target.markers.find(marker=>String(content).includes(marker))||null;}
function normalizeThemeTitle(content){
  const re=new RegExp(`<style\\s+id=["']${STYLE_ID}["'][^>]*>[\\s\\S]*?<\\/style>\\s*`,'i');
  return `${STYLE}\n${String(content).replace(re,'').trimStart()}`;
}
function normalizeSeedsLinks(content){
  let out=String(content);
  const changes=[];
  const rules=[
    {
      label:'Learn the genetics',
      pattern:/href="\/learn\/"([^>]*)>Learn the genetics<\/a>/g,
      replacement:'href="/learn/genetics-breeding/"$1>Learn the genetics</a>',
      to:'/learn/genetics-breeding/'
    },
    {
      label:'Study genetics & breeding',
      pattern:/href="\/learn\/"([^>]*)>Study genetics (?:&amp;|&) breeding<\/a>/g,
      replacement:'href="/learn/genetics-breeding/"$1>Study genetics &amp; breeding</a>',
      to:'/learn/genetics-breeding/'
    },
    {
      label:'Document your grow',
      pattern:/href="\/tools\/"([^>]*)>Document your grow<\/a>/g,
      replacement:'href="/growlens/"$1>Document your grow</a>',
      to:'/growlens/'
    }
  ];
  for(const rule of rules){
    const matches=[...out.matchAll(rule.pattern)];
    if(matches.length>1) throw new Error(`seeds: expected at most one ${rule.label} CTA, found ${matches.length}.`);
    if(matches.length===1){
      out=out.replace(rule.pattern,rule.replacement);
      changes.push({label:rule.label,to:rule.to});
    }
  }
  return {content:out,changes};
}

const results=[];
for(const target of targets){
  const rows=await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(target.slug)}&context=edit&per_page=10`);
  if(!Array.isArray(rows)||rows.length!==1) throw new Error(`${target.slug}: expected exactly one page, found ${Array.isArray(rows)?rows.length:'invalid'}.`);
  const page=rows[0];
  const before=rendered(page.content);
  const marker=knownMarker(before,target);
  if(!marker) throw new Error(`${target.slug}: no approved designed-hero marker is present; refusing title normalization.`);
  if(!/<h1\b/i.test(before)) throw new Error(`${target.slug}: no custom H1 found; refusing to hide the theme title.`);

  let after=normalizeThemeTitle(before);
  let linkChanges=[];
  if(target.slug==='seeds'){
    const normalizedLinks=normalizeSeedsLinks(after);
    after=normalizedLinks.content;
    linkChanges=normalizedLinks.changes;
  }

  await writeFile(join(backupDir,`page-${page.id}-${target.slug}-before.json`),`${JSON.stringify(page,null,2)}\n`);
  if(apply&&after!==before){await request(`/wp-json/wp/v2/pages/${page.id}`,{method:'POST',body:JSON.stringify({content:after,status:'publish'})});}
  const check=await request(`/wp-json/wp/v2/pages/${page.id}?context=edit`);
  const current=rendered(check.content);
  if(apply&&!current.includes(`id="${STYLE_ID}"`)) throw new Error(`${target.slug}: scoped title suppression was not persisted.`);
  if(!knownMarker(current,target)) throw new Error(`${target.slug}: approved hero marker changed unexpectedly.`);
  if(target.slug==='seeds' && /Document your grow<\/a>/i.test(current) && !/href="\/growlens\/"[^>]*>Document your grow<\/a>/i.test(current)) throw new Error('seeds: Document your grow CTA is not routed directly to GrowLens.');
  if(target.slug==='seeds' && /Study genetics (?:&amp;|&) breeding<\/a>/i.test(current) && !/href="\/learn\/genetics-breeding\/"[^>]*>Study genetics (?:&amp;|&) breeding<\/a>/i.test(current)) throw new Error('seeds: genetics study CTA is not routed to the genetics subject page.');
  if(target.slug==='seeds' && /Learn the genetics<\/a>/i.test(current) && !/href="\/learn\/genetics-breeding\/"[^>]*>Learn the genetics<\/a>/i.test(current)) throw new Error('seeds: genetics hero CTA is not routed to the genetics subject page.');
  results.push({slug:target.slug,pageId:page.id,changed:after!==before,applied:apply,marker,linkChanges});
}

const report={generatedAt:new Date().toISOString(),siteUrl,apply,backupDir,styleId:STYLE_ID,targets:results};
await writeFile(join(backupDir,'premium-title-normalization-report.json'),`${JSON.stringify(report,null,2)}\n`);
await writeFile(join(backupRoot,'premium-title-backup-path.txt'),`${backupDir}\n`);
console.log(JSON.stringify(report,null,2));

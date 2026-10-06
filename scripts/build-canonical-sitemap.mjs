import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, relative, dirname } from 'node:path';
import process from 'node:process';

const repo=process.cwd();
const site='https://dtfseeds.com';
const publicRoot=join(repo,'site','public-route-patch');
const output=join(publicRoot,'sitemap.xml');
const routes=new Set(['/']);

const esc=(s)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
const normalize=(route)=>{
  if(!route||route==='/' ) return '/';
  const clean=route.split('#')[0].split('?')[0];
  if(!clean.startsWith('/')) return null;
  if(/\.(?:xml|txt|json|js|css|map|png|jpe?g|webp|svg|gif|ico|pdf|zip|csv|woff2?|ttf|otf)$/i.test(clean)) return null;
  return clean.endsWith('/')?clean:clean+'/';
};
const noindex=(html)=>/<meta\b[^>]*name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(html) || /<meta\b[^>]*content=["'][^"']*noindex[^"']*["'][^>]*name=["']robots["']/i.test(html);

async function walk(dir){
  for(const entry of await readdir(dir,{withFileTypes:true})){
    const full=join(dir,entry.name);
    if(entry.isDirectory()) await walk(full);
    else if(entry.isFile()&&entry.name==='index.html'){
      const html=await readFile(full,'utf8');
      if(noindex(html)) continue;
      const rel=relative(publicRoot,dirname(full)).replaceAll('\\','/');
      const route=normalize('/'+(rel==='.'?'':rel));
      if(route) routes.add(route);
      for(const m of html.matchAll(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/gi)){
        try{const u=new URL(m[1],site);if(u.origin===site){const n=normalize(u.pathname);if(n)routes.add(n);}}catch{}
      }
    }
  }
}

await walk(publicRoot);

for(const pageDir of ['site/wordpress/pages']){
  const dir=join(repo,pageDir);
  for(const entry of await readdir(dir,{withFileTypes:true})){
    if(!entry.isFile()||!entry.name.endsWith('.html')) continue;
    const html=await readFile(join(dir,entry.name),'utf8');
    if(noindex(html)) continue;
    for(const m of html.matchAll(/<link\b[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/gi)){
      try{const u=new URL(m[1],site);if(u.origin===site){const n=normalize(u.pathname);if(n)routes.add(n);}}catch{}
    }
  }
}

const encyclopedia=await readFile(join(publicRoot,'learn','encyclopedia','index.html'),'utf8');
for(const m of encyclopedia.matchAll(/href=["'](\/learn\/encyclopedia\/[^"'?#]+\/?)["']/gi)){
  const n=normalize(m[1]); if(n) routes.add(n);
}

const apps=JSON.parse(await readFile(join(repo,'site','deployment','public-apps.json'),'utf8'));
for(const app of apps.apps||[]){
  const n=normalize(app.route); if(n&&app.status!=='retired') routes.add(n);
}

for(const route of [
  '/seeds/','/learn/','/courses/','/tools/','/games/','/community/','/shop/','/blog/',
  '/gallery/','/about/','/contact/','/grow/','/photo/','/diagnose/','/infographics/',
  '/growlens/','/thc-grow-doc/','/atlas/','/terpene-atlas/','/projects/'
]) routes.add(route);

const lessonRoutes=[...routes].filter(r=>/^\/learn\/encyclopedia\/thc-enc-\d{3}\/$/.test(r));
if(lessonRoutes.length!==420) throw new Error(`Expected 420 Encyclopedia lesson routes, found ${lessonRoutes.length}`);
for(const required of ['/','/seeds/','/learn/','/courses/','/tools/','/games/','/atlas/','/growlens/','/thc-grow-doc/','/learn/encyclopedia/']){
  if(!routes.has(required)) throw new Error(`Required sitemap route missing: ${required}`);
}

const ordered=[...routes].sort((a,b)=>a==='/'?-1:b==='/'?1:a.localeCompare(b));
const xml=['<?xml version="1.0" encoding="UTF-8"?>','<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',...ordered.map(route=>`  <url><loc>${esc(site+route)}</loc></url>`),'</urlset>',''].join('\n');
await writeFile(output,xml,'utf8');
console.log(JSON.stringify({output:relative(repo,output),urlCount:ordered.length,encyclopediaLessons:lessonRoutes.length},null,2));

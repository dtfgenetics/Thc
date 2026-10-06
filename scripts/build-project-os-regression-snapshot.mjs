#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
const baseline=JSON.parse(fs.readFileSync('data/project-os/regression-baseline.json','utf8'));
const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const tools=readJson(baseline.sources.toolRegistry);
const games=readJson(baseline.sources.gameRegistry);
const apps=readJson(baseline.sources.publicApps);
if(!fs.existsSync(baseline.sources.sitemap)){
 const generated=spawnSync(process.execPath,['scripts/build-canonical-sitemap.mjs'],{encoding:'utf8'});
 if(generated.status!==0) throw new Error('Failed to build canonical sitemap before regression snapshot: '+(generated.stderr||generated.stdout));
}
const sitemap=fs.readFileSync(baseline.sources.sitemap,'utf8');
const lessonRoutes=(sitemap.match(/<loc>https:\/\/dtfseeds\.com\/learn\/encyclopedia\/thc-enc-\d{3}\/<\/loc>/g)||[]).length;
const snapshot={
 schemaVersion:1,
 metrics:{
  encyclopediaLessons:lessonRoutes,
  toolRegistryEntries:(tools.tools||[]).length,
  gameRegistryEntries:(games.games||[]).length,
  publicApps:(apps.apps||[]).length,
  sitemapUrls:(sitemap.match(/<url>/g)||[]).length
 },
 hashes:Object.fromEntries(Object.values(baseline.sources).filter(p=>fs.existsSync(p)).map(p=>[p,hash(p)]))
};
const errors=[];
for(const [k,min] of Object.entries(baseline.minimums||{})) if((snapshot.metrics[k]??-1)<min) errors.push(k+' regressed below minimum '+min+' (got '+snapshot.metrics[k]+')');
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
if(process.argv.includes('--json')) console.log(JSON.stringify(snapshot,null,2));
else console.log('Project OS regression snapshot valid: '+JSON.stringify(snapshot.metrics));

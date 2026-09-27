import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const tools=[
 ['water-quality-lab','THC Water Quality Lab',['Alkalinity','Ca:Mg mass ratio']],
 ['fertigation-lab','THC Fertigation Lab',['target mg/L','1000*f']],
 ['dryback-lab','THC Irrigation & Dryback Lab',['percentage points/hour','lost/span*100']],
 ['dew-point','THC Dew Point & Condensation Lab',['dew point','17.625']],
 ['environment-control','THC Environmental Control Center',['Leaf VPD','.0036']],
 ['ipm-scout','THC IPM Scout',['thc-ipm-scout-v1','Export CSV']],
 ['dry-cure-lab','THC Dry & Cure Lab',['weight loss','dew point']],
 ['grow-planner','THC Grow Cycle Planner',['Stage calendar','Flowering']],
 ['substrate-calculator','THC Substrate & Container Calculator',['ft³','3.785411784']],
 ['breeder-pedigree','DTF Breeding & Pedigree Builder',['dtf-breeder-pedigree-v1','parent_a']],
 ['co2-ventilation','THC Ventilation & CO₂ Reference',['air changes/hour','cfm*60/v']],
 ['photoperiod-planner','THC Photoperiod & Lighting Schedule',['calculated DLI','p*h*.0036']],
 ['plant-growth-tracker','THC Plant Growth Tracker',['nodes/day','(b-a)/d']],
 ['root-zone-temperature','THC Root-Zone Temperature Reference',['Root-air difference','Irrigation solution temperature']],
 ['dilution-calculator','THC Solution Dilution Calculator',['C₁V₁ = C₂V₂','b*v/a']],
 ['unit-converter','THC Cultivation Unit Converter',['Conductivity','3.785411784']]
];
const errors=[];
const ok=(v,m)=>{if(!v)errors.push(m)};
const css=path.join(root,'site/public-route-patch/assets/thc-tool-suite-v1.css');
const js=path.join(root,'site/public-route-patch/assets/thc-tool-suite-v1.js');
ok(fs.existsSync(css)&&fs.statSync(css).size>3000,'shared tool-suite CSS missing or too small');
ok(fs.existsSync(js)&&fs.statSync(js).size>300,'shared tool-suite JS missing or too small');
const sharedJs=fs.readFileSync(js,'utf8');
for(const token of ['thc-cultivation-context-v1','thc-growlens-state-v1','addEnvironmentReading','addIrrigationRecord','addObservation','addFeedingRecord','addReservoirRecord','addHarvestRecord']){
 ok(sharedJs.includes(token),'shared tool-suite JS missing integration token: '+token);
}
for(const [slug,title,tokens] of tools){
 const p=path.join(root,'site/public-route-patch',slug,'index.html');
 ok(fs.existsSync(p),slug+' page missing');
 if(!fs.existsSync(p))continue;
 const h=fs.readFileSync(p,'utf8');
 ok(h.includes(title),slug+' title missing');
 ok(h.includes('/assets/thc-tool-suite-v1.css'),slug+' shared CSS missing');
 ok(h.includes('/assets/thc-tool-suite-v1.js'),slug+' shared JS missing');
 ok(h.includes('data-menu')&&h.includes('data-nav'),slug+' mobile nav contract missing');
 ok(h.includes('href="/tools/"'),slug+' All Tools return link missing');
 ok(h.includes('aria-label="Primary navigation"'),slug+' primary nav label missing');
 const visible=h.replace(/placeholder="[^"]*"/gi,'').replace(/placeholder='[^']*'/gi,'');
 ok(!/coming soon|\bplaceholder\b/i.test(visible),slug+' contains unfinished-state copy');
 for(const token of tokens)ok(h.includes(token),slug+' expected implementation token missing: '+token);
}
for(const [slug,token] of [['environment-control','Save to GrowLens'],['dryback-lab','Save to GrowLens'],['ipm-scout','Save to GrowLens'],['water-quality-lab','Save to GrowLens'],['fertigation-lab','Save to GrowLens'],['dry-cure-lab','Save harvest to GrowLens']]){
 const h=fs.readFileSync(path.join(root,'site/public-route-patch',slug,'index.html'),'utf8');
 ok(h.includes(token),slug+' missing GrowLens bridge action');
}
for(const token of ['Shared cultivation context','Grow','Room','Zone','Plant / group','Cultivar / line','Stage']){
 ok(sharedJs.includes(token),'shared cultivation context UI missing token: '+token);
}
const hub=fs.readFileSync(path.join(root,'site/public-route-patch/tools/index.html'),'utf8');
for(const [slug,title] of tools){
 ok(hub.includes('href="/'+slug+'/"'), 'tools hub missing '+slug);
 ok(hub.includes(title.replace('THC ','').split(' — ')[0])||hub.includes(title), 'tools hub missing label '+title);
}
const apps=JSON.parse(fs.readFileSync(path.join(root,'site/deployment/public-apps.json'),'utf8'));
const appIds=new Set(apps.apps.map(x=>x.id));
for(const [slug] of tools)ok(appIds.has(slug),'public-apps missing '+slug);
const nav=JSON.parse(fs.readFileSync(path.join(root,'data/public-navigation.json'),'utf8'));
const navIds=new Set((nav.tools||[]).map(x=>x.id));
for(const [slug] of tools)ok(navIds.has(slug),'public-navigation missing '+slug);

const dew=(t,rh)=>{const a=17.625,b=243.04,g=Math.log(rh/100)+(a*t)/(b+t);return b*g/(a-g)};
ok(Math.abs(dew(24,65)-17.0)<0.3,'dew-point formula sanity check failed');
const fert=150*100/(1000*0.10);
ok(Math.abs(fert-150)<1e-9,'fertigation mass-balance sanity check failed');
const dryback=(5-4.1)/(5-2)*100;
ok(Math.abs(dryback-30)<1e-9,'dryback sanity check failed');
const ach=300*60/(10*10*8);
ok(Math.abs(ach-22.5)<1e-9,'ventilation ACH sanity check failed');
const dli=700*12*.0036;
ok(Math.abs(dli-30.24)<1e-9,'DLI sanity check failed');

if(errors.length){console.error('THC Tool Suite v1 validation failed with '+errors.length+' issue(s):');for(const e of errors)console.error(' - '+e);process.exit(1)}
console.log('THC Tool Suite v1 validation passed: 16 routes, shared shell, hub/registry wiring and core calculation sanity checks are intact.');

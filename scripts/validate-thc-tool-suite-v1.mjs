import fs from 'node:fs';
import path from 'node:path';
import {dewPoint,airChangesPerHour,deliveredCfmForAirChanges,dliFromPpfd,drybackPercent,fertilizerMassGrams} from '../site/public-route-patch/assets/thc-cultivation-math-v1.mjs';

const root=process.cwd();
const tools=[
 ['water-quality-lab','THC Water Quality Lab',['Alkalinity','Ca:Mg mass ratio']],
 ['fertigation-lab','THC Fertigation Lab',['target mg/L','fertilizerMassGrams','p2o5PercentToElementalP']],
 ['dryback-lab','THC Irrigation & Dryback Lab',['percentage points/hour','drybackPercent','ratePerHour']],
 ['dew-point','THC Dew Point & Condensation Lab',['dew point','dewPoint']],
 ['environment-control','THC Environmental Control Center',['Leaf VPD','leafVpd','dliFromPpfd']],
 ['ipm-scout','THC IPM Scout',['thc-ipm-scout-v1','Export CSV']],
 ['dry-cure-lab','THC Dry & Cure Lab',['weight loss','dew point']],
 ['grow-planner','THC Grow Cycle Planner',['Stage calendar','Flowering']],
 ['substrate-calculator','THC Substrate & Container Calculator',['purchase target','gallonsToLiters']],
 ['breeder-pedigree','DTF Breeding & Pedigree Builder',['dtf-breeder-pedigree-v1','parent_a']],
 ['co2-ventilation','THC Ventilation & CO₂ Reference',['air changes/hour','airChangesPerHour','deliveredCfmForAirChanges','cfmToCubicMetersPerHour','cubicMetersPerHourToCfm']],
 ['photoperiod-planner','THC Photoperiod & Lighting Schedule',['calculated DLI','dliFromPpfd']],
 ['plant-growth-tracker','THC Plant Growth Tracker',['nodes/day','heightRate']],
 ['root-zone-temperature','THC Root-Zone Temperature Reference',['Root-air difference','Irrigation solution temperature']],
 ['dilution-calculator','THC Solution Dilution Calculator',['C₁V₁ = C₂V₂','dilutionStockVolume','serialDilution','Stock aliquot']],
 ['unit-converter','THC Cultivation Unit Converter',['Conductivity','celsiusToFahrenheit','cfmToCubicMetersPerHour']]
];
const errors=[];
const ok=(v,m)=>{if(!v)errors.push(m)};
const css=path.join(root,'site/public-route-patch/assets/thc-tool-suite-v1.css');
const js=path.join(root,'site/public-route-patch/assets/thc-tool-suite-v1.js');
ok(fs.existsSync(css)&&fs.statSync(css).size>3000,'shared tool-suite CSS missing or too small');
ok(fs.existsSync(js)&&fs.statSync(js).size>300,'shared tool-suite JS missing or too small');
const sharedJs=fs.readFileSync(js,'utf8');
for(const token of ['thc-cultivation-context-v1','thc-growlens-state-v1','addEnvironmentReading','addIrrigationRecord','addObservation','addDiaryEntry','addFeedingRecord','addReservoirRecord','addHarvestRecord','addCycle','addTasks']){
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
for(const [slug,token] of [['environment-control','Save to GrowLens'],['dryback-lab','Save to GrowLens'],['ipm-scout','Save to GrowLens'],['water-quality-lab','Save to GrowLens'],['fertigation-lab','Save to GrowLens'],['dry-cure-lab','Save harvest to GrowLens'],['plant-growth-tracker','Save to GrowLens'],['root-zone-temperature','Save to GrowLens']]){
 const h=fs.readFileSync(path.join(root,'site/public-route-patch',slug,'index.html'),'utf8');
 ok(h.includes(token),slug+' missing GrowLens bridge action');
}
for(const token of ['Shared cultivation context','Grow','Room','Zone','Plant / group','Cultivar / line','Stage']){
 ok(sharedJs.includes(token),'shared cultivation context UI missing token: '+token);
}
for(const [slug,tokens] of [
 ['water-quality-lab',['thc-water-quality-history-v1','Change from prior report']],
 ['fertigation-lab',['recipeMatrix','Target vs achieved recipe worksheet']],
 ['dry-cure-lab',['thc-dry-cure-checkpoints-v1','Save harvest to GrowLens']],
 ['breeder-pedigree',['Offspring / line name','Population size','Selected plant IDs','Relationship explorer','Direct descendants']],['grow-planner',['Create GrowLens stage tasks','THC.growlens.addTasks','Create GrowLens cycle','THC.growlens.addCycle','Saved grow plans','Backup JSON','Restore JSON','data-load','data-delete']],['environment-control',['Recent VPD trend','history-chart']],['dryback-lab',['Recent dryback trend','history-chart']],['root-zone-temperature',['thc-root-zone-history-v1','Root-zone trend']],['plant-growth-tracker',['thc-plant-growth-history-v1','Growth-rate trend']],['photoperiod-planner',['thc-photoperiod-schedules-v1','Compare saved schedules']],['substrate-calculator',['thc-substrate-plans-v1','Purchase overage','Plan name','Review one zone / room','Backup JSON','Restore JSON','data-load','data-delete','thc-substrate-plans']],['co2-ventilation',['Delivered airflow factor','target ACH']],['dilution-calculator',['Serial dilution steps','Diluent amount']],['unit-converter',['Airflow','m³/h','Area','Mass']]
]){
 const h=fs.readFileSync(path.join(root,'site/public-route-patch',slug,'index.html'),'utf8');
 for(const token of tokens) ok(h.includes(token),slug+' missing upgraded workflow token: '+token);
}
for(const slug of ['ph-meter','tds-meter','vpd-chart','ppfd-chart']){
 const h=fs.readFileSync(path.join(root,'site/public-route-patch',slug,'index.html'),'utf8');
 for(const token of ['/assets/thc-tool-suite-v1.css','/assets/thc-tool-suite-v1.js','data-menu','data-nav','id="site-nav"']){
  ok(h.includes(token),slug+' missing shared legacy integration token: '+token);
 }
}
const ppfdCore=fs.readFileSync(path.join(root,'site/public-route-patch/ppfd-chart/index.html'),'utf8');
ok(ppfdCore.includes('.cell input:focus-visible'), 'PPFD canopy cells must expose a visible keyboard focus state');
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

ok(Math.abs(dewPoint(24,65)-17.0)<0.3,'shared dew-point sanity check failed');
const fert=fertilizerMassGrams(150,100,10);
ok(Math.abs(fert-150)<1e-9,'shared fertigation mass-balance sanity check failed');
const dryback=drybackPercent(5,2,4.1);
ok(Math.abs(dryback-30)<1e-9,'shared dryback sanity check failed');
ok(Math.abs(airChangesPerHour(300,10*10*8)-22.5)<1e-9,'shared ventilation ACH sanity check failed');
ok(Math.abs(deliveredCfmForAirChanges(22.5,10*10*8)-300)<1e-9,'shared reverse ventilation sanity check failed');
ok(Math.abs(dliFromPpfd(700,12)-30.24)<1e-9,'shared DLI sanity check failed');

if(errors.length){console.error('THC Tool Suite v1 validation failed with '+errors.length+' issue(s):');for(const e of errors)console.error(' - '+e);process.exit(1)}
console.log('THC Tool Suite v1 validation passed: 16 routes, shared shell, hub/registry wiring and core calculation sanity checks are intact.');

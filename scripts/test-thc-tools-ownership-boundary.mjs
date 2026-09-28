import fs from 'node:fs';

const forbidden=[
  'site/public-route-patch/tools',
  'site/public-route-patch/ph-meter',
  'site/public-route-patch/tds-meter',
  'site/public-route-patch/vpd-chart',
  'site/public-route-patch/ppfd-chart',
  'site/public-route-patch/water-quality-lab',
  'site/public-route-patch/fertigation-lab',
  'site/public-route-patch/dryback-lab',
  'site/public-route-patch/dew-point',
  'site/public-route-patch/environment-control',
  'site/public-route-patch/ipm-scout',
  'site/public-route-patch/dry-cure-lab',
  'site/public-route-patch/grow-planner',
  'site/public-route-patch/substrate-calculator',
  'site/public-route-patch/breeder-pedigree',
  'site/public-route-patch/co2-ventilation',
  'site/public-route-patch/photoperiod-planner',
  'site/public-route-patch/plant-growth-tracker',
  'site/public-route-patch/root-zone-temperature',
  'site/public-route-patch/dilution-calculator',
  'site/public-route-patch/unit-converter'
];

const mode=process.argv.includes('--post-cutover')?'post-cutover':'pre-cutover';
const existing=forbidden.filter(path=>fs.existsSync(path));

if(mode==='post-cutover'&&existing.length){
  console.error('Duplicate canonical THC tool implementation remains in Thc after cutover:');
  for(const path of existing) console.error(' - '+path);
  process.exit(1);
}

if(mode==='pre-cutover'&&!existing.length){
  console.error('Pre-cutover rollback source disappeared unexpectedly.');
  process.exit(1);
}

console.log(`THC tools ownership boundary check passed in ${mode} mode; local duplicate count=${existing.length}.`);

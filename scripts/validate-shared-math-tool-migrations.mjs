import fs from 'node:fs';

const cases=[
  ['dew-point','dewPoint',/17\.625|243\.04/],
  ['dilution-calculator','dilutionStockVolume',/b\*v\/a/],
  ['co2-ventilation','airChangesPerHour',/delivered\*60\/v/],
  ['unit-converter','gallonsToLiters',/3\.785411784/],
];
const errors=[];
for(const [slug,fn,legacy] of cases){
  const file=`site/public-route-patch/${slug}/index.html`;
  const html=fs.readFileSync(file,'utf8');
  if(!html.includes("type=\"module\"")) errors.push(`${slug}: module script missing`);
  if(!html.includes("/assets/thc-cultivation-math-v1.mjs")) errors.push(`${slug}: shared math import missing`);
  if(!html.includes(fn)) errors.push(`${slug}: expected shared export ${fn} not used`);
  if(legacy.test(html)) errors.push(`${slug}: duplicated legacy math remains`);
}
if(errors.length){
  console.error('Shared math migration validation failed:');
  for(const error of errors) console.error(' - '+error);
  process.exit(1);
}
console.log('Shared math migration validation passed for dew point, dilution, ventilation, and volume conversion.');

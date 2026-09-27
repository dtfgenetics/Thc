import fs from 'node:fs';

const cases=[
  {slug:'dew-point',functions:['dewPoint'],legacy:/17\.625|243\.04/},
  {slug:'dilution-calculator',functions:['dilutionStockVolume'],legacy:/b\*v\/a/},
  {slug:'co2-ventilation',functions:['airChangesPerHour'],legacy:/delivered\*60\/v/},
  {slug:'unit-converter',functions:['gallonsToLiters','litersToGallons','celsiusToFahrenheit','fahrenheitToCelsius','centimetersToInches','inchesToCentimeters','squareMetersToSquareFeet','squareFeetToSquareMeters','gramsToOunces','ouncesToGrams','millisiemensToMicrosiemens','microsiemensToMillisiemens','cfmToCubicMetersPerHour','cubicMetersPerHourToCfm'],legacy:/3\.785411784|2\.54|10\.7639104167|28\.349523125|1\.69901082|x\*9\/5\+32|\(x-32\)\*5\/9/},
  {slug:'vpd-chart',functions:['leafVpd'],legacy:/0\.6108\*Math\.exp|17\.27\*t|237\.3/},
  {slug:'environment-control',functions:['leafVpd','dewPoint','dliFromPpfd'],legacy:/0\.6108\*Math\.exp|17\.625|243\.04|p\*ph\*\.0036/},
];
const errors=[];
for(const {slug,functions,legacy} of cases){
  const file=`site/public-route-patch/${slug}/index.html`;
  const html=fs.readFileSync(file,'utf8');
  if(!html.includes('type="module"')) errors.push(`${slug}: module script missing`);
  if(!html.includes('/assets/thc-cultivation-math-v1.mjs')) errors.push(`${slug}: shared math import missing`);
  for(const fn of functions) if(!html.includes(fn)) errors.push(`${slug}: expected shared export ${fn} not used`);
  if(legacy.test(html)) errors.push(`${slug}: duplicated legacy math remains`);
}
if(errors.length){
  console.error('Shared math migration validation failed:');
  for(const error of errors) console.error(' - '+error);
  process.exit(1);
}
console.log('Shared math migration validation passed for six cultivation tool routes.');

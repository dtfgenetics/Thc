import fs from 'node:fs';

const engine='site/public-route-patch/assets/thc-cultivation-math-v1.mjs';
const contract='scripts/test-cultivation-math-engine.mjs';
const errors=[];
const ok=(value,message)=>{if(!value)errors.push(message)};

ok(fs.existsSync(engine),'cultivation math engine missing');
ok(fs.existsSync(contract),'cultivation math contract missing');
if(fs.existsSync(engine)){
 const source=fs.readFileSync(engine,'utf8');
 for(const name of ['dliFromPpfd','ppfdFromDli','integrateDli','saturationVaporPressure','airVpd','leafVpd','dilutionStockVolume','serialDilution','dewPoint','airChangesPerHour','deliveredCfmForAirChanges','gallonsToLiters','litersToGallons','celsiusToFahrenheit','fahrenheitToCelsius','centimetersToInches','inchesToCentimeters','squareMetersToSquareFeet','squareFeetToSquareMeters','gramsToOunces','ouncesToGrams','millisiemensToMicrosiemens','microsiemensToMillisiemens','cfmToCubicMetersPerHour','cubicMetersPerHourToCfm','ecToDisplayedPpm','displayedPpmToEc','drybackPercent','ratePerHour','fertilizerMassGrams','p2o5PercentToElementalP','k2oPercentToElementalK']) ok(source.includes(`export function ${name}`),`missing export: ${name}`);
 ok(!/document\.|window\.|localStorage|fetch\(/.test(source),'math engine must remain pure and environment-independent');
}
if(errors.length){console.error('Cultivation math static validation failed:');for(const error of errors)console.error(' - '+error);process.exit(1)}
console.log('Cultivation math static validation passed.');

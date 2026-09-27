import assert from 'node:assert/strict';
import {
  dliFromPpfd,
  ppfdFromDli,
  integrateDli,
  saturationVaporPressure,
  airVpd,
  leafVpd,
  dilutionStockVolume,
  serialDilution,
  dewPoint,
  airChangesPerHour,
  deliveredCfmForAirChanges,
  gallonsToLiters,
  litersToGallons,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  centimetersToInches,
  inchesToCentimeters,
  squareMetersToSquareFeet,
  squareFeetToSquareMeters,
  gramsToOunces,
  ouncesToGrams,
  millisiemensToMicrosiemens,
  microsiemensToMillisiemens,
  cfmToCubicMetersPerHour,
  cubicMetersPerHourToCfm,
  ecToDisplayedPpm,
  displayedPpmToEc,
  drybackPercent,
  ratePerHour,
  fertilizerMassGrams,
  p2o5PercentToElementalP,
  k2oPercentToElementalK
} from '../site/public-route-patch/assets/thc-cultivation-math-v1.mjs';

const near=(actual,expected,tol=1e-6)=>assert.ok(Math.abs(actual-expected)<=tol,`${actual} != ${expected}`);

near(dliFromPpfd(700,12),30.24);
near(ppfdFromDli(30.24,12),700);
near(integrateDli([{ppfd:0,hours:1},{ppfd:700,hours:10},{ppfd:350,hours:2}]),27.72);
near(saturationVaporPressure(25),3.1678,0.002);
near(airVpd(25,60),1.267,0.01);
near(leafVpd(25,60,23),0.909,0.02);
near(dilutionStockVolume(1000,100,10),1);
assert.deepEqual(serialDilution({initialConcentration:1000,targetConcentration:1,stepFactor:10,finalVolume:10}),[
 {from:1000,to:100,stockVolume:1,diluentVolume:9,finalVolume:10},
 {from:100,to:10,stockVolume:1,diluentVolume:9,finalVolume:10},
 {from:10,to:1,stockVolume:1,diluentVolume:9,finalVolume:10}
]);
near(dewPoint(24,65),17.0,0.3);
near(airChangesPerHour(300,10*10*8),22.5);
near(deliveredCfmForAirChanges(22.5,10*10*8),300);
near(gallonsToLiters(1),3.785411784);
near(litersToGallons(3.785411784),1);
near(celsiusToFahrenheit(25),77);
near(fahrenheitToCelsius(77),25);
near(centimetersToInches(2.54),1);
near(inchesToCentimeters(1),2.54);
near(squareMetersToSquareFeet(1),10.7639104167);
near(squareFeetToSquareMeters(10.7639104167),1);
near(gramsToOunces(28.349523125),1);
near(ouncesToGrams(1),28.349523125);
near(millisiemensToMicrosiemens(1.8),1800);
near(microsiemensToMillisiemens(1800),1.8);
near(cfmToCubicMetersPerHour(100),169.901082);
near(cubicMetersPerHourToCfm(169.901082),100);
near(ecToDisplayedPpm(1.8,500),900);
near(ecToDisplayedPpm(1.8,700),1260);
near(displayedPpmToEc(900,500),1.8);
near(drybackPercent(5,2,4.1),30);
near(ratePerHour(30,6),5);
near(fertilizerMassGrams(150,100,10),150);
near(p2o5PercentToElementalP(10),4.364);
near(k2oPercentToElementalK(20),16.602);
assert.throws(()=>ecToDisplayedPpm(1.8,600),/500 or 700/);
assert.throws(()=>drybackPercent(2,5,4),/High reference/);
assert.throws(()=>dliFromPpfd(-1,12),/PPFD/);
assert.throws(()=>airVpd(25,101),/humidity/i);
assert.throws(()=>dilutionStockVolume(0,100,10),/concentration/i);

console.log('Cultivation math engine contract passed.');

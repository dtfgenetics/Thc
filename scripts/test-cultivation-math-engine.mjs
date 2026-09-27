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
  gallonsToLiters,
  litersToGallons
} from '../site/public-route-patch/assets/thc-cultivation-math-v1.mjs';

const near=(actual,expected,tol=1e-6)=>assert.ok(Math.abs(actual-expected)<=tol,`${actual} != ${expected}`);

near(dliFromPpfd(700,12),30.24);
near(ppfdFromDli(30.24,12),700);
near(integrateDli([{ppfd:0,hours:1},{ppfd:700,hours:10},{ppfd:350,hours:2}]),27.72);
near(saturationVaporPressure(25),3.1678,0.002);
near(airVpd(25,60),1.267,0.01);
near(leafVpd(25,60,23),0.997,0.02);
near(dilutionStockVolume(1000,100,10),1);
assert.deepEqual(serialDilution({initialConcentration:1000,targetConcentration:1,stepFactor:10,finalVolume:10}),[
 {from:1000,to:100,stockVolume:1,diluentVolume:9,finalVolume:10},
 {from:100,to:10,stockVolume:1,diluentVolume:9,finalVolume:10},
 {from:10,to:1,stockVolume:1,diluentVolume:9,finalVolume:10}
]);
near(dewPoint(24,65),17.0,0.3);
near(airChangesPerHour(300,10*10*8),22.5);
near(gallonsToLiters(1),3.785411784);
near(litersToGallons(3.785411784),1);
assert.throws(()=>dliFromPpfd(-1,12),/PPFD/);
assert.throws(()=>airVpd(25,101),/humidity/i);
assert.throws(()=>dilutionStockVolume(0,100,10),/concentration/i);

console.log('Cultivation math engine contract passed.');

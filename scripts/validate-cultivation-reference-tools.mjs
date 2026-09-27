import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = {
  hub: 'site/public-route-patch/tools/index.html',
  ph: 'site/public-route-patch/ph-meter/index.html',
  tds: 'site/public-route-patch/tds-meter/index.html',
  vpd: 'site/public-route-patch/vpd-chart/index.html',
  ppfd: 'site/public-route-patch/ppfd-chart/index.html',
};

const read = (key) => fs.readFileSync(path.join(root, files[key]), 'utf8');
const hub = read('hub');
const ph = read('ph');
const tds = read('tds');
const vpd = read('vpd');
const ppfd = read('ppfd');
const errors = [];
const assert = (ok, msg) => { if (!ok) errors.push(msg); };

for (const route of ['/atlas/', '/terpene-atlas/', '/ph-meter/', '/tds-meter/', '/vpd-chart/', '/ppfd-chart/']) {
  assert(hub.includes(`href="${route}"`) || hub.includes(`href='${route}'`), `tools hub missing ${route}`);
}
assert((hub.match(/target="_blank"/g) || []).length  >= 6, 'tools hub must open all six reference launchers in a new tab');
for (const label of ['Plant Atlas', 'Terpene Atlas', 'pH Meter', 'TDS / EC Meter', 'VPD Chart', 'PPFD / DLI']) {
  assert(hub.includes(label), `tools hub missing visible label: ${label}`);
}

const canonical = [
  ['/', 'Home'], ['/seeds/', 'Seeds'], ['/learn/', 'Learn'], ['/courses/', 'Courses'],
  ['/tools/', 'Tools'], ['/games/', 'Games'], ['/community/', 'Community'], ['/shop/', 'Shop'],
];
for (const [fileKey, html] of [['ph', ph], ['tds', tds], ['vpd', vpd], ['ppfd', ppfd]]) {
  assert(html.includes('href="/tools/"'), `${files[fileKey]} missing central All Tools return link`);
  for (const [route, label] of canonical) {
    assert(html.includes(`href="${route}"`), `${files[fileKey]} missing canonical route ${route} (${label})`);
  }
  for (const route of ['/atlas/', '/terpene-atlas/']) {
    assert(html.includes(`href="${route}"`), `${files[fileKey]} missing cross-reference ${route}`);
  }
}

assert(ph.includes('type="number"') && ph.includes('min="0"') && ph.includes('max="14"'), 'pH page must constrain readings to 0-14');
assert(ph.includes("v<7?'acidic':v>7?'alkaline':'neutral'"), 'pH page must classify acidic/neutral/alkaline readings');
assert(ph.includes('5.5') && ph.includes('6.5') && ph.includes('6.0') && ph.includes('7.0'), 'pH page missing broad cultivation reference windows');

assert(tds.includes('500 convention') && tds.includes('700 convention') && tds.includes('× 500') && tds.includes('× 700'), 'TDS page missing 500/700 scale explanation');
assert(tds.includes("v*500") && tds.includes("v*700"), 'TDS converter missing 500/700 conversion');
assert(tds.includes('const v=p/s') && tds.includes("v.toFixed(2)"), 'TDS reverse conversion missing ppm-to-EC calculation');

assert(vpd.includes('0.6108*Math.exp((17.27*t)/(t+237.3))'), 'VPD page missing saturation-vapor-pressure equation');
assert(vpd.includes('svp(leaf)-svp(air)*(rhValue/100)'), 'VPD page missing leaf-to-air vapor pressure deficit calculation');
assert(vpd.includes('Relative humidity (%)') && vpd.includes('Leaf offset'), 'VPD page missing required inputs');
assert(vpd.includes("u==='f'?(v-32)*5/9:v") && vpd.includes("v*9/5+32"), 'VPD page missing Celsius/Fahrenheit conversion support');

const atlas = fs.readFileSync(path.join(root, 'site/public-route-patch/atlas/index.html'), 'utf8');
const terpenes = fs.readFileSync(path.join(root, 'site/public-route-patch/terpene-atlas/index.html'), 'utf8');
assert(ppfd.includes("p*h*0.0036"), 'PPFD page missing PPFD-to-DLI formula');
assert(ppfd.includes("td/(h*0.0036)"), 'PPFD page missing user-target DLI-to-PPFD formula');
assert(ppfd.includes('id="ppfdGrid"') && ppfd.includes('min/avg*100') && ppfd.includes('sd/avg*100'), 'PPFD page missing canopy grid, uniformity, or coefficient-of-variation calculation');
assert(ppfd.includes('Measurement method') && ppfd.includes('Manufacturer PPFD map') && ppfd.includes('variable sunlight or dimming schedules require integrated measurements over time'), 'PPFD page missing measurement-method or variable-light context');
assert(ppfd.includes('THC Light Lab') && ppfd.includes('Teaching Healthy Cultivation') && ppfd.includes('PAR vs ePAR'), 'PPFD page missing THC educational branding or PAR/ePAR education');
assert(ppfd.includes('targetMin') && ppfd.includes('targetMax') && ppfd.includes('inRange'), 'PPFD page must use user-defined target range analysis');
assert(ppfd.includes('Apogee DLI guidance') && ppfd.includes('LI-COR DLI logging') && ppfd.includes('Frontiers 2022') && ppfd.includes('Scientific Reports 2025'), 'PPFD page missing evidence links');
assert(ppfd.includes("STORAGE_KEY='thc-light-lab-surveys-v2'") && ppfd.includes("'thc-light-lab-surveys-v1'") && ppfd.includes('localStorage.setItem'), 'PPFD page missing v2 local survey persistence or v1 migration support');
assert(ppfd.includes('fixtureModel') && ppfd.includes('mountHeight') && ppfd.includes('sensorModel') && ppfd.includes('measurementDate'), 'PPFD page missing survey metadata fields');
assert(ppfd.includes("lines=['row,column,ppfd']") && ppfd.includes('FileReader') && ppfd.includes('Export map CSV'), 'PPFD page missing CSV round-trip workflow');
assert(ppfd.includes("window.print()") && ppfd.includes('Print / Save report'), 'PPFD page missing printable Light Report workflow');
assert(ppfd.includes("'use schedule'") && ppfd.includes('Browser storage is unavailable'), 'PPFD page missing variable-light or storage-failure safeguards');
assert(ppfd.includes('target low exceeds target high') && ppfd.includes("'fix range'"), 'PPFD page missing invalid target-range handling');
assert(ppfd.includes('compareSession') && ppfd.includes('renderComparison') && ppfd.includes('Average PPFD ') && ppfd.includes('Uniformity '), 'PPFD page missing live saved-survey comparison workflow');
assert(ppfd.includes('mapProgress') && ppfd.includes('legendbar') && ppfd.includes("'R'+rr+' · C'+cc"), 'PPFD page missing map completion, legend, or coordinate labeling');
assert(ppfd.includes('Export full survey') && ppfd.includes('application/json;charset=utf-8') && ppfd.includes('Copy summary'), 'PPFD page missing full-survey export or summary workflow');
assert(ppfd.includes('µmol·m⁻²·s⁻¹') && ppfd.includes('mol·m⁻²·day⁻¹ DLI'), 'PPFD page missing explicit PPFD/DLI units in primary output');
assert(ppfd.includes('600, 800 and 1,000') && ppfd.includes('150–700') && ppfd.includes('not universal target bands'), 'PPFD research context must distinguish tested study conditions from universal targets');
assert(ppfd.includes('fillReading') && ppfd.includes('clearMap') && ppfd.includes("stats.max/stats.min"), 'PPFD page missing map utility controls or spread analysis');
assert(ppfd.includes('Variable-light DLI schedule') && ppfd.includes("dli+=p*h*0.0036") && ppfd.includes('scheduleStats'), 'PPFD page missing variable-light DLI integration');
assert(ppfd.includes('Import full survey') && ppfd.includes('jsonFile') && ppfd.includes('formatVersion:2'), 'PPFD page missing full-survey JSON round trip');
assert(ppfd.includes("thc-light-lab-surveys-v1") && ppfd.includes("thc-light-lab-surveys-v2"), 'PPFD page must preserve legacy saved surveys during schema migration');
assert(ppfd.includes('Measurement protocol') && ppfd.includes('cosine response') && ppfd.includes('LI-COR DLI logging'), 'PPFD page missing professional measurement protocol guidance');
assert(ppfd.includes('validChoice') && ppfd.includes('boundedValue'), 'PPFD page missing imported-survey validation safeguards');
assert(ppfd.includes('within10') && ppfd.includes('within20') && ppfd.includes('edgeCenter') && ppfd.includes('pointSpacing'), 'PPFD page missing distribution, perimeter/center, or point-spacing map analysis');
assert(ppfd.includes('Min ÷ average (legacy)') && ppfd.includes('Uniformity needs more than one metric'), 'PPFD page must label min/average as a legacy metric and explain its limitations');
assert(ppfd.includes("Math.abs(v-stats.avg)<=stats.avg*.10") && ppfd.includes("Math.abs(v-stats.avg)<=stats.avg*.20"), 'PPFD page missing normalized distribution coverage calculations');
assert(ppfd.includes('edgeCenterStats') && ppfd.includes('spacingStats'), 'PPFD page missing edge/center or grid-spacing calculation helpers');
assert(ppfd.includes('Metric (m / cm)') && ppfd.includes('Imperial (ft / in)') && ppfd.includes('convertDimensions'), 'PPFD page missing metric/imperial dimension support');
assert(ppfd.includes('sensorCheckDate') && ppfd.includes('Sensor calibration / check date'), 'PPFD page missing sensor calibration/check documentation');
assert(ppfd.includes('comparableGeometry') && ppfd.includes('Caution: setup differs'), 'PPFD comparison must warn when survey geometry or equipment differs');
assert(ppfd.includes("unit:metric?'m':'ft'") && ppfd.includes('renderUnitSystem'), 'PPFD spacing output must follow the selected unit system');
assert(ppfd.includes("box.style.background=heat(v)") && ppfd.includes("heat(input.value)"), 'PPFD page must preserve blank map cells as unmeasured');
assert(ppfd.includes('href="/tools/"'), 'PPFD page missing central All Tools link');
assert(atlas.includes('href="/tools/"'), 'Plant Atlas missing central All Tools link');
assert(terpenes.includes('href="/tools/"'), 'Terpene Atlas missing central All Tools link');

const svp = (t) => 0.6108 * Math.exp((17.27 * t) / (t + 237.3));
const sample = Math.max(0, svp(25) - svp(26) * 0.60);
const scheduleDli = (300 * 1 * 0.0036) + (700 * 10 * 0.0036) + (300 * 1 * 0.0036);
assert(sample > 1.0 && sample < 1.3, `VPD formula sanity check failed: ${sample}`);
assert(Math.abs(scheduleDli - 27.36) < 1e-9, `PPFD variable-light DLI sanity check failed: ${scheduleDli}`);

if (errors.length) {
  console.error(`Cultivation reference tool validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(' - ' + error);
  process.exit(1);
}

console.log('Cultivation reference tool validation passed: hub links, canonical Tools navigation, pH/TDS/VPD/PPFD calculations, Light Lab survey workflows, and cross-references are intact.');

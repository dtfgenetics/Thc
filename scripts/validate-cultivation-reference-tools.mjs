import fs from 'node:fs';
import path from 'node:path';
import {leafVpd} from '../site/public-route-patch/assets/thc-cultivation-math-v1.mjs';
import {calculateVariableLight} from '../site/public-route-patch/assets/thc-light-lab-math-v1.mjs';

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
assert(ph.includes('pH measurement journal') && ph.includes("thc-ph-measurements-v1"), 'pH page missing local measurement journal');
assert(ph.includes('Meter / probe ID') && ph.includes('Last calibration') && ph.includes('Export CSV') && ph.includes('Import CSV'), 'pH journal missing meter/calibration or CSV workflow');
assert(ph.includes('phCalibrationStatus') && ph.includes('phCalibrationRefs') && ph.includes('calibrationAgeDays') && ph.includes('Common pH reference buffers include 4.00, 7.00 and 10.00'), 'pH journal missing calibration-age status or buffer reference tracking');
assert(ph.includes("header:'calibration_refs'"), 'pH CSV journal must preserve calibration reference buffers');
assert(ph.includes('/assets/vendor/uplot-1.6.32.min.js') && ph.includes('/assets/vendor/papaparse-5.7.0.min.js') && ph.includes('/assets/thc-measurement-journal-v1.js'), 'pH journal must use shared uPlot/Papa Parse measurement stack');

assert(tds.includes('500 convention') && tds.includes('700 convention') && tds.includes('× 500') && tds.includes('× 700'), 'TDS page missing 500/700 scale explanation');
assert(tds.includes("v*500") && tds.includes("v*700"), 'TDS converter missing 500/700 conversion');
assert(tds.includes('const v=p/s') && tds.includes("v.toFixed(2)"), 'TDS reverse conversion missing ppm-to-EC calculation');
assert(tds.includes('EC / TDS measurement journal') && tds.includes("thc-ec-measurements-v1"), 'TDS/EC page missing local measurement journal');
assert(tds.includes('Last calibration / check') && tds.includes('Sample temp (°C, optional)') && tds.includes('Export CSV') && tds.includes('Import CSV'), 'TDS/EC journal missing calibration, temperature, or CSV workflow');
assert(tds.includes('ecCalibrationStatus') && tds.includes('ecCalibrationStandard') && tds.includes('calibrationAgeDays') && tds.includes('1.413 mS/cm (1413 µS/cm)') && tds.includes('There is no universal calibration interval'), 'TDS/EC journal missing calibration-age status or conductivity-standard guidance');
assert(tds.includes("header:'calibration_standard'"), 'TDS/EC CSV journal must preserve calibration standard identity');
assert(tds.includes('/assets/vendor/uplot-1.6.32.min.js') && tds.includes('/assets/vendor/papaparse-5.7.0.min.js') && tds.includes('/assets/thc-measurement-journal-v1.js'), 'TDS/EC journal must use shared uPlot/Papa Parse measurement stack');

assert(vpd.includes("/assets/thc-cultivation-math-v1.mjs") && vpd.includes('leafVpd'), 'VPD page missing shared leaf-VPD calculation');
assert(vpd.includes('Relative humidity (%)') && vpd.includes('Leaf offset'), 'VPD page missing required inputs');
assert(vpd.includes("u==='f'?(v-32)*5/9:v") && vpd.includes("v*9/5+32"), 'VPD page missing Celsius/Fahrenheit conversion support');
assert(vpd.includes('Logger CSV trend analysis') && vpd.includes('parseTrendCsv') && vpd.includes('drawTrend'), 'VPD page missing local CSV trend-analysis workflow');
assert(vpd.includes("['temperature','temp','air_temp','air_temperature'") && vpd.includes("['humidity','rh','relative_humidity'"), 'VPD CSV import missing flexible temperature/RH header mapping');
assert(vpd.includes('Analyzed '+"'"+'+rows.length+'+"'"+' valid logger rows locally in this browser.') && vpd.includes('Average VPD'), 'VPD trend workflow missing local-processing disclosure or summary metrics');
assert(vpd.includes('/assets/vendor/papaparse-5.7.0.min.js') && vpd.includes('window.Papa?.parse'), 'VPD page must use vendored Papa Parse with fallback support');
assert(vpd.includes('/assets/vendor/uplot-1.6.32.min.js') && vpd.includes('/assets/vendor/uplot-1.6.32.min.css') && vpd.includes('window.uPlot'), 'VPD logger must use vendored uPlot with canvas fallback');
assert(vpd.includes("cursor:{drag:{x:true,y:false,setScale:true}}") && vpd.includes("fallback.hidden=false"), 'VPD uPlot integration must preserve zoom/cursor interaction and fallback rendering');

const journalRuntime = fs.readFileSync(path.join(root, 'site/public-route-patch/assets/thc-measurement-journal-v1.js'), 'utf8');
assert(journalRuntime.includes('THCMeasurementJournal') && journalRuntime.includes('localStorage.setItem') && journalRuntime.includes('window.Papa?.parse') && journalRuntime.includes('window.uPlot'), 'shared measurement journal runtime missing persistence, CSV, or chart contracts');
assert(journalRuntime.includes('Browser storage is unavailable') && journalRuntime.includes('limit') && journalRuntime.includes('confirm('), 'shared measurement journal missing storage failure, record cap, or destructive-action safeguards');
const atlas = fs.readFileSync(path.join(root, 'site/public-route-patch/atlas/index.html'), 'utf8');
const terpenes = fs.readFileSync(path.join(root, 'site/public-route-patch/terpene-atlas/index.html'), 'utf8');
assert(ppfd.includes('/assets/thc-light-lab-math-v1.mjs') && ppfd.includes('calculateStableLight'), 'PPFD page missing shared stable-light DLI adapter');
assert(ppfd.includes('light.requiredPpfd'), 'PPFD page missing shared user-target DLI-to-PPFD result');
assert(ppfd.includes('id="ppfdGrid"') && ppfd.includes('min/avg*100') && ppfd.includes('sd/avg*100'), 'PPFD page missing canopy grid, uniformity, or coefficient-of-variation calculation');
assert(ppfd.includes('id="rows"') && ppfd.includes('id="cols"') && ppfd.includes('<option>3</option>') && ppfd.includes('<option>9</option>') && ppfd.includes('r*c'), 'PPFD page must preserve configurable 3×3 through 9×9 canopy mapping');
assert(ppfd.includes('Measurement method') && ppfd.includes('Manufacturer PPFD map') && ppfd.includes('variable sunlight or dimming schedules require integrated measurements over time'), 'PPFD page missing measurement-method or variable-light context');
assert(ppfd.includes('THC Light Lab') && ppfd.includes('Teaching Healthy Cultivation') && ppfd.includes('PAR vs ePAR'), 'PPFD page missing THC educational branding or PAR/ePAR education');
assert(ppfd.includes('targetMin') && ppfd.includes('targetMax') && ppfd.includes('inRange'), 'PPFD page must use user-defined target range analysis');
assert(ppfd.includes('Apogee DLI guidance') && ppfd.includes('LI-COR DLI logging') && ppfd.includes('Frontiers 2022') && ppfd.includes('Scientific Reports 2025'), 'PPFD page missing evidence links');
assert(ppfd.includes("STORAGE_KEY='thc-light-lab-surveys-v2'") && ppfd.includes("'thc-light-lab-surveys-v1'") && ppfd.includes('localStorage.setItem'), 'PPFD page missing v2 local survey persistence or v1 migration support');
assert(ppfd.includes('fixtureModel') && ppfd.includes('mountHeight') && ppfd.includes('sensorModel') && ppfd.includes('measurementDate'), 'PPFD page missing survey metadata fields');
assert(ppfd.includes("lines=['row,column,ppfd']") && ppfd.includes('FileReader') && ppfd.includes('Export map CSV'), 'PPFD page missing CSV round-trip workflow');
assert(ppfd.includes('/assets/vendor/papaparse-5.7.0.min.js') && ppfd.includes('window.Papa?.parse'), 'PPFD page must use vendored Papa Parse for robust CSV imports');
assert(ppfd.includes("window.print()") && ppfd.includes('Print / Save report'), 'PPFD page missing printable Light Report workflow');
assert(ppfd.includes("'use schedule'") && ppfd.includes('Browser storage is unavailable'), 'PPFD page missing variable-light or storage-failure safeguards');
assert(ppfd.includes('target low exceeds target high') && ppfd.includes("'fix range'"), 'PPFD page missing invalid target-range handling');
assert(ppfd.includes('compareSession') && ppfd.includes('renderComparison') && ppfd.includes('Average PPFD ') && ppfd.includes('Uniformity '), 'PPFD page missing live saved-survey comparison workflow');
assert(ppfd.includes('mapProgress') && ppfd.includes('legendbar') && ppfd.includes("'R'+rr+' · C'+cc"), 'PPFD page missing map completion, legend, or coordinate labeling');
assert(ppfd.includes('Export full survey') && ppfd.includes('application/json;charset=utf-8') && ppfd.includes('Copy summary'), 'PPFD page missing full-survey export or summary workflow');
assert(ppfd.includes('µmol·m⁻²·s⁻¹') && ppfd.includes('mol·m⁻²·day⁻¹ DLI'), 'PPFD page missing explicit PPFD/DLI units in primary output');
assert(ppfd.includes('600, 800 and 1,000') && ppfd.includes('150–700') && ppfd.includes('not universal target bands'), 'PPFD research context must distinguish tested study conditions from universal targets');
assert(ppfd.includes('fillReading') && ppfd.includes('clearMap') && ppfd.includes("stats.max/stats.min"), 'PPFD page missing map utility controls or spread analysis');
assert(ppfd.includes('Variable-light DLI schedule') && ppfd.includes('calculateVariableLight') && ppfd.includes('scheduleStats'), 'PPFD page missing shared variable-light DLI integration');
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
assert(ppfd.includes('comparableGeometry') && ppfd.includes('Setup differs in') && ppfd.includes('Direct comparison caution:'), 'PPFD comparison must warn when survey geometry or equipment differs');
assert(ppfd.includes("unit:metric?'m':'ft'") && ppfd.includes('renderUnitSystem'), 'PPFD spacing output must follow the selected unit system');
assert(ppfd.includes('Skip to Light Lab') && ppfd.includes('id="mainContent"'), 'PPFD page missing keyboard skip navigation');
assert(ppfd.includes('overflow-x:auto;flex-wrap:nowrap') && !ppfd.includes('@media(max-width:900px){.workspace,.mapper{grid-template-columns:1fr}.education,.researchgrid{grid-template-columns:1fr 1fr}.nav{display:none}'), 'PPFD page must preserve primary navigation on narrow viewports');
assert(ppfd.includes('.nav a{min-height:44px') && ppfd.includes('.tabs a{min-height:44px'), 'PPFD page missing robust touch target sizing');
assert(ppfd.includes('gridScrollHint') && ppfd.includes('tabindex="0" aria-describedby="gridScrollHint"'), 'PPFD heatmap missing small-screen scroll accessibility guidance');
assert(ppfd.includes('THC Light Lab — Survey Report') && ppfd.includes('updatePrintSummary') && ppfd.includes("beforeprint"), 'PPFD page missing printable survey summary workflow');
assert(ppfd.includes("const rr=Math.floor(i/c)+1,cc=i%c+1,box=document.createElement('label')"), 'PPFD grid must define row/column coordinates before accessible labels use them');
assert(ppfd.includes('Delta vs baseline') && ppfd.includes('deltaFor(i)') && ppfd.includes('comparisonCoverage'), 'PPFD page missing point-by-point baseline delta map or paired coverage analysis');
assert(ppfd.includes('partial survey') && ppfd.includes('paired readings'), 'PPFD page must disclose incomplete current or paired comparison maps');
assert(ppfd.includes('Delta map requires the same row and column grid'), 'PPFD delta map must reject incompatible baseline grids');
assert(ppfd.includes("box.style.background=heat(v)") && ppfd.includes("heat(input.value)"), 'PPFD page must preserve blank map cells as unmeasured');
assert(ppfd.includes('href="/tools/"'), 'PPFD page missing central All Tools link');
assert(atlas.includes('href="/tools/"'), 'Plant Atlas missing central All Tools link');
assert(terpenes.includes('href="/tools/"'), 'Terpene Atlas missing central All Tools link');

const sample = Math.max(0, leafVpd(26,60,25));
const scheduleDli = calculateVariableLight([{ppfd:300,hours:1},{ppfd:700,hours:10},{ppfd:300,hours:1}]).dli;
assert(sample > 0.9 && sample < 1.2, `Shared VPD sanity check failed: ${sample}`);
assert(Math.abs(scheduleDli - 27.36) < 1e-9, `Shared PPFD variable-light DLI sanity check failed: ${scheduleDli}`);

if (errors.length) {
  console.error(`Cultivation reference tool validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(' - ' + error);
  process.exit(1);
}

console.log('Cultivation reference tool validation passed: hub links, canonical Tools navigation, pH/TDS journals, VPD/PPFD calculations, Light Lab survey workflows, and cross-references are intact.');

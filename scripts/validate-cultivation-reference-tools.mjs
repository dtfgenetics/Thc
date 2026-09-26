import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const files = {
  hub: 'site/public-route-patch/tools/index.html',
  ph: 'site/public-route-patch/ph-meter/index.html',
  tds: 'site/public-route-patch/tds-meter/index.html',
  vpd: 'site/public-route-patch/vpd-chart/index.html',
};

const read = (key) => fs.readFileSync(path.join(root, files[key]), 'utf8');
const hub = read('hub');
const ph = read('ph');
const tds = read('tds');
const vpd = read('vpd');
const errors = [];
const assert = (ok, msg) => { if (!ok) errors.push(msg); };

for (const route of ['/atlas/', '/terpene-atlas/', '/ph-meter/', '/tds-meter/', '/vpd-chart/']) {
  assert(hub.includes(`href="${route}"`) || hub.includes(`href='${route}'`), `tools hub missing ${route}`);
}
assert((hub.match(/target="_blank"/g) || []).length >= 5, 'tools hub must open all five reference launchers in a new tab');
for (const label of ['Plant Atlas', 'Terpene Atlas', 'pH Meter', 'TDS / EC Meter', 'VPD Chart']) {
  assert(hub.includes(label), `tools hub missing visible label: ${label}`);
}

const canonical = [
  ['/', 'Home'], ['/seeds/', 'Seeds'], ['/learn/', 'Learn'], ['/courses/', 'Courses'],
  ['/tools/', 'Diagnostic'], ['/games/', 'Games'], ['/community/', 'Community'], ['/shop/', 'Shop'],
];
for (const [fileKey, html] of [['ph', ph], ['tds', tds], ['vpd', vpd]]) {
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

assert(tds.includes('ppm ≈ EC × 500') && tds.includes('ppm ≈ EC × 700'), 'TDS page missing 500/700 scale explanation');
assert(tds.includes("v*500") && tds.includes("v*700"), 'TDS converter missing 500/700 conversion');
assert(tds.includes("(p/s).toFixed(2)"), 'TDS reverse conversion missing ppm-to-EC calculation');

assert(vpd.includes('0.6108*Math.exp((17.27*t)/(t+237.3))'), 'VPD page missing saturation-vapor-pressure equation');
assert(vpd.includes('svp(leaf)-svp(air)*(rhValue/100)'), 'VPD page missing leaf-to-air vapor pressure deficit calculation');
assert(vpd.includes('Relative humidity (%)') && vpd.includes('Leaf offset'), 'VPD page missing required inputs');
assert(vpd.includes("u==='f'?(v-32)*5/9:v") && vpd.includes("v*9/5+32"), 'VPD page missing Celsius/Fahrenheit conversion support');

const atlas = fs.readFileSync(path.join(root, 'site/public-route-patch/atlas/index.html'), 'utf8');
const terpenes = fs.readFileSync(path.join(root, 'site/public-route-patch/terpene-atlas/index.html'), 'utf8');
assert(atlas.includes('href="/tools/"'), 'Plant Atlas missing central All Tools link');
assert(terpenes.includes('href="/tools/"'), 'Terpene Atlas missing central All Tools link');

const svp = (t) => 0.6108 * Math.exp((17.27 * t) / (t + 237.3));
const sample = Math.max(0, svp(25) - svp(26) * 0.60);
assert(sample > 1.0 && sample < 1.3, `VPD formula sanity check failed: ${sample}`);

if (errors.length) {
  console.error(`Cultivation reference tool validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(' - ' + error);
  process.exit(1);
}

console.log('Cultivation reference tool validation passed: hub links, canonical navigation, pH/TDS/VPD calculations, and cross-references are intact.');

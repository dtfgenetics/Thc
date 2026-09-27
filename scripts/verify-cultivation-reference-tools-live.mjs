#!/usr/bin/env node
import process from 'node:process';
import fs from 'node:fs';

const baseUrl = String(process.env.DTF_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const tag = process.env.GITHUB_RUN_ID || Date.now().toString();

const registry = JSON.parse(fs.readFileSync('data/tool-registry.json','utf8'));
const routes = registry.tools
  .filter(tool => tool.public)
  .map(tool => ({ path: `/${tool.slug}/`, markers: tool.liveMarkers }));

const errors = [];

const assets = [
  { path: '/assets/thc-tool-suite-v1.js', markers: ['thc-cultivation-context-v1', 'addEnvironmentReading', 'addIrrigationRecord'] },
  { path: '/assets/thc-tool-suite-v1.css', markers: ['.top', '.shell', '.fields'] },
  { path: '/assets/thc-measurement-journal-v1.js', markers: ['THCMeasurementJournal', 'create'] },
  { path: '/assets/thc-cultivation-math-v1.mjs', markers: ['export function dliFromPpfd', 'export function serialDilution', 'export function deliveredCfmForAirChanges'] },
  { path: '/assets/thc-light-lab-math-v1.mjs', markers: ['calculateStableLight', 'calculateVariableLight', 'dliRangeForMap'] },
  { path: '/assets/vendor/papaparse-5.7.0.min.js', markers: ['Papa'] },
  { path: '/assets/vendor/uplot-1.6.32.min.js', markers: ['uPlot'] },
  { path: '/assets/vendor/uplot-1.6.32.min.css', markers: ['.uplot'] },
  { path: '/assets/breeder-pedigree-graph-v1.js', markers: ['THCBreederGraph', 'cytoscape'] },
  { path: '/assets/vendor/cytoscape-3.34.3.min.js', markers: ['cytoscape'] },
];


for (const route of routes) {
  const url = new URL(route.path, baseUrl);
  url.searchParams.set('dtf_cultivation_tools_verify', tag);
  let response;
  let body = '';
  try {
    response = await fetch(url, {
      redirect: 'manual',
      headers: {
        'Cache-Control': 'no-cache, no-store, max-age=0',
        Pragma: 'no-cache',
        'User-Agent': 'DTFSeeds-Cultivation-Reference-Verification/1.0',
      },
      signal: AbortSignal.timeout(20000),
    });
    body = await response.text();
  } catch (error) {
    errors.push(`${route.path}: request failed: ${error.message}`);
    continue;
  }

  if (response.status !== 200) {
    errors.push(`${route.path}: expected HTTP 200, received ${response.status}`);
    continue;
  }
  if (response.headers.get('location')) {
    errors.push(`${route.path}: unexpected redirect to ${response.headers.get('location')}`);
  }
  if (body.length < 500) {
    errors.push(`${route.path}: response is suspiciously small (${body.length} bytes)`);
  }
  for (const marker of route.markers) {
    if (!body.toLowerCase().includes(marker.toLowerCase())) {
      errors.push(`${route.path}: missing live marker: ${marker}`);
    }
  }
}

if (errors.length) {
  console.error(`Cultivation reference live verification failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(' - ' + error);
  process.exit(1);
}


for (const asset of assets) {
  const url = new URL(asset.path, baseUrl);
  url.searchParams.set('dtf_cultivation_assets_verify', tag);
  let response;
  let body = '';
  try {
    response = await fetch(url, {
      redirect: 'manual',
      headers: {
        'Cache-Control': 'no-cache, no-store, max-age=0',
        Pragma: 'no-cache',
        'User-Agent': 'DTFSeeds-Cultivation-Asset-Verification/1.0',
      },
      signal: AbortSignal.timeout(20000),
    });
    body = await response.text();
  } catch (error) {
    errors.push(`${asset.path}: asset request failed: ${error.message}`);
    continue;
  }

  if (response.status !== 200) {
    errors.push(`${asset.path}: expected HTTP 200, received ${response.status}`);
    continue;
  }
  if (body.length < 50) {
    errors.push(`${asset.path}: asset response is suspiciously small (${body.length} bytes)`);
  }
  for (const marker of asset.markers) {
    if (!body.includes(marker)) errors.push(`${asset.path}: missing live asset marker: ${marker}`);
  }
}

if (errors.length) {
  console.error(`Cultivation shared-asset live verification failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(' - ' + error);
  process.exit(1);
}

console.log(`Cultivation tool live verification passed for ${routes.length} registry-owned routes plus shared runtime assets.`);

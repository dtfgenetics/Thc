#!/usr/bin/env node
import process from 'node:process';

const baseUrl = String(process.env.DTF_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const tag = process.env.GITHUB_RUN_ID || Date.now().toString();

const routes = [
  { path: '/tools/', markers: ['Cultivation reference tools', 'Plant Atlas', 'Terpene Atlas', 'pH Meter', 'TDS / EC Meter', 'VPD Chart', 'PPFD / DLI'] },
  { path: '/atlas/', markers: ['THC Living Plant Atlas', 'All Tools'] },
  { path: '/terpene-atlas/', markers: ['THC Terpene Atlas', 'All Tools'] },
  { path: '/ph-meter/', markers: ['pH Meter', 'All Tools', 'This page does not measure pH by itself'] },
  { path: '/tds-meter/', markers: ['TDS / EC Meter', 'All Tools', '500 scale', '700 scale'] },
  { path: '/vpd-chart/', markers: ['VPD Chart', 'All Tools', 'Leaf offset'] },
  { path: '/ppfd-chart/', markers: ['THC Light Lab', 'All Tools', 'Canopy mapper', 'Survey record', 'Variable-light DLI schedule', 'Import full survey', 'Measurement protocol', 'Metric (m / cm)', 'Sensor calibration / check date', 'Setup differs in', 'Direct comparison caution:', 'Skip to Light Lab', 'THC Light Lab — Survey Report', 'Delta vs baseline', 'paired readings', 'Within ±10% of average', 'Perimeter ÷ center average', 'Approx. point spacing', 'not universal target bands'] },
  { path: '/unit-converter/', markers: ['THC Cultivation Unit Converter', 'All Tools', 'Conductivity'] },
  { path: '/dilution-calculator/', markers: ['THC Solution Dilution Calculator', 'All Tools', 'Serial dilution steps'] },
  { path: '/root-zone-temperature/', markers: ['THC Root-Zone Temperature Reference', 'All Tools', 'Root-zone trend'] },
  { path: '/plant-growth-tracker/', markers: ['THC Plant Growth Tracker', 'All Tools', 'Growth-rate trend'] },
  { path: '/photoperiod-planner/', markers: ['THC Photoperiod & Lighting Schedule', 'All Tools', 'Compare saved schedules'] },
  { path: '/co2-ventilation/', markers: ['THC Ventilation & CO₂ Reference', 'All Tools', 'target ACH'] },
  { path: '/substrate-calculator/', markers: ['THC Substrate & Container Calculator', 'All Tools', 'Purchase overage'] },
  { path: '/dry-cure-lab/', markers: ['THC Dry & Cure Lab', 'All Tools', 'Save harvest to GrowLens'] },
  { path: '/environment-control/', markers: ['THC Environmental Control Center', 'All Tools', 'Recent VPD trend'] },
  { path: '/dew-point/', markers: ['THC Dew Point & Condensation Lab', 'All Tools', 'dew point'] },
  { path: '/dryback-lab/', markers: ['THC Irrigation & Dryback Lab', 'All Tools', 'Recent dryback trend'] },
  { path: '/fertigation-lab/', markers: ['THC Fertigation Lab', 'All Tools', 'Target vs achieved recipe worksheet'] },
  { path: '/water-quality-lab/', markers: ['THC Water Quality Lab', 'All Tools', 'Change from prior report'] },
];

const errors = [];

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

console.log('Cultivation reference live verification passed for the tools hub, atlases, and all 16 cultivation tool routes.');

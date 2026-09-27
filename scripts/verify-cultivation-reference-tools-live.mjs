#!/usr/bin/env node
import process from 'node:process';

const baseUrl = String(process.env.DTF_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const tag = process.env.GITHUB_RUN_ID || Date.now().toString();

const routes = [
  { path: '/tools/', markers: ['THC Tool Suite', 'Water Quality Lab', 'Fertigation Lab', 'Irrigation & Dryback Lab', 'Environmental Control Center', 'IPM Scout', 'Dry & Cure Lab', 'Grow Cycle Planner', 'Breeding & Pedigree Builder'] },
  { path: '/atlas/', markers: ['THC Living Plant Atlas', 'All Tools'] },
  { path: '/terpene-atlas/', markers: ['THC Terpene Atlas', 'All Tools'] },
  { path: '/ph-meter/', markers: ['pH Meter', 'All Tools', 'This page does not measure pH by itself'] },
  { path: '/tds-meter/', markers: ['TDS / EC Meter', 'All Tools', '500 scale', '700 scale'] },
  { path: '/vpd-chart/', markers: ['VPD Chart', 'All Tools', 'Leaf offset'] },
  { path: '/ppfd-chart/', markers: ['THC Light Lab', 'All Tools', 'Canopy mapper', 'Survey record', 'Variable-light DLI schedule', 'Import full survey', 'Measurement protocol', 'Metric (m / cm)', 'Sensor calibration / check date', 'Skip to Light Lab', 'THC Light Lab — Survey Report', 'Delta vs baseline', 'paired readings', 'Within ±10% of average', 'Perimeter ÷ center average', 'Approx. point spacing', 'not universal target bands'] },
  { path: '/water-quality-lab/', markers: ['THC Water Quality Lab', 'Water report', 'Source history'] },
  { path: '/fertigation-lab/', markers: ['THC Fertigation Lab', 'Injector / stock-tank mode', 'Target vs achieved recipe worksheet'] },
  { path: '/dryback-lab/', markers: ['THC Irrigation & Dryback Lab', 'Dryback measurement', 'Recent dryback trend'] },
  { path: '/dew-point/', markers: ['THC Dew Point & Condensation Lab', 'Condensation check', 'dew point'] },
  { path: '/environment-control/', markers: ['THC Environmental Control Center', 'User guardrails', 'Recent VPD trend'] },
  { path: '/ipm-scout/', markers: ['THC IPM Scout', 'New scouting record', 'Selected route trend'] },
  { path: '/dry-cure-lab/', markers: ['THC Dry & Cure Lab', 'Drying checkpoint', 'Drying history'] },
  { path: '/grow-planner/', markers: ['THC Grow Cycle Planner', 'Stage calendar', 'Create GrowLens stage tasks'] },
  { path: '/substrate-calculator/', markers: ['THC Substrate & Container Calculator', 'Actual fill factor', 'Saved media plans'] },
  { path: '/breeder-pedigree/', markers: ['DTF Breeding & Pedigree Builder', 'Relationship explorer', 'Direct descendants'] },
  { path: '/co2-ventilation/', markers: ['THC Ventilation & CO₂ Reference', 'Delivered airflow factor', 'Required airflow for entered target'] },
  { path: '/photoperiod-planner/', markers: ['THC Photoperiod & Lighting Schedule', 'Compare saved schedules', 'Most recent change'] },
  { path: '/plant-growth-tracker/', markers: ['THC Plant Growth Tracker', 'Growth-rate trend', 'Saved intervals'] },
  { path: '/root-zone-temperature/', markers: ['THC Root-Zone Temperature Reference', 'Root-zone trend', 'Recent readings'] },
  { path: '/dilution-calculator/', markers: ['THC Solution Dilution Calculator', 'Serial dilution steps', 'Diluent amount'] },
  { path: '/unit-converter/', markers: ['THC Cultivation Unit Converter', 'Conductivity', 'Airflow'] },
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

console.log('Cultivation reference live verification passed for the Tools hub, legacy reference tools, and all THC Tool Suite v1 production routes.');

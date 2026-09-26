#!/usr/bin/env node
import process from 'node:process';

const baseUrl = String(process.env.DTF_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const tag = process.env.GITHUB_RUN_ID || Date.now().toString();

const routes = [
  { path: '/tools/', markers: ['Cultivation reference desk', 'Plant Atlas', 'Terpene Atlas', 'pH Meter', 'TDS / EC Meter', 'VPD Chart'] },
  { path: '/atlas/', markers: ['THC Living Plant Atlas', 'All Tools'] },
  { path: '/terpene-atlas/', markers: ['THC Terpene Atlas', 'All Tools'] },
  { path: '/ph-meter/', markers: ['pH Meter', 'All Tools', 'This page does not measure pH by itself'] },
  { path: '/tds-meter/', markers: ['TDS / EC Meter', 'All Tools', '500 scale', '700 scale'] },
  { path: '/vpd-chart/', markers: ['VPD Chart', 'All Tools', 'Leaf temperature offset'] },
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

console.log('Cultivation reference live verification passed for /tools/, Plant Atlas, Terpene Atlas, pH, TDS/EC, and VPD routes.');

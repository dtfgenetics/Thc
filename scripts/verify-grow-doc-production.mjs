#!/usr/bin/env node
import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

dns.setDefaultResultOrder('ipv4first');

const site = String(process.env.SITE || 'https://dtfseeds.com').replace(/\/+$/, '');
const reportPath = String(process.env.DTF_GROW_DOC_REPORT || '').trim();
const route = '/thc-grow-doc/';
const markers = ['Diagnose', 'Plant atlas', 'Issue library', 'Reference images'];
const attempts = 4;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithTimeout(url, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`request timed out after ${timeoutMs}ms`)), timeoutMs);
  try {
    return await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache, no-store, max-age=0',
        Pragma: 'no-cache',
        'User-Agent': 'DTFSeeds-Grow-Doc-Production-Identity/1.0',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchStable(url) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetchWithTimeout(url);
      if (response.status >= 500 || response.status === 429) {
        const text = await response.text();
        lastError = new Error(`${url} returned ${response.status}: ${text.slice(0, 200)}`);
      } else {
        return response;
      }
    } catch (error) {
      lastError = error;
    }
    if (attempt < attempts) await sleep(1500 * attempt);
  }
  throw lastError || new Error(`Could not fetch ${url}`);
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

const token = `${Date.now()}-${process.pid}-${Math.random().toString(16).slice(2)}`;
const pageUrl = new URL(route, site);
pageUrl.searchParams.set('dtf_grow_doc_identity', token);

const pageResponse = await fetchStable(pageUrl);
const html = await pageResponse.text();
const finalUrl = new URL(pageResponse.url);

requireCondition(pageResponse.ok, `Grow Doc route returned HTTP ${pageResponse.status}`);
requireCondition(finalUrl.pathname === route, `Grow Doc route identity changed to ${finalUrl.pathname}`);
requireCondition(/<div\s+id=["']root["']/i.test(html), 'Grow Doc React root element is missing.');
requireCondition(/<link\s+rel=["']canonical["']\s+href=["']https:\/\/dtfseeds\.com\/thc-grow-doc\/["']/i.test(html), 'Grow Doc canonical URL is missing or incorrect.');

const jsMatch = html.match(/<script[^>]+src=["'](\/thc-grow-doc\/assets\/index-[A-Za-z0-9_-]+\.js)["'][^>]*><\/script>/i);
const cssMatch = html.match(/<link[^>]+href=["'](\/thc-grow-doc\/assets\/index-[A-Za-z0-9_-]+\.css)["'][^>]*>/i);
requireCondition(jsMatch, 'Grow Doc hashed JavaScript entry asset is missing from the live HTML.');
requireCondition(cssMatch, 'Grow Doc hashed stylesheet entry asset is missing from the live HTML.');

const jsUrl = new URL(jsMatch[1], site);
jsUrl.searchParams.set('dtf_grow_doc_identity', token);
const cssUrl = new URL(cssMatch[1], site);
cssUrl.searchParams.set('dtf_grow_doc_identity', token);

const [jsResponse, cssResponse] = await Promise.all([fetchStable(jsUrl), fetchStable(cssUrl)]);
const [js, css] = await Promise.all([jsResponse.text(), cssResponse.text()]);

requireCondition(jsResponse.ok, `Grow Doc JavaScript entry returned HTTP ${jsResponse.status}`);
requireCondition(cssResponse.ok, `Grow Doc stylesheet entry returned HTTP ${cssResponse.status}`);
requireCondition(Buffer.byteLength(js) > 250000, `Grow Doc JavaScript bundle is unexpectedly small (${Buffer.byteLength(js)} bytes).`);
requireCondition(Buffer.byteLength(css) > 15000, `Grow Doc stylesheet bundle is unexpectedly small (${Buffer.byteLength(css)} bytes).`);

const missingMarkers = markers.filter(marker => !js.includes(marker));
requireCondition(missingMarkers.length === 0, `Grow Doc React bundle is missing application markers: ${missingMarkers.join(', ')}`);

const report = {
  schemaVersion: 1,
  site,
  route,
  generatedAt: new Date().toISOString(),
  page: {
    status: pageResponse.status,
    finalUrl: pageResponse.url,
    bytes: Buffer.byteLength(html),
    reactRoot: true,
  },
  assets: {
    javascript: { path: jsMatch[1], status: jsResponse.status, bytes: Buffer.byteLength(js) },
    stylesheet: { path: cssMatch[1], status: cssResponse.status, bytes: Buffer.byteLength(css) },
  },
  markers,
  ok: true,
};

if (reportPath) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

console.log(JSON.stringify(report));

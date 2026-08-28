#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import dns from 'node:dns';
import { fileURLToPath } from 'node:url';

dns.setDefaultResultOrder('ipv4first');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const registryPath = process.env.DTF_PUBLIC_NAVIGATION || path.join(repoRoot, 'data', 'public-navigation.json');
const reportPath = process.env.DTF_FEATURE_REPORT || '';
const listOnly = process.argv.includes('--list') || process.argv.includes('--plan-only');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function normalizeRoute(route) {
  const value = String(route || '').trim();
  if (!value.startsWith('/')) throw new Error(`public route must start with '/': ${value}`);
  return value === '/' ? '/' : `${value.replace(/\/+$/, '')}/`;
}

function markerFromTitle(title) {
  let value = String(title || '').trim().replace(/^THC\s+/i, '');
  value = value.split(/\s+[—–]\s+|:\s*/u, 1)[0].trim();
  if (!value) throw new Error(`could not derive durable marker from title: ${title}`);
  return value;
}

function buildPlan(registry) {
  const hubs = [
    { kind: 'hub', id: 'games-hub', route: '/games/', marker: 'DTF Game Hub' },
    { kind: 'hub', id: 'tools-hub', route: '/tools/', marker: 'DTF Cultivation Tools' },
    { kind: 'hub', id: 'projects-hub', route: '/projects/', marker: 'DTF Projects' },
  ];

  const tools = (registry.tools || [])
    .filter(item => item && item.public === true)
    .map(item => ({
      kind: 'tool',
      id: String(item.id || ''),
      route: normalizeRoute(item.route),
      marker: markerFromTitle(item.title),
      title: String(item.title || ''),
    }));

  const games = (registry.games || [])
    .filter(item => item && item.public === true)
    .map(item => ({
      kind: item.status === 'multiplayer' ? 'multiplayer' : 'game',
      id: String(item.id || ''),
      route: normalizeRoute(item.route),
      marker: markerFromTitle(item.title),
      title: String(item.title || ''),
    }));

  const plan = [...hubs, ...tools, ...games].map(item => ({ ...item, route: normalizeRoute(item.route) }));
  const seen = new Map();
  for (const item of plan) {
    if (!item.id) throw new Error(`public route ${item.route} is missing an id`);
    const existing = seen.get(item.route);
    if (existing) throw new Error(`duplicate public route ${item.route}: ${existing} and ${item.id}`);
    seen.set(item.route, item.id);
  }
  if (games.length === 0) throw new Error('public game registry is empty');
  if (tools.length === 0) throw new Error('public tool registry is empty');
  return plan;
}

function normalizedPathname(url) {
  const pathname = new URL(url).pathname;
  return normalizeRoute(pathname);
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`request timed out after ${timeoutMs}ms`)), timeoutMs);
  try {
    return await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'Cache-Control': 'no-cache, no-store, max-age=0',
        Pragma: 'no-cache',
        'User-Agent': 'DTFSeeds-Feature-Audit/3.0',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function verifyOne(site, item) {
  const attempts = 4;
  let last = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const token = `${Date.now()}-${process.pid}-${attempt}-${Math.random().toString(16).slice(2)}`;
    const requestUrl = new URL(item.route, site);
    requestUrl.searchParams.set('dtf_feature_audit', token);
    try {
      const response = await fetchWithTimeout(requestUrl, 45000);
      const body = await response.text();
      const status = response.status;
      const bytes = Buffer.byteLength(body);
      const markerSeen = body.toLocaleLowerCase().includes(item.marker.toLocaleLowerCase());
      const finalPath = normalizedPathname(response.url);
      const routeIdentity = finalPath === item.route;
      const ok = status >= 200 && status < 300 && bytes > 400 && markerSeen && routeIdentity;
      last = {
        ...item,
        status,
        bytes,
        markerSeen,
        routeIdentity,
        finalUrl: response.url,
        ok,
        attempt,
        error: null,
      };
      if (ok) return last;
      if (status < 500 && status !== 429 && markerSeen && routeIdentity) break;
    } catch (error) {
      last = {
        ...item,
        status: 0,
        bytes: 0,
        markerSeen: false,
        routeIdentity: false,
        finalUrl: '',
        ok: false,
        attempt,
        error: error?.message || String(error),
      };
    }
    if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
  }
  return last;
}

function tsvSafe(value) {
  return String(value ?? '').replace(/[\t\r\n]+/g, ' ');
}

const registry = readJson(registryPath);
const plan = buildPlan(registry);
const site = String(process.env.SITE || registry.site || 'https://dtfseeds.com').replace(/\/+$/, '');

if (listOnly) {
  process.stdout.write(`${JSON.stringify({ site, total: plan.length, routes: plan }, null, 2)}\n`);
  process.exit(0);
}

const rows = [];
for (const item of plan) {
  const row = await verifyOne(site, item);
  rows.push(row);
  console.log([
    row.kind,
    row.route,
    row.status || '000',
    row.markerSeen ? 'yes' : 'no',
    row.routeIdentity ? 'yes' : 'no',
    row.bytes,
    row.ok ? 'yes' : 'no',
    row.finalUrl || '-',
    row.error || '-',
  ].map(tsvSafe).join('\t'));
}

const failures = rows.filter(row => !row.ok);
const report = {
  schemaVersion: 1,
  site,
  generatedAt: new Date().toISOString(),
  registry: path.relative(repoRoot, registryPath),
  total: rows.length,
  failures: failures.length,
  rows,
};

if (reportPath) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
}

console.log(`Audited ${rows.length} registry-backed public surfaces; failures=${failures.length}.`);
if (failures.length > 0) {
  for (const row of failures) {
    console.error(`FAILED ${row.route}: HTTP=${row.status || '000'} marker=${row.markerSeen} identity=${row.routeIdentity} final=${row.finalUrl || '-'} error=${row.error || '-'}`);
  }
  process.exit(1);
}

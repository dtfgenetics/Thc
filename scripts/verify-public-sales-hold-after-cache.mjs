import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const DEFAULT_BASE = 'https://dtfseeds.com';
const ROUTES = [
  { path: '/', marker: 'Genetics first. Learn the plant behind the pack.', hold: true },
  { path: '/tools/', marker: 'Grow with records. Diagnose with evidence.' },
  { path: '/vpd-chart/', marker: 'Leaf-VPD calculator' }
];

export function purchasingLinks(html, origin = DEFAULT_BASE) {
  const urls = [];
  const base = new URL(origin);
  for (const match of String(html).matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])(.*?)\1/gi)) {
    let url;
    try { url = new URL(match[2].replaceAll('&amp;', '&'), base); } catch { continue; }
    if (url.origin !== base.origin) continue;
    if (/^\/(?:shop|product|cart|checkout)(?:\/|$)/i.test(url.pathname)) urls.push(url.pathname);
  }
  return urls;
}

export function inspectHtml(html, route, origin = DEFAULT_BASE) {
  const failures = [];
  const body = String(html || '');
  if (!body.includes(route.marker)) failures.push('expected page identity not found');
  if (route.hold && !/Seed sales temporarily on hold/i.test(body)) {
    failures.push('homepage sales-hold notice missing');
  }
  const links = purchasingLinks(body, origin);
  if (links.length) failures.push('purchasing navigation still present: ' + [...new Set(links)].join(', '));
  return failures;
}

export async function verifyPage(base, route, mode, nonce, fetcher = fetch) {
  const url = new URL(route.path, base);
  if (mode === 'bypass-query') url.searchParams.set('dtf_sales_hold_verify', nonce);
  const response = await fetcher(url, {
    redirect: 'follow',
    headers: { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' },
    signal: AbortSignal.timeout(30000)
  });
  if (response.url && new URL(response.url).origin !== new URL(base).origin) {
    return { path: route.path, mode, status: response.status, failures: ['unexpected cross-domain redirect'] };
  }
  const html = await response.text();
  const failures = response.status === 200 ? inspectHtml(html, route, base) : ['HTTP ' + response.status];
  return { path: route.path, mode, status: response.status, failures };
}

async function main() {
  const base = process.env.DTF_PUBLIC_SITE || DEFAULT_BASE;
  if (new URL(base).origin !== DEFAULT_BASE) throw new Error('Only the canonical public domain can be verified');
  const nonce = String(process.env.GITHUB_RUN_ID || Date.now());
  let failed = false;
  for (const route of ROUTES) {
    for (const mode of ['plain', 'bypass-query']) {
      let result;
      try { result = await verifyPage(base, route, mode, nonce); }
      catch (error) {
        result = { path: route.path, mode, status: 'unavailable', failures: [String(error.message || error).slice(0,180)] };
      }
      const ok = result.failures.length === 0;
      console.log(JSON.stringify({ route: result.path, mode: result.mode, http: result.status, ok, failures: result.failures }));
      if (!ok) failed = true;
    }
  }
  if (failed) {
    console.error('Public cache has not converged. Do not mark the Hostinger release verified or bypass the sales hold.');
    process.exitCode = 1;
  } else console.log('Public sales-hold verification passed on both canonical and cache-busted URLs.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

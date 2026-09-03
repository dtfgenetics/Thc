#!/usr/bin/env node
import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from '@playwright/test';

dns.setDefaultResultOrder('ipv4first');

const site = String(process.env.SITE || 'https://dtfseeds.com').replace(/\/+$/, '');
const route = '/thc-grow-doc/';
const evidenceDir = path.resolve(process.env.DTF_GROW_DOC_BROWSER_EVIDENCE || 'test-results/grow-doc-live');
fs.mkdirSync(evidenceDir, { recursive: true });

const views = [
  { label: 'Diagnose', heading: 'Document the plant before you diagnose it.', mode: 'nav' },
  { label: 'Plant atlas', heading: 'Navigate the plant by evidence, not decoration.', mode: 'nav' },
  { label: 'Issue library', heading: 'Issue library', mode: 'nav' },
  { label: 'Reference images', heading: 'Reference images', mode: 'nav' },
  { label: 'Grow log', heading: 'Grow log', mode: 'nav' },
  { label: 'Dataset coverage', heading: 'Coverage dashboard', mode: 'coverage' },
  { label: 'About', heading: 'About THC Grow Doc', mode: 'nav' },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertNoPageOverflow(page, name) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 1, `${name} has ${overflow}px of page-level horizontal overflow.`);
}

async function assertDarkProductShell(page, name) {
  const colors = await page.evaluate(() => {
    const shell = document.querySelector('.app-shell');
    const header = document.querySelector('.site-header');
    return {
      shell: shell ? getComputedStyle(shell).backgroundColor : '',
      body: getComputedStyle(document.body).backgroundColor,
      header: header ? getComputedStyle(header).backgroundColor : '',
    };
  });
  const white = new Set(['rgb(255, 255, 255)', 'rgba(255, 255, 255, 1)']);
  assert(!white.has(colors.shell) || !white.has(colors.header), `${name} rendered as an all-white product shell instead of the dark Grow Doc UI.`);
}

async function visitView(page, viewportName, item) {
  if (viewportName === 'mobile') {
    const menu = page.getByRole('button', { name: 'Open menu' });
    await menu.waitFor({ state: 'visible' });
    await menu.click();
    const mobileNav = page.getByRole('navigation', { name: 'Grow Doc mobile navigation' });
    await mobileNav.waitFor({ state: 'visible' });
    await mobileNav.getByRole('button', { name: item.label, exact: true }).click();
  } else if (item.mode === 'coverage') {
    await page.getByRole('button', { name: /Dataset v0\.2/i }).click();
  } else {
    const desktopNav = page.getByRole('navigation', { name: 'Grow Doc navigation' });
    await desktopNav.getByRole('button', { name: item.label, exact: true }).click();
  }

  const heading = page.getByRole('heading', { name: item.heading, exact: true });
  await heading.waitFor({ state: 'visible' });
  await assertNoPageOverflow(page, `${viewportName} ${item.label}`);
}

async function runViewport(browser, viewportName, viewport) {
  const context = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const failedRequiredRequests = [];
  const badRequiredResponses = [];

  page.on('pageerror', error => pageErrors.push(error.message || String(error)));
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('requestfailed', request => {
    try {
      const url = new URL(request.url());
      if (url.origin === site && url.pathname.startsWith(route)) {
        failedRequiredRequests.push(`${request.method()} ${url.pathname}: ${request.failure()?.errorText || 'request failed'}`);
      }
    } catch {}
  });
  page.on('response', response => {
    try {
      const url = new URL(response.url());
      if (url.origin === site && url.pathname.startsWith(route) && response.status() >= 400) {
        badRequiredResponses.push(`${response.status()} ${url.pathname}`);
      }
    } catch {}
  });

  const token = `${Date.now()}-${process.pid}-${viewportName}-${Math.random().toString(16).slice(2)}`;
  const url = `${site}${route}?dtf_browser_acceptance=${encodeURIComponent(token)}`;
  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
  assert(response?.ok(), `${viewportName} Grow Doc navigation returned HTTP ${response?.status() ?? 'unknown'}.`);
  assert(new URL(page.url()).pathname === route, `${viewportName} Grow Doc redirected away from ${route}.`);

  await page.getByRole('link', { name: 'DTF Genetics home' }).waitFor({ state: 'visible' });
  await page.getByRole('heading', { name: 'Document the plant before you diagnose it.', exact: true }).waitFor({ state: 'visible' });
  await assertNoPageOverflow(page, `${viewportName} initial Diagnose view`);
  await assertDarkProductShell(page, viewportName);

  if (viewportName === 'desktop') {
    const desktopNav = page.getByRole('navigation', { name: 'Grow Doc navigation' });
    await desktopNav.waitFor({ state: 'visible' });
    for (const label of ['Diagnose', 'Plant atlas', 'Issue library', 'Reference images', 'Grow log', 'About']) {
      await desktopNav.getByRole('button', { name: label, exact: true }).waitFor({ state: 'visible' });
    }
    await page.getByRole('button', { name: /Dataset v0\.2/i }).waitFor({ state: 'visible' });
  } else {
    await page.getByRole('button', { name: 'Open menu' }).waitFor({ state: 'visible' });
  }

  for (const item of views) await visitView(page, viewportName, item);

  await page.screenshot({ path: path.join(evidenceDir, `${viewportName}-about.png`), fullPage: true });

  assert(pageErrors.length === 0, `${viewportName} uncaught page errors:\n${pageErrors.join('\n')}`);
  assert(failedRequiredRequests.length === 0, `${viewportName} failed same-origin Grow Doc requests:\n${failedRequiredRequests.join('\n')}`);
  assert(badRequiredResponses.length === 0, `${viewportName} non-success Grow Doc responses:\n${badRequiredResponses.join('\n')}`);
  assert(consoleErrors.length === 0, `${viewportName} browser console errors:\n${consoleErrors.join('\n')}`);

  const result = {
    viewport: viewportName,
    width: viewport.width,
    height: viewport.height,
    views: views.map(({ label, heading }) => ({ label, heading, ok: true })),
    pageErrors,
    consoleErrors,
    failedRequiredRequests,
    badRequiredResponses,
    ok: true,
  };
  await context.close();
  return result;
}

const browser = await chromium.launch({ headless: true });
try {
  const results = [];
  results.push(await runViewport(browser, 'desktop', { width: 1440, height: 1000 }));
  results.push(await runViewport(browser, 'mobile', { width: 390, height: 844 }));
  const report = {
    schemaVersion: 1,
    site,
    route,
    generatedAt: new Date().toISOString(),
    results,
    ok: results.every(result => result.ok),
  };
  fs.writeFileSync(path.join(evidenceDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}

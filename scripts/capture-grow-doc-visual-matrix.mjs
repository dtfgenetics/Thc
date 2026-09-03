#!/usr/bin/env node
import dns from 'node:dns';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from '@playwright/test';

dns.setDefaultResultOrder('ipv4first');

const site = String(process.env.SITE || 'https://dtfseeds.com').replace(/\/+$/, '');
const route = '/thc-grow-doc/';
const evidenceDir = path.resolve(process.env.DTF_GROW_DOC_VISUAL_MATRIX || 'test-results/grow-doc-visual-matrix');
fs.mkdirSync(evidenceDir, { recursive: true });

const views = [
  { label: 'Diagnose', slug: 'diagnose', heading: 'Document the plant before you diagnose it.', mode: 'nav' },
  { label: 'Plant atlas', slug: 'plant-atlas', heading: 'Navigate the plant by evidence, not decoration.', mode: 'nav' },
  { label: 'Issue library', slug: 'issue-library', heading: 'Issue library', mode: 'nav' },
  { label: 'Reference images', slug: 'reference-images', heading: 'Reference images', mode: 'nav' },
  { label: 'Grow log', slug: 'grow-log', heading: 'Grow log', mode: 'nav' },
  { label: 'Dataset coverage', slug: 'dataset-coverage', heading: 'Coverage dashboard', mode: 'coverage' },
  { label: 'About', slug: 'about', heading: 'About THC Grow Doc', mode: 'nav' },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function assertNoPageOverflow(page, name) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  const overflow = metrics.scrollWidth - metrics.clientWidth;
  assert(overflow <= 1, `${name} has ${overflow}px of page-level horizontal overflow.`);
  return { ...metrics, overflow };
}

async function primeFullPageForVisualCapture(page) {
  await page.addStyleTag({
    content: '.issue-row { content-visibility: visible !important; contain-intrinsic-size: auto !important; }',
  });

  await page.evaluate(async () => {
    const step = Math.max(500, Math.floor(window.innerHeight * 0.8));
    const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    for (let y = 0; y <= maxY; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    window.scrollTo(0, maxY);
    await new Promise((resolve) => setTimeout(resolve, 120));
    window.scrollTo(0, 0);
    await new Promise((resolve) => setTimeout(resolve, 120));
  });
}

async function assertReferenceMediaIntegrity(page, viewportName) {
  const metrics = await page.evaluate((routePath) => {
    const images = [...document.querySelectorAll('img[data-grow-doc-reference-image="true"]')];
    return images.map((image) => ({
      src: image.currentSrc || image.src,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      local: (image.currentSrc || image.src).includes(`${routePath}reference-media/crops/`),
    }));
  }, route);

  assert(metrics.length > 0, `${viewportName} Reference images rendered no reference image elements.`);
  const broken = metrics.filter((image) => !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0);
  assert(broken.length === 0, `${viewportName} Reference images contains ${broken.length} broken image element(s):\n${broken.map((image) => image.src).join('\n')}`);

  const local = metrics.filter((image) => image.local);
  assert(local.length >= 15, `${viewportName} Reference images rendered only ${local.length} scientifically matched same-origin reviewed crops; expected at least 15.`);

  return { renderedImages: metrics.length, localReviewedCrops: local.length, brokenImages: broken.length };
}

async function assertMobileDiagnoseComposition(page) {
  const metrics = await page.evaluate(() => {
    const grid = document.querySelector('.evidence-grid');
    const workflow = document.querySelector('.workflow-column');
    const result = document.querySelector('.result-panel');
    const slots = [...document.querySelectorAll('.evidence-slot')];
    const gridRect = grid?.getBoundingClientRect();
    const slotRects = slots.map((slot) => slot.getBoundingClientRect());
    const workflowRect = workflow?.getBoundingClientRect();
    const resultRect = result?.getBoundingClientRect();
    return {
      gridWidth: gridRect?.width ?? 0,
      slotWidths: slotRects.map((rect) => rect.width),
      slotLefts: slotRects.map((rect) => Math.round(rect.left)),
      workflowTop: workflowRect?.top ?? 0,
      workflowBottom: workflowRect?.bottom ?? 0,
      resultTop: resultRect?.top ?? 0,
    };
  });

  assert(metrics.gridWidth > 0 && metrics.slotWidths.length === 5, 'Mobile Diagnose evidence grid did not expose all five evidence cards.');
  assert(new Set(metrics.slotLefts).size === 1, `Mobile Diagnose evidence cards are not stacked in one column: ${metrics.slotLefts.join(', ')}`);
  assert(metrics.slotWidths.every((width) => Math.abs(width - metrics.gridWidth) <= 2), `Mobile Diagnose evidence cards do not fill the evidence grid: grid=${metrics.gridWidth}, slots=${metrics.slotWidths.join(', ')}`);
  assert(metrics.resultTop >= metrics.workflowBottom - 1, `Mobile Diagnose result summary appears before the primary workflow: resultTop=${metrics.resultTop}, workflowBottom=${metrics.workflowBottom}.`);
  return metrics;
}

async function chooseView(page, viewportName, item) {
  if (viewportName === 'mobile') {
    const menu = page.getByRole('button', { name: 'Open menu' });
    await menu.waitFor({ state: 'visible' });
    await menu.click();
    const mobileNav = page.getByRole('navigation', { name: 'Grow Doc mobile navigation' });
    await mobileNav.waitFor({ state: 'visible' });
    await mobileNav.getByRole('button', { name: item.label, exact: true }).click();
  } else if (item.mode === 'coverage') {
    await page.getByRole('button', { name: /Dataset v0\.2/i }).click();
  } else if (item.label !== 'Diagnose') {
    const desktopNav = page.getByRole('navigation', { name: 'Grow Doc navigation' });
    await desktopNav.getByRole('button', { name: item.label, exact: true }).click();
  }

  const heading = page.getByRole('heading', { name: item.heading, exact: true });
  await heading.waitFor({ state: 'visible' });
  await page.waitForTimeout(150);
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
  const response = await page.goto(`${site}${route}?dtf_visual_matrix=${encodeURIComponent(token)}`, { waitUntil: 'networkidle', timeout: 90000 });
  assert(response?.ok(), `${viewportName} Grow Doc returned HTTP ${response?.status() ?? 'unknown'}.`);
  assert(new URL(page.url()).pathname === route, `${viewportName} Grow Doc redirected away from ${route}.`);

  const captured = [];
  for (const item of views) {
    await chooseView(page, viewportName, item);
    const overflow = await assertNoPageOverflow(page, `${viewportName} ${item.label}`);
    await primeFullPageForVisualCapture(page);

    let referenceMedia = null;
    let mobileDiagnose = null;
    if (item.label === 'Reference images') referenceMedia = await assertReferenceMediaIntegrity(page, viewportName);
    if (viewportName === 'mobile' && item.label === 'Diagnose') mobileDiagnose = await assertMobileDiagnoseComposition(page);

    const screenshot = `${viewportName}-${item.slug}.png`;
    await page.screenshot({ path: path.join(evidenceDir, screenshot), fullPage: true });
    const dimensions = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    }));
    captured.push({ label: item.label, heading: item.heading, screenshot, ...overflow, ...dimensions, referenceMedia, mobileDiagnose, ok: true });
  }

  assert(pageErrors.length === 0, `${viewportName} uncaught page errors:\n${pageErrors.join('\n')}`);
  assert(failedRequiredRequests.length === 0, `${viewportName} failed same-origin Grow Doc requests:\n${failedRequiredRequests.join('\n')}`);
  assert(badRequiredResponses.length === 0, `${viewportName} non-success Grow Doc responses:\n${badRequiredResponses.join('\n')}`);
  assert(consoleErrors.length === 0, `${viewportName} browser console errors:\n${consoleErrors.join('\n')}`);

  await context.close();
  return {
    viewport: viewportName,
    width: viewport.width,
    height: viewport.height,
    views: captured,
    pageErrors,
    consoleErrors,
    failedRequiredRequests,
    badRequiredResponses,
    ok: true,
  };
}

const browser = await chromium.launch({ headless: true });
try {
  const results = [
    await runViewport(browser, 'desktop', { width: 1440, height: 1000 }),
    await runViewport(browser, 'mobile', { width: 390, height: 844 }),
  ];
  const report = {
    schemaVersion: 3,
    site,
    route,
    generatedAt: new Date().toISOString(),
    screenshotCount: results.reduce((sum, result) => sum + result.views.length, 0),
    results,
    ok: results.every(result => result.ok),
  };
  fs.writeFileSync(path.join(evidenceDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
} finally {
  await browser.close();
}

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const widget = readFileSync(new URL('./PwaHealthWidget.tsx', import.meta.url), 'utf8');
const main = readFileSync(new URL('./main.tsx', import.meta.url), 'utf8');
const serviceWorker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

describe('GrowLens PWA health controls', () => {
  it('surfaces storage estimates and persistence as explicit user actions', () => {
    expect(widget).toContain('navigator.storage?.estimate');
    expect(widget).toContain('navigator.storage.persisted');
    expect(widget).toContain('navigator.storage.persist()');
    expect(widget).toContain('Request persistent storage');
    expect(widget).toContain('Storage estimates cover this site origin');
  });

  it('requires user approval before activating a waiting service worker', () => {
    expect(widget).toContain("waiting.postMessage({ type: 'SKIP_WAITING' })");
    expect(widget).toContain('Install downloaded update');
    expect(widget).toContain("navigator.serviceWorker.addEventListener('controllerchange'");
    expect(serviceWorker).toContain("event.data?.type === 'SKIP_WAITING'");
    expect(serviceWorker).toContain('self.skipWaiting()');
  });

  it('mounts the health panel in the GrowLens shell', () => {
    expect(main).toContain("import PwaHealthWidget from './PwaHealthWidget'");
    expect(main).toContain('<PwaHealthWidget />');
    expect(main).toContain("import './pwa-health.css'");
  });
});

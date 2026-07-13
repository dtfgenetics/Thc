import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const serviceWorkerSource = readFileSync(
  new URL('../public/sw.js', import.meta.url),
  'utf8',
);

describe('GrowLens service worker privacy boundary', () => {
  it('recognizes API requests as private traffic', () => {
    expect(serviceWorkerSource).toContain("requestUrl.pathname.includes('/api/')");
  });

  it('passes private API requests directly to the network', () => {
    expect(serviceWorkerSource).toMatch(
      /if \(isPrivateApiRequest\(requestUrl\)\) \{\s*event\.respondWith\(fetch\(event\.request\)\);\s*return;/,
    );
  });

  it('refuses to cache private or no-store responses', () => {
    expect(serviceWorkerSource).toContain('/no-store|private/i.test(cacheControl)');
  });
});

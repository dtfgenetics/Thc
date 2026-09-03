import { readFile } from 'node:fs/promises';

const ownerVisualCss = await readFile('site/design-system/dtf-genetics-owner-v1.css', 'utf8');
if (!ownerVisualCss.includes('premium catalog presentation') || !ownerVisualCss.includes('data-dtf-genetics-library') || !ownerVisualCss.includes('REVIEWED STRAIN CARD')) {
  throw new Error('Premium Genetics owner visual layer is missing or incomplete; refusing to publish a downgraded catalog.');
}

import './force-original-image-accept.mjs';
await import('./reconcile-wordpress-genetics-duplicate-pages.mjs');
await import('./publish-wordpress-genetics-library-cdn-core.mjs');
await import('./apply-wordpress-genetics-visual-v1.mjs');

// The public Seeds page is cached by Hostinger/LiteSpeed. Purge only after the
// authoritative genetics write and the owner-scoped visual pass both succeed
// so live verification sees the same reviewed release that WordPress stores.
await import('./flush-hostinger-litespeed-mcp.mjs');

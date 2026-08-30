import './force-original-image-accept.mjs';
await import('./reconcile-wordpress-genetics-duplicate-pages.mjs');
await import('./publish-wordpress-genetics-library-cdn-core.mjs');

// The public Seeds page is cached by Hostinger/LiteSpeed. Purge only after the
// authoritative genetics write succeeds so live verification sees the release
// that was just published instead of a stale pre-release page.
await import('./flush-hostinger-litespeed-mcp.mjs');

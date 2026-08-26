# Protect the Plants

Protect the Plants is DTF Genetics' original 15×15 two-player hidden-garden strategy game.

## Production target

- Canonical public route: `https://dtfseeds.com/games/protect-the-plants/`
- Front end: static HTML/CSS/vanilla JavaScript
- Multiplayer API: same-origin PHP (`api.php`)
- Production persistence: WordPress transients loaded through the site's `wp-load.php`
- Local/test persistence: temporary JSON fallback when WordPress is unavailable

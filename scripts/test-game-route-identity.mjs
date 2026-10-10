import assert from 'node:assert/strict';
import test from 'node:test';
import { isHighLandPlayableDocument } from './game-route-identity.mjs';

test('accepts a High Land game entry point with a root element', () => {
  assert.equal(isHighLandPlayableDocument('<html><head><title>High Land: The Sweet Escape | DTF Genetics</title></head><body><div id="root"></div><script type="module" src="/assets/main.js"></script></body></html>'), true);
});

test('rejects a game hub fallback even when it contains scripts and a High Land link', () => {
  assert.equal(isHighLandPlayableDocument('<html><head><title>DTF Game Hub | Original Cannabis Browser Games</title></head><body><a href="/games/high-land/">High Land</a><script src="/app.js"></script></body></html>'), false);
});

test('rejects an empty launch placeholder with a High Land title', () => {
  assert.equal(isHighLandPlayableDocument('<html><head><title>High Land: The Sweet Escape</title></head><body>Loading game...</body></html>'), false);
});

test('rejects unrelated interactive documents', () => {
  assert.equal(isHighLandPlayableDocument('<title>THC U Know</title><button>Play</button>'), false);
});

test('rejects JSON-LD metadata posing as a runtime bundle', () => {
  assert.equal(isHighLandPlayableDocument('<title>High Land: The Sweet Escape</title><div id="root"></div><script type="application/ld+json">{}</script>'), false);
});

test('accepts a compiled Vite module bundle', () => {
  assert.equal(isHighLandPlayableDocument('<title>High Land: The Sweet Escape</title><div class="app" id="root"></div><script type="module" crossorigin src="/games/high-land/assets/index-a123.js?v=1"></script>'), true);
});

test('rejects a titled page with a global JS bundle but no High Land app mount', () => {
  assert.equal(isHighLandPlayableDocument('<title>High Land: The Sweet Escape</title><script src="/wp-content/global.js"></script>'), false);
});

test('rejects global non-module JavaScript even with a matching title and root', () => {
  assert.equal(isHighLandPlayableDocument('<title>High Land: The Sweet Escape</title><div id="root"></div><script src="/wp-content/global.js"></script>'), false);
});

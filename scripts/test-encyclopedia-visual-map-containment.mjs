import assert from 'node:assert/strict';
import path from 'node:path';
import { resolveMappedVisualAsset } from './lib/encyclopedia-visual-map-containment.mjs';
const root = path.resolve('/repo/site/wordpress/assets/infographics');
for (const filename of ['THC-ENC-001.png','THC-ENC-420_01_core-concept-overview.webp','THC-ENC-1000_10_summary-reference-graphic.jpeg']) {
  assert.equal(resolveMappedVisualAsset(root,filename), path.join(root,filename));
}
for (const filename of ['../outside.png','../../outside.webp','folder/inside.png','folder\\inside.png','/tmp/image.png','C:\\temp\\image.png','image.svg','image.png/../other.png','','.',null]) {
  assert.equal(resolveMappedVisualAsset(root,filename),null,String(filename));
}
console.log('Encyclopedia mapped visual path containment passed');

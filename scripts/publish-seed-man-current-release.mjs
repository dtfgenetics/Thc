import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const sourceRoot = path.resolve('site/public-route-patch/games/seed-man-platformer');
const indexPath = path.join(sourceRoot, 'index.html');
const templatePath = path.resolve('scripts/publish-seed-man-route-via-wordpress.mjs');

const indexText = fs.readFileSync(indexPath, 'utf8');
const releaseMatch = indexText.match(/name=["']dtf-sprout-release["']\s+content=["']([^"']+)["']/i);
const release = releaseMatch?.[1] || '';
if (!/^\d{8}-r\d+$/.test(release)) {
  throw new Error(`Invalid or missing canonical Sprout Run release marker: ${release || '(empty)'}`);
}

const template = fs.readFileSync(templatePath, 'utf8');
const templateReleaseMatches = [...template.matchAll(/20260830-r4/g)].length;
if (templateReleaseMatches < 1) {
  throw new Error('Seed Man atomic publisher template no longer contains its expected release placeholder. Update the wrapper/template contract deliberately.');
}

const generated = template.replaceAll('20260830-r4', release);
const generatedReleaseMatches = [...generated.matchAll(new RegExp(release.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'))].length;
if (generated.includes('20260830-r4') || generatedReleaseMatches < templateReleaseMatches) {
  throw new Error(`Failed to bind Seed Man publisher template to ${release}.`);
}

if (process.env.SEED_MAN_PUBLISH_DRY_RUN === '1') {
  console.log(JSON.stringify({
    ok: true,
    dryRun: true,
    release,
    templateReleaseMatches,
    generatedReleaseMatches,
    staleTemplateReleaseRemaining: generated.includes('20260830-r4')
  }, null, 2));
  process.exit(0);
}

const generatedPath = path.join(os.tmpdir(), `dtf-seed-man-publisher-${process.pid}-${Date.now()}.mjs`);
fs.writeFileSync(generatedPath, generated, { mode: 0o600 });

try {
  console.error(`Seed Man publisher bound canonical release ${release} into ${templateReleaseMatches} template marker(s).`);
  await import(`${pathToFileURL(generatedPath).href}?release=${encodeURIComponent(release)}`);
} finally {
  try { fs.rmSync(generatedPath, { force: true }); } catch {}
}

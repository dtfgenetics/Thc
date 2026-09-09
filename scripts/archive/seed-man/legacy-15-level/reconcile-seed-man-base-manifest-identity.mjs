import fs from 'node:fs';

// Archived legacy migration helper.
// This script targets the retired 11-level base / 15-level expanded Seed Man contract.
// Do not wire this back into active CI or production release flows.

const targetPath = 'site/public-route-patch/games/seed-man-platformer/campaign-v1.js';
let source = fs.readFileSync(targetPath, 'utf8');

const retiredTitle = "title: 'Seed Man: Sprout Run'";
const canonicalTitle = "title: 'Seed Man: Greenhouse Gauntlet'";

if (source.includes(retiredTitle)) {
  source = source.replace(retiredTitle, canonicalTitle);
}

if (!source.includes(canonicalTitle)) throw new Error('Base campaign manifest does not expose the canonical Greenhouse Gauntlet title.');
if (!source.includes("id: 'sprout-run-campaign'")) throw new Error('Base campaign compatibility ID changed unexpectedly.');
if (!source.includes("defaultLevelId: 'sprout-run'")) throw new Error('Level 1 compatibility ID changed unexpectedly.');
if (!source.includes('levelCount: 11')) throw new Error('Base 11-level compatibility layer changed unexpectedly.');
if (!source.includes('newLevelCount: 10')) throw new Error('Base compatibility level count changed unexpectedly.');
if (source.includes(retiredTitle)) throw new Error('Retired public-style Sprout Run campaign title remains.');

fs.writeFileSync(targetPath, source);
console.log(JSON.stringify({
  ok: true,
  archived: true,
  targetPath,
  publicTitle: 'Seed Man: Greenhouse Gauntlet',
  compatibilityCampaignId: 'sprout-run-campaign',
  compatibilityDefaultLevelId: 'sprout-run',
  compatibilityLevelCount: 11,
  fullCampaignLevelCount: 15
}, null, 2));

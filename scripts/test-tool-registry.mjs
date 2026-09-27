import fs from 'node:fs';
import path from 'node:path';

const registryPath = path.resolve('data/tool-registry.json');
const expectedSlugs = [
  'tools','atlas','terpene-atlas','ph-meter','tds-meter','vpd-chart','ppfd-chart',
  'water-quality-lab','fertigation-lab','dryback-lab','dew-point','environment-control',
  'ipm-scout','dry-cure-lab','grow-planner','substrate-calculator','breeder-pedigree',
  'co2-ventilation','photoperiod-planner','plant-growth-tracker','root-zone-temperature',
  'dilution-calculator','unit-converter'
];

const failures = [];
const ok = (condition, message) => { if (!condition) failures.push(message); };

ok(fs.existsSync(registryPath), 'data/tool-registry.json is missing');

if (fs.existsSync(registryPath)) {
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  ok(Array.isArray(registry.tools), 'registry.tools must be an array');

  if (Array.isArray(registry.tools)) {
    const slugs = registry.tools.map(tool => tool.slug);
    const uniqueSlugs = new Set(slugs);

    ok(slugs.length === uniqueSlugs.size, 'tool slugs must be unique');

    for (const slug of expectedSlugs) {
      ok(uniqueSlugs.has(slug), `registry missing expected slug: ${slug}`);
    }

    for (const tool of registry.tools) {
      ok(typeof tool.id === 'string' && tool.id.length > 0, `${tool.slug || 'unknown'} missing id`);
      ok(typeof tool.title === 'string' && tool.title.length > 0, `${tool.slug || 'unknown'} missing title`);
      ok(typeof tool.category === 'string' && tool.category.length > 0, `${tool.slug || 'unknown'} missing category`);
      ok(typeof tool.public === 'boolean', `${tool.slug || 'unknown'} public must be boolean`);
      ok(typeof tool.sourcePath === 'string' && tool.sourcePath.length > 0, `${tool.slug || 'unknown'} missing sourcePath`);
      ok(Array.isArray(tool.requiredAssets), `${tool.slug || 'unknown'} requiredAssets must be an array`);
      ok(Array.isArray(tool.validationMarkers) && tool.validationMarkers.length > 0, `${tool.slug || 'unknown'} validationMarkers missing`);
      ok(Array.isArray(tool.liveMarkers) && tool.liveMarkers.length > 0, `${tool.slug || 'unknown'} liveMarkers missing`);
      ok(typeof tool.growlensBridge === 'boolean', `${tool.slug || 'unknown'} growlensBridge must be boolean`);

      if (typeof tool.sourcePath === 'string') {
        ok(fs.existsSync(path.resolve(tool.sourcePath)), `${tool.slug} sourcePath does not exist: ${tool.sourcePath}`);
      }

      if (Array.isArray(tool.requiredAssets)) {
        for (const asset of tool.requiredAssets) {
          ok(fs.existsSync(path.resolve(asset)), `${tool.slug} required asset missing: ${asset}`);
        }
      }
    }

    for (const slug of ['ipm-scout','grow-planner','breeder-pedigree']) {
      ok(uniqueSlugs.has(slug), `coverage regression: ${slug} must be registry-owned`);
    }
  }
}

if (failures.length) {
  console.error(`Tool registry test failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(' - ' + failure);
  process.exit(1);
}

console.log(`Tool registry test passed for ${expectedSlugs.length} expected routes.`);

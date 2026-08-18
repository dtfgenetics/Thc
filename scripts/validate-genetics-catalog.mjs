import { readFile } from 'node:fs/promises';

const catalogPath = new URL('../data/genetics/catalog.json', import.meta.url);
const seedsPagePath = new URL('../site/wordpress/pages/seeds.html', import.meta.url);
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const seedsHtml = await readFile(seedsPagePath, 'utf8');

function fail(message) {
  throw new Error(`Genetics catalog validation failed: ${message}`);
}

if (catalog.schemaVersion !== 1) fail('schemaVersion must be 1');
if (catalog.brand !== 'DTF Genetics') fail('brand must be DTF Genetics');
if (!/^\d{4}-\d{2}-\d{2}$/.test(catalog.updated || '')) fail('updated must be YYYY-MM-DD');
if (!Array.isArray(catalog.lines) || catalog.lines.length === 0) fail('lines must be a non-empty array');

const ids = new Set();
const names = new Set();
const byId = new Map();
const allowedStatuses = new Set(['parent-line', 'active-breeding-line', 'flagship-breeding-line', 'released-line', 'archived-line']);
const allowedRoles = new Set(['seed-parent', 'pollen-parent', 'parent-unspecified']);

for (const line of catalog.lines) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(line.id || '')) fail(`invalid line id ${line.id}`);
  if (ids.has(line.id)) fail(`duplicate id ${line.id}`);
  ids.add(line.id);
  byId.set(line.id, line);

  if (!line.name?.trim()) fail(`${line.id} has no name`);
  if (names.has(line.name)) fail(`duplicate line name ${line.name}`);
  names.add(line.name);
  if (!allowedStatuses.has(line.status)) fail(`${line.id} has invalid status ${line.status}`);
  if (!line.lineage?.includes('×')) fail(`${line.id} lineage must use a documented cross separator`);
  if (!Array.isArray(line.parents) || line.parents.length !== 2) fail(`${line.id} must have exactly two parent records`);

  for (const parent of line.parents) {
    if (!allowedRoles.has(parent.role)) fail(`${line.id} has invalid parent role ${parent.role}`);
    if (!parent.name?.trim()) fail(`${line.id} has unnamed parent`);
  }

  if (line.floweringWindowWeeks !== null) {
    const window = line.floweringWindowWeeks;
    if (!Number.isInteger(window.minimum) || !Number.isInteger(window.maximum)) fail(`${line.id} flowering window must be integer weeks`);
    if (window.minimum < 1 || window.maximum < window.minimum) fail(`${line.id} has invalid flowering window`);
    if (!window.qualifier?.trim()) fail(`${line.id} flowering window needs a qualifier`);
  }

  if (!line.publicDescription?.trim()) fail(`${line.id} has no public description`);
  const claims = line.claimsPolicy || {};
  for (const key of ['phenotypeGuarantee', 'yieldGuarantee', 'potencyGuarantee', 'finishDateGuarantee']) {
    if (claims[key] !== false) fail(`${line.id} ${key} must be explicitly false`);
  }

  if (!seedsHtml.includes(line.name)) fail(`public seeds page is missing ${line.name}`);
  if (!seedsHtml.includes(line.lineage)) fail(`public seeds page is missing lineage ${line.lineage}`);
}

for (const line of catalog.lines) {
  for (const parent of line.parents) {
    if (!parent.catalogId) continue;
    const linked = byId.get(parent.catalogId);
    if (!linked) fail(`${line.id} references missing catalog parent ${parent.catalogId}`);
    if (linked.name !== parent.name) fail(`${line.id} parent ${parent.catalogId} name mismatch: ${parent.name} vs ${linked.name}`);
  }
}

console.log(`Validated ${catalog.lines.length} DTF Genetics catalog lines and public-page lineage synchronization.`);

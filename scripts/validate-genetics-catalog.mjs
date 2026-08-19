import { readFile } from 'node:fs/promises';

const catalogPath = new URL('../data/genetics/catalog.json', import.meta.url);
const releaseControlPath = new URL('../data/genetics/release-control.json', import.meta.url);
const seedsPagePath = new URL('../site/wordpress/pages/seeds.html', import.meta.url);
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const releaseControl = JSON.parse(await readFile(releaseControlPath, 'utf8'));
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

if (releaseControl.schemaVersion !== 1) fail('release-control schemaVersion must be 1');
if (releaseControl.brand !== 'DTF Genetics') fail('release-control brand must be DTF Genetics');
if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseControl.updated || '')) fail('release-control updated must be YYYY-MM-DD');
if (!releaseControl.privacyBoundary?.includes('Exact inventory counts')) fail('release-control must preserve the public/private inventory boundary');
if (!Array.isArray(releaseControl.lineControls)) fail('release-control lineControls must be an array');

const forbiddenPublicKeys = new Set([
  'quantity', 'inventoryCount', 'inventory_count', 'unitsOnHand', 'units_on_hand',
  'price', 'cost', 'margin', 'customer', 'customerData', 'privateDecision',
  'commercialDecision', 'custodyLocation', 'seedLotCustody', 'internalNotes'
]);
const releaseStates = new Set(['metadata-pending', 'planning', 'testing', 'approved', 'retired']);
const availabilityStates = new Set(['not-asserted', 'available', 'sold-out', 'not-for-sale']);
const seedTypes = new Set(['unknown', 'regular', 'feminized', 'autoflower-regular', 'autoflower-feminized']);
const generationPattern = /^(F[1-9][0-9]*|S[1-9][0-9]*|BX[1-9][0-9]*|IBL(?:-[A-Za-z0-9]+)?)$/;
const controlsByLine = new Map();

for (const control of releaseControl.lineControls) {
  if (!ids.has(control.lineId)) fail(`release-control references missing catalog line ${control.lineId}`);
  if (controlsByLine.has(control.lineId)) fail(`duplicate release-control record for ${control.lineId}`);
  controlsByLine.set(control.lineId, control);

  for (const key of Object.keys(control)) {
    if (forbiddenPublicKeys.has(key)) fail(`${control.lineId} exposes forbidden public release field ${key}`);
  }

  if (!releaseStates.has(control.publicReleaseState)) fail(`${control.lineId} has invalid publicReleaseState`);
  if (!availabilityStates.has(control.publicAvailability)) fail(`${control.lineId} has invalid publicAvailability`);
  if (!seedTypes.has(control.seedType)) fail(`${control.lineId} has invalid seedType`);
  if (control.generation !== null && !generationPattern.test(control.generation)) fail(`${control.lineId} has invalid generation ${control.generation}`);
  if (!Array.isArray(control.evidenceRefs) || new Set(control.evidenceRefs).size !== control.evidenceRefs.length) fail(`${control.lineId} evidenceRefs must be a unique array`);
  if (control.lastVerified !== null && !/^\d{4}-\d{2}-\d{2}$/.test(control.lastVerified)) fail(`${control.lineId} lastVerified must be null or YYYY-MM-DD`);
  if (typeof control.publicListingAllowed !== 'boolean') fail(`${control.lineId} publicListingAllowed must be boolean`);
  if (!control.notes?.trim()) fail(`${control.lineId} release-control notes are required`);

  if (control.publicListingAllowed) {
    if (control.publicReleaseState !== 'approved') fail(`${control.lineId} cannot be publicly listed unless release state is approved`);
    if (!['available', 'sold-out'].includes(control.publicAvailability)) fail(`${control.lineId} approved public listing needs an explicit public availability state`);
    if (!control.generation) fail(`${control.lineId} approved public listing requires a generation`);
    if (control.seedType === 'unknown') fail(`${control.lineId} approved public listing requires a verified seed type`);
    if (!control.packagingVersion?.trim()) fail(`${control.lineId} approved public listing requires packagingVersion`);
    if (control.evidenceRefs.length === 0) fail(`${control.lineId} approved public listing requires evidenceRefs`);
    if (!control.lastVerified) fail(`${control.lineId} approved public listing requires lastVerified`);
  } else if (control.publicAvailability === 'available') {
    fail(`${control.lineId} cannot claim public availability while publicListingAllowed is false`);
  }
}

for (const line of catalog.lines) {
  if (!controlsByLine.has(line.id)) fail(`catalog line ${line.id} is missing a release-control record`);
}
if (controlsByLine.size !== catalog.lines.length) fail('release-control must contain exactly one record per catalog line');

console.log(`Validated ${catalog.lines.length} DTF Genetics catalog lines, public-page lineage synchronization, and fail-closed public release controls.`);

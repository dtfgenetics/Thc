#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const appRoot = path.join(root, 'apps/growlens-web/public/atlas');
const mirrorRoot = path.join(root, 'site/public-route-patch/atlas');
const errors = [];
const ok = (condition, message) => { if (!condition) errors.push(message); };
const read = (file) => {
  try { return fs.readFileSync(file, 'utf8'); }
  catch (error) { errors.push(`Cannot read ${path.relative(root, file)}: ${error.message}`); return ''; }
};

const requiredMirrors = [
  'index.html',
  'atlas-3d-v4.js',
  'atlas-3d-bootstrap.js',
  'atlas-v4.css',
  'atlas-site-shell-v5.css',
  'atlas-anatomy-index-v1.css',
  'atlas-anatomy-index-v1.js',
  'atlas-workspace-v5.css',
  'atlas-workspace-v5.js',
  'media/README.md',
  'module.js',
  'data/systems.json',
  'data/hotspots-v4.json',
  'data/scale-map-v1.json',
  'data/media-registry-v1.json',
  'data/media-production-queue-v1.json',
  'models/model-manifest-v4.json',
  'models/README.md',
];

for (const relative of requiredMirrors) {
  const source = path.join(appRoot, relative);
  const mirror = path.join(mirrorRoot, relative);
  ok(fs.existsSync(source), `Missing source file: ${path.relative(root, source)}`);
  ok(fs.existsSync(mirror), `Missing public-route mirror: ${path.relative(root, mirror)}`);
  if (fs.existsSync(source) && fs.existsSync(mirror)) ok(fs.readFileSync(source).equals(fs.readFileSync(mirror)), `Mirror mismatch: ${relative}`);
}

const index = read(path.join(appRoot, 'index.html'));
for (const token of ['/atlas/atlas-v4.css', '/atlas/atlas-site-shell-v5.css', '/atlas/atlas-anatomy-index-v1.css', '/atlas/atlas-anatomy-index-v1.js', '/atlas/atlas-workspace-v5.css', '/atlas/atlas-workspace-v5.js', '/atlas/atlas-3d-bootstrap.js', 'data-plant-model-status', 'data-anatomy-index', 'CLICK · INSPECT', 'Interactive 3D system V4', '<b>32</b><span>inspectable structures</span>', '/terpene-atlas/']) {
  ok(index.includes(token), `Atlas index missing V4 wiring: ${token}`);
}
ok(!index.includes('type="module" src="/atlas/atlas-3d.js"'), 'Atlas index must not boot V3 directly; V3 is emergency fallback only');

const siteShell = read(path.join(appRoot, 'atlas-site-shell-v5.css'));
for (const token of ['--atlas-site-header-offset: 92px', '--atlas-site-header-offset: 74px', '.topbar', '72svh', '64svh', 'min-height: 44px']) {
  ok(siteShell.includes(token), `Atlas V5 site-shell contract missing: ${token}`);
}
ok(!/body\s*\{[^}]*overflow-x\s*:\s*hidden/i.test(siteShell), 'Atlas site-shell must not hide page-level horizontal overflow regressions');
ok(/\.topbar\s*\{[^}]*top:\s*var\(--atlas-site-header-offset\)\s*!important/i.test(siteShell), 'Atlas secondary topbar must remain offset below the V5 global header');

const bootstrap = read(path.join(appRoot, 'atlas-3d-bootstrap.js'));
for (const token of ["import('/atlas/atlas-3d-v4.js')", 'bootPlantAtlasV4', "import('/atlas/atlas-3d.js')", "host.dataset.rendererGeneration = 'v3-fallback'"]) {
  ok(bootstrap.includes(token), `V4 bootstrap contract missing: ${token}`);
}

const renderer = read(path.join(appRoot, 'atlas-3d-v4.js'));
for (const token of [
  'GLTFLoader', 'RoomEnvironment', 'MODEL_MANIFEST_URL', 'buildProceduralSpecimen', 'procedural-pbr', 'external-glb',
  'new THREE.Raycaster()', "canvas.addEventListener('pointerup'", "canvas.addEventListener('keydown'",
  'webglcontextlost', 'IntersectionObserver', 'ResizeObserver', 'THREE.ACESFilmicToneMapping', "plant-atlas:focus", 'export const bootPlantAtlasV4',
]) ok(renderer.includes(token), `V4 renderer contract missing: ${token}`);
ok(/new\s+OrbitControls\s*\(\s*camera\s*,\s*canvas\s*\)/.test(renderer), 'V4 renderer contract missing: OrbitControls(camera, canvas)');

let hotspotData = null;
try { hotspotData = JSON.parse(read(path.join(appRoot, 'data/hotspots-v4.json'))); }
catch (error) { errors.push(`Invalid hotspots-v4.json: ${error.message}`); }

const requiredHotspots = new Map([
  ['root-system', '/atlas/root-system/'], ['root-tip', '/atlas/root-system/'], ['stem-vascular', '/atlas/stem-vascular/'],
  ['nodes-branching', '/atlas/nodes-branching/'], ['apical-meristem', '/atlas/nodes-branching/'], ['leaf-module', '/atlas/leaf-module/'],
  ['petiole', '/atlas/leaf-module/'], ['leaf-venation', '/atlas/leaf-module/'], ['flower-anatomy', '/atlas/flower-anatomy/'],
  ['bract', '/atlas/flower-anatomy/'], ['sugar-leaf', '/atlas/flower-anatomy/'], ['reproductive-biology', '/atlas/reproductive-biology/'],
  ['stigma', '/atlas/reproductive-biology/'], ['trichomes-resin', '/atlas/trichomes-resin/'],
  ['root-crown', '/atlas/root-system/'], ['lateral-root', '/atlas/root-system/'], ['fine-roots', '/atlas/root-system/'],
  ['internode', '/atlas/nodes-branching/'], ['axillary-bud', '/atlas/nodes-branching/'],
  ['xylem-pathway', '/atlas/stem-vascular/'], ['phloem-pathway', '/atlas/stem-vascular/'],
  ['leaflet', '/atlas/leaf-module/'], ['leaf-margin', '/atlas/leaf-module/'], ['leaf-blade', '/atlas/leaf-module/'],
  ['stomatal-surface', '/atlas/leaf-module/'], ['preflower-site', '/atlas/reproductive-biology/'],
  ['pistillate-flower', '/atlas/reproductive-biology/'], ['ovary-ovule', '/atlas/reproductive-biology/'],
  ['inflorescence-axis', '/atlas/flower-anatomy/'], ['capitate-stalked-trichome', '/atlas/trichomes-resin/'],
  ['trichome-gland-head', '/atlas/trichomes-resin/'], ['trichome-stalk', '/atlas/trichomes-resin/'],
]);

if (hotspotData) {
  ok(hotspotData.schemaVersion === 4, 'hotspots-v4.json must use schemaVersion 4');
  ok(hotspotData.coordinateSpace === 'normalized-model-bounds', 'hotspot coordinate space must be normalized-model-bounds');
  const hotspots = Array.isArray(hotspotData.hotspots) ? hotspotData.hotspots : [];
  ok(hotspots.length >= 32, `Expected at least 32 anatomy hotspots; found ${hotspots.length}`);
  const ids = new Set();
  for (const hotspot of hotspots) {
    ok(typeof hotspot?.id === 'string' && hotspot.id.length > 0, 'Every hotspot needs an id');
    ok(!ids.has(hotspot?.id), `Duplicate hotspot id: ${hotspot?.id}`);
    ids.add(hotspot?.id);
    ok(typeof hotspot?.label === 'string' && hotspot.label.length > 0, `Hotspot ${hotspot?.id || '(unknown)'} needs a label`);
    ok(typeof hotspot?.copy === 'string' && hotspot.copy.length > 40, `Hotspot ${hotspot?.id || '(unknown)'} needs explanatory copy`);
    ok(typeof hotspot?.route === 'string' && hotspot.route.startsWith('/atlas/'), `Hotspot ${hotspot?.id || '(unknown)'} needs an Atlas route`);
    ok(Array.isArray(hotspot?.anchors) && hotspot.anchors.length > 0, `Hotspot ${hotspot?.id || '(unknown)'} needs at least one anchor`);
    for (const anchor of hotspot?.anchors || []) {
      ok(Array.isArray(anchor) && anchor.length === 3, `Hotspot ${hotspot?.id || '(unknown)'} has an invalid 3D anchor`);
      for (const value of anchor || []) ok(Number.isFinite(value) && value >= 0 && value <= 1, `Hotspot ${hotspot?.id || '(unknown)'} anchor coordinates must be between 0 and 1`);
    }
  }
  for (const [id, route] of requiredHotspots) {
    const hotspot = hotspots.find((entry) => entry.id === id);
    ok(Boolean(hotspot), `Missing required hotspot: ${id}`);
    if (hotspot) ok(hotspot.route === route, `Hotspot ${id} must retain route ${route}`);
  }
}

let systemsData = null;
try { systemsData = JSON.parse(read(path.join(appRoot, 'data/systems.json'))); }
catch (error) { errors.push(`Invalid systems.json: ${error.message}`); }

if (systemsData) {
  ok(systemsData.schemaVersion === 4, 'Plant Atlas systems contract must use schemaVersion 4');
  const systems = Array.isArray(systemsData.systems) ? systemsData.systems : [];
  ok(systems.length === 16, `Plant Atlas must expose exactly 16 science systems; found ${systems.length}`);
  const ids = new Set();
  for (const system of systems) {
    ok(typeof system.id === 'string' && system.id.length > 0, 'Every Plant Atlas system needs an id');
    ok(!ids.has(system.id), `Duplicate Plant Atlas system id: ${system.id}`);
    ids.add(system.id);
    ok(typeof system.route === 'string' && /^\/atlas\/.+\/$/.test(system.route), `System ${system.id} needs a canonical /atlas/ route`);
    for (const field of ['concepts','functions','observe','interactions','cautions','measurements','evidenceQuestions','deepDiveTopics','scales']) {
      ok(Array.isArray(system[field]) && system[field].length > 0, `System ${system.id} missing enriched field: ${field}`);
    }
    const relative = system.route.replace(/^\/atlas\//, '').replace(/\/$/, '');
    const sourcePage = path.join(appRoot, relative, 'index.html');
    const mirrorPage = path.join(mirrorRoot, relative, 'index.html');
    ok(fs.existsSync(sourcePage), `Missing Plant Atlas system page: ${system.route}`);
    ok(fs.existsSync(mirrorPage), `Missing public mirror for Plant Atlas system: ${system.route}`);
    if (fs.existsSync(sourcePage) && fs.existsSync(mirrorPage)) ok(fs.readFileSync(sourcePage).equals(fs.readFileSync(mirrorPage)), `System page mirror mismatch: ${system.route}`);
  }
}

const workspaceRuntime = read(path.join(appRoot, 'atlas-workspace-v5.js'));
for (const token of ['data-atlas-mode','data-atlas-layer','data-atlas-command-input','plant-atlas:focus','wireWorkspaceChrome','wireStageAndCompare','setStage','renderCompare','data-rail-toggle','data-viewer-action','atlasLabels','data-compare-assign','data-layer-legend','scale-map-v1.json','media-registry-v1.json','data-atlas-scale-nav','data-atlas-media-panel','atlas-media-gallery','mediaCoverage','decorateMediaCoverage','data-media-coverage-badge','atlas-media-dialog','atlas-media-evidence','atlas-evidence-meta','atlas-media-filter','data-media-filter','applyMediaEvidenceFilter','data-media-asset-id','data-media-state','data-scale-direction','Go deeper','metaKey','ctrlKey','Measurements','Evidence']) ok(workspaceRuntime.includes(token), `Atlas V5 workspace runtime missing: ${token}`);
const workspaceCss = read(path.join(appRoot, 'atlas-workspace-v5.css'));
for (const token of ['.atlas-workspace-bar','.atlas-command-results','.atlas-inspector-tabs','.atlas-nav-rail','.atlas-viewer-toolbar','.atlas-stage-bar','.atlas-compare-panel','.atlas-layer-legend','data-system-category','grid-template-columns:240px','data-atlas-mode','max-width:980px']) ok(workspaceCss.includes(token), `Atlas V5 workspace CSS missing: ${token}`);
for (const token of ['data-atlas-mode="explorer"','data-atlas-mode="research"','data-atlas-layer="anatomy"','data-atlas-layer="diagnostics"','data-atlas-command-input','data-atlas-mobile-tray-toggle','atlas-nav-rail','data-rail-systems','atlas-viewer-toolbar','data-viewer-action="labels"','data-viewer-action="compare"','atlas-layer-legend','atlas-stage-bar','data-atlas-stage="reproductive"','data-atlas-compare']) ok(index.includes(token), `Atlas V5 workspace shell missing: ${token}`);

ok(!/(?<!\$)\$\('\[data-[^']+\]'\)\.forEach/.test(workspaceRuntime), 'Atlas V5 workspace must use the multi-element selector helper for data-* control collections');

const anatomyIndex = read(path.join(appRoot, 'atlas-anatomy-index-v1.js'));
for (const token of ['hotspots-v4.json','data-anatomy-search','data-anatomy-scale','plant-atlas:focus']) ok(anatomyIndex.includes(token), `Anatomy index runtime missing: ${token}`);

const moduleRuntime = read(path.join(appRoot, 'module.js'));
for (const token of ['measurements','evidenceQuestions','deepDiveTopics','connectedTools','dataset.measurementsRuntime']) ok(moduleRuntime.includes(token), `Plant Atlas module runtime missing enriched contract: ${token}`);


let scaleMap = null;
try { scaleMap = JSON.parse(read(path.join(appRoot, 'data/scale-map-v1.json'))); }
catch (error) { errors.push(`Invalid scale-map-v1.json: ${error.message}`); }
if (scaleMap) {
  ok(scaleMap.schemaVersion === 1, 'scale-map-v1.json must use schemaVersion 1');
  const paths = Array.isArray(scaleMap.pathways) ? scaleMap.pathways : [];
  ok(paths.length >= 7, `Expected at least 7 multi-scale pathways; found ${paths.length}`);
  const hotspotIds = new Set((hotspotData?.hotspots || []).map((entry) => entry.id));
  for (const pathway of paths) {
    ok(typeof pathway.id === 'string' && pathway.id.length > 0, 'Every scale pathway needs an id');
    ok(typeof pathway.label === 'string' && pathway.label.length > 0, `Scale pathway ${pathway.id || '(unknown)'} needs a label`);
    ok(Array.isArray(pathway.steps) && pathway.steps.length >= 3, `Scale pathway ${pathway.id || '(unknown)'} needs at least 3 steps`);
    for (const id of pathway.steps || []) ok(hotspotIds.has(id), `Scale pathway ${pathway.id} references unknown hotspot ${id}`);
    ok(typeof pathway.destination === 'string' && pathway.destination.startsWith('/atlas/'), `Scale pathway ${pathway.id} needs an Atlas destination`);
  }
}

let mediaRegistry = null;
try { mediaRegistry = JSON.parse(read(path.join(appRoot, 'data/media-registry-v1.json'))); }
catch (error) { errors.push(`Invalid media-registry-v1.json: ${error.message}`); }
if (mediaRegistry) {
  ok(mediaRegistry.schemaVersion === 1, 'media-registry-v1.json must use schemaVersion 1');
  const classes = new Set(Array.isArray(mediaRegistry.assetClasses) ? mediaRegistry.assetClasses : []);
  const records = Array.isArray(mediaRegistry.records) ? mediaRegistry.records : [];
  ok(records.length >= 10, `Expected at least 10 initial media registry records; found ${records.length}`);
  const hotspotIds = new Set((hotspotData?.hotspots || []).map((entry) => entry.id));
  const seen = new Set();
  for (const record of records) {
    ok(hotspotIds.has(record.entityId), `Media registry references unknown entity ${record.entityId}`);
    ok(!seen.has(record.entityId), `Duplicate media registry entity: ${record.entityId}`);
    seen.add(record.entityId);
    ok(Array.isArray(record.required) && record.required.length > 0, `Media record ${record.entityId} needs required asset classes`);
    for (const kind of record.required || []) ok(classes.has(kind), `Media record ${record.entityId} uses unknown asset class ${kind}`);
    ok(Array.isArray(record.assets), `Media record ${record.entityId} assets must be an array`);
    for (const asset of record.assets || []) {
      for (const field of ['assetId','entityId','class','src','source','creator','license','captureType','plantStage','organ','illustrativeOrMeasured']) {
        ok(typeof asset[field] === 'string' && asset[field].length > 0, `Media asset ${asset.assetId || '(unknown)'} missing ${field}`);
      }
      ok(asset.entityId === record.entityId, `Media asset ${asset.assetId || '(unknown)'} entityId must match owning record`);
      ok(classes.has(asset.class), `Media asset ${asset.assetId || '(unknown)'} uses unknown class ${asset.class}`);
      ok(typeof asset.src === 'string' && asset.src.startsWith('/atlas/media/'), `Media asset ${asset.assetId || '(unknown)'} must use /atlas/media/ path`);
      if (typeof asset.src === 'string' && asset.src.startsWith('/atlas/media/')) {
        const relativeMedia = asset.src.replace(/^\/atlas\/media\//, '');
        const sourceMedia = path.join(appRoot, 'media', relativeMedia);
        const mirrorMedia = path.join(mirrorRoot, 'media', relativeMedia);
        ok(fs.existsSync(sourceMedia), `Registered media asset missing source file: ${asset.src}`);
        ok(fs.existsSync(mirrorMedia), `Registered media asset missing mirror file: ${asset.src}`);
        if (fs.existsSync(sourceMedia) && fs.existsSync(mirrorMedia)) ok(fs.readFileSync(sourceMedia).equals(fs.readFileSync(mirrorMedia)), `Registered media asset mirror mismatch: ${asset.src}`);
      }
    }
    if ((record.assets || []).length === 0) ok(record.status === 'production-needed', `Empty media record ${record.entityId} must remain explicitly production-needed`);
  }
  const fields = new Set(mediaRegistry?.provenanceContract?.requiredFields || []);
  for (const field of ['assetId','entityId','class','src','source','creator','license','captureType','plantStage','organ','illustrativeOrMeasured']) {
    ok(fields.has(field), `Media provenance contract missing required field: ${field}`);
  }
}



const sourceImportsDir = path.join(appRoot, 'data/media-imports');
const mirrorImportsDir = path.join(mirrorRoot, 'data/media-imports');
if (fs.existsSync(sourceImportsDir)) {
  const importFiles = fs.readdirSync(sourceImportsDir).filter((name) => name.endsWith('.json')).sort();
  ok(fs.existsSync(mirrorImportsDir), 'Missing public-route media-import descriptor directory');
  for (const name of importFiles) {
    const sourceImport = path.join(sourceImportsDir, name);
    const mirrorImport = path.join(mirrorImportsDir, name);
    ok(fs.existsSync(mirrorImport), `Missing mirrored media-import descriptor: ${name}`);
    if (fs.existsSync(mirrorImport)) ok(fs.readFileSync(sourceImport).equals(fs.readFileSync(mirrorImport)), `Media-import descriptor mirror mismatch: ${name}`);
    let descriptor = null;
    try { descriptor = JSON.parse(read(sourceImport)); }
    catch (error) { errors.push(`Invalid media import descriptor ${name}: ${error.message}`); }
    if (!descriptor) continue;
    ok(descriptor.schemaVersion === 1, `Media import ${name} must use schemaVersion 1`);
    ok(descriptor.status === 'approved-for-import', `Media import ${name} must be explicitly approved-for-import`);
    const hasCommonsResolver = typeof descriptor.commonsTitle === 'string' && descriptor.commonsTitle.startsWith('File:');
    ok(hasCommonsResolver || /^https:\/\//.test(descriptor.downloadUrl || ''), `Media import ${name} needs an HTTPS downloadUrl or Commons resolver title`);
    ok(/^https:\/\//.test(descriptor.sourcePage || ''), `Media import ${name} needs an HTTPS sourcePage`);
    if (!hasCommonsResolver) ok(/^[a-f0-9]{40}$/i.test(descriptor.expectedSha1 || ''), `Media import ${name} needs a 40-character SHA-1 when not using Commons metadata resolution`);
    ok(Number(descriptor.expectedWidth) > 0 && Number(descriptor.expectedHeight) > 0, `Media import ${name} needs positive expected dimensions`);
    ok(Math.max(Number(descriptor.expectedWidth) || 0, Number(descriptor.expectedHeight) || 0) >= 2400, `Media import ${name} must meet the 2400px production minimum`);
    const asset = descriptor.asset || {};
    const record = (mediaRegistry?.records || []).find((entry) => entry.entityId === asset.entityId);
    ok(Boolean(record), `Media import ${name} references unknown entity ${asset.entityId}`);
    ok((mediaRegistry?.assetClasses || []).includes(asset.class), `Media import ${name} references unknown class ${asset.class}`);
    ok(typeof asset.assetId === 'string' && asset.assetId.length > 0, `Media import ${name} needs assetId`);
    ok(typeof asset.src === 'string' && asset.src.startsWith('/atlas/media/'), `Media import ${name} needs /atlas/media/ destination`);
    for (const field of ['source','creator','license','captureType','plantStage','organ','illustrativeOrMeasured','alt','title']) {
      ok(typeof asset[field] === 'string' && asset[field].length > 0, `Media import ${name} missing asset.${field}`);
    }
  }
}

let mediaQueue = null;
try { mediaQueue = JSON.parse(read(path.join(appRoot, 'data/media-production-queue-v1.json'))); }
catch (error) { errors.push(`Invalid media-production-queue-v1.json: ${error.message}`); }
if (mediaQueue) {
  ok(mediaQueue.schemaVersion === 1, 'media-production-queue-v1.json must use schemaVersion 1');
  ok(mediaQueue?.productionRules?.rasterOnly === true, 'Plant Atlas instructional media queue must remain raster-first');
  const groups = Array.isArray(mediaQueue.priorities) ? mediaQueue.priorities : [];
  ok(groups.length >= 5, `Expected at least 5 visual production priority groups; found ${groups.length}`);
  const mediaIds = new Set((mediaRegistry?.records || []).map((record) => record.entityId));
  const seenPriority = new Set();
  for (const group of groups) {
    ok(Number.isInteger(group.priority) && group.priority > 0, 'Each media queue group needs a positive integer priority');
    ok(!seenPriority.has(group.priority), `Duplicate media queue priority: ${group.priority}`);
    seenPriority.add(group.priority);
    ok(Array.isArray(group.entities) && group.entities.length > 0, `Media queue priority ${group.priority} needs entities`);
    for (const id of group.entities || []) ok(mediaIds.has(id), `Media queue priority ${group.priority} references entity without media registry record: ${id}`);
    ok(Array.isArray(group.deliverables) && group.deliverables.length > 0, `Media queue priority ${group.priority} needs deliverables`);
  }
  ok(Array.isArray(mediaQueue?.productionRules?.preferredFormats) && mediaQueue.productionRules.preferredFormats.includes('png'), 'Media queue must allow PNG production');
  ok(Number(mediaQueue?.productionRules?.minimumLongEdgePx) >= 2400, 'Media queue minimum long edge must remain at least 2400 px');
}

let manifest = null;
try { manifest = JSON.parse(read(path.join(appRoot, 'models/model-manifest-v4.json'))); }
catch (error) { errors.push(`Invalid model-manifest-v4.json: ${error.message}`); }

if (manifest) {
  ok(manifest.schemaVersion === 1, 'model-manifest-v4.json must use schemaVersion 1');
  ok(typeof manifest?.fallback?.label === 'string' && manifest.fallback.label.length > 0, 'Model manifest needs a fallback label');
  ok(manifest?.fallback?.mode === 'procedural-pbr', 'Model manifest fallback must be procedural-pbr');
  ok(manifest?.fallback?.requiresExternalAsset === false, 'Built-in PBR fallback must not require an external asset');
  const preferred = manifest?.preferredModel || {};
  ok(preferred.url === '/atlas/models/cannabis-specimen-v1.glb', 'Preferred GLB must use the canonical model path');
  ok(preferred.format === 'glb', 'Preferred model format must be glb');

  const sourceModel = path.join(appRoot, 'models/cannabis-specimen-v1.glb');
  const mirrorModel = path.join(mirrorRoot, 'models/cannabis-specimen-v1.glb');
  if (preferred.enabled === true) {
    ok(preferred.license && preferred.license !== 'pending-approved-asset', 'Enabled external GLB requires an approved recorded license');
    ok(fs.existsSync(sourceModel), 'External GLB is enabled but source model is missing');
    ok(fs.existsSync(mirrorModel), 'External GLB is enabled but deployment mirror model is missing');
    if (fs.existsSync(sourceModel)) {
      const bytes = fs.statSync(sourceModel).size;
      ok(bytes > 1024, 'Production GLB exists but is suspiciously small');
      ok(bytes <= 25 * 1024 * 1024, `Production GLB exceeds initial 25 MB transfer budget (${(bytes / 1024 / 1024).toFixed(2)} MB)`);
    }
    if (fs.existsSync(sourceModel) && fs.existsSync(mirrorModel)) ok(fs.readFileSync(sourceModel).equals(fs.readFileSync(mirrorModel)), 'Production GLB mirror mismatch');
  } else {
    ok(!renderer.includes('loader.loadAsync(DEFAULT_MODEL_URL)'), 'Disabled model manifest must not trigger an unconditional GLB request');
  }
}

const modelReadme = read(path.join(appRoot, 'models/README.md'));
for (const token of ['glTF 2.0', 'exposed root system', '80k–250k', 'mid-range Android phone', 'visual fidelity upgrade', 'procedural-pbr']) {
  ok(modelReadme.includes(token), `Model contract missing release requirement: ${token}`);
}

if (errors.length) {
  console.error(`Plant Atlas V4 validation failed with ${errors.length} issue${errors.length === 1 ? '' : 's'}:`);
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log(`Plant Atlas V4/V5 workspace valid: 16 enriched systems, ${requiredHotspots.size} required inspectable structures, unified workspace search/modes/layers, searchable anatomy index, V4-first 3D focus, Terpene Atlas bridge, synchronized deployment mirror, and optional licensed GLB upgrade.`);

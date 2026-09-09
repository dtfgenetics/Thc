import fs from 'node:fs';

// Archived legacy migration helper.
// This script targets the retired 15-level Seed Man public identity contract.
// Do not wire this back into active CI, Game Hub generation, or production release flows.

const hubPath = 'site/public-route-patch/games/index.html';
const sourceMapPath = 'data/game-source-map.json';

const read = (path) => fs.readFileSync(path, 'utf8');
const write = (path, value) => fs.writeFileSync(path, value);
const must = (condition, message) => { if (!condition) throw new Error(message); };

const oldQuickCard = '<article class="card"><span class="status">Play now</span><h3>Seed Man: Sprout Run</h3><p>Run, jump, collect sprouts, activate the checkpoint, avoid hazards and reach the DTF finish flag.</p><a class="card-link" href="/games/seed-man-platformer/">Play Seed Man →</a></article>';
const featureAnchor = '<article class="card feature-card"><div class="feature-art high-land" role="img" aria-label="High Land game board preview"></div><div class="feature-copy"><span class="status">Play now</span><h3>High Land: The Sweet Escape</h3><p>Race across the cannabis-fantasy board, resolve HIT cards and special spaces, and reach Cloud 9 first.</p><div class="pill-row"><span class="pill">Board race</span><span class="pill">Strategy</span><span class="pill">Mobile-friendly</span></div><a class="card-link" href="/games/high-land/">Play High Land →</a></div></article>';
const seedFeature = '<article class="card feature-card seed-man-feature"><div class="feature-art seed-man" role="img" aria-label="Seed Man Greenhouse Gauntlet campaign preview"><strong>SEED<br>MAN</strong></div><div class="feature-copy"><span class="status">Play now</span><h3>Seed Man: Greenhouse Gauntlet</h3><p>Run the full platform campaign across five distinct worlds and 15 levels, absorb temporary phenotype powers, defeat six bosses, and restore the Genetic Frontier.</p><div class="pill-row"><span class="pill">Platform adventure</span><span class="pill">15 levels</span><span class="pill">Phenotype powers</span><span class="pill">Boss battles</span></div><a class="card-link" href="/games/seed-man-platformer/">Play Seed Man →</a></div></article>';
const cssAnchor = ".game-hub-page .feature-art.high-land{background-image:linear-gradient(180deg,rgba(4,11,7,.05),rgba(4,11,7,.58)),url('/games/high-land/assets/images/board/high-land-board.png');background-size:cover;background-position:center}";
const seedCss = ".game-hub-page .seed-man-feature{grid-column:1/-1}.game-hub-page .feature-art.seed-man{background:radial-gradient(circle at 28% 24%,rgba(200,243,106,.24),transparent 18rem),radial-gradient(circle at 76% 72%,rgba(214,192,255,.18),transparent 16rem),linear-gradient(145deg,#102c1d,#0b1711 68%,#181128)}.game-hub-page .feature-art.seed-man strong{font-size:clamp(3.3rem,8vw,7.2rem);line-height:.72;text-shadow:0 12px 36px rgba(0,0,0,.38)}";

let hub = read(hubPath);
let sourceMap = read(sourceMapPath);
const originalHub = hub;
const originalSourceMap = sourceMap;

if (hub.includes(oldQuickCard)) hub = hub.replace(oldQuickCard, '');
if (!hub.includes('class="card feature-card seed-man-feature"')) {
  must(hub.includes(featureAnchor), 'Could not locate High Land feature card insertion point.');
  hub = hub.replace(featureAnchor, `${featureAnchor}${seedFeature}`);
}
if (!hub.includes('.feature-art.seed-man{')) {
  must(hub.includes(cssAnchor), 'Could not locate Game Hub feature-art CSS insertion point.');
  hub = hub.replace(cssAnchor, `${cssAnchor}${seedCss}`);
}

hub = hub.replaceAll('Seed Man: Sprout Run', 'Seed Man: Greenhouse Gauntlet');
sourceMap = sourceMap.replace('"title": "Seed Man: Sprout Run"', '"title": "Seed Man: Greenhouse Gauntlet"');

must(!hub.includes('Seed Man: Sprout Run'), 'Game Hub still exposes retired Sprout Run product title.');
must(!hub.includes('Run, jump, collect sprouts, activate the checkpoint, avoid hazards and reach the DTF finish flag.'), 'Game Hub still exposes retired Seed Man description.');
must(hub.includes('Seed Man: Greenhouse Gauntlet'), 'Game Hub is missing canonical Seed Man title.');
must(hub.includes('five distinct worlds and 15 levels'), 'Game Hub is missing campaign-scale Seed Man copy.');
must(hub.includes('Phenotype powers') && hub.includes('Boss battles'), 'Game Hub is missing Seed Man campaign tags.');
must(sourceMap.includes('"title": "Seed Man: Greenhouse Gauntlet"'), 'Canonical game source map is not aligned to Greenhouse Gauntlet.');
must(!sourceMap.includes('"title": "Seed Man: Sprout Run"'), 'Canonical game source map still contains retired title.');

if (hub !== originalHub) write(hubPath, hub);
if (sourceMap !== originalSourceMap) write(sourceMapPath, sourceMap);

console.log(JSON.stringify({
  ok: true,
  archived: true,
  changed: hub !== originalHub || sourceMap !== originalSourceMap,
  hubPromoted: true,
  canonicalTitle: 'Seed Man: Greenhouse Gauntlet',
  files: [
    ...(hub !== originalHub ? [hubPath] : []),
    ...(sourceMap !== originalSourceMap ? [sourceMapPath] : [])
  ]
}, null, 2));

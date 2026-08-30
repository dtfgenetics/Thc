import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, text) { fs.writeFileSync(path, text); }
function must(condition, message) { if (!condition) throw new Error(message); }
function replaceOnce(text, from, to, label) {
  if (text.includes(to)) return text;
  must(text.includes(from), `Could not patch ${label}`);
  return text.replace(from, to);
}

const indexPath = 'site/public-route-patch/games/seed-man-platformer/index.html';
let index = read(indexPath);
const releaseMatch = index.match(/name="dtf-sprout-release" content="(\d{8})-r(\d+)"/);
must(releaseMatch, 'Seed Man release marker missing');
const currentRelease = `${releaseMatch[1]}-r${releaseMatch[2]}`;
const nextRelease = `${releaseMatch[1]}-r${Number(releaseMatch[2]) + 1}`;
index = index.split(currentRelease).join(nextRelease);
index = replaceOnce(
  index,
  `<script src="./seed-man-production-art.js?v=${nextRelease}" defer></script>\n  <script src="./input-guard-v1.js?v=${nextRelease}" defer></script>`,
  `<script src="./seed-man-production-art.js?v=${nextRelease}" defer></script>\n  <script src="./gameplay-v2.js?v=${nextRelease}" defer></script>\n  <script src="./input-guard-v1.js?v=${nextRelease}" defer></script>`,
  'gameplay-v2 script tag'
);
index = index.replace(
  'collect all 24 sprouts, use responsive short-hop/full-height jumps, double jumps and power-ups, activate three checkpoints, and reach the Dream the Future flag.',
  'collect all 24 sprouts, ride moving greenhouse tables, stomp roaming pests, hit boost pads, use responsive short-hop/full-height jumps, double jumps and power-ups, activate three checkpoints, and reach the Dream the Future flag.'
);
index = index.replace(
  '<strong>Power-ups:</strong> gold = speed, green = high jump, purple = sprout magnet, blue = hazard shield.',
  '<strong>Gameplay:</strong> stomp pests from above, use BOOST pads for high routes, and time moving greenhouse platforms. <strong>Power-ups:</strong> gold = speed, green = high jump, purple = sprout magnet, blue = hazard shield.'
);
write(indexPath, index);

const compatPath = 'site/public-route-patch/games/seed-man-platformer/canvas-compat-v1.js';
let compat = read(compatPath);
compat = compat.replace(/const RELEASE = '\d{8}-r\d+';/, `const RELEASE = '${nextRelease}';`);
write(compatPath, compat);

const publisherPath = 'scripts/publish-seed-man-route-via-wordpress.mjs';
let publisher = read(publisherPath);
publisher = replaceOnce(
  publisher,
  "'seed-man-production-art.js','input-guard-v1.js'",
  "'seed-man-production-art.js','gameplay-v2.js','input-guard-v1.js'",
  'publisher releaseFiles/allowed list'
);
publisher = publisher.replace(
  "'/games/seed-man-platformer/seed-man-production-art.js','/games/seed-man-platformer/input-guard-v1.js'",
  "'/games/seed-man-platformer/seed-man-production-art.js','/games/seed-man-platformer/gameplay-v2.js','/games/seed-man-platformer/input-guard-v1.js'"
);
write(publisherPath, publisher);

const publishWorkflowPath = '.github/workflows/publish-seed-man-production.yml';
let publishWorkflow = read(publishWorkflowPath);
publishWorkflow = publishWorkflow.replace(
  'seed-man-production-art.js input-guard-v1.js seed-man.css',
  'seed-man-production-art.js gameplay-v2.js input-guard-v1.js seed-man.css'
);
publishWorkflow = replaceOnce(
  publishWorkflow,
  '          node --check "$root/seed-man-production-art.js"\n          node --check "$root/input-guard-v1.js"',
  '          node --check "$root/seed-man-production-art.js"\n          node --check "$root/gameplay-v2.js"\n          node --check "$root/input-guard-v1.js"',
  'publisher syntax validation'
);
publishWorkflow = publishWorkflow.replace(
  'for asset in app.js canvas-compat-v1.js seed-man-production-art.js input-guard-v1.js',
  'for asset in app.js canvas-compat-v1.js seed-man-production-art.js gameplay-v2.js input-guard-v1.js'
);
publishWorkflow = replaceOnce(
  publishWorkflow,
  "          grep -Fq 'seed-man-locked-v1' \"$RUNNER_TEMP/seed-man-production-art.js\"\n          grep -Fq 'willReadFrequently'",
  "          grep -Fq 'seed-man-locked-v1' \"$RUNNER_TEMP/seed-man-production-art.js\"\n          grep -Fq 'sprout-run-gameplay-v2' \"$RUNNER_TEMP/gameplay-v2.js\"\n          grep -Fq 'stompable-pests' \"$RUNNER_TEMP/gameplay-v2.js\"\n          grep -Fq 'willReadFrequently'",
  'publisher gameplay marker verification'
);
write(publishWorkflowPath, publishWorkflow);

const ciPath = '.github/workflows/seed-man-platformer-ci.yml';
let ci = read(ciPath);
ci = replaceOnce(
  ci,
  '          node --check site/public-route-patch/games/seed-man-platformer/seed-man-production-art.js\n          node --check site/public-route-patch/games/seed-man-platformer/input-guard-v1.js',
  '          node --check site/public-route-patch/games/seed-man-platformer/seed-man-production-art.js\n          node --check site/public-route-patch/games/seed-man-platformer/gameplay-v2.js\n          node --check site/public-route-patch/games/seed-man-platformer/input-guard-v1.js',
  'CI gameplay syntax check'
);
ci = replaceOnce(
  ci,
  '          test -s "$route/seed-man-production-art.js"\n          test -s "$route/input-guard-v1.js"',
  '          test -s "$route/seed-man-production-art.js"\n          test -s "$route/gameplay-v2.js"\n          test -s "$route/input-guard-v1.js"',
  'CI gameplay file presence'
);
ci = replaceOnce(
  ci,
  '          grep -Fq "<script src=\\"./seed-man-production-art.js?v=${release}\\" defer></script>" "$route/index.html"\n          grep -Fq "<script src=\\"./input-guard-v1.js?v=${release}\\" defer></script>" "$route/index.html"',
  '          grep -Fq "<script src=\\"./seed-man-production-art.js?v=${release}\\" defer></script>" "$route/index.html"\n          grep -Fq "<script src=\\"./gameplay-v2.js?v=${release}\\" defer></script>" "$route/index.html"\n          grep -Fq "<script src=\\"./input-guard-v1.js?v=${release}\\" defer></script>" "$route/index.html"',
  'CI gameplay script tag'
);
ci = replaceOnce(
  ci,
  "          grep -Fq 'seed-man-locked-v1' \"$route/seed-man-production-art.js\"\n          grep -Fq 'No third-party level layouts or character assets are used.'",
  "          grep -Fq 'seed-man-locked-v1' \"$route/seed-man-production-art.js\"\n          grep -Fq 'sprout-run-gameplay-v2' \"$route/gameplay-v2.js\"\n          grep -Fq 'moving-platforms' \"$route/gameplay-v2.js\"\n          grep -Fq 'stompable-pests' \"$route/gameplay-v2.js\"\n          grep -Fq 'bounce-pads' \"$route/gameplay-v2.js\"\n          grep -Fq 'No third-party level layouts or character assets are used.'",
  'CI gameplay runtime markers'
);
ci = replaceOnce(
  ci,
  '      - name: Play through Sprout Run in Chromium\n        run: node games/seed-man-platformer/test/browser-smoke.mjs',
  '      - name: Play through Sprout Run in Chromium\n        run: node games/seed-man-platformer/test/browser-smoke.mjs\n      - name: Exercise gameplay v2 mechanics in Chromium\n        run: node games/seed-man-platformer/test/gameplay-v2-smoke.mjs',
  'CI gameplay browser test'
);
write(ciPath, ci);

const liveBrowserPath = '.github/workflows/seed-man-live-browser-acceptance.yml';
let liveBrowser = read(liveBrowserPath);
liveBrowser = replaceOnce(
  liveBrowser,
  '          node games/seed-man-platformer/test/browser-smoke.mjs',
  '          node games/seed-man-platformer/test/browser-smoke.mjs\n          node games/seed-man-platformer/test/gameplay-v2-smoke.mjs',
  'live gameplay-v2 acceptance'
);
write(liveBrowserPath, liveBrowser);

const renderPath = '.github/workflows/seed-man-live-render-diagnostic.yml';
let render = read(renderPath);
render = render.replace(/result\.release !== '\d{8}-r\d+'/g, `result.release !== '${nextRelease}'`);
write(renderPath, render);

console.log(JSON.stringify({ currentRelease, nextRelease, patched: [indexPath, compatPath, publisherPath, publishWorkflowPath, ciPath, liveBrowserPath, renderPath] }, null, 2));
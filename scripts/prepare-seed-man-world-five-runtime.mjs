import fs from 'node:fs';

const runtimePath = 'site/public-route-patch/games/seed-man-platformer/world-five-v1.js';
if (!fs.existsSync(runtimePath)) throw new Error(`Missing Seed Man World 5 runtime: ${runtimePath}`);

let runtime = fs.readFileSync(runtimePath, 'utf8');
const STATE_MARKER = 'seed-man-world-five-state-sync-v1';

if (!runtime.includes(STATE_MARKER)) {
  const selectNeedle = "    if (!entry || !next) return false;\n    level = JSON.parse(JSON.stringify(next));";
  const selectReplacement = "    if (!entry || !next) return false;\n    window.__SPROUT_CAMPAIGN__?.selectLevel?.(id);\n    level = JSON.parse(JSON.stringify(next));";
  if (!runtime.includes(selectNeedle)) throw new Error('Could not locate World 5 level-selection state anchor.');
  runtime = runtime.replace(selectNeedle, selectReplacement);

  const observerNeedle = "      }).observe(finish, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true });";
  const observerReplacement = "      }).observe(finish, { attributes: true, attributeFilter: ['hidden'] });";
  if (!runtime.includes(observerNeedle)) throw new Error('Could not locate World 5 completion observer anchor.');
  runtime = runtime.replace(observerNeedle, observerReplacement);

  runtime = runtime.replace(
    "  const VERSION = 'seed-man-world-five-v1';",
    "  const VERSION = 'seed-man-world-five-v1';\n  const STATE_SYNC_VERSION = 'seed-man-world-five-state-sync-v1';"
  );
  fs.writeFileSync(runtimePath, runtime);
}

for (const marker of [
  STATE_MARKER,
  'window.__SPROUT_CAMPAIGN__?.selectLevel?.(id);',
  "attributeFilter: ['hidden']",
  'seed-man-world-five-v1'
]) {
  if (!runtime.includes(marker)) throw new Error(`Prepared World 5 runtime is missing state marker: ${marker}`);
}
if (runtime.includes("attributeFilter: ['hidden'], childList: true, subtree: true")) {
  throw new Error('World 5 completion observer still watches its own child mutations.');
}

console.log(JSON.stringify({
  ok: true,
  runtime: runtimePath,
  version: STATE_MARKER,
  campaignApiStateSync: true,
  completionObserver: 'hidden-attribute-only'
}, null, 2));
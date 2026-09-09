import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const workflowPath = path.resolve('.github/workflows/build-dtfseeds-public-suite.yml');
const revisionPath = path.resolve('site/public-route-patch/games/who-took-it/source-revision.txt');
const checkOnly = process.argv.includes('--check');

function parseRevision(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index < 1) throw new Error(`Malformed Who Took It revision line: ${line}`);
    values[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return values;
}

function replaceContract(text, current, expected, label) {
  if (text.includes(expected)) return text;
  if (!text.includes(current)) {
    throw new Error(`Unable to reconcile ${label}; neither the legacy nor expected contract was found.`);
  }
  return text.replace(current, expected);
}

const revision = parseRevision(fs.readFileSync(revisionPath, 'utf8'));
if (revision.repository !== 'dtfgenetics/Thc-guess-who') throw new Error('Who Took It source pin repository is incorrect.');
if (!/^[0-9a-f]{40}$/.test(revision.commit || '')) throw new Error('Who Took It source pin must contain a 40-character lowercase commit SHA.');
if (revision.route !== '/games/who-took-it/') throw new Error('Who Took It source pin route is incorrect.');
if (revision.sourcePath !== '03_digital-game') throw new Error('Who Took It source pin sourcePath is incorrect.');

const legacyBuild = `      - name: Build Who Took It\n        shell: bash\n        run: |\n          set -euo pipefail\n          repo="$RUNNER_TEMP/who-took-it"\n          git clone --depth=1 https://github.com/dtfgenetics/Thc-guess-who.git "$repo"\n          cd "$repo/03_digital-game"\n          npm install --ignore-scripts\n          npm run validate\n          npm run smoke\n          npm run build\n          test -s dist/index.html\n          cd "$repo"\n          echo "WHO_TOOK_IT_SHA=$(git rev-parse HEAD)" >> "$GITHUB_ENV"\n`;

const pinnedBuild = `      - name: Build pinned Who Took It\n        shell: bash\n        run: |\n          set -euo pipefail\n          revision_file="$GITHUB_WORKSPACE/site/public-route-patch/games/who-took-it/source-revision.txt"\n          test -s "$revision_file"\n          repo_name="$(sed -n 's/^repository=//p' "$revision_file")"\n          revision="$(sed -n 's/^commit=//p' "$revision_file")"\n          route="$(sed -n 's/^route=//p' "$revision_file")"\n          source_path="$(sed -n 's/^sourcePath=//p' "$revision_file")"\n          test "$repo_name" = "dtfgenetics/Thc-guess-who"\n          test "$route" = "/games/who-took-it/"\n          test "$source_path" = "03_digital-game"\n          [[ "$revision" =~ ^[0-9a-f]{40}$ ]]\n\n          repo="$RUNNER_TEMP/who-took-it"\n          git init "$repo"\n          cd "$repo"\n          git remote add origin "https://github.com/\${repo_name}.git"\n          git fetch --depth=1 origin "$revision"\n          git checkout --detach FETCH_HEAD\n          test "$(git rev-parse HEAD)" = "$revision"\n\n          cd "$repo/$source_path"\n          npm install --ignore-scripts\n          npm run check\n          test -s dist/index.html\n          test -s src/data/suspect-art.json\n          node scripts/validate-art-registry.mjs\n          cd "$repo"\n          echo "WHO_TOOK_IT_SHA=$revision" >> "$GITHUB_ENV"\n`;

const legacyAssembly = `          mkdir -p release/games/who-took-it\n          cp -a "$RUNNER_TEMP/who-took-it/03_digital-game/dist/." release/games/who-took-it/\n`;
const pinnedAssembly = `          mkdir -p release/games/who-took-it\n          cp -a "$RUNNER_TEMP/who-took-it/03_digital-game/dist/." release/games/who-took-it/\n          cp site/public-route-patch/games/who-took-it/source-revision.txt release/games/who-took-it/source-revision.txt\n`;

const legacyRequired = `            release/games/who-took-it/index.html\n`;
const pinnedRequired = `            release/games/who-took-it/index.html\n            release/games/who-took-it/source-revision.txt\n`;

const legacyVerify = `          grep -Fq '/games/who-took-it/' release/games/who-took-it/index.html\n`;
const pinnedVerify = `          grep -Fq '/games/who-took-it/' release/games/who-took-it/index.html\n          grep -Fq 'repository=dtfgenetics/Thc-guess-who' release/games/who-took-it/source-revision.txt\n          grep -Fq "commit=$WHO_TOOK_IT_SHA" release/games/who-took-it/source-revision.txt\n          grep -Fq 'route=/games/who-took-it/' release/games/who-took-it/source-revision.txt\n          grep -Fq "\\\"whoTookIt\\\": \\\"$WHO_TOOK_IT_SHA\\\"" release/dtf-build.json\n`;

const legacySummary = `            echo '- /games/who-took-it/'\n`;
const pinnedSummary = `            echo "- /games/who-took-it/ (canonical pinned $WHO_TOOK_IT_SHA)"\n`;

let workflow = fs.readFileSync(workflowPath, 'utf8');
const before = workflow;
workflow = replaceContract(workflow, legacyBuild, pinnedBuild, 'Who Took It build step');
workflow = replaceContract(workflow, legacyAssembly, pinnedAssembly, 'Who Took It release assembly');
workflow = replaceContract(workflow, legacyRequired, pinnedRequired, 'Who Took It required release files');
workflow = replaceContract(workflow, legacyVerify, pinnedVerify, 'Who Took It release verification');
workflow = replaceContract(workflow, legacySummary, pinnedSummary, 'Who Took It build summary');

if (checkOnly) {
  if (workflow !== before) {
    console.error('Who Took It public-suite source contract is stale. Run node scripts/reconcile-who-took-it-public-suite-source.mjs');
    process.exit(1);
  }
  console.log(`Who Took It public-suite source contract is pinned to ${revision.commit}.`);
  process.exit(0);
}

if (workflow === before) {
  console.log(`Who Took It public-suite source contract already pinned to ${revision.commit}.`);
  process.exit(0);
}

fs.writeFileSync(workflowPath, workflow);
console.log(`Reconciled Who Took It public-suite build to pinned source ${revision.commit}.`);

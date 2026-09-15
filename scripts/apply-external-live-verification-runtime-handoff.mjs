import fs from 'node:fs';

const promotionPath = 'scripts/promote-public-game-routes-via-wordpress.mjs';
const validatorPath = 'scripts/validate-external-game-contracts.mjs';

let promotion = fs.readFileSync(promotionPath, 'utf8');
if (!promotion.includes("import { spawnSync } from 'node:child_process';")) {
  promotion = promotion.replace(
    "import crypto from 'node:crypto';\n",
    "import crypto from 'node:crypto';\nimport { spawnSync } from 'node:child_process';\n",
  );
}

const helperAnchor = 'async function cleanup() {';
const helper = `async function verifyExternalReleaseCandidates() {
  let lastStatus = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    console.log(\`[external-live-verify] attempt \${attempt}/5\`);
    const result = spawnSync(process.execPath, ['scripts/verify-external-release-candidates-live.mjs'], {
      stdio: 'inherit',
      env: { ...process.env, DTF_SITE_URL: siteUrl },
    });
    lastStatus = result.status;
    if (result.status === 0) return;
    if (attempt < 5) await sleep(10_000);
  }
  throw new Error(\`External game exact live verification failed after 5 attempts (last status \${String(lastStatus)}).\`);
}

`;
if (!promotion.includes('async function verifyExternalReleaseCandidates()')) {
  if (!promotion.includes(helperAnchor)) throw new Error('promotion cleanup anchor not found');
  promotion = promotion.replace(helperAnchor, `${helper}${helperAnchor}`);
}

const finalizeAnchor = "  applied = false;\n  console.log(JSON.stringify({";
const finalizeReplacement = "  applied = false;\n  await verifyExternalReleaseCandidates();\n  console.log(JSON.stringify({";
if (!promotion.includes('await verifyExternalReleaseCandidates();')) {
  if (!promotion.includes(finalizeAnchor)) throw new Error('promotion finalization anchor not found');
  promotion = promotion.replace(finalizeAnchor, finalizeReplacement);
}
fs.writeFileSync(promotionPath, promotion);

let validator = fs.readFileSync(validatorPath, 'utf8');
const validatorAnchor = "const routes = new Set();\n\n";
const validatorBlock = `const promotionRuntime = await readFile(new URL('./promote-public-game-routes-via-wordpress.mjs', import.meta.url), 'utf8');
for (const [pattern, message] of [
  [/spawnSync\\(process\\.execPath, \\['scripts\\/verify-external-release-candidates-live\\.mjs'\\]/, 'production route promotion must invoke the exact external live verifier'],
  [/attempt <= 5/, 'external live verification must use bounded retry attempts'],
  [/DTF_SITE_URL: siteUrl/, 'external live verification must target the active production site URL'],
  [/applied = false;\\s*await verifyExternalReleaseCandidates\\(\\);/, 'exact external live verification must run after route promotion finalization'],
]) {
  if (!pattern.test(promotionRuntime)) errors.push(message);
}

`;
if (!validator.includes('production route promotion must invoke the exact external live verifier')) {
  if (!validator.includes(validatorAnchor)) throw new Error('external contract validator anchor not found');
  validator = validator.replace(validatorAnchor, `${validatorAnchor}${validatorBlock}`);
}
fs.writeFileSync(validatorPath, validator);

console.log('Coupled deterministic external live verification to production route promotion.');

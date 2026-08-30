import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function fail(message) {
  console.error(`❌ ${message}`);
  process.exit(1);
}

function requireFile(rel) {
  if (!fs.existsSync(path.join(root, rel))) fail(`${rel} is missing.`);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    env: process.env
  });
  if (result.error) fail(`${command} ${args.join(' ')} could not start: ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('🤖 DTF Games AI workspace setup');
console.log('================================');

for (const rel of ['package.json', 'package-lock.json', 'AGENTS.md', 'CLAUDE.md', 'AI_CONTEXT.md']) {
  requireFile(rel);
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
if (!Number.isInteger(nodeMajor) || nodeMajor < 22) {
  fail(`Node.js 22 or newer is required; found ${process.version}.`);
}

const npmVersion = spawnSync(npmCommand, ['--version'], {
  cwd: root,
  encoding: 'utf8',
  shell: false,
  env: process.env
});
if (npmVersion.error || npmVersion.status !== 0) fail('npm is required.');

console.log(`✓ Node ${process.version}`);
console.log(`✓ npm ${npmVersion.stdout.trim()}`);
console.log('✓ Repository context and agent instruction files found');

if (checkOnly) {
  console.log('✓ AI setup contract check passed');
  process.exit(0);
}

console.log('\n📦 Installing the committed dependency graph with npm ci...');
run(npmCommand, ['ci']);

console.log('\n🧭 Checking game ownership and deployment routes...');
run(npmCommand, ['run', 'games:status']);

console.log('\n🧪 Running the unified game preflight...');
run(npmCommand, ['run', 'games:preflight']);

console.log('\n✅ AI-friendly DTF workspace setup complete');
console.log('Read first: AGENTS.md → CLAUDE.md → AI_CONTEXT.md → project source-of-truth docs');
console.log('Before editing a game: npm run games:status -- --id <game-id>');
console.log('Before opening a PR: npm run games:preflight');

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = path.join(root, 'games/shared-platform/src');
const publicDir = path.join(root, 'site/public-route-patch/games/shared-platform');
const files = ['index.mjs', 'settings.mjs', 'replay.mjs', 'telemetry.mjs', 'input.mjs', 'audio.mjs'];
const check = process.argv.includes('--check');

function normalize(text) {
  return text.replace(/\r\n/g, '\n');
}

const manifest = {
  schemaVersion: 1,
  platformVersion: '1.1.0',
  source: 'games/shared-platform/src',
  files,
};

const mismatches = [];
for (const file of files) {
  const sourcePath = path.join(sourceDir, file);
  const publicPath = path.join(publicDir, file);
  const source = normalize(fs.readFileSync(sourcePath, 'utf8'));
  const target = fs.existsSync(publicPath) ? normalize(fs.readFileSync(publicPath, 'utf8')) : null;
  if (target !== source) {
    mismatches.push(file);
    if (!check) {
      fs.mkdirSync(publicDir, { recursive: true });
      fs.writeFileSync(publicPath, source);
    }
  }
}

const manifestPath = path.join(publicDir, 'manifest.json');
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
const currentManifest = fs.existsSync(manifestPath) ? normalize(fs.readFileSync(manifestPath, 'utf8')) : null;
if (currentManifest !== manifestText) {
  mismatches.push('manifest.json');
  if (!check) {
    fs.mkdirSync(publicDir, { recursive: true });
    fs.writeFileSync(manifestPath, manifestText);
  }
}

if (check && mismatches.length) {
  throw new Error(`shared game platform public runtime is stale: ${mismatches.join(', ')}`);
}

console.log(check
  ? `shared game platform public runtime matches canonical source (${files.length} modules)`
  : `shared game platform public runtime synchronized (${mismatches.length} file(s) updated)`);

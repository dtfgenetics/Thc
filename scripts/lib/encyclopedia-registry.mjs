import fs from 'node:fs';
import path from 'node:path';

export const CORE_ENCYCLOPEDIA_LESSON_COUNT = 420;
export const CORE_ENCYCLOPEDIA_PART_COUNT = 21;

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));

export function loadEncyclopediaRegistry(root = process.cwd()) {
  const encRoot = path.join(root, 'content', 'encyclopedia');
  const corePath = path.join(encRoot, 'current-controlled-registry.json');
  const extensionPath = path.join(encRoot, 'extension-registry.json');
  const core = readJson(corePath);
  const extension = fs.existsSync(extensionPath)
    ? readJson(extensionPath)
    : { schemaVersion: '1.0.0', registryId: 'thc-encyclopedia-extension-registry', entries: [] };

  const coreEntries = Array.isArray(core.entries) ? core.entries : [];
  const extensionEntries = Array.isArray(extension.entries) ? extension.entries : [];
  const entries = [...coreEntries, ...extensionEntries];
  const seenIds = new Set();
  const seenNumbers = new Set();

  for (const entry of entries) {
    if (!entry?.id || !/^THC-ENC-\d{3,}$/.test(entry.id)) {
      throw new Error(`Invalid encyclopedia registry id: ${entry?.id || '(missing)'}`);
    }
    if (!Number.isInteger(Number(entry.number)) || Number(entry.number) < 1) {
      throw new Error(`${entry.id}: registry number must be a positive integer`);
    }
    if (seenIds.has(entry.id)) throw new Error(`Duplicate encyclopedia registry id: ${entry.id}`);
    if (seenNumbers.has(Number(entry.number))) throw new Error(`Duplicate encyclopedia registry number: ${entry.number}`);
    seenIds.add(entry.id);
    seenNumbers.add(Number(entry.number));
  }

  return {
    core,
    extension,
    coreEntries,
    extensionEntries,
    entries,
    coreCount: coreEntries.length,
    extensionCount: extensionEntries.length,
    totalCount: entries.length
  };
}

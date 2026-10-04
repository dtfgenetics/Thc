import fs from 'node:fs';
import path from 'node:path';

const arr = value => Array.isArray(value) ? value : [];

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function relativePath(root, file) {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

export function discoverEncyclopediaVolumes(root = process.cwd()) {
  const encyclopediaRoot = path.join(root, 'content', 'encyclopedia');
  if (!fs.existsSync(encyclopediaRoot)) return [];
  return fs.readdirSync(encyclopediaRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^volume-\d+$/.test(entry.name))
    .map(entry => ({ name: entry.name, number: Number(entry.name.slice('volume-'.length)) }))
    .filter(entry => Number.isInteger(entry.number) && entry.number > 0)
    .sort((a, b) => a.number - b.number);
}

export function readCanonicalEncyclopediaLessons(root = process.cwd()) {
  const encyclopediaRoot = path.join(root, 'content', 'encyclopedia');
  const lessons = [];

  for (const volumeInfo of discoverEncyclopediaVolumes(root)) {
    const part = volumeInfo.number;
    const volumeRoot = path.join(encyclopediaRoot, volumeInfo.name);
    const lessonRoot = path.join(volumeRoot, 'lessons');
    let foundIndividual = false;

    if (fs.existsSync(lessonRoot)) {
      for (const name of fs.readdirSync(lessonRoot).filter(file => /^thc-enc-\d{3,}\.json$/.test(file)).sort()) {
        const file = path.join(lessonRoot, name);
        lessons.push({
          ...readJson(file),
          __path: relativePath(root, file),
          __part: part,
          __sourceKind: 'individual-canonical'
        });
        foundIndividual = true;
      }
    }

    if (foundIndividual) continue;
    for (const name of fs.readdirSync(volumeRoot).filter(file => /^draft-lessons-\d+-\d+\.json$/.test(file)).sort()) {
      const file = path.join(volumeRoot, name);
      const pack = readJson(file);
      for (const lesson of arr(pack.lessons)) {
        lessons.push({
          ...lesson,
          __path: relativePath(root, file),
          __part: part,
          __sourceKind: 'draft-collection'
        });
      }
    }
  }

  return lessons.sort((a, b) => Number(a.number) - Number(b.number));
}

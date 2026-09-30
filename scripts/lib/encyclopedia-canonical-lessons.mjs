import fs from 'node:fs';
import path from 'node:path';

const arr = value => Array.isArray(value) ? value : [];

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function relativePath(root, file) {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

export function readCanonicalEncyclopediaLessons(root = process.cwd()) {
  const encyclopediaRoot = path.join(root, 'content', 'encyclopedia');
  const lessons = [];

  for (let part = 1; part <= 21; part += 1) {
    const volume = String(part).padStart(2, '0');
    const volumeRoot = path.join(encyclopediaRoot, `volume-${volume}`);
    const lessonRoot = path.join(volumeRoot, 'lessons');
    let foundIndividual = false;

    if (fs.existsSync(lessonRoot)) {
      for (const name of fs.readdirSync(lessonRoot).filter(file => /^thc-enc-\d{3}\.json$/.test(file)).sort()) {
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

    if (foundIndividual || !fs.existsSync(volumeRoot)) continue;
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

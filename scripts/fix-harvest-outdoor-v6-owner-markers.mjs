import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const checkOnly = process.argv.includes('--check');
const edits = [
  {
    path: 'scripts/publish-wordpress-harvest-outdoor-v6-final.mjs',
    replacements: [
      ["ownerMarker:'data-dtf-topic=\"outdoor\"'", "ownerMarker:'data-dtf-topic=\"outdoor-cultivation\"'"],
      ["guideMarker:'data-dtf-learning-v4=\"topic-outdoor\"'", "guideMarker:'data-dtf-learning-v4=\"topic-outdoor-cultivation\"'"]
    ]
  },
  {
    path: '.github/workflows/wordpress-harvest-outdoor-v6-production.yml',
    replacements: [
      ["grep -Fq 'data-dtf-topic=\"outdoor\"' \"$body\"", "grep -Fq 'data-dtf-topic=\"outdoor-cultivation\"' \"$body\""],
      ["grep -Fq 'data-dtf-learning-v4=\"topic-outdoor\"' \"$body\"", "grep -Fq 'data-dtf-learning-v4=\"topic-outdoor-cultivation\"' \"$body\""]
    ]
  }
];

let changedFiles = 0;
let changedReplacements = 0;
for (const edit of edits) {
  const source = await readFile(edit.path, 'utf8');
  let next = source;
  let changed = false;
  for (const [oldText, newText] of edit.replacements) {
    const oldCount = next.split(oldText).length - 1;
    const newCount = next.split(newText).length - 1;
    if (oldCount > 1) throw new Error(`${edit.path}: stale marker occurs ${oldCount} times: ${oldText}`);
    if (oldCount === 1) {
      next = next.replace(oldText, newText);
      changed = true;
      changedReplacements += 1;
      continue;
    }
    if (newCount !== 1) throw new Error(`${edit.path}: expected exactly one repaired marker when stale marker is absent: ${newText}`);
  }
  if (changed) {
    changedFiles += 1;
    if (!checkOnly) await writeFile(edit.path, next, 'utf8');
  }
}

console.log(JSON.stringify({
  valid: true,
  checkOnly,
  changedFiles,
  changedReplacements,
  canonicalOutdoorTopicId: 'outdoor-cultivation'
}, null, 2));

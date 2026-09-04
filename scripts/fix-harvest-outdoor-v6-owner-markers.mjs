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
      ['data-dtf-topic="outdoor"', 'data-dtf-topic="outdoor-cultivation"'],
      ['data-dtf-learning-v4="topic-outdoor"', 'data-dtf-learning-v4="topic-outdoor-cultivation"']
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
    // Idempotent reruns only need to prove the canonical replacement exists.
    // Match the ownership marker token itself rather than a whole grep command:
    // verifier variable names and formatting may differ while ownership is valid.
    if (newCount < 1) throw new Error(`${edit.path}: repaired marker is absent when stale marker is absent: ${newText}`);
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

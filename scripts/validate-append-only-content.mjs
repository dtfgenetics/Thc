import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const policyPath = process.env.CONTENT_PRESERVATION_POLICY || 'configuration/content-preservation-policy.json';
const base = process.env.CONTENT_BASE_REF || process.argv[2] || 'HEAD^';
const head = process.env.CONTENT_HEAD_REF || process.argv[3] || 'HEAD';
const policy = JSON.parse(await readFile(policyPath, 'utf8'));

if (policy?.schemaVersion !== 2 || policy.mode !== 'editable_with_git_history') {
  throw new Error('Invalid editable content-integrity policy.');
}
if (!Array.isArray(policy.collections) || policy.collections.length === 0) {
  throw new Error('Content-integrity policy has no collections.');
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const readAt = (ref, path) => execFileSync('git', ['show', `${ref}:${path}`]);

const diffLines = git('diff', '--name-status', '--find-renames=70%', base, head)
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean);

const changes = diffLines.map(line => {
  const parts = line.split('\t');
  const statusToken = parts[0];
  const code = statusToken[0];
  if (code === 'R') {
    return {
      code,
      similarity: Number(statusToken.slice(1) || 0),
      oldPath: parts[1],
      path: parts[2]
    };
  }
  return { code, path: parts[1] };
});

const compiled = policy.collections.map(collection => ({
  ...collection,
  regex: new RegExp(collection.pathRegex),
  idPattern: new RegExp(collection.idRegex)
}));
const collectionFor = path => path ? compiled.find(collection => collection.regex.test(path)) : null;

const operationFor = code => ({ A: 'add', M: 'modify', D: 'delete', R: 'rename' }[code] || null);
const permissionFor = action => ({ add: 'allowAdd', modify: 'allowModify', delete: 'allowDelete', rename: 'allowRename' }[action]);
const trackedChanges = [];

for (const change of changes) {
  const oldCollection = collectionFor(change.oldPath);
  const currentCollection = collectionFor(change.path);
  const collection = oldCollection || currentCollection;
  if (!collection) continue;

  const action = operationFor(change.code);
  if (!action) {
    throw new Error(`Unsupported content operation ${change.code}: ${change.oldPath || change.path}`);
  }
  const permission = permissionFor(action);
  if (collection[permission] !== true) {
    throw new Error(`${action} is disabled for ${collection.id}: ${change.oldPath || change.path}`);
  }

  trackedChanges.push({
    path: change.oldPath || change.path,
    newPath: change.oldPath ? change.path : undefined,
    action,
    collection: collection.id
  });
}

// Integrity validation applies to the complete current collection after any
// additions, edits, deletions, or renames. Git history remains the audit trail;
// content changes do not require a separate authorization artifact.
for (const collection of compiled) {
  const files = git('ls-tree', '-r', '--name-only', head)
    .split(/\r?\n/)
    .filter(path => collection.regex.test(path));
  const ids = new Map();
  const numbers = new Map();

  for (const path of files) {
    let record;
    try {
      record = JSON.parse(readAt(head, path).toString('utf8'));
    } catch (error) {
      throw new Error(`Invalid JSON in ${path}: ${error.message}`);
    }

    const id = String(record?.[collection.identityField] || '');
    const number = Number(record?.[collection.numberField]);
    const match = id.match(collection.idPattern);

    if (!match) throw new Error(`Invalid identity ${id || '(missing)'} in ${path}.`);
    if (!Number.isInteger(number)) throw new Error(`Missing/invalid ${collection.numberField} in ${path}.`);
    if (Number(match[1]) !== number) throw new Error(`Identity/number mismatch in ${path}: ${id} vs ${number}.`);
    if (ids.has(id)) throw new Error(`Duplicate canonical identity ${id}: ${ids.get(id)} and ${path}.`);
    if (numbers.has(number)) throw new Error(`Duplicate canonical number ${number}: ${numbers.get(number)} and ${path}.`);

    ids.set(id, path);
    numbers.set(number, path);
  }
}

console.log(JSON.stringify({
  ok: true,
  mode: policy.mode,
  base,
  head,
  changes: trackedChanges,
  auditTrail: 'git-history'
}, null, 2));

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const policyPath = process.env.CONTENT_PRESERVATION_POLICY || 'configuration/content-preservation-policy.json';
const base = process.env.CONTENT_BASE_REF || process.argv[2] || 'HEAD^';
const head = process.env.CONTENT_HEAD_REF || process.argv[3] || 'HEAD';
const policy = JSON.parse(await readFile(policyPath, 'utf8'));
if (policy?.schemaVersion !== 1 || policy.mode !== 'append_only_by_default') throw new Error('Invalid content preservation policy.');
if (!Array.isArray(policy.collections) || policy.collections.length === 0) throw new Error('Content preservation policy has no collections.');

const authDir = String(policy.authorizationDirectory || 'content/change-authorizations').replace(/\/$/, '');
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });
const gitBuffer = (...args) => execFileSync('git', args);
const existsAt = (ref, path) => {
  try { git('cat-file', '-e', `${ref}:${path}`); return true; } catch { return false; }
};
const readAt = (ref, path) => gitBuffer('show', `${ref}:${path}`);

const diffLines = git('diff', '--name-status', '--find-renames=70%', base, head)
  .split(/\r?\n/).map(line => line.trim()).filter(Boolean);

const changes = diffLines.map(line => {
  const parts = line.split('\t');
  const statusToken = parts[0];
  const code = statusToken[0];
  if (code === 'R') return { code, similarity: Number(statusToken.slice(1) || 0), oldPath: parts[1], path: parts[2] };
  return { code, path: parts[1] };
});

const authorizationFiles = changes
  .filter(change => change.code === 'A' && change.path.startsWith(`${authDir}/`) && change.path.endsWith('.json'))
  .map(change => change.path);

for (const change of changes) {
  if (change.path.startsWith(`${authDir}/`) || change.oldPath?.startsWith(`${authDir}/`)) {
    if (change.code !== 'A') throw new Error(`Authorization history is append-only. Existing authorization records cannot be ${change.code === 'D' ? 'deleted' : change.code === 'R' ? 'renamed' : 'modified'}: ${change.oldPath || change.path}`);
  }
}

const authorizations = [];
for (const path of authorizationFiles) {
  const auth = JSON.parse(readAt(head, path).toString('utf8'));
  if (auth?.schemaVersion !== 1 || !auth.id || !auth.authorizedBy || !auth.instructionRef || !Array.isArray(auth.changes) || auth.changes.length === 0) {
    throw new Error(`Invalid content change authorization: ${path}`);
  }
  if (String(auth.reason || '').trim().length < 12) throw new Error(`Authorization ${auth.id} must include a meaningful reason.`);
  authorizations.push({ path, ...auth });
}

const compiled = policy.collections.map(collection => ({ ...collection, regex: new RegExp(collection.pathRegex) }));
const collectionFor = path => compiled.find(collection => collection.regex.test(path));
const protectedChanges = [];
for (const change of changes) {
  const oldCollection = change.oldPath ? collectionFor(change.oldPath) : null;
  const currentCollection = collectionFor(change.path);
  const collection = oldCollection || currentCollection;
  if (!collection) continue;
  protectedChanges.push({ ...change, collection });
}

function contentHash(ref, path) {
  return sha256(readAt(ref, path));
}
function requireAuthorization(change) {
  const action = change.code === 'M' ? 'modify' : change.code === 'D' ? 'delete' : change.code === 'R' ? 'rename' : null;
  if (!action) return null;
  const priorPath = change.oldPath || change.path;
  const previousSha256 = contentHash(base, priorPath);
  const nextSha256 = action === 'delete' ? null : contentHash(head, change.path);
  const matches = [];
  for (const auth of authorizations) {
    for (const item of auth.changes) {
      if (item.action !== action) continue;
      if (item.path !== priorPath) continue;
      if (action === 'rename' && item.newPath !== change.path) continue;
      if (String(item.previousSha256 || '').toLowerCase() !== previousSha256) continue;
      if (action !== 'delete' && String(item.newSha256 || '').toLowerCase() !== nextSha256) continue;
      if (String(item.reason || '').trim().length < 12) continue;
      matches.push({ auth, item });
    }
  }
  if (matches.length !== 1) {
    throw new Error(`${action.toUpperCase()} blocked for protected content ${priorPath}. Add exactly one new authorization JSON under ${authDir}/ with previousSha256=${previousSha256}${nextSha256 ? ` and newSha256=${nextSha256}` : ''}.`);
  }
  return { authorizationId: matches[0].auth.id, previousSha256, newSha256: nextSha256 };
}

const results = [];
for (const change of protectedChanges) {
  const requested = new Set(change.collection.requireAuthorizationFor || []);
  if (change.code === 'A') {
    if (change.collection.allowAdd !== true) throw new Error(`Adds are disabled for ${change.collection.id}: ${change.path}`);
    results.push({ path: change.path, action: 'add', collection: change.collection.id });
    continue;
  }
  const action = change.code === 'M' ? 'modify' : change.code === 'D' ? 'delete' : change.code === 'R' ? 'rename' : change.code;
  if (!requested.has(action)) throw new Error(`Unsupported protected-content operation ${action}: ${change.oldPath || change.path}`);
  results.push({ path: change.oldPath || change.path, newPath: change.oldPath ? change.path : undefined, action, collection: change.collection.id, ...requireAuthorization(change) });
}

// Validate current canonical identities so new content cannot silently reuse an existing record ID/number.
for (const collection of compiled) {
  const files = git('ls-tree', '-r', '--name-only', head).split(/\r?\n/).filter(path => collection.regex.test(path));
  const ids = new Map();
  const numbers = new Map();
  const idPattern = new RegExp(collection.idRegex);
  for (const path of files) {
    const record = JSON.parse(readAt(head, path).toString('utf8'));
    const id = String(record?.[collection.identityField] || '');
    const number = Number(record?.[collection.numberField]);
    const match = id.match(idPattern);
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
  protectedChanges: results,
  newAuthorizationRecords: authorizationFiles
}, null, 2));

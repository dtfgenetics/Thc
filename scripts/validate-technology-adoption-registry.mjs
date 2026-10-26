#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const path = process.argv[2] ? resolve(process.argv[2]) : resolve(ROOT, 'data/technology-adoption-registry.json');
const statuses = ['discovered', 'evaluated', 'approved', 'integrated', 'production-verified'];
const allowedRepos = new Set(['dtfgenetics/Thc', 'dtfgenetics/Tools', 'dtfgenetics/Thc-dataset', 'dtfgenetics/Dtf420']);
const errors = [];
let data;
try { data = JSON.parse(readFileSync(path, 'utf8')); }
catch (error) { console.error('Registry parse failed:', error.message); process.exit(1); }
if (data.schema_version !== 1) errors.push('schema_version must be 1');
if (!Array.isArray(data.candidates)) errors.push('candidates must be an array');
if (JSON.stringify(data.status_values) !== JSON.stringify(statuses)) errors.push('status_values must match supported lifecycle');
const ids = new Set();
for (const [index, c] of (Array.isArray(data.candidates) ? data.candidates : []).entries()) {
  const p = 'candidates[' + index + ']';
  if (!c || typeof c !== 'object' || Array.isArray(c)) { errors.push(p + ': must be an object'); continue; }
  if (typeof c.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.id)) errors.push(p + ': invalid id');
  else if (ids.has(c.id)) errors.push(p + ': duplicate id ' + c.id);
  ids.add(c.id);
  for (const k of ['name', 'category', 'target_area', 'evaluation']) {
    if (typeof c[k] !== 'string' || !c[k].trim()) errors.push(p + ': missing ' + k);
  }
  if (!allowedRepos.has(c.target_repo)) errors.push(p + ': unknown canonical target_repo');
  try { const u = new URL(c.source); if (u.protocol !== 'https:' || !u.hostname.includes('.')) throw Error(); }
  catch { errors.push(p + ': source must be a valid https URL'); }
  if (!statuses.includes(c.status)) errors.push(p + ': invalid status');
  if (typeof c.license !== 'string' || !c.license.trim()) errors.push(p + ': missing license assessment');
  // Advance only with explicit evidence; unknown licenses cannot enter approval.
  const rank = statuses.indexOf(c.status);
  if (rank >= 2 && (!c.license || c.license === 'unverified' || !c.license_evidence)) errors.push(p + ': approval requires verified license evidence');
  if (rank >= 2 && !c.security_review) errors.push(p + ': approval requires security_review');
  if (rank >= 3 && (!c.pull_request || !c.tests)) errors.push(p + ': integration requires pull_request and tests');
  if (rank >= 4 && (!c.deployment_sha || !c.live_verification)) errors.push(p + ': production verification requires deployment SHA and live evidence');
}
if (errors.length) { for (const error of errors) console.error('ERROR:', error); process.exit(1); }
console.log('Technology registry valid: ' + data.candidates.length + ' candidates; no unsupported promotions.');

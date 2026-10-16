#!/usr/bin/env node
// Fail closed: claims of release readiness require attributable, checkable evidence.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REQUIRED = ['functional','scientific','visual','deployment','outcome'];
export function validate(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return ['manifest must be an object'];
  for (const field of ['project','release','productionUrl']) {
    if (typeof manifest[field] !== 'string' || !manifest[field].trim()) errors.push(`${field} is required`);
  }
  if (manifest.productionUrl && (!/^https:\/\//.test(manifest.productionUrl) || !URL.canParse(manifest.productionUrl))) errors.push('productionUrl must be a valid HTTPS URL');
  if (!manifest.gates || typeof manifest.gates !== 'object' || Array.isArray(manifest.gates)) return [...errors, 'gates object is required'];
  for (const gate of REQUIRED) {
    const item = manifest.gates[gate];
    if (!item || item.status !== 'passed') { errors.push(`${gate}: status must be passed`); continue; }
    if (typeof item.checkedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(item.checkedAt) || !Number.isFinite(Date.parse(item.checkedAt))) errors.push(`${gate}: valid checkedAt timestamp required`);
    if (!Array.isArray(item.evidence) || !item.evidence.length || item.evidence.some(e => typeof e !== 'string' || !/^https:\/\//.test(e) || !URL.canParse(e))) errors.push(`${gate}: at least one valid HTTPS evidence URL required`);
  }
  return errors;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const file = process.argv[2];
  if (!file) { console.error('Usage: node scripts/verify-release-evidence.mjs <manifest.json>'); process.exit(2); }
  try {
    const errors = validate(JSON.parse(fs.readFileSync(file, 'utf8')));
    if (errors.length) { console.error('RELEASE BLOCKED:\n' + errors.map(e => '- ' + e).join('\n')); process.exit(1); }
    console.log('Release evidence manifest validated. Note: links and underlying evidence still require independent verification.');
  } catch (err) { console.error('RELEASE BLOCKED: ' + err.message); process.exit(1); }
}

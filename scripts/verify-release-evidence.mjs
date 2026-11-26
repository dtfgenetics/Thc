#!/usr/bin/env node
// Fail closed: claims of release readiness require attributable, checkable evidence.
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REQUIRED = ['functional','scientific','visual','deployment','outcome'];
function validHttpsUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:' && !url.username && !url.password &&
      host.includes('.') && !['example.com', 'example.org', 'example.net', 'localhost'].includes(host) &&
      !host.endsWith('.localhost') && !host.endsWith('.local') && !host.endsWith('.invalid');
  } catch { return false; }
}
function validTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed > Date.now()) return false;
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month && d.getUTCDate() === day;
}
export function validate(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) return ['manifest must be an object'];
  for (const field of ['project','release','productionUrl']) {
    if (typeof manifest[field] !== 'string' || !manifest[field].trim()) errors.push(`${field} is required`);
  }
  if (manifest.productionUrl && !validHttpsUrl(manifest.productionUrl)) errors.push('productionUrl must be a valid public HTTPS URL');
  if (!manifest.gates || typeof manifest.gates !== 'object' || Array.isArray(manifest.gates)) return [...errors, 'gates object is required'];
  for (const gate of REQUIRED) {
    const item = manifest.gates[gate];
    if (!item || item.status !== 'passed') { errors.push(`${gate}: status must be passed`); continue; }
    if (!validTimestamp(item.checkedAt)) errors.push(`${gate}: valid nonfuture checkedAt timestamp required`);
    if (!Array.isArray(item.evidence) || !item.evidence.length || item.evidence.some(e => !validHttpsUrl(e))) errors.push(`${gate}: at least one valid public HTTPS evidence URL required`);
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

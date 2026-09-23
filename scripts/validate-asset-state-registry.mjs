#!/usr/bin/env node
import fs from "node:fs";

const registryPath = "data/asset-state-registry.json";
const allowed = new Set(["blocked", "quarantined", "superseded", "tombstoned", "rejected", "restored"]);
const data = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const errors = [];
const seen = new Set();

if (data.schema_version !== "1.0.0") errors.push("schema_version must be 1.0.0");
if (!/^\d{4}-\d{2}-\d{2}$/.test(data.updated || "")) errors.push("updated must be YYYY-MM-DD");
if (!Array.isArray(data.records)) errors.push("records must be an array");

for (const [i, r] of (data.records || []).entries()) {
  const p = `records[${i}]`;
  for (const key of ["asset_id", "project_id", "state", "reason", "updated"]) {
    if (!r[key]) errors.push(`${p} missing ${key}`);
  }
  if (!("canonical_location" in r)) errors.push(`${p} missing canonical_location`);
  if (!allowed.has(r.state)) errors.push(`${p} has invalid state "${r.state}"`);
  if (seen.has(r.asset_id)) errors.push(`${p} duplicates asset_id "${r.asset_id}"`);
  seen.add(r.asset_id);
  if (r.replacement_asset_id && r.replacement_asset_id === r.asset_id) {
    errors.push(`${p} cannot replace itself`);
  }
}
if (errors.length) {
  for (const e of errors) console.error(`ERROR: ${e}`);
  process.exit(1);
}
console.log(`Asset-state registry valid: ${data.records.length} record(s).`);

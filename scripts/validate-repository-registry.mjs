import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const registryPath = path.join(root, "data", "repository-registry.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

const allowedStatuses = new Set(["canonical","standalone_canonical","migration","legacy_review","archive_candidate","archive_ready"]);
const repos = registry.repositories ?? [];
const errors = [];
const seen = new Set();

if (registry.schema_version !== 1) errors.push("schema_version must be 1");
if (registry.authority !== "dtfgenetics/Thc") errors.push("authority must be dtfgenetics/Thc");

for (const entry of repos) {
  if (!entry.repo?.startsWith("dtfgenetics/")) errors.push(`invalid repo name: ${entry.repo}`);
  if (seen.has(entry.repo)) errors.push(`duplicate repo: ${entry.repo}`);
  seen.add(entry.repo);
  if (!allowedStatuses.has(entry.status)) errors.push(`invalid status for ${entry.repo}: ${entry.status}`);
  if (!Array.isArray(entry.canonical_for)) errors.push(`canonical_for must be an array: ${entry.repo}`);
  if (entry.status === "migration" && entry.canonical_for.length) errors.push(`migration repo cannot claim canonical domains: ${entry.repo}`);
  if ((entry.status === "archive_candidate" || entry.status === "archive_ready") && entry.canonical_for.length) errors.push(`${entry.status} repository cannot claim canonical domains: ${entry.repo}`);
}

const requiredCanonical = new Map([
  ["cultivation tools","dtfgenetics/Tools"],
  ["THC encyclopedia","dtfgenetics/thc-grow-hub"],
  ["certification courses","dtfgenetics/Thc-learning-courses-"],
  ["Grow Doc application","dtfgenetics/Thc-dataset"],
  ["production integration","dtfgenetics/Thc"]
]);

for (const [domain, owner] of requiredCanonical) {
  const claims = repos.filter(r => (r.canonical_for ?? []).includes(domain));
  if (claims.length !== 1 || claims[0].repo !== owner) {
    errors.push(`canonical ownership mismatch for "${domain}": expected only ${owner}, found ${claims.map(x=>x.repo).join(", ") || "none"}`);
  }
}

const prohibitedCanonical = new Set(["dtfgenetics/Dtf420","dtfgenetics/dtf-thc-hub"]);
for (const repo of prohibitedCanonical) {
  const entry = repos.find(r => r.repo === repo);
  if (!entry) errors.push(`missing transitional repository: ${repo}`);
  else if (entry.canonical_for.length) errors.push(`transitional repo claims canonical ownership: ${repo}`);
}

if (errors.length) {
  console.error("Repository architecture validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Repository architecture OK: ${repos.length} repositories classified.`);

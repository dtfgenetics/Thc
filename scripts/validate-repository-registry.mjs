import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const registryPath = path.join(root, "data", "repository-registry.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

const projectRegistryPath = path.join(root, "data", "project-registry.json");
const publicAppsPath = path.join(root, "site", "deployment", "public-apps.json");
const retirementManifestPath = path.join(root, "data", "repository-retirement-manifest.json");
const projectRegistry = JSON.parse(fs.readFileSync(projectRegistryPath, "utf8"));
const publicApps = JSON.parse(fs.readFileSync(publicAppsPath, "utf8"));
const retirementManifest = JSON.parse(fs.readFileSync(retirementManifestPath, "utf8"));

const allowedStatuses = new Set(["canonical","standalone_canonical","migration","legacy_review","archive_candidate","archive_ready"]);

if (retirementManifest.schemaVersion !== 1) errors.push("repository retirement manifest schemaVersion must equal 1");
if (retirementManifest.authority !== "dtfgenetics/Thc") errors.push("repository retirement manifest authority must be dtfgenetics/Thc");

const retirementRepos = Array.isArray(retirementManifest.repositories) ? retirementManifest.repositories : [];
const retirementBranches = Array.isArray(retirementManifest.branches) ? retirementManifest.branches : [];
const knownRepos = new Set(repos.map((entry) => entry.repo));
const retirementRepoKeys = new Set();

for (const entry of retirementRepos) {
  if (!knownRepos.has(entry.repo)) errors.push(`retirement manifest references unknown repository: ${entry.repo}`);
  if (retirementRepoKeys.has(entry.repo)) errors.push(`duplicate retirement repository entry: ${entry.repo}`);
  retirementRepoKeys.add(entry.repo);
  if (!["archive_ready","migration_keep"].includes(entry.disposition)) {
    errors.push(`invalid repository retirement disposition: ${entry.repo} -> ${entry.disposition}`);
  }
  const registryEntry = repos.find((repo) => repo.repo === entry.repo);
  if (entry.disposition === "archive_ready" && registryEntry?.status !== "archive_ready") {
    errors.push(`retirement manifest/archive registry mismatch: ${entry.repo}`);
  }
  if (entry.disposition === "migration_keep" && registryEntry?.status !== "migration") {
    errors.push(`retirement manifest/migration registry mismatch: ${entry.repo}`);
  }
  if (typeof entry.reason !== "string" || !entry.reason.trim()) {
    errors.push(`retirement repository reason is required: ${entry.repo}`);
  }
}

const branchKeys = new Set();
for (const entry of retirementBranches) {
  const key = `${entry.repo}:${entry.branch}`;
  if (!knownRepos.has(entry.repo)) errors.push(`retirement branch references unknown repository: ${key}`);
  if (branchKeys.has(key)) errors.push(`duplicate retirement branch entry: ${key}`);
  branchKeys.add(key);
  if (entry.disposition !== "delete_safe") errors.push(`invalid branch retirement disposition: ${key} -> ${entry.disposition}`);
  if (typeof entry.basis !== "string" || !entry.basis.trim()) errors.push(`retirement branch basis is required: ${key}`);
}
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


const archiveReadyRepos = repos.filter((entry) => entry.status === "archive_ready");
const projects = Array.isArray(projectRegistry.projects) ? projectRegistry.projects : [];
const deploymentApps = Array.isArray(publicApps.apps) ? publicApps.apps : [];

for (const entry of archiveReadyRepos) {
  const projectEntries = projects.filter((project) => project.repo === entry.repo);
  for (const project of projectEntries) {
    if (project.status !== "archive-ready") {
      errors.push(`archive-ready repository has non-archive project status: ${entry.repo} -> ${project.status}`);
    }
    if (project.release_path !== null && project.release_path !== undefined) {
      errors.push(`archive-ready repository must not keep a release_path: ${entry.repo}`);
    }
  }

  const activeDeploymentEntries = deploymentApps.filter((app) => app.repository === entry.repo);
  for (const app of activeDeploymentEntries) {
    errors.push(`archive-ready repository must not appear in public app registry: ${entry.repo} (${app.id || "unknown"})`);
  }
}


const migrationRepos = repos.filter((entry) => entry.status === "migration");
const activeDeploymentStatuses = new Set([
  "release-candidate",
  "ready-to-package",
  "production-v20",
  "public-landing",
  "runtime-integration"
]);

for (const entry of migrationRepos) {
  const migrationApps = deploymentApps.filter((app) => app.repository === entry.repo);
  for (const app of migrationApps) {
    if (app.route) {
      errors.push(`migration repository must not own a public route: ${entry.repo} -> ${app.route}`);
    }
    if (activeDeploymentStatuses.has(app.status)) {
      errors.push(`migration repository has active deployment status: ${entry.repo} -> ${app.status}`);
    }
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

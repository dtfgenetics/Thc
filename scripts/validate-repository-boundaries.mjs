import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const boundaryPath = path.join(root, "data", "repository-boundaries.json");
const projectRegistryPath = path.join(root, "data", "project-registry.json");

function fail(message) {
  console.error(`[repo-boundaries] ${message}`);
  process.exitCode = 1;
}

if (!fs.existsSync(boundaryPath)) {
  fail("Missing data/repository-boundaries.json");
  process.exit();
}

const boundary = JSON.parse(fs.readFileSync(boundaryPath, "utf8"));
const projects = JSON.parse(fs.readFileSync(projectRegistryPath, "utf8"));

if (boundary.integrationRepository !== "dtfgenetics/Thc") {
  fail("integrationRepository must remain dtfgenetics/Thc");
}

const forbiddenPrefixes = (boundary.domains ?? []).flatMap((domain) => domain.forbiddenDuplicatePrefixes ?? []);
for (const prefix of forbiddenPrefixes) {
  if (fs.existsSync(path.join(root, prefix))) {
    fail(`Forbidden duplicate product source exists in integration repository: ${prefix}`);
  }
}

const domainIds = new Set();
const canonicalRepos = new Set();
for (const domain of boundary.domains ?? []) {
  if (!domain.id || !domain.canonicalRepository || !domain.thcRole) {
    fail("Every domain requires id, canonicalRepository, and thcRole");
    continue;
  }
  if (domainIds.has(domain.id)) fail(`Duplicate domain id: ${domain.id}`);
  domainIds.add(domain.id);
  if (canonicalRepos.has(domain.canonicalRepository) && domain.canonicalRepository !== "dtfgenetics/Thc") {
    // A repository may intentionally own multiple domains, but duplicate entries should be explicit.
    console.warn(`[repo-boundaries] canonical repository owns multiple domains: ${domain.canonicalRepository}`);
  }
  canonicalRepos.add(domain.canonicalRepository);
}

const registeredRepos = new Set((projects.projects ?? []).map((p) => p.repo).filter(Boolean));
for (const required of [
  "dtfgenetics/Tools",
  "dtfgenetics/thc-grow-hub",
  "dtfgenetics/Thc-learning-courses-",
  "dtfgenetics/Thc-dataset",
]) {
  if (!registeredRepos.has(required)) {
    fail(`Canonical repository is missing from data/project-registry.json: ${required}`);
  }
}

const transitional = new Map((boundary.transitionalRepositories ?? []).map((item) => [item.repository, item.status]));
for (const repo of ["dtfgenetics/Dtf420", "dtfgenetics/dtf-thc-hub"]) {
  if (!transitional.has(repo)) fail(`Missing transitional repository declaration: ${repo}`);
}

const archiveCandidates = new Set(boundary.immediateArchiveCandidates ?? []);
for (const repo of [
  "dtfgenetics/code",
  "dtfgenetics/all-in-one-thc-grow-",
  "dtfgenetics/thc-music-bot-for-discod",
]) {
  if (!archiveCandidates.has(repo)) fail(`Missing archive candidate declaration: ${repo}`);
}

if (!process.exitCode) {
  console.log("[repo-boundaries] repository ownership contract valid");
}

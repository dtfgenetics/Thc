import fs from "node:fs";

const registry = JSON.parse(fs.readFileSync(new URL("../data/tool-execution-registry.json", import.meta.url), "utf8"));
const repoRegistry = JSON.parse(fs.readFileSync(new URL("../data/repository-registry.json", import.meta.url), "utf8"));

const errors = [];
const tools = Array.isArray(registry.tools) ? registry.tools : [];
const knownRepos = new Set((repoRegistry.repositories ?? []).map((entry) => entry.repo));
const ids = new Set();
const routes = new Set();

if (!tools.length) errors.push("tool execution registry must contain tools");

for (const tool of tools) {
  if (!tool.id || ids.has(tool.id)) errors.push(`duplicate or missing tool id: ${tool.id ?? "<missing>"}`);
  ids.add(tool.id);

  if (!tool.route || !tool.route.startsWith("/") || !tool.route.endsWith("/")) {
    errors.push(`invalid public route for ${tool.id}: ${tool.route}`);
  } else if (routes.has(tool.route)) {
    errors.push(`duplicate public tool route: ${tool.route}`);
  }
  routes.add(tool.route);

  if (!tool.canonical?.repo || !knownRepos.has(tool.canonical.repo)) {
    errors.push(`unknown canonical repo for ${tool.id}: ${tool.canonical?.repo}`);
  }
  if (!tool.canonical?.path) errors.push(`missing canonical path for ${tool.id}`);
  if (!tool.execution?.verify) errors.push(`missing verify command for ${tool.id}`);
  if (tool.integration?.repo !== "dtfgenetics/Thc") {
    errors.push(`production integration repo must be dtfgenetics/Thc for ${tool.id}`);
  }
  if (!tool.integration?.path) errors.push(`missing integration path for ${tool.id}`);
}

const byId = new Map(tools.map((tool) => [tool.id, tool]));
const required = [
  ["growlens", "dtfgenetics/Thc", "apps/growlens-web", "/growlens/"],
  ["grow-doc", "dtfgenetics/Thc-dataset", ".", "/thc-grow-doc/"],
  ["tools-hub", "dtfgenetics/Tools", "site/public-route-patch/tools", "/tools/"],
  ["plant-atlas", "dtfgenetics/Tools", "site/public-route-patch/atlas", "/atlas/"],
  ["terpene-atlas", "dtfgenetics/Tools", "site/public-route-patch/terpene-atlas", "/terpene-atlas/"]
];

for (const [id, repo, path, route] of required) {
  const tool = byId.get(id);
  if (!tool) {
    errors.push(`missing required tool registry entry: ${id}`);
    continue;
  }
  if (tool.canonical.repo !== repo) errors.push(`${id} canonical repo mismatch: expected ${repo}, got ${tool.canonical.repo}`);
  if (tool.canonical.path !== path) errors.push(`${id} canonical path mismatch: expected ${path}, got ${tool.canonical.path}`);
  if (tool.route !== route) errors.push(`${id} route mismatch: expected ${route}, got ${tool.route}`);
}

for (const tool of tools.filter((entry) => entry.category === "focused-tool" || entry.category === "hub")) {
  if (tool.canonical.repo !== "dtfgenetics/Tools") {
    errors.push(`focused tool must be canonical in dtfgenetics/Tools: ${tool.id}`);
  }
  if (!tool.canonical.path.startsWith("site/public-route-patch/")) {
    errors.push(`focused tool canonical path must be under Tools site/public-route-patch: ${tool.id}`);
  }
  if (tool.integration.mode !== "generated-or-synchronized-mirror") {
    errors.push(`focused tool integration must be a generated/synchronized mirror: ${tool.id}`);
  }
}

for (const forbidden of ["dtfgenetics/Dtf420", "dtfgenetics/dtf-thc-hub"]) {
  for (const tool of tools.filter((entry) => entry.canonical.repo === forbidden)) {
    errors.push(`migration repository cannot own canonical tool: ${forbidden} -> ${tool.id}`);
  }
}

if (errors.length) {
  console.error("Tool execution registry validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Tool execution registry OK: ${tools.length} public tool routes have explicit ownership and execution contracts.`);

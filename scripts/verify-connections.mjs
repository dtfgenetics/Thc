import { access } from "node:fs/promises";

const requiredFiles = [
  "package.json",
  "AGENTS.md",
  "docs/GAME_DEVELOPMENT_FREEDOM.md",
];

const requiredEndpoints = [
  {
    name: "DTF Seeds public site",
    url: "https://dtfseeds.com/",
    expected: [200],
  },
];

const optionalCurrentEndpoints = [
  {
    name: "Current High Land route",
    url: "https://dtfseeds.com/games/high-land/",
    expected: [200],
  },
  {
    name: "Current High Land room API index",
    url: "https://dtfseeds.com/games/high-land/api/",
    expected: [200, 400, 401, 403, 404, 405],
  },
];

let failed = false;

for (const path of requiredFiles) {
  try {
    await access(path);
    console.log(`PASS file ${path}`);
  } catch {
    failed = true;
    console.error(`FAIL missing file ${path}`);
  }
}

async function probe(check, required) {
  try {
    const response = await fetch(check.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    const ok = check.expected.includes(response.status);
    const prefix = ok ? "PASS" : required ? "FAIL" : "INFO";
    console.log(`${prefix} ${check.name}: HTTP ${response.status}`);
    if (!ok && required) failed = true;
  } catch (error) {
    if (required) {
      failed = true;
      console.error(`FAIL ${check.name}: ${error.message}`);
    } else {
      console.log(`INFO ${check.name}: unavailable (${error.message})`);
    }
  }
}

for (const check of requiredEndpoints) await probe(check, true);
for (const check of optionalCurrentEndpoints) await probe(check, false);

if (failed) {
  process.exitCode = 1;
} else {
  console.log("Connection preflight passed without enforcing a game backend, route owner, or transport implementation.");
}

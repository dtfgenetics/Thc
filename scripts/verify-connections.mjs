import { access } from "node:fs/promises";

const requiredFiles = [
  ".mcp.json",
  "supabase/config.toml",
  "apps/high-land-web/package.json",
  ".github/workflows/high-land-ci.yml",
  ".github/workflows/hostinger-high-land-deploy.yml",
  ".github/workflows/wordpress-readonly-audit.yml",
];

const endpointChecks = [
  {
    name: "DTF Seeds public site",
    url: "https://dtfseeds.com/",
    expected: [200],
  },
  {
    name: "DTF Seeds High Land route",
    url: "https://dtfseeds.com/games/high-land/",
    expected: [200],
  },
  {
    name: "WordPress MCP authentication boundary",
    url: "https://dtfseeds.com/wp-json/mcp/mcp-adapter-default-server",
    expected: [401, 403],
  },
  {
    name: "Supabase MCP authentication boundary",
    url: "https://mcp.supabase.com/mcp",
    expected: [401, 403, 405],
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

for (const check of endpointChecks) {
  try {
    const response = await fetch(check.url, {
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });

    if (check.expected.includes(response.status)) {
      console.log(`PASS ${check.name}: HTTP ${response.status}`);
    } else {
      failed = true;
      console.error(
        `FAIL ${check.name}: HTTP ${response.status}; expected ${check.expected.join("/")}`,
      );
    }
  } catch (error) {
    failed = true;
    console.error(`FAIL ${check.name}: ${error.message}`);
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log("Connection preflight passed.");
}

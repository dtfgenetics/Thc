import { access } from "node:fs/promises";

const requiredFiles = [
  "docs/BACKEND_DECISION.md",
  "apps/high-land-web/package.json",
  "apps/high-land-web/public/api/create-room.php",
  "apps/high-land-web/public/api/get-room.php",
  "apps/high-land-web/src/game/multiplayer/websiteRoomTransport.ts",
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
    name: "High Land room API index guard",
    url: "https://dtfseeds.com/games/high-land/api/",
    expected: [404],
  },
  {
    name: "High Land create-room method guard",
    url: "https://dtfseeds.com/games/high-land/api/create-room.php",
    expected: [405],
  },
  {
    name: "High Land get-room validation guard",
    url: "https://dtfseeds.com/games/high-land/api/get-room.php",
    expected: [400],
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

import { setDefaultResultOrder } from "node:dns";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

setDefaultResultOrder("ipv4first");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(await readFile(path.join(root, "data", "game-registry-v2.json"), "utf8"));
const site = (process.env.DTF_SITE_URL || "https://dtfseeds.com").replace(/\/$/, "");
const output = process.env.GAME_LIVE_EVIDENCE || path.join(root, "artifacts", "game-live-evidence.json");
const attempts = Number.parseInt(process.env.GAME_LIVE_FETCH_ATTEMPTS || "4", 10);
const timeoutMs = Number.parseInt(process.env.GAME_LIVE_FETCH_TIMEOUT_MS || "20000", 10);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchRoute(url) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        redirect: "manual",
        headers: { "Cache-Control": "no-cache, no-store, max-age=0", "User-Agent": "DTFSeeds-Game-Portfolio-Live-Verify/1.0" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = await response.text();
      if (response.status >= 500 && attempt < attempts) { await sleep(500 * attempt); continue; }
      return { status: response.status, location: response.headers.get("location"), body };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(500 * attempt);
    }
  }
  throw lastError || new Error("fetch failed");
}

function looksLikeFallback(body) {
  return /page not found|nothing found|404 not found/i.test(body.slice(0, 12000));
}

const candidates = registry.games.filter((game) => {
  const route = game.location?.publicRoute || game.publicRoute;
  return typeof route === "string" && route.startsWith("/") && game.release?.status !== "retired";
});
const evidence = [];
for (const game of candidates) {
  const route = game.location?.publicRoute || game.publicRoute;
  const url = new URL(route, site);
  url.searchParams.set("dtf_game_verify", String(Date.now()) + "-" + game.id);
  try {
    const result = await fetchRoute(url.href);
    const html = /<(?:!doctype|html)\b/i.test(result.body);
    const redirected = result.status >= 300 && result.status < 400;
    const fallback = looksLikeFallback(result.body);
    const ok = result.status === 200 && html && !fallback;
    evidence.push({ id: game.id, route, url: new URL(route, site).href, ok, status: result.status, redirected, redirectLocation: result.location, html, fallback, checkedAt: new Date().toISOString() });
    console.log((ok ? "PASS " : "FAIL ") + game.id + " " + route + " HTTP " + result.status + (result.location ? " -> " + result.location : ""));
  } catch (error) {
    evidence.push({ id: game.id, route, url: new URL(route, site).href, ok: false, error: error instanceof Error ? error.message : String(error), checkedAt: new Date().toISOString() });
    console.error("FAIL " + game.id + " " + route + ": " + (error instanceof Error ? error.message : String(error)));
  }
}
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({ site, checkedAt: new Date().toISOString(), evidence }, null, 2) + "\n");
const passed = evidence.filter((item) => item.ok).length;
const failed = evidence.length - passed;
console.log(JSON.stringify({ site, total: evidence.length, passed, failed, output }, null, 2));
if (process.env.GAME_LIVE_STRICT === "1" && failed) process.exit(1);

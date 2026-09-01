const baseUrl = String(process.env.DTF_SITE_URL || 'https://dtfseeds.com').replace(/\/+$/, '');
const attemptCount = Number(process.env.DTF_LIVE_VERIFY_ATTEMPTS || 6);
const retryDelayMs = Number(process.env.DTF_LIVE_VERIFY_DELAY_MS || 5000);
const runId = process.env.GITHUB_RUN_ID || Date.now();

const routes = [
  {
    path: '/games/high-land/',
    markers: ['High Land: The Sweet Escape'],
    cssMarkers: ['--hl-lime', '#c8ff62']
  },
  {
    path: '/games/high-life/',
    markers: ['From Bagseed to Legacy', '18 TURN RUN']
  },
  {
    path: '/games/grower-conversations/',
    markers: ['Grower Conversations', '96-card community deck']
  },
  {
    path: '/games/seed-man-platformer/',
    markers: ['content="20260830-r7"', '0 / 24', '7,800 px course']
  },
  {
    path: '/games/phenoquest/',
    markers: [
      'PhenoQuest: The Living Seed Vault',
      './experience-v2.css',
      './experience-v2.js'
    ],
    assets: [
      {
        path: 'experience-v2.js',
        markers: [
          'deriveFirstSessionProgress',
          'PhenoQuest guided first-session experience initialized.'
        ]
      },
      {
        path: 'experience-v2.css',
        markers: ['.first-session-guide', 'prefers-reduced-motion']
      },
      {
        path: '_runtime/src/engine/game-state.js',
        markers: ['export function setStarterChoice', 'export function addStoredUnit']
      }
    ]
  },
  {
    path: '/games/weedopolis/',
    markers: ['Weedopolis']
  },
  {
    path: '/games/crossword/',
    markers: ['Crossword']
  }
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractStylesheets(html, pageUrl) {
  const matches = [...html.matchAll(/<link\b[^>]*rel=["'][^"']*stylesheet[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/gi)];
  return matches.map((match) => new URL(match[1], pageUrl).toString());
}

async function fetchNoRedirect(url, accept = 'text/html,application/xhtml+xml') {
  return fetch(url, {
    redirect: 'manual',
    headers: {
      'Cache-Control': 'no-cache, no-store, max-age=0',
      Pragma: 'no-cache',
      Accept: accept
    },
    signal: AbortSignal.timeout(20000)
  });
}

function assertDirectSuccess(response, label) {
  if (response.status >= 300 && response.status < 400) {
    throw new Error(`${label} redirected with HTTP ${response.status} to ${response.headers.get('location') || '<unknown>'}`);
  }
  if (response.status !== 200) throw new Error(`${label} returned HTTP ${response.status}`);
}

async function verifyAsset(route, asset) {
  const assetUrl = new URL(asset.path, `${baseUrl}${route.path}`);
  assetUrl.searchParams.set('dtf_current_release_verify', String(runId));
  const response = await fetchNoRedirect(assetUrl.toString(), '*/*');
  assertDirectSuccess(response, `${route.path}${asset.path}`);
  const body = await response.text();
  for (const marker of asset.markers || []) {
    if (!body.includes(marker)) {
      throw new Error(`${route.path}${asset.path} is missing asset marker '${marker}'`);
    }
  }
}

async function verifyRoute(route) {
  const url = `${baseUrl}${route.path}?dtf_current_release_verify=${encodeURIComponent(runId)}`;
  let lastError = null;

  for (let attempt = 1; attempt <= attemptCount; attempt += 1) {
    try {
      const response = await fetchNoRedirect(url);
      assertDirectSuccess(response, route.path);
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.toLowerCase().includes('text/html')) throw new Error(`returned unexpected content-type '${contentType}'`);

      const html = await response.text();
      for (const marker of route.markers) {
        if (!html.toLowerCase().includes(marker.toLowerCase())) {
          throw new Error(`missing page marker '${marker}'`);
        }
      }

      if (route.cssMarkers?.length) {
        const stylesheets = extractStylesheets(html, url);
        if (!stylesheets.length) throw new Error('did not expose a stylesheet for V2 UI verification');
        let matched = false;
        for (const stylesheet of stylesheets) {
          const cssResponse = await fetch(stylesheet, {
            headers: { 'Cache-Control': 'no-cache, no-store, max-age=0' },
            signal: AbortSignal.timeout(20000)
          });
          if (!cssResponse.ok) continue;
          const css = await cssResponse.text();
          if (route.cssMarkers.every((marker) => css.includes(marker))) {
            matched = true;
            break;
          }
        }
        if (!matched) throw new Error(`stylesheets did not contain V2 markers: ${route.cssMarkers.join(', ')}`);
      }

      for (const asset of route.assets || []) {
        await verifyAsset(route, asset);
      }

      console.log(`PASS ${route.path} (attempt ${attempt})`);
      return;
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt}/${attemptCount} failed for ${route.path}: ${error.message}`);
      if (attempt < attemptCount) await sleep(retryDelayMs);
    }
  }

  throw new Error(`${route.path} did not converge to its current release: ${lastError?.message || 'unknown error'}`);
}

const failures = [];
for (const route of routes) {
  try {
    await verifyRoute(route);
  } catch (error) {
    failures.push(error.message);
  }
}

if (failures.length) {
  console.error(`Current public-suite release verification failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Current public-suite release verification passed for ${routes.length} routes.`);

const siteUrl = (process.env.DTF_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const pages = [
  ['/learn/atlas/', 'THC Living Plant Atlas'],
  ['/learn/atlas/seed-germination/thermal-limits-and-germination-rate/', 'Thermal limits & germination rate'],
  ['/learn/atlas/root-system/root-tip-zones-and-apical-growth/', 'Root tip zones & apical growth'],
  ['/learn/atlas/stem-vascular/hydraulic-disruption-and-embolism/', 'Hydraulic disruption & embolism'],
  ['/learn/atlas/nodes-branching/axillary-bud-activation/', 'Axillary bud activation'],
  ['/learn/atlas/leaves/leaf-tissue-anatomy/', 'Leaf tissue anatomy'],
  ['/learn/atlas/flowers/bract-ovary-and-stigma-anatomy/', 'Bract, ovary & stigma anatomy'],
  ['/learn/atlas/trichomes-resin/head-stipe-and-stalk-specialization/', 'Head, stipe & stalk specialization'],
  ['/learn/atlas/sex-pollen-seed/sex-chromosomes-and-early-gene-regulation/', 'Sex chromosomes & early gene regulation'],
  ['/learn/atlas/environment-overlay/co2-diffusion-and-photosynthetic-response/', 'CO2 diffusion & photosynthetic response'],
  ['/learn/atlas/diagnostic-overlay/evidence-weighting-and-confirmatory-testing/', 'Evidence weighting & confirmatory testing'],
];

async function fetchFresh(route) {
  const url = new URL(route, siteUrl);
  url.searchParams.set('dtf_atlas_live_verify', `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  return fetch(url, {
    redirect: 'manual',
    headers: {
      'user-agent': 'DTFSeeds-Atlas-Live-Verification/1.0',
      'cache-control': 'no-cache, no-store, max-age=0',
      pragma: 'no-cache',
    },
    signal: AbortSignal.timeout(45_000),
  });
}

async function retry(label, check) {
  let last = 'not attempted';
  for (let attempt = 1; attempt <= 7; attempt += 1) {
    try {
      const result = await check();
      if (result.ok) return result;
      last = result.reason;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    if (attempt < 7) await sleep(1200 + attempt * 900);
  }
  throw new Error(`${label} failed live verification: ${last}`);
}

async function verifyPage(route, marker) {
  return retry(route, async () => {
    const response = await fetchFresh(route);
    const text = await response.text();
    const location = response.headers.get('location') || '';
    const ok = response.status === 200
      && !location
      && text.includes(marker)
      && text.includes('https://dtfseeds.com')
      && text.includes('/_next/static/')
      && !/https?:\/\/(?:www\.)?dtf420\.com/i.test(text)
      && !/dtf-content-overlay\/learn\//i.test(text);
    return {
      ok,
      reason: `HTTP ${response.status}; location=${location || '<none>'}; marker=${text.includes(marker)}; canonical=${text.includes('https://dtfseeds.com')}; next=${text.includes('/_next/static/')}; retiredDomain=${/https?:\/\/(?:www\.)?dtf420\.com/i.test(text)}; stagingLeak=${/dtf-content-overlay\/learn\//i.test(text)}`,
    };
  });
}

async function verifyRuntimeFile(route, markers) {
  return retry(route, async () => {
    const response = await fetchFresh(route);
    const text = await response.text();
    const location = response.headers.get('location') || '';
    const markerState = markers.map((marker) => text.includes(marker));
    const ok = response.status === 200
      && !location
      && markerState.every(Boolean)
      && !/https?:\/\/(?:www\.)?dtf420\.com/i.test(text);
    return {
      ok,
      reason: `HTTP ${response.status}; location=${location || '<none>'}; markers=${markerState.join(',')}; bytes=${text.length}`,
    };
  });
}

for (const [route, marker] of pages) {
  await verifyPage(route, marker);
  console.log(`verified ${route}`);
}

await verifyRuntimeFile('/learn/atlas/atlas-3d/index.html', ['atlas-runtime.js', 'canvas']);
console.log('verified /learn/atlas/atlas-3d/index.html');
await verifyRuntimeFile('/learn/atlas/atlas-3d/atlas-runtime.js', ['startAtlasRuntime', 'OrbitControls']);
console.log('verified /learn/atlas/atlas-3d/atlas-runtime.js');

const learnHub = await retry('/learn/', async () => {
  const response = await fetchFresh('/learn/');
  const text = await response.text();
  const location = response.headers.get('location') || '';
  return {
    ok: response.status === 200 && !location && !/dtf-content-overlay\/learn\//i.test(text),
    reason: `HTTP ${response.status}; location=${location || '<none>'}; stagingLeak=${/dtf-content-overlay\/learn\//i.test(text)}`,
  };
});
if (!learnHub.ok) throw new Error('WordPress-owned /learn/ hub was not preserved.');

console.log(JSON.stringify({
  ok: true,
  site: siteUrl,
  atlasPagesVerified: pages.length,
  atlasSystemsRepresented: 10,
  runtimeFilesVerified: 2,
  canonicalRoute: '/learn/atlas/',
  wordPressLearnHubPreserved: true,
}));

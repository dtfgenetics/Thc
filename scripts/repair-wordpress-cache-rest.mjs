const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';

if (!username || !password) {
  throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');
}

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path, options = {}) {
  const response = await fetch(`${siteUrl}${path}`, {
    ...options,
    headers: {
      Authorization: auth,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)}`);
  }
  return body;
}

async function setPluginStatus(plugin, status) {
  const encoded = plugin.split('/').map(encodeURIComponent).join('/');
  return request(`/wp-json/wp/v2/plugins/${encoded}`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

const checks = [
  ['/', 'Genetics. Plant science. Tools. Games. Community.'],
  ['/learn/', 'Explore by subject'],
  ['/learn/infographics/', 'Visual plant science and cultivation library.'],
];

async function fetchPublic(path) {
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(`${siteUrl}${path}${separator}dtf_cache_repair=${Date.now()}-${Math.random().toString(16).slice(2)}`, {
    redirect: 'follow',
    headers: {
      'Cache-Control': 'no-cache, no-store, max-age=0',
      Pragma: 'no-cache',
      'User-Agent': 'DTFSeeds-production-repair/1.0',
    },
  });
  const text = await response.text();
  return { status: response.status, ok: response.ok, text };
}

async function verifyPublic(label) {
  const results = [];
  for (const [path, marker] of checks) {
    const result = await fetchPublic(path);
    const markerFound = result.text.toLowerCase().includes(marker.toLowerCase());
    const staleMarkers = [
      'Grow education belongs in a clean, readable library.',
      'MOPS, cultivation notes, THC basics',
      'being rebuilt',
      'Reserved strain card',
      'Tool-ready rebuild',
    ].filter((value) => result.text.toLowerCase().includes(value.toLowerCase()));
    results.push({
      label,
      path,
      status: result.status,
      marker,
      markerFound,
      staleMarkers,
      wordpressMediaReferences: (result.text.match(/\/wp-content\/uploads\//g) || []).length,
      sample: result.text.slice(0, 280).replace(/\s+/g, ' '),
    });
  }
  return results;
}

function allCurrent(results) {
  return results.every((result) => result.status >= 200 && result.status < 400 && result.markerFound && result.staleMarkers.length === 0);
}

const plugins = await request('/wp-json/wp/v2/plugins?context=edit&per_page=100');
const liteSpeed = Array.isArray(plugins)
  ? plugins.find((plugin) => plugin.plugin === 'litespeed-cache/litespeed-cache')
  : null;

const report = {
  generatedAt: new Date().toISOString(),
  siteUrl,
  liteSpeedPresent: Boolean(liteSpeed),
  initialLiteSpeedStatus: liteSpeed?.status || null,
  action: 'none',
  before: await verifyPublic('before'),
  afterDisable: null,
  afterReactivate: null,
  finalLiteSpeedStatus: liteSpeed?.status || null,
  outcome: 'unknown',
};

if (allCurrent(report.before)) {
  report.outcome = 'already-current';
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

if (!liteSpeed) {
  report.outcome = 'not-litespeed-cache';
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = 2;
} else if (liteSpeed.status !== 'active') {
  report.outcome = 'litespeed-already-inactive-and-public-still-stale';
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = 3;
} else {
  report.action = 'temporarily-disable-litespeed';
  await setPluginStatus(liteSpeed.plugin, 'inactive');
  report.finalLiteSpeedStatus = 'inactive';
  await sleep(2500);
  report.afterDisable = await verifyPublic('after-disable');

  if (!allCurrent(report.afterDisable)) {
    await setPluginStatus(liteSpeed.plugin, 'active');
    report.finalLiteSpeedStatus = 'active';
    report.outcome = 'litespeed-not-root-cause-restored';
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 4;
  } else {
    report.action = 'disable-reactivate-and-verify';
    await setPluginStatus(liteSpeed.plugin, 'active');
    report.finalLiteSpeedStatus = 'active';
    await sleep(2500);
    report.afterReactivate = await verifyPublic('after-reactivate');

    if (allCurrent(report.afterReactivate)) {
      report.outcome = 'cache-reset-success-plugin-active';
    } else {
      await setPluginStatus(liteSpeed.plugin, 'inactive');
      report.finalLiteSpeedStatus = 'inactive';
      report.outcome = 'cache-reset-success-plugin-left-inactive-to-prevent-stale-pages';
    }

    console.log(JSON.stringify(report, null, 2));
  }
}

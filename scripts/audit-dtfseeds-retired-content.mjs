const BASE = 'https://dtfseeds.com';
const retiredRoutes = [
  '/blog/',
  '/exploring-dtf-genetics-a-hub-for-cannabis-art-and-gardening-tools/',
  '/explore-dtf-genetics-your-destination-for-cannabis-themed-apparel-and-art/'
];
const banned = ['email@email.com', '+123456789'];
let failed = false;

for (const path of retiredRoutes) {
  const requested = new URL(path, BASE).href;
  try {
    const response = await fetch(requested, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: { 'user-agent': 'DTFSeeds-Retired-Content-QA/1.0' }
    });
    const html = await response.text();
    const found = banned.filter((value) => html.toLowerCase().includes(value.toLowerCase()));
    const moved = response.url !== requested || [301,302,307,308,404,410].includes(response.status);
    const cleanFallback = response.status === 200 && found.length === 0 && /noindex/i.test(html);
    const pass = found.length === 0 && (moved || cleanFallback);
    console.log(`${pass ? 'PASS' : 'FAIL'} ${path} -> ${response.status} ${response.url}`);
    if (found.length) console.error(`  banned public data: ${found.join(', ')}`);
    if (!pass) console.error('  retired content must redirect/be removed or serve a clean noindex fallback');
    if (!pass) failed = true;
  } catch (error) {
    console.error(`FAIL ${path}: ${error instanceof Error ? error.message : String(error)}`);
    failed = true;
  }
}

if (failed) process.exitCode = 1;

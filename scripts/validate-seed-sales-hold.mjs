import fs from 'node:fs';
import path from 'node:path';

// Release safety guard: public editorial pages must not send visitors to products
// while the temporary seed-sales suspension is in effect.
const root = process.cwd();
const pages = ['site/wordpress/pages/seeds.html', 'site/wordpress/pages/shop.html'];
let failed = false;
for (const relativePath of pages) {
  const html = fs.readFileSync(path.join(root, relativePath), 'utf8');
  const checks = [
    ['sales-hold notice', /Seed sales are temporarily on hold\./i.test(html)],
    ['no direct product links', !/href\s*=\s*["']\/product\//i.test(html)],
    ['no add-to-cart links', !/href\s*=\s*["'][^"']*(?:add-to-cart=|\/cart\/|\/checkout\/)/i.test(html)],
  ];
  for (const [label, ok] of checks) {
    if (!ok) { console.error(relativePath + ': FAIL ' + label); failed = true; }
  }
}
// Legacy Shop V5 can overwrite WordPress content; require its production guard.
const workflow = fs.readFileSync(path.join(root, '.github/workflows/wordpress-shop-storefront-v5.yml'), 'utf8');
if (!workflow.includes('id: sales_hold') || !workflow.includes("if: steps.sales_hold.outputs.active != 'true'")) {
  console.error('Legacy Shop V5 publisher is not suspended during the seed sales hold.');
  failed = true;
}
if (failed) process.exit(1);
console.log('Seed-sales hold editorial page guard passed. Live WooCommerce checkout must also be disabled and separately verified.');

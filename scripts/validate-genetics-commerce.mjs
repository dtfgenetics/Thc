import { readFile } from 'node:fs/promises';

const registryPath = 'site/wordpress/products/genetics.json';
const seedsPath = 'site/wordpress/pages/seeds.html';
const shopPath = 'site/wordpress/pages/shop.html';

const [registryText, seedsHtml, shopHtml] = await Promise.all([
  readFile(registryPath, 'utf8'),
  readFile(seedsPath, 'utf8'),
  readFile(shopPath, 'utf8')
]);

const registry = JSON.parse(registryText);
const errors = [];
const warnings = [];
const seedsLower = seedsHtml.toLowerCase();
const shopLower = shopHtml.toLowerCase();

if (registry?.schemaVersion !== 1) errors.push('genetics.json schemaVersion must be 1');
if (!Array.isArray(registry?.products) || registry.products.length === 0) {
  errors.push('genetics.json must contain at least one product record');
}

const ids = new Set();
const paths = new Set();
const allowedSeedTypes = new Set(['regular', 'feminized', 'autoflower', 'regular autoflower', 'feminized autoflower']);
const dynamicFields = new Set(registry?.policy?.doNotHardCodeDynamicCommerceFields || []);

for (const product of registry.products || []) {
  const label = product?.id || '(missing id)';
  for (const key of ['id', 'canonicalName', 'lineage', 'generation', 'seedType', 'packQuantity', 'productPath', 'liveStoreLabel', 'catalogMatchStatus']) {
    if (product?.[key] === undefined || product?.[key] === null || product?.[key] === '') {
      errors.push(`${label}: missing required field ${key}`);
    }
  }

  if (ids.has(product.id)) errors.push(`${label}: duplicate product id`);
  ids.add(product.id);

  if (paths.has(product.productPath)) errors.push(`${label}: duplicate productPath ${product.productPath}`);
  paths.add(product.productPath);

  if (!String(product.productPath || '').startsWith('/product/')) {
    errors.push(`${label}: productPath must stay under /product/`);
  }

  if (!Number.isInteger(product.packQuantity) || product.packQuantity <= 0) {
    errors.push(`${label}: packQuantity must be a positive integer`);
  }

  if (!allowedSeedTypes.has(String(product.seedType || '').toLowerCase())) {
    warnings.push(`${label}: seedType '${product.seedType}' is outside the current controlled vocabulary`);
  }

  for (const field of dynamicFields) {
    if (Object.hasOwn(product, field)) {
      errors.push(`${label}: dynamic commerce field '${field}' must not be hard-coded in genetics.json`);
    }
  }

  if (!seedsHtml.includes(product.productPath)) {
    errors.push(`${label}: Seeds page does not link ${product.productPath}`);
  }
  if (!shopHtml.includes(product.productPath)) {
    errors.push(`${label}: Shop page does not link ${product.productPath}`);
  }

  if (product.titleNormalization?.automaticRenameAllowed !== undefined &&
      product.catalogMatchStatus.includes('review') &&
      product.titleNormalization.automaticRenameAllowed !== false) {
    errors.push(`${label}: unresolved store-title review must not permit automatic rename`);
  }
}

const blueMango = (registry.products || []).filter((product) => product.canonicalName === 'Blue Mango');
if (blueMango.length < 2) errors.push('Expected regular and feminized Blue Mango commerce records');
for (const product of blueMango) {
  if (product.lineage !== 'Somango XXL × Blueberry Butcher') {
    errors.push(`${product.id}: Blue Mango lineage drifted from Somango XXL × Blueberry Butcher`);
  }
  if (product.generation !== 'F2') {
    errors.push(`${product.id}: current linked Blue Mango release must remain labeled F2 unless the route changes`);
  }
}

const sourcePages = `${seedsHtml}\n${shopHtml}`.toLowerCase();
const forbiddenPublicClaims = [
  'experience the pinnacle',
  'high potential yields',
  'optimized growth cycle',
  'large yields in a short span',
  'commercial purposes',
  'deliver consistent phenotypes'
];
for (const phrase of forbiddenPublicClaims) {
  if (sourcePages.includes(phrase)) errors.push(`Canonical Seeds/Shop source contains prohibited legacy claim: ${phrase}`);
}

if (!seedsLower.includes('product page is the transaction source of truth')) {
  errors.push('Seeds page must state that the product page controls transaction data');
}
if (!shopLower.includes('product pages control current price, inventory, quantity, seed type')) {
  errors.push('Shop page must keep dynamic transaction fields on product pages');
}

if (errors.length) {
  console.error('Genetics commerce validation failed:');
  for (const error of errors) console.error(`- ${error}`);
}
if (warnings.length) {
  console.warn('Genetics commerce validation warnings:');
  for (const warning of warnings) console.warn(`- ${warning}`);
}

console.log(`Validated ${registry.products?.length || 0} genetics commerce records, ${paths.size} unique product routes.`);
if (errors.length) process.exitCode = 1;

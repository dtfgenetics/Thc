import { readFile } from 'node:fs/promises';

const genetics = JSON.parse(await readFile('site/wordpress/products/genetics.json', 'utf8'));
const plan = JSON.parse(await readFile('site/wordpress/products/woocommerce-reconciliation.json', 'utf8'));
const errors = [];

if (plan?.schemaVersion !== 1) errors.push('WooCommerce reconciliation schemaVersion must be 1');
if (plan?.siteUrl !== 'https://dtfseeds.com') errors.push('WooCommerce reconciliation siteUrl must remain https://dtfseeds.com');
if (String(plan?.policy?.category || '').toLowerCase() !== 'seeds') errors.push('Canonical WooCommerce category must be Seeds');

const registryById = new Map((genetics.products || []).map((product) => [product.id, product]));
const plannedIds = new Set();
const plannedSlugs = new Set();
const allowedSpecFields = new Set(['registryId', 'slug', 'desiredName', 'preserveCurrentName', 'shortDescription', 'description']);
const forbiddenCommerceFields = new Set([
  'price', 'regular_price', 'sale_price', 'stock_quantity', 'stock_status', 'manage_stock',
  'sku', 'shipping_class', 'tax_status', 'tax_class', 'images', 'tags', 'attributes', 'downloads', 'status'
]);
const forbiddenClaims = [
  'experience the pinnacle',
  'high potential yields',
  'large yields',
  'optimized growth cycle',
  'commercial purposes',
  'commercial performance',
  'deliver consistent phenotypes',
  'consistent phenotypes',
  'guaranteed aroma',
  'guaranteed flavor'
];

for (const spec of plan.products || []) {
  const label = spec?.registryId || '(missing registryId)';
  if (!spec.registryId) errors.push('Every reconciliation product requires registryId');
  if (!spec.slug) errors.push(`${label}: missing slug`);
  if (!spec.shortDescription) errors.push(`${label}: missing shortDescription`);
  if (!spec.description) errors.push(`${label}: missing description`);

  if (plannedIds.has(spec.registryId)) errors.push(`${label}: duplicate registryId`);
  plannedIds.add(spec.registryId);
  if (plannedSlugs.has(spec.slug)) errors.push(`${label}: duplicate slug ${spec.slug}`);
  plannedSlugs.add(spec.slug);

  for (const key of Object.keys(spec)) {
    if (!allowedSpecFields.has(key)) errors.push(`${label}: unsupported reconciliation field ${key}`);
    if (forbiddenCommerceFields.has(key)) errors.push(`${label}: protected commerce field ${key} must not be in reconciliation plan`);
  }

  const registry = registryById.get(spec.registryId);
  if (!registry) {
    errors.push(`${label}: no matching canonical genetics record`);
    continue;
  }

  const expectedSlug = String(registry.productPath || '').replace(/^\/product\//, '').replace(/\/$/, '');
  if (spec.slug !== expectedSlug) errors.push(`${label}: slug does not match canonical productPath ${registry.productPath}`);

  const needsTitleReview = String(registry.catalogMatchStatus || '').includes('review');
  if (needsTitleReview && spec.preserveCurrentName !== true) {
    errors.push(`${label}: unresolved store-title review must preserve the current product name`);
  }
  if (needsTitleReview && spec.desiredName) {
    errors.push(`${label}: unresolved store-title review must not define desiredName`);
  }
  if (!needsTitleReview && !spec.preserveCurrentName && !spec.desiredName) {
    errors.push(`${label}: verified product should define desiredName or explicitly preserveCurrentName`);
  }

  const combined = `${spec.shortDescription}\n${spec.description}`.toLowerCase();
  for (const claim of forbiddenClaims) {
    if (combined.includes(claim)) errors.push(`${label}: prohibited marketing/guarantee phrase found: ${claim}`);
  }
  if (/\$\s*\d/.test(combined)) errors.push(`${label}: product copy must not hard-code a price`);

  const lineage = String(registry.lineage || '');
  if (lineage && !combined.includes(lineage.toLowerCase())) errors.push(`${label}: product copy must include canonical lineage ${lineage}`);
  const generation = String(registry.generation || '');
  if (generation && !combined.includes(generation.toLowerCase())) errors.push(`${label}: product copy must include generation ${generation}`);
  const seedType = String(registry.seedType || '');
  if (seedType && !combined.includes(seedType.toLowerCase())) errors.push(`${label}: product copy must include seed type ${seedType}`);
}

for (const registry of genetics.products || []) {
  if (!plannedIds.has(registry.id)) errors.push(`${registry.id}: missing WooCommerce reconciliation record`);
}
for (const id of plannedIds) {
  if (!registryById.has(id)) errors.push(`${id}: reconciliation plan contains product not found in genetics registry`);
}

if (errors.length) {
  console.error('WooCommerce reconciliation validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Validated ${plannedIds.size} WooCommerce reconciliation records against ${registryById.size} genetics records.`);
}

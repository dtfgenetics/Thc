import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const planPath = process.env.WC_RECONCILIATION_PLAN || 'site/wordpress/products/woocommerce-reconciliation.json';
const plan = JSON.parse(await readFile(planPath, 'utf8'));
const siteUrl = (process.env.WP_SITE_URL || plan.siteUrl || 'https://dtfseeds.com').replace(/\/$/, '');
const applyChanges = String(process.env.APPLY_WOOCOMMERCE_CHANGES || '').toLowerCase() === 'true';
const backupRoot = process.env.BACKUP_ROOT || process.cwd();
const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const backupDir = join(backupRoot, `woocommerce-product-backup-${timestamp}`);
const reportJsonPath = process.env.WC_REPORT_JSON || 'woocommerce-reconciliation-report.json';
const reportMarkdownPath = process.env.WC_REPORT_MARKDOWN || 'woocommerce-reconciliation-report.md';

const consumerKey = process.env.WC_CONSUMER_KEY || '';
const consumerSecret = process.env.WC_CONSUMER_SECRET || '';
const wpUsername = process.env.WP_API_USERNAME || '';
const wpPassword = process.env.WP_API_PASSWORD || '';

const authMode = consumerKey && consumerSecret
  ? 'woocommerce-consumer-key'
  : wpUsername && wpPassword
    ? 'wordpress-basic-auth'
    : 'none';

const authHeader = authMode === 'woocommerce-consumer-key'
  ? `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`
  : authMode === 'wordpress-basic-auth'
    ? `Basic ${Buffer.from(`${wpUsername}:${wpPassword}`).toString('base64')}`
    : '';

const protectedFields = new Set([
  ...(plan.policy?.preserveFields || []),
  'id',
  'permalink',
  'date_created',
  'date_modified',
  'total_sales',
  'orders'
]);

const allowedWriteFields = new Set(['name', 'description', 'short_description', 'categories']);
const removeCategorySlugs = new Set((plan.policy?.removeCategorySlugs || []).map((value) => String(value).toLowerCase()));
const desiredCategoryName = plan.policy?.category || 'Seeds';

function normalizeHtml(value = '') {
  return String(value).replace(/\r\n/g, '\n').trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetries(url, options = {}, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        redirect: 'follow',
        signal: AbortSignal.timeout(20_000),
        headers: {
          Accept: 'application/json',
          'User-Agent': 'DTFSeeds-WooCommerce-Reconciler/1.0',
          ...(options.headers || {})
        }
      });
      const text = await response.text();
      let body = null;
      if (text) {
        try {
          body = JSON.parse(text);
        } catch {
          body = { raw: text.slice(0, 1500) };
        }
      }
      if (!response.ok) {
        const code = body?.code ? ` (${body.code})` : '';
        const message = body?.message ? `: ${body.message}` : '';
        throw new Error(`HTTP ${response.status}${code}${message}`);
      }
      return { response, body };
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(attempt * 1500);
    }
  }
  throw lastError;
}

async function publicStoreProductsBySlug(slug) {
  const url = new URL('/wp-json/wc/store/v1/products', siteUrl);
  url.searchParams.set('slug', slug);
  const { body } = await fetchWithRetries(url.href);
  if (!Array.isArray(body)) throw new Error(`Store API returned an unexpected response for ${slug}`);
  return body;
}

async function wcRequest(path, options = {}) {
  if (!authHeader) throw new Error('Authenticated WooCommerce access is not configured');
  return fetchWithRetries(`${siteUrl}${path}`, {
    ...options,
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
}

async function authenticatedProductBySlug(slug) {
  const params = new URLSearchParams({ slug, per_page: '100' });
  const { body } = await wcRequest(`/wp-json/wc/v3/products?${params}`);
  if (!Array.isArray(body)) throw new Error(`wc/v3 returned an unexpected response for ${slug}`);
  return body;
}

async function ensureSeedCategory() {
  const params = new URLSearchParams({ search: desiredCategoryName, per_page: '100' });
  const { body } = await wcRequest(`/wp-json/wc/v3/products/categories?${params}`);
  if (!Array.isArray(body)) throw new Error('Could not inspect WooCommerce product categories');
  const exact = body.find((category) =>
    String(category?.name || '').toLowerCase() === desiredCategoryName.toLowerCase() ||
    String(category?.slug || '').toLowerCase() === desiredCategoryName.toLowerCase()
  );
  if (exact?.id) return exact;

  const created = await wcRequest('/wp-json/wc/v3/products/categories', {
    method: 'POST',
    body: JSON.stringify({ name: desiredCategoryName })
  });
  if (!created.body?.id) throw new Error(`WooCommerce did not confirm creation of category ${desiredCategoryName}`);
  return created.body;
}

function publicCategories(product) {
  return Array.isArray(product?.categories) ? product.categories : [];
}

function authenticatedCategories(product) {
  return Array.isArray(product?.categories) ? product.categories : [];
}

function desiredPayload(spec, currentProduct, seedCategory) {
  const payload = {
    description: spec.description,
    short_description: spec.shortDescription
  };

  if (!spec.preserveCurrentName && spec.desiredName) payload.name = spec.desiredName;

  if (seedCategory?.id) {
    const existing = authenticatedCategories(currentProduct)
      .filter((category) => !removeCategorySlugs.has(String(category?.slug || '').toLowerCase()))
      .map((category) => ({ id: category.id }))
      .filter((category) => Number.isInteger(Number(category.id)));
    if (!existing.some((category) => Number(category.id) === Number(seedCategory.id))) {
      existing.push({ id: seedCategory.id });
    }
    payload.categories = existing;
  }

  for (const key of Object.keys(payload)) {
    if (!allowedWriteFields.has(key)) throw new Error(`Refusing unexpected WooCommerce write field: ${key}`);
    if (protectedFields.has(key)) throw new Error(`Refusing protected WooCommerce write field: ${key}`);
  }
  return payload;
}

function buildChanges(spec, current, categorySnapshot = []) {
  const changes = [];
  if (!spec.preserveCurrentName && spec.desiredName && String(current?.name || '') !== spec.desiredName) {
    changes.push({ field: 'name', from: current?.name || '', to: spec.desiredName });
  }
  if (normalizeHtml(current?.description) !== normalizeHtml(spec.description)) {
    changes.push({ field: 'description', from: '(current description)', to: '(canonical description)' });
  }
  if (normalizeHtml(current?.short_description) !== normalizeHtml(spec.shortDescription)) {
    changes.push({ field: 'short_description', from: '(current short description)', to: '(canonical short description)' });
  }

  const categorySlugs = categorySnapshot.map((category) => String(category?.slug || '').toLowerCase());
  if (categorySlugs.some((slug) => removeCategorySlugs.has(slug))) {
    changes.push({ field: 'categories', from: categorySlugs.join(', ') || '(none)', to: `remove ${[...removeCategorySlugs].join(', ')}; ensure ${desiredCategoryName}` });
  } else if (!categorySlugs.includes(desiredCategoryName.toLowerCase())) {
    changes.push({ field: 'categories', from: categorySlugs.join(', ') || '(none)', to: `ensure ${desiredCategoryName}` });
  }
  return changes;
}

async function verifyUpdatedProduct(id, spec, seedCategory) {
  const { body } = await wcRequest(`/wp-json/wc/v3/products/${id}`);
  const failures = [];
  if (!spec.preserveCurrentName && spec.desiredName && body?.name !== spec.desiredName) failures.push('name');
  if (normalizeHtml(body?.description) !== normalizeHtml(spec.description)) failures.push('description');
  if (normalizeHtml(body?.short_description) !== normalizeHtml(spec.shortDescription)) failures.push('short_description');
  const categories = authenticatedCategories(body);
  if (seedCategory?.id && !categories.some((category) => Number(category?.id) === Number(seedCategory.id))) failures.push('Seeds category');
  if (categories.some((category) => removeCategorySlugs.has(String(category?.slug || '').toLowerCase()))) failures.push('legacy category removal');
  if (failures.length) throw new Error(`Verification failed for product ${id}: ${failures.join(', ')}`);
  return body;
}

if (plan?.schemaVersion !== 1) throw new Error('Unsupported WooCommerce reconciliation schema');
if (!Array.isArray(plan?.products) || plan.products.length === 0) throw new Error('WooCommerce reconciliation plan has no products');
if (applyChanges && authMode === 'none') {
  throw new Error('APPLY_WOOCOMMERCE_CHANGES=true requires WC_CONSUMER_KEY/WC_CONSUMER_SECRET or WP_API_USERNAME/WP_API_PASSWORD');
}

await mkdir(backupDir, { recursive: true });

const results = [];
let seedCategory = null;
if (applyChanges) seedCategory = await ensureSeedCategory();

for (const spec of plan.products) {
  const publicMatches = await publicStoreProductsBySlug(spec.slug);
  if (publicMatches.length !== 1) {
    throw new Error(`Expected exactly one published Store API product for slug '${spec.slug}'; found ${publicMatches.length}`);
  }

  const publicProduct = publicMatches[0];
  let current = publicProduct;
  let categories = publicCategories(publicProduct);
  let productId = publicProduct.id;

  if (applyChanges) {
    const privateMatches = await authenticatedProductBySlug(spec.slug);
    if (privateMatches.length !== 1) {
      throw new Error(`Expected exactly one authenticated WooCommerce product for slug '${spec.slug}'; found ${privateMatches.length}`);
    }
    current = privateMatches[0];
    categories = authenticatedCategories(current);
    productId = current.id;
    await writeFile(join(backupDir, `${spec.registryId}-before.json`), `${JSON.stringify(current, null, 2)}\n`, 'utf8');
  }

  const changes = buildChanges(spec, current, categories);
  const result = {
    registryId: spec.registryId,
    slug: spec.slug,
    productId,
    currentName: current?.name || '',
    preserveCurrentName: Boolean(spec.preserveCurrentName),
    changes,
    changed: false,
    verified: false
  };

  if (applyChanges && changes.length > 0) {
    const payload = desiredPayload(spec, current, seedCategory);
    await writeFile(join(backupDir, `${spec.registryId}-planned-payload.json`), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    const updated = await wcRequest(`/wp-json/wc/v3/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    if (Number(updated.body?.id) !== Number(productId)) {
      throw new Error(`WooCommerce did not confirm update of product ${productId}`);
    }
    result.changed = true;
    await verifyUpdatedProduct(productId, spec, seedCategory);
    result.verified = true;
  } else if (applyChanges) {
    result.verified = true;
  }

  results.push(result);
}

const report = {
  generatedAt: new Date().toISOString(),
  siteUrl,
  mode: applyChanges ? 'apply' : 'dry-run',
  authMode,
  desiredCategory: desiredCategoryName,
  backupDir: applyChanges ? backupDir : null,
  productCount: results.length,
  productsNeedingChanges: results.filter((result) => result.changes.length > 0).length,
  productsChanged: results.filter((result) => result.changed).length,
  results
};

const markdown = [
  '# WooCommerce Product Reconciliation',
  '',
  `Generated: ${report.generatedAt}`,
  `Mode: **${report.mode}**`,
  `Authentication mode: **${report.authMode}**`,
  `Products checked: **${report.productCount}**`,
  `Products needing changes: **${report.productsNeedingChanges}**`,
  `Products changed: **${report.productsChanged}**`,
  '',
  '| Product | ID | Planned changes | Applied | Verified |',
  '|---|---:|---|---|---|',
  ...results.map((result) => `| ${result.registryId} | ${result.productId ?? ''} | ${result.changes.map((change) => change.field).join(', ') || 'none'} | ${result.changed ? 'yes' : 'no'} | ${result.verified ? 'yes' : 'no'} |`),
  '',
  'Protected transaction fields are never included in update payloads. Price, stock, SKU, slug, images, tags, attributes, shipping, and tax fields remain controlled by WooCommerce.',
  applyChanges ? `Rollback snapshots: ${backupDir}` : 'No writes were performed.'
].join('\n') + '\n';

await Promise.all([
  writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
  writeFile(reportMarkdownPath, markdown, 'utf8')
]);

console.log(markdown);

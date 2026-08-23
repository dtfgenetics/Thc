import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const siteUrl = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const username = process.env.WP_API_USERNAME || '';
const password = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_GENETICS_V2 || '').toLowerCase() === 'true';
const catalogPath = process.env.DTF_GENETICS_CATALOG || join(process.cwd(), 'site/wordpress/genetics/catalog.json');
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-genetics-v2';
const stamp = new Date().toISOString().replace(/[-:.]/g, '').replace('Z', 'Z');
const backupDir = join(backupRoot, `genetics-v2-${stamp}`);

if (!username || !password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

await mkdir(backupDir, { recursive: true });

const auth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const headers = {
  Authorization: auth,
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'DTFSeeds-Genetics-V2/1.0'
};

const catalogDocument = JSON.parse(await readFile(catalogPath, 'utf8'));
const catalog = Array.isArray(catalogDocument?.catalog) ? catalogDocument.catalog : [];
if (!catalog.length) throw new Error('Genetics catalog is empty');

const required = ['id', 'name', 'slug', 'lineage', 'status', 'statusLabel', 'profileUrl', 'summary'];
for (const entry of catalog) {
  for (const key of required) {
    if (!entry?.[key]) throw new Error(`Genetics catalog entry is missing ${key}: ${entry?.id || entry?.name || 'unknown entry'}`);
  }
  if (entry.profileUrl !== `/seeds/${entry.slug}/`) {
    throw new Error(`Profile URL must live under /seeds/: ${entry.id}`);
  }
}
if (new Set(catalog.map((entry) => entry.slug)).size !== catalog.length) throw new Error('Duplicate genetics slug found');
if (new Set(catalog.map((entry) => entry.id)).size !== catalog.length) throw new Error('Duplicate genetics ID found');

function esc(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function statusClass(status) {
  if (status === 'current-release') return 'release';
  if (status === 'parent-line') return 'parent';
  return 'project';
}

function profileTitle(entry) {
  return [entry.name, entry.seedType, entry.generation].filter(Boolean).join(' · ');
}

function metaPills(entry) {
  return [entry.statusLabel, entry.seedType, entry.generation, entry.flowering]
    .filter(Boolean)
    .map((value) => `<span class="gv2-pill">${esc(value)}</span>`)
    .join('');
}

function art(entry, large = false) {
  if (entry.image) {
    return `<div class="gv2-art ${large ? 'gv2-art-large' : ''}"><img src="${esc(entry.image)}" alt="${esc(entry.imageAlt || `${entry.name} strain card`)}" loading="${large ? 'eager' : 'lazy'}" decoding="async"></div>`;
  }
  return `<div class="gv2-art gv2-art-placeholder ${large ? 'gv2-art-large' : ''}" role="img" aria-label="${esc(entry.imageAlt || `${entry.name} strain card placeholder`)}">
    <div class="gv2-art-orbit"></div>
    <span class="gv2-art-brand">DTF GENETICS</span>
    <strong>${esc(entry.name)}</strong>
    <small>${esc(entry.lineage)}</small>
    <em>Dream the Future</em>
  </div>`;
}

function card(entry) {
  const shop = entry.shopUrl
    ? `<a class="gv2-btn gv2-btn-gold" href="${esc(entry.shopUrl)}">Shop release</a>`
    : '';
  return `<article class="gv2-card" data-status="${esc(entry.status)}">
    ${art(entry)}
    <div class="gv2-card-body">
      <div class="gv2-card-top"><span class="gv2-status gv2-status-${statusClass(entry.status)}">${esc(entry.statusLabel)}</span>${entry.generation ? `<span class="gv2-generation">${esc(entry.generation)}</span>` : ''}</div>
      <h3>${esc(entry.name)}</h3>
      <p class="gv2-lineage">${esc(entry.lineage)}</p>
      <p class="gv2-summary">${esc(entry.summary)}</p>
      <div class="gv2-card-actions"><a class="gv2-btn gv2-btn-dark" href="${esc(entry.profileUrl)}">View genetics profile</a>${shop}</div>
    </div>
  </article>`;
}

function styles() {
  return `<style id="dtf-genetics-v2-styles">
  .gv2{--ink:#0b2415;--forest:#103b21;--green:#1d7040;--lime:#8bd35b;--gold:#ddb959;--cream:#f7f3e7;--paper:#fffef9;--muted:#526257;--line:#d9e1d8;background:var(--cream);color:var(--ink);font-family:inherit;overflow:hidden}
  .gv2 *{box-sizing:border-box}.gv2 a{text-decoration:none}.gv2-wrap{width:min(1240px,calc(100% - 36px));margin:auto}.gv2-hero{position:relative;padding:78px 0 64px;background:radial-gradient(circle at 82% 16%,rgba(221,185,89,.24),transparent 28%),radial-gradient(circle at 10% 92%,rgba(139,211,91,.12),transparent 30%),linear-gradient(145deg,#06190e,#103b21 58%,#153f24);color:#fff}.gv2-hero:after{content:"";position:absolute;inset:auto -120px -220px auto;width:520px;height:520px;border:1px solid rgba(221,185,89,.2);border-radius:50%;pointer-events:none}.gv2-hero-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(330px,.95fr);gap:54px;align-items:center}.gv2-kicker{margin:0 0 14px;color:var(--gold);font-size:.78rem;font-weight:900;letter-spacing:.15em;text-transform:uppercase}.gv2-hero h1{margin:0;max-width:800px;font-size:clamp(3rem,6.4vw,6rem);line-height:.92;letter-spacing:-.055em}.gv2-lede{max-width:740px;margin:24px 0 0;color:#d7e4d9;font-size:1.12rem;line-height:1.75}.gv2-actions,.gv2-card-actions{display:flex;gap:10px;flex-wrap:wrap}.gv2-actions{margin-top:28px}.gv2-btn{display:inline-flex;min-height:44px;align-items:center;justify-content:center;padding:11px 17px;border-radius:999px;font-weight:900;line-height:1.2;transition:transform .15s ease,box-shadow .15s ease}.gv2-btn:hover{transform:translateY(-1px)}.gv2-btn-gold{background:var(--gold);color:#112416!important;box-shadow:0 12px 30px rgba(0,0,0,.14)}.gv2-btn-light{background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.28);color:#fff!important}.gv2-btn-dark{background:var(--forest);color:#fff!important}.gv2-hero-art{position:relative}.gv2-hero-stack{display:grid;grid-template-columns:1fr 1fr;gap:14px;transform:rotate(2deg)}.gv2-hero-stack .gv2-art:nth-child(2){transform:translateY(34px) rotate(3deg)}
  .gv2-art{position:relative;display:flex;min-height:285px;flex-direction:column;justify-content:flex-end;overflow:hidden;border-radius:26px;background:linear-gradient(150deg,#102d1d,#07180e 62%,#1a5230);border:1px solid rgba(221,185,89,.48);padding:24px;color:#fff;box-shadow:0 22px 54px rgba(5,25,12,.22);isolation:isolate}.gv2-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.gv2-art img+*{position:relative}.gv2-art-placeholder:before{content:"";position:absolute;inset:22% -15% -36% 24%;border-radius:50%;background:radial-gradient(circle at 50% 40%,rgba(139,211,91,.62),rgba(36,121,64,.22) 36%,transparent 67%);filter:blur(2px);z-index:-1}.gv2-art-orbit{position:absolute;width:230px;height:230px;right:-70px;top:-72px;border:1px solid rgba(221,185,89,.45);border-radius:50%;box-shadow:0 0 0 28px rgba(221,185,89,.035),0 0 0 58px rgba(221,185,89,.025);z-index:-1}.gv2-art-brand{position:absolute;top:22px;left:24px;color:var(--gold);font-size:.7rem;font-weight:950;letter-spacing:.16em}.gv2-art strong{font-size:clamp(1.8rem,3vw,2.8rem);line-height:.96;letter-spacing:-.04em}.gv2-art small{margin-top:9px;color:#d8e7dc;font-weight:750;line-height:1.35}.gv2-art em{margin-top:20px;color:var(--gold);font-size:.76rem;font-style:normal;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.gv2-art-large{min-height:460px}
  .gv2-nav{position:relative;z-index:3;margin-top:-24px}.gv2-nav-inner{display:flex;gap:8px;flex-wrap:wrap;padding:12px;background:#fff;border:1px solid var(--line);border-radius:22px;box-shadow:0 18px 48px rgba(11,36,21,.12)}.gv2-nav a{flex:1;min-width:150px;padding:13px 16px;border-radius:14px;background:#f2f6f0;color:var(--ink)!important;text-align:center;font-weight:900}.gv2-nav a:hover{background:#e5efe3}
  .gv2-section{padding:72px 0}.gv2-section-soft{background:#edf3e9}.gv2-section-dark{background:#0c2a18;color:#fff}.gv2-heading{display:flex;gap:28px;align-items:end;justify-content:space-between;margin-bottom:28px}.gv2-heading>div{max-width:760px}.gv2-heading h2{margin:0;font-size:clamp(2.2rem,4.4vw,3.8rem);line-height:1;letter-spacing:-.045em}.gv2-heading p{max-width:520px;margin:0;color:var(--muted);line-height:1.7}.gv2-section-dark .gv2-heading p{color:#c8d8cd}.gv2-eyebrow{margin:0 0 9px;color:var(--green);font-size:.76rem;font-weight:950;letter-spacing:.14em;text-transform:uppercase}.gv2-section-dark .gv2-eyebrow{color:var(--gold)}
  .gv2-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:20px}.gv2-card{display:flex;min-width:0;flex-direction:column;background:var(--paper);border:1px solid var(--line);border-radius:26px;overflow:hidden;box-shadow:0 14px 36px rgba(11,36,21,.075)}.gv2-card .gv2-art{min-height:310px;border:0;border-radius:0;box-shadow:none}.gv2-card-body{display:flex;flex:1;flex-direction:column;padding:24px}.gv2-card-top{display:flex;justify-content:space-between;gap:10px;align-items:center}.gv2-status,.gv2-generation,.gv2-pill{display:inline-flex;align-items:center;border-radius:999px;padding:6px 10px;font-size:.7rem;font-weight:950;letter-spacing:.07em;text-transform:uppercase}.gv2-status-release{background:#dcefd8;color:#1b5d30}.gv2-status-project{background:#f5e8bd;color:#755d16}.gv2-status-parent{background:#dce9f2;color:#26536a}.gv2-generation{background:#eff2ec;color:#4d6252}.gv2-card h3{margin:18px 0 7px;font-size:1.7rem;letter-spacing:-.035em}.gv2-lineage{margin:0;color:#28583a;font-weight:900;line-height:1.45}.gv2-summary{margin:14px 0 22px;color:var(--muted);line-height:1.7}.gv2-card-actions{margin-top:auto}.gv2-card-actions .gv2-btn{font-size:.85rem}
  .gv2-callout{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.72fr);gap:42px;align-items:center}.gv2-callout h2{margin:0 0 16px;font-size:clamp(2.3rem,4.8vw,4.2rem);line-height:.98;letter-spacing:-.05em}.gv2-callout p{color:#ccdbd0;line-height:1.8}.gv2-proof{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.gv2-proof div{padding:20px;border:1px solid rgba(255,255,255,.15);border-radius:20px;background:rgba(255,255,255,.05)}.gv2-proof strong{display:block;color:var(--gold);font-size:1.7rem}.gv2-proof span{display:block;margin-top:5px;color:#cbd8ce;font-size:.9rem}
  .gv2-profile-hero{padding:62px 0 48px;background:linear-gradient(145deg,#06190e,#113b22);color:#fff}.gv2-back{display:inline-flex;margin-bottom:24px;color:#d8c374!important;font-weight:900}.gv2-profile-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(330px,.8fr);gap:50px;align-items:center}.gv2-profile h1{margin:0;font-size:clamp(3rem,6vw,5.4rem);line-height:.94;letter-spacing:-.055em}.gv2-profile-lineage{margin:17px 0 0;color:#d9e7dd;font-size:1.2rem;font-weight:800}.gv2-pills{display:flex;gap:8px;flex-wrap:wrap;margin-top:24px}.gv2-pill{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.18);color:#fff}.gv2-profile-copy{font-size:1.08rem;line-height:1.85;color:#465d4d}.gv2-fact-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:28px 0}.gv2-fact{padding:18px;border-radius:18px;background:#fff;border:1px solid var(--line)}.gv2-fact span{display:block;color:#657268;font-size:.72rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}.gv2-fact strong{display:block;margin-top:7px;font-size:1rem}.gv2-note{padding:22px;border-left:4px solid var(--gold);background:#fff8df;border-radius:0 18px 18px 0;color:#4f583d;line-height:1.75}
  @media(max-width:980px){.gv2-hero-grid,.gv2-profile-grid,.gv2-callout{grid-template-columns:1fr}.gv2-hero-art{max-width:720px}.gv2-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.gv2-fact-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:640px){.gv2-wrap{width:min(100% - 24px,1240px)}.gv2-hero{padding-top:58px}.gv2-hero-grid{gap:34px}.gv2-hero-stack{grid-template-columns:1fr 1fr;gap:8px}.gv2-hero-stack .gv2-art{min-height:220px;padding:16px}.gv2-hero-stack .gv2-art:nth-child(2){transform:translateY(18px) rotate(2deg)}.gv2-art-brand{top:16px;left:16px}.gv2-art strong{font-size:1.5rem}.gv2-art small{font-size:.72rem}.gv2-grid{grid-template-columns:1fr}.gv2-heading{display:block}.gv2-heading p{margin-top:14px}.gv2-section{padding:56px 0}.gv2-fact-grid{grid-template-columns:1fr 1fr}.gv2-art-large{min-height:360px}}
  </style>`;
}

function seedsPage() {
  const current = catalog.filter((entry) => entry.status === 'current-release');
  const projects = catalog.filter((entry) => entry.status === 'breeding-project');
  const parents = catalog.filter((entry) => entry.status === 'parent-line');
  const heroItems = [current[0], current[2] || current[1]].filter(Boolean);
  return `<div class="gv2" data-dtf-genetics="v2">
  ${styles()}
  <section class="gv2-hero"><div class="gv2-wrap gv2-hero-grid"><div><p class="gv2-kicker">DTF Genetics · Dream the Future</p><h1>Built line by line. Documented generation by generation.</h1><p class="gv2-lede">Explore DTF Genetics as a breeding program, not a generic product grid. Every line gets a dedicated profile for lineage, generation context, seed type, breeding direction, release status, and its strain-card artwork as those assets are added.</p><div class="gv2-actions"><a class="gv2-btn gv2-btn-gold" href="#current-releases">Explore current releases</a><a class="gv2-btn gv2-btn-light" href="/shop/">Open the seed shop</a></div></div><div class="gv2-hero-art"><div class="gv2-hero-stack">${heroItems.map((entry) => art(entry)).join('')}</div></div></div></section>
  <div class="gv2-wrap gv2-nav"><div class="gv2-nav-inner"><a href="#current-releases">Current releases</a><a href="#breeding-projects">Breeding projects</a><a href="#parent-lines">Parent lines</a><a href="/learn/genetics-breeding/">Learn genetics</a></div></div>
  <section class="gv2-section" id="current-releases"><div class="gv2-wrap"><div class="gv2-heading"><div><p class="gv2-eyebrow">Available genetics</p><h2>Current releases</h2></div><p>Start with the breeding profile, then move to the product listing for live pack, price, inventory, shipping, and checkout details.</p></div><div class="gv2-grid">${current.map(card).join('')}</div></div></section>
  <section class="gv2-section gv2-section-dark"><div class="gv2-wrap gv2-callout"><div><p class="gv2-eyebrow">A breeder’s catalog</p><h2>The strain card should be the beginning, not the entire story.</h2><p>Each genetics profile is designed to hold the matching card art, lineage, generation, seed type, breeding notes, and release state in one durable place. That gives every DTF line a page people can actually discover, share, and return to.</p><div class="gv2-actions"><a class="gv2-btn gv2-btn-gold" href="/shop/">Shop available releases</a><a class="gv2-btn gv2-btn-light" href="/about/">About DTF Genetics</a></div></div><div class="gv2-proof"><div><strong>${catalog.length}</strong><span>lines encoded in Genetics V2</span></div><div><strong>${current.length}</strong><span>current release profiles</span></div><div><strong>${projects.length}</strong><span>breeding-project profiles</span></div><div><strong>${parents.length}</strong><span>parent-line profiles</span></div></div></div></section>
  <section class="gv2-section gv2-section-soft" id="breeding-projects"><div class="gv2-wrap"><div class="gv2-heading"><div><p class="gv2-eyebrow">Breeding library</p><h2>Projects in development</h2></div><p>Breeding-library status keeps developing lines visible without presenting them as currently available seed packs.</p></div><div class="gv2-grid">${projects.map(card).join('')}</div></div></section>
  <section class="gv2-section" id="parent-lines"><div class="gv2-wrap"><div class="gv2-heading"><div><p class="gv2-eyebrow">Lineage foundation</p><h2>Parent lines</h2></div><p>Parent profiles make the family tree easier to follow and give future crosses a clear lineage reference.</p></div><div class="gv2-grid">${parents.map(card).join('')}</div></div></section>
  </div>`;
}

function profilePage(entry) {
  const related = catalog.filter((candidate) => candidate.id !== entry.id && (candidate.lineage.includes(entry.name) || entry.lineage.includes(candidate.name))).slice(0, 3);
  const relatedHtml = related.length
    ? `<section class="gv2-section gv2-section-soft"><div class="gv2-wrap"><div class="gv2-heading"><div><p class="gv2-eyebrow">Family tree</p><h2>Related DTF lines</h2></div><p>Follow the documented lineage into parent and descendant profiles.</p></div><div class="gv2-grid">${related.map(card).join('')}</div></div></section>`
    : '';
  return `<div class="gv2 gv2-profile" data-dtf-genetics-profile="${esc(entry.id)}">${styles()}
  <section class="gv2-profile-hero"><div class="gv2-wrap"><a class="gv2-back" href="/seeds/">← Back to all genetics</a><div class="gv2-profile-grid"><div><p class="gv2-kicker">${esc(entry.statusLabel)}</p><h1>${esc(profileTitle(entry))}</h1><p class="gv2-profile-lineage">${esc(entry.lineage)}</p><div class="gv2-pills">${metaPills(entry)}</div><div class="gv2-actions"><a class="gv2-btn gv2-btn-gold" href="/seeds/">Browse genetics</a>${entry.shopUrl ? `<a class="gv2-btn gv2-btn-light" href="${esc(entry.shopUrl)}">Shop this release</a>` : ''}</div></div>${art(entry, true)}</div></div></section>
  <section class="gv2-section"><div class="gv2-wrap"><div class="gv2-heading"><div><p class="gv2-eyebrow">Genetics profile</p><h2>The line at a glance</h2></div><p>Breeding information is separated from retail details so lineage stays useful even when availability changes.</p></div><div class="gv2-fact-grid"><div class="gv2-fact"><span>Lineage</span><strong>${esc(entry.lineage)}</strong></div><div class="gv2-fact"><span>Generation</span><strong>${esc(entry.generation || 'Not published')}</strong></div><div class="gv2-fact"><span>Seed type</span><strong>${esc(entry.seedType || 'Not published')}</strong></div><div class="gv2-fact"><span>Status</span><strong>${esc(entry.statusLabel)}</strong></div>${entry.flowering ? `<div class="gv2-fact"><span>Planning window</span><strong>${esc(entry.flowering)}</strong></div>` : ''}</div><p class="gv2-profile-copy">${esc(entry.summary)}</p><div class="gv2-note"><strong>Breeder note:</strong> ${esc(entry.selectionNotes || 'This profile documents the line without guaranteeing individual phenotype expression.')}</div>${entry.shopUrl ? `<div class="gv2-actions" style="margin-top:24px"><a class="gv2-btn gv2-btn-dark" href="${esc(entry.shopUrl)}">View live product listing</a></div>` : ''}</div></section>
  ${relatedHtml}
  </div>`;
}

async function request(path, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(`${siteUrl}${path}`, {
        ...options,
        headers: { ...headers, ...(options.headers || {}) },
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000)
      });
      const text = await response.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text.slice(0, 1000) }; }
      if ((response.status === 429 || response.status >= 500) && attempt < 4) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
        continue;
      }
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${body?.message || body?.raw || 'unknown error'}`);
      return body;
    } catch (error) {
      lastError = error;
      if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
  throw lastError;
}

async function getPageBySlug(slug, parent = null) {
  const params = new URLSearchParams({ slug, context: 'edit', per_page: '100' });
  if (parent) params.set('parent', String(parent));
  const rows = await request(`/wp-json/wp/v2/pages?${params}`);
  if (!Array.isArray(rows)) throw new Error(`Unexpected WordPress response for ${slug}`);
  if (rows.length > 1) throw new Error(`Multiple WordPress pages found for slug ${slug}`);
  return rows[0] || null;
}

async function savePage(page, payload, backupName) {
  if (page) await writeFile(join(backupDir, `${backupName}-before.json`), `${JSON.stringify(page, null, 2)}\n`);
  if (!apply) return { id: page?.id || null, dryRun: true };
  if (page) return request(`/wp-json/wp/v2/pages/${page.id}`, { method: 'POST', body: JSON.stringify({ ...payload, status: 'publish' }) });
  return request('/wp-json/wp/v2/pages', { method: 'POST', body: JSON.stringify({ ...payload, status: 'publish' }) });
}

const seeds = await getPageBySlug('seeds');
if (!seeds?.id) throw new Error('Canonical /seeds/ page does not exist');

const results = [];
const seedsResult = await savePage(seeds, { title: 'Seeds / Genetics', content: seedsPage() }, `page-${seeds.id}-seeds`);
results.push({ slug: 'seeds', pageId: seedsResult?.id || seeds.id, action: apply ? 'updated' : 'dry-run' });

for (const entry of catalog) {
  const existing = await getPageBySlug(entry.slug, seeds.id);
  const payload = {
    title: profileTitle(entry),
    slug: entry.slug,
    parent: seeds.id,
    content: profilePage(entry),
    menu_order: 0
  };
  const saved = await savePage(existing, payload, `profile-${entry.slug}`);
  results.push({ slug: entry.slug, pageId: saved?.id || existing?.id || null, action: apply ? (existing ? 'updated' : 'created') : 'dry-run', profileUrl: entry.profileUrl });
}

const report = {
  generatedAt: new Date().toISOString(),
  apply,
  catalogVersion: catalogDocument.version,
  catalogCount: catalog.length,
  releaseCount: catalog.filter((entry) => entry.status === 'current-release').length,
  projectCount: catalog.filter((entry) => entry.status === 'breeding-project').length,
  parentCount: catalog.filter((entry) => entry.status === 'parent-line').length,
  profilesWithoutImages: catalog.filter((entry) => !entry.image).map((entry) => entry.id),
  results
};
await writeFile(join(backupDir, 'genetics-v2-report.json'), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(join(backupRoot, 'genetics-v2-backup-path.txt'), `${backupDir}\n`);
console.log(JSON.stringify(report, null, 2));

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const validateOnly = process.argv.includes('--validate-only');
const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_SIMPLE_USER_GUIDE_BATCH1 || '').toLowerCase() === 'true';
const source = process.env.SIMPLE_USER_GUIDE_BATCH1_PATH || 'site/wordpress/education/simple-user-guide-batch1.json';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-simple-user-guide-batch1';
const data = JSON.parse(await readFile(source, 'utf8'));

const esc = (v = '') => String(v)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');
const rendered = (v) => typeof v === 'string' ? v : (v?.raw || v?.rendered || '');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function validate(d) {
  if (d?.schemaVersion !== 1 || d?.id !== 'simple-user-guide-batch1') throw new Error('Invalid Simple User Guide identity.');
  if (d?.route !== '/learn/beginner-guides/simple-user-guide/') throw new Error('Unexpected Simple User Guide route.');
  if (!Array.isArray(d.pages) || d.pages.length !== 10) throw new Error(`Expected 10 pages, found ${d?.pages?.length || 0}.`);
  const slugs = new Set();
  let sectionCount = 0;
  for (const page of d.pages) {
    if (!Number.isInteger(page.number) || page.number < 1 || page.number > 10) throw new Error(`Invalid page number: ${page.number}`);
    if (!page.slug || slugs.has(page.slug)) throw new Error(`Duplicate or missing slug: ${page.slug}`);
    slugs.add(page.slug);
    if (!page.title || !page.lead || !page.simpleRule) throw new Error(`${page.slug}: missing required learner-facing content.`);
    if (!Array.isArray(page.sections) || page.sections.length < 1) throw new Error(`${page.slug}: at least one content section is required.`);
    for (const section of page.sections) {
      if (!section.label) throw new Error(`${page.slug}: section label is required.`);
      const hasItems = Array.isArray(section.items) && section.items.length > 0;
      const hasText = typeof section.text === 'string' && section.text.trim().length > 0;
      if (!hasItems && !hasText) throw new Error(`${page.slug}: section must contain items or text.`);
      sectionCount += 1;
    }
  }
  if (d.nextAsset?.status !== 'deferred-until-batch1-is-built') throw new Error('Terms page must remain deferred until Batch 1 is built.');
  return { pages: d.pages.length, sections: sectionCount };
}

const totals = validate(data);
if (validateOnly) {
  console.log(JSON.stringify({ valid: true, id: data.id, route: data.route, ...totals }, null, 2));
  process.exit(0);
}
if (!apply) throw new Error('Set APPLY_SIMPLE_USER_GUIDE_BATCH1=true for production.');
if (!user || !pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
async function request(path, options = {}) {
  let last;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await fetch(`${site}${path}`, {
        ...options,
        redirect: 'follow',
        signal: AbortSignal.timeout(60000),
        headers: {
          Authorization: auth,
          Accept: 'application/json',
          'User-Agent': 'DTFSeeds-Simple-User-Guide-Batch1/1.0',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {})
        }
      });
      const text = await response.text();
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      if ((response.status === 429 || response.status >= 500) && attempt < 8) {
        await sleep(attempt * 1500);
        continue;
      }
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 500) : JSON.stringify(body).slice(0, 500)}`);
      return body;
    } catch (error) {
      last = error;
      if (attempt < 8) await sleep(attempt * 1500);
    }
  }
  throw last;
}

const sectionHtml = (section) => {
  const items = Array.isArray(section.items) && section.items.length
    ? `<ul>${section.items.map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`
    : '';
  const text = section.text ? `<p>${esc(section.text)}</p>` : '';
  return `<div class="sug1-section"><h4>${esc(section.label)}</h4>${items}${text}</div>`;
};

const pageHtml = (page) => {
  const transition = page.moveOn
    ? `<div class="sug1-transition"><b>${esc(page.moveOnLabel || 'Move on when')}</b><span>${esc(page.moveOn)}</span></div>`
    : '';
  const avoid = page.avoid
    ? `<div class="sug1-avoid"><b>Avoid</b><span>${esc(page.avoid)}</span></div>`
    : '';
  return `<article class="sug1-page" data-sug-page="${esc(page.slug)}" id="sug1-${esc(page.slug)}"><header><small>Guide ${String(page.number).padStart(2, '0')}</small><h3>${esc(page.title)}</h3><p>${esc(page.lead)}</p></header><div class="sug1-sections">${page.sections.map(sectionHtml).join('')}</div>${transition}${avoid}<div class="sug1-rule"><b>Simple rule</b><span>${esc(page.simpleRule)}</span></div></article>`;
};

const learnRows = await request('/wp-json/wp/v2/pages?slug=learn&context=edit&per_page=20');
if (!Array.isArray(learnRows) || learnRows.length !== 1) throw new Error(`Expected one Learn parent, found ${Array.isArray(learnRows) ? learnRows.length : 'invalid'}.`);
const learn = learnRows[0];

const beginnerRows = await request('/wp-json/wp/v2/pages?slug=beginner-guides&context=edit&per_page=100');
const beginnerChildren = Array.isArray(beginnerRows) ? beginnerRows.filter((page) => Number(page.parent) === Number(learn.id)) : [];
if (beginnerChildren.length !== 1) throw new Error(`Expected one /learn/beginner-guides/ page, found ${beginnerChildren.length}.`);
const beginner = beginnerChildren[0];

const rows = await request('/wp-json/wp/v2/pages?slug=simple-user-guide&context=edit&per_page=100');
const existing = Array.isArray(rows) ? rows.filter((page) => Number(page.parent) === Number(beginner.id)) : [];
if (existing.length > 1) throw new Error(`Expected zero or one Simple User Guide page, found ${existing.length}.`);
const page = existing[0] || null;
const before = page ? rendered(page.content) : '';
if (page && before && !before.includes('data-dtf-simple-user-guide-batch1="true"') && !String(page.title?.raw || page.title?.rendered || '').includes('THC Simple User Guide')) {
  throw new Error('Simple User Guide ownership check failed.');
}

const nav = data.pages.map((item) => `<a href="#sug1-${esc(item.slug)}"><span>${String(item.number).padStart(2, '0')}</span>${esc(item.title)}</a>`).join('');
const css = `<style id="dtf-simple-user-guide-batch1-style">.sug1{--deep:#14291a;--green:#3f733f;--paper:#fffdf8;--cream:#f5f0e4;--ink:#213626;--muted:#5c6b5e;--line:#d9e0d5;--warn:#7b3c30;background:linear-gradient(180deg,#f8f5ea,#edf3e9);color:var(--ink);padding:64px 0 78px}.sug1 *{box-sizing:border-box}.sug1-wrap{width:min(1120px,calc(100% - 34px));margin:auto}.sug1 small{display:block;color:#7c692f;font-weight:900;letter-spacing:.1em;text-transform:uppercase}.sug1 h2{font-size:clamp(2.5rem,5vw,4.5rem);line-height:.96;letter-spacing:-.05em;margin:8px 0 14px}.sug1 h3{font-size:clamp(1.8rem,3vw,2.5rem);letter-spacing:-.035em;margin:4px 0 8px}.sug1 h4{margin:0 0 8px}.sug1 p{color:var(--muted);line-height:1.65}.sug1-hero{display:grid;grid-template-columns:1fr .8fr;gap:24px;align-items:start}.sug1-status{padding:20px;border-radius:18px;background:var(--deep);color:#fff}.sug1-status p{color:#d7e2d5}.sug1-nav{display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin:28px 0 38px}.sug1-nav a{padding:12px;border:1px solid var(--line);border-radius:13px;background:white;color:var(--ink)!important;text-decoration:none!important;font-weight:850}.sug1-nav span{display:block;color:#806d32;font-size:.65rem}.sug1-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}.sug1-page{background:var(--paper);border:1px solid var(--line);border-radius:20px;padding:24px;box-shadow:0 8px 24px rgba(30,50,34,.05)}.sug1-page>header{border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:14px}.sug1-sections{display:grid;gap:12px}.sug1-section{padding:14px;border-radius:14px;background:#f7f5ed}.sug1-section ul{margin:8px 0 0;padding-left:20px}.sug1-section li{margin:5px 0}.sug1-transition,.sug1-avoid,.sug1-rule{display:grid;grid-template-columns:110px 1fr;gap:10px;margin-top:12px;padding:12px 14px;border-radius:12px}.sug1-transition{background:#eef4ea}.sug1-avoid{background:#fbefeb}.sug1-avoid b{color:var(--warn)}.sug1-rule{background:var(--deep);color:white}.sug1-rule b{color:#dbc47f}.sug1-next{margin-top:30px;padding:20px;border:1px dashed #9aaa93;border-radius:16px;background:white}.sug1-next p{margin-bottom:0}@media(max-width:850px){.sug1-hero,.sug1-grid{grid-template-columns:1fr}.sug1-nav{grid-template-columns:repeat(2,1fr)}}@media(max-width:520px){.sug1{padding:48px 0 60px}.sug1-wrap{width:min(100% - 24px,1120px)}.sug1-nav{grid-template-columns:1fr}.sug1-transition,.sug1-avoid,.sug1-rule{grid-template-columns:1fr;gap:4px}}</style>`;
const content = `${css}<section class="sug1" data-dtf-simple-user-guide-batch1="true"><div class="sug1-wrap"><div class="sug1-hero"><div><small>Teaching Healthy Cultivation · Beginner Guides</small><h2>${esc(data.title)}</h2><p><strong>${esc(data.subtitle)}</strong></p><p>${esc(data.intro)}</p></div><aside class="sug1-status"><small>Production status</small><h3>10 approved page scripts</h3><p>${esc(data.visualStatus)}</p></aside></div><nav class="sug1-nav">${nav}</nav><div class="sug1-grid">${data.pages.map(pageHtml).join('')}</div><section class="sug1-next"><small>Next planned asset</small><h3>${esc(data.nextAsset.title)}</h3><p>${esc(data.nextAsset.rule)}</p></section></div></section>`;

const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = join(backupRoot, `simple-user-guide-batch1-${stamp}`);
await mkdir(backupDir, { recursive: true });
if (page) await writeFile(join(backupDir, `page-${page.id}-before.json`), `${JSON.stringify(page, null, 2)}\n`);
await writeFile(join(backupDir, 'planned.html'), `${content}\n`);

let changed = false;
let created = false;
let targetId = page?.id || null;
try {
  let updated;
  const payload = {
    title: 'THC Simple User Guide — Teaching Healthy Cultivation',
    slug: 'simple-user-guide',
    parent: beginner.id,
    status: 'publish',
    content
  };
  if (page) {
    updated = await request(`/wp-json/wp/v2/pages/${page.id}`, { method: 'POST', body: JSON.stringify(payload) });
  } else {
    updated = await request('/wp-json/wp/v2/pages', { method: 'POST', body: JSON.stringify(payload) });
    created = true;
    targetId = updated.id;
  }
  changed = true;
  const html = rendered(updated.content);
  const count = (html.match(/data-sug-page=/g) || []).length;
  if (!html.includes('data-dtf-simple-user-guide-batch1="true"') || count !== 10) throw new Error(`REST verification failed: ${count} Simple User Guide pages.`);
  const report = { generatedAt: new Date().toISOString(), pageId: targetId, route: data.route, ...totals, backupDir };
  await writeFile(join(backupDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  if (changed && page) {
    try {
      await request(`/wp-json/wp/v2/pages/${page.id}`, {
        method: 'POST',
        body: JSON.stringify({
          title: page.title?.raw || 'THC Simple User Guide — Teaching Healthy Cultivation',
          slug: 'simple-user-guide',
          parent: beginner.id,
          status: page.status || 'publish',
          content: before
        })
      });
    } catch (rollback) {
      throw new Error(`${error.message}; rollback failed: ${rollback.message}`);
    }
  } else if (changed && created && targetId) {
    try { await request(`/wp-json/wp/v2/pages/${targetId}?force=true`, { method: 'DELETE' }); } catch {}
  }
  throw error;
}

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const validateOnly = process.argv.includes('--validate-only');
const site = (process.env.WP_SITE_URL || 'https://dtfseeds.com').replace(/\/$/, '');
const user = process.env.WP_API_USERNAME || '';
const pass = process.env.WP_API_PASSWORD || '';
const apply = String(process.env.APPLY_DIAGNOSTIC_CASE_LAB_V1 || '').toLowerCase() === 'true';
const packagePath = process.env.DIAGNOSTIC_CASE_LAB_V1_PATH || 'site/wordpress/education/diagnostic-case-lab-v1.json';
const backupRoot = process.env.BACKUP_ROOT || '/tmp/dtf-diagnostic-case-lab-v1';
const data = JSON.parse(await readFile(packagePath, 'utf8'));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const esc = (v = '') => String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const rendered = (v) => typeof v === 'string' ? v : (v?.raw || v?.rendered || '');

function validate(pkg) {
  if (pkg?.schemaVersion !== 1 || pkg?.id !== 'diagnostic-case-lab-v1' || pkg?.route !== '/learn/diagnostic-cases/' || pkg?.slug !== 'diagnostic-cases') {
    throw new Error('Invalid Diagnostic Case Lab V1 identity.');
  }
  if (!pkg.learningOutcome || !pkg.evidenceBoundary) throw new Error('Diagnostic Case Lab requires learning outcome and evidence boundary.');
  if (!Array.isArray(pkg.sourceRefs) || pkg.sourceRefs.length < 7) throw new Error('Diagnostic Case Lab requires at least 7 source references.');
  if (!Array.isArray(pkg.cases) || pkg.cases.length !== 12) throw new Error(`Expected exactly 12 diagnostic cases; found ${pkg?.cases?.length || 0}.`);
  if (!Array.isArray(pkg.decisionTrees) || pkg.decisionTrees.length !== 6) throw new Error(`Expected exactly 6 decision trees; found ${pkg?.decisionTrees?.length || 0}.`);
  const sourceIds = new Set(pkg.sourceRefs.map((s) => s.id));
  const caseIds = new Set();
  const treeIds = new Set();
  let differentials = 0;
  let evidencePoints = 0;
  let decisionNodes = 0;
  for (const c of pkg.cases) {
    if (!c.id || caseIds.has(c.id)) throw new Error(`Duplicate/missing case id ${c.id}.`);
    caseIds.add(c.id);
    for (const field of ['title','difficulty','category','presenting','interpretation','why','action','verify']) if (!c[field]) throw new Error(`${c.id}: missing ${field}.`);
    if (!Array.isArray(c.evidence) || c.evidence.length < 4) throw new Error(`${c.id}: needs at least four evidence points.`);
    if (!Array.isArray(c.differential) || c.differential.length < 3) throw new Error(`${c.id}: needs at least three competing causes.`);
    if (!Array.isArray(c.sourceIds) || !c.sourceIds.length) throw new Error(`${c.id}: sourceIds required.`);
    for (const sid of c.sourceIds) if (!sourceIds.has(sid)) throw new Error(`${c.id}: unknown source ${sid}.`);
    for (const d of c.differential) if (!d.cause || !d.weight || !d.reason) throw new Error(`${c.id}: incomplete differential.`);
    evidencePoints += c.evidence.length;
    differentials += c.differential.length;
  }
  for (const tree of pkg.decisionTrees) {
    if (!tree.id || treeIds.has(tree.id)) throw new Error(`Duplicate/missing tree id ${tree.id}.`);
    treeIds.add(tree.id);
    if (!tree.title || !tree.start || !Array.isArray(tree.nodes) || tree.nodes.length !== 5) throw new Error(`${tree.id}: expected title, start and exactly five nodes.`);
    const nodeIds = new Set();
    for (const node of tree.nodes) {
      if (!node.id || nodeIds.has(node.id) || !node.question || !node.yes || !node.no) throw new Error(`${tree.id}: invalid decision node.`);
      nodeIds.add(node.id);
      decisionNodes += 1;
    }
    if (!nodeIds.has(tree.start)) throw new Error(`${tree.id}: start node does not exist.`);
  }
  if (!Array.isArray(pkg.supportRoutes) || pkg.supportRoutes.length < 8) throw new Error('Support routes are incomplete.');
  const text = JSON.stringify(pkg);
  const forbiddenPositiveClaims = [/guaranteed\s+yield/i,/always\s+spray/i,/amber\s*=\s*couchlock/i,/one\s+photo\s+proves/i,/fixed\s+safe\s+pollen\s+distance/i];
  for (const re of forbiddenPositiveClaims) if (re.test(text)) throw new Error(`Unsupported positive claim found: ${re}`);
  return { cases: pkg.cases.length, trees: pkg.decisionTrees.length, decisionNodes, evidencePoints, differentials, sources: pkg.sourceRefs.length };
}

const totals = validate(data);
if (validateOnly) {
  console.log(JSON.stringify({ valid: true, id: data.id, route: data.route, ...totals }, null, 2));
  process.exit(0);
}
if (!apply) throw new Error('Set APPLY_DIAGNOSTIC_CASE_LAB_V1=true for production publication.');
if (!user || !pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required.');

const auth = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
async function request(path, options = {}) {
  let last;
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      const response = await fetch(`${site}${path}`, {
        ...options,
        redirect: 'follow',
        signal: AbortSignal.timeout(60_000),
        headers: {
          Authorization: auth,
          Accept: 'application/json',
          'User-Agent': 'DTFSeeds-Diagnostic-Case-Lab-V1/1.0',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...(options.headers || {})
        }
      });
      const text = await response.text();
      let body = text;
      try { body = text ? JSON.parse(text) : null; } catch {}
      if ((response.status === 429 || response.status >= 500) && attempt < 8) { await sleep(attempt * 1500); continue; }
      if (!response.ok) throw new Error(`${options.method || 'GET'} ${path} failed (${response.status}): ${typeof body === 'string' ? body.slice(0, 650) : JSON.stringify(body).slice(0, 650)}`);
      return body;
    } catch (error) {
      last = error;
      if (attempt < 8) await sleep(attempt * 1500);
    }
  }
  throw last;
}

async function rowsBySlug(slug) {
  const rows = await request(`/wp-json/wp/v2/pages?slug=${encodeURIComponent(slug)}&context=edit&per_page=100`);
  return Array.isArray(rows) ? rows : [];
}

function badgeClass(weight = '') {
  const w = weight.toLowerCase();
  if (w.includes('higher')) return 'high';
  if (w.includes('lower')) return 'low';
  return 'mid';
}

function renderCase(c) {
  return `<article class="dcl-case" data-dcl-case="${esc(c.id)}">
    <div class="dcl-case-head"><div><span class="dcl-id">${esc(c.id)}</span><span class="dcl-difficulty">${esc(c.difficulty)}</span></div><span class="dcl-category">${esc(c.category)}</span></div>
    <h3>${esc(c.title)}</h3><p class="dcl-presenting">${esc(c.presenting)}</p>
    <div class="dcl-evidence"><strong>Evidence available</strong><ul>${c.evidence.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
    <details class="dcl-reveal"><summary>Reveal the differential and best-supported interpretation</summary>
      <div class="dcl-differentials">${c.differential.map((d) => `<div class="dcl-diff"><span class="dcl-weight ${badgeClass(d.weight)}">${esc(d.weight)}</span><h4>${esc(d.cause)}</h4><p>${esc(d.reason)}</p></div>`).join('')}</div>
      <div class="dcl-answer"><h4>Best-supported interpretation</h4><p>${esc(c.interpretation)}</p><p><strong>Why:</strong> ${esc(c.why)}</p></div>
      <div class="dcl-next"><div><h4>Next justified action</h4><p>${esc(c.action)}</p></div><div><h4>Verify afterward</h4><p>${esc(c.verify)}</p></div></div>
      <div class="dcl-links">${(c.relatedRoutes || []).map((r) => `<a href="${esc(r)}">Open related subject →</a>`).join('')}</div>
    </details>
  </article>`;
}

function renderTree(tree) {
  return `<article class="dcl-tree" data-dcl-tree="${esc(tree.id)}"><div class="dcl-tree-title"><span>${esc(tree.id)}</span><h3>${esc(tree.title)}</h3></div><div class="dcl-nodes">${tree.nodes.map((n, i) => `<div class="dcl-node"><b>${i + 1}</b><div><h4>${esc(n.question)}</h4><p><strong>Yes:</strong> ${esc(n.yes)}</p><p><strong>No:</strong> ${esc(n.no)}</p></div></div>${i < tree.nodes.length - 1 ? '<div class="dcl-arrow">↓</div>' : ''}`).join('')}</div></article>`;
}

function renderPage() {
  const css = `<style id="dtf-diagnostic-case-lab-v1-style">
  .dcl{--ink:#102d1a;--muted:#53675a;--deep:#071b10;--green:#176d39;--gold:#d7b95f;--cream:#f8f5eb;--soft:#edf3ec;--line:#d4e1d6;background:var(--cream);color:var(--ink)}.dcl *{box-sizing:border-box}.dcl .wrap{width:min(1180px,calc(100% - 34px));margin:auto}.dcl .hero{padding:72px 0 60px;background:radial-gradient(circle at 82% 10%,rgba(215,185,95,.22),transparent 31%),linear-gradient(145deg,var(--deep),#103b23);color:#fff}.dcl .kicker{margin:0 0 10px;color:var(--gold);font-size:.76rem;font-weight:900;letter-spacing:.13em;text-transform:uppercase}.dcl h1{margin:0;font-size:clamp(2.8rem,6vw,5.3rem);line-height:.95;letter-spacing:-.055em}.dcl .lede{max-width:850px;color:#d5e4da;font-size:1.08rem;line-height:1.72}.dcl .stats{display:flex;gap:10px;flex-wrap:wrap;margin-top:25px}.dcl .stat{padding:10px 14px;border:1px solid rgba(255,255,255,.22);border-radius:999px;font-weight:900}.dcl .actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:23px}.dcl .btn{display:inline-flex;padding:10px 16px;border-radius:999px;text-decoration:none!important;font-weight:900}.dcl .primary{background:var(--gold);color:var(--deep)!important}.dcl .secondary{border:1px solid rgba(255,255,255,.28);color:#fff!important}.dcl .section{padding:64px 0}.dcl .soft{background:var(--soft)}.dcl .heading{display:flex;justify-content:space-between;align-items:end;gap:28px;margin-bottom:26px}.dcl .heading h2{margin:0;font-size:clamp(2rem,4vw,3.3rem);line-height:1.02;letter-spacing:-.04em}.dcl .heading p{max-width:560px;margin:0;color:var(--muted);line-height:1.65}.dcl .rules{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.dcl .rule{background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px}.dcl .rule b{display:grid;place-items:center;width:36px;height:36px;border-radius:11px;background:#e8efe8;color:var(--green);margin-bottom:10px}.dcl .rule h3{margin:0 0 7px}.dcl .rule p{margin:0;color:var(--muted);line-height:1.58}.dcl .case-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.dcl-case{background:#fff;border:1px solid var(--line);border-radius:22px;padding:22px;box-shadow:0 10px 28px rgba(16,48,28,.055)}.dcl-case-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.dcl-id,.dcl-difficulty,.dcl-category{display:inline-block;padding:5px 9px;border-radius:999px;font-size:.72rem;font-weight:900}.dcl-id{background:#102d1a;color:#fff}.dcl-difficulty{background:#edf3ec;margin-left:6px}.dcl-category{background:#f6efd8;color:#6a5615}.dcl-case h3{font-size:1.38rem;margin:14px 0 8px}.dcl-presenting{color:var(--muted);line-height:1.65}.dcl-evidence{background:#f3f6f1;border-radius:15px;padding:15px;margin:15px 0}.dcl-evidence ul{margin:8px 0 0;padding-left:18px;color:var(--muted);line-height:1.55}.dcl-reveal{border-top:1px solid var(--line);padding-top:13px}.dcl-reveal summary{cursor:pointer;color:var(--green);font-weight:900}.dcl-differentials{display:grid;gap:10px;margin-top:16px}.dcl-diff{position:relative;border:1px solid var(--line);border-radius:14px;padding:14px}.dcl-diff h4{margin:0 0 5px;padding-right:85px}.dcl-diff p{margin:0;color:var(--muted);line-height:1.55}.dcl-weight{position:absolute;right:12px;top:12px;padding:4px 7px;border-radius:999px;font-size:.68rem;font-weight:900}.dcl-weight.high{background:#dff0df;color:#176d39}.dcl-weight.mid{background:#f6efd8;color:#6a5615}.dcl-weight.low{background:#f2e6e3;color:#7a382e}.dcl-answer{margin-top:14px;padding:16px;border-radius:15px;background:#0d2a19;color:#fff}.dcl-answer h4{margin:0 0 7px}.dcl-answer p{margin:6px 0;color:#d5e1d8;line-height:1.58}.dcl-next{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.dcl-next>div{padding:14px;border-radius:14px;background:#f3f6f1}.dcl-next h4{margin:0 0 6px}.dcl-next p{margin:0;color:var(--muted);line-height:1.55}.dcl-links{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}.dcl-links a{font-weight:900;color:var(--green)!important;text-decoration:none!important}.dcl .tree-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.dcl-tree{background:#fff;border:1px solid var(--line);border-radius:22px;padding:22px}.dcl-tree-title span{font-size:.72rem;font-weight:900;color:var(--green)}.dcl-tree-title h3{margin:4px 0 16px;font-size:1.4rem}.dcl-node{display:grid;grid-template-columns:38px 1fr;gap:11px;padding:13px;border-radius:15px;background:#f3f6f1}.dcl-node>b{display:grid;place-items:center;width:34px;height:34px;border-radius:10px;background:var(--green);color:#fff}.dcl-node h4{margin:0 0 6px}.dcl-node p{margin:4px 0;color:var(--muted);line-height:1.5}.dcl-arrow{text-align:center;color:var(--green);font-size:1.3rem;font-weight:900;padding:2px}.dcl .sources{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.dcl .source{background:#fff;border:1px solid var(--line);border-radius:17px;padding:18px}.dcl .source h3{margin:0 0 6px;font-size:1.02rem}.dcl .source p{margin:6px 0;color:var(--muted);line-height:1.55}.dcl .source a{color:var(--green)!important;font-weight:900;text-decoration:none!important}.dcl .boundary{padding:28px;border-radius:24px;background:#0d2a19;color:#fff}.dcl .boundary h2{margin:0 0 8px}.dcl .boundary p{color:#d4e2d8;line-height:1.65;max-width:880px}@media(max-width:980px){.dcl .case-grid,.dcl .tree-grid,.dcl .sources{grid-template-columns:1fr}.dcl .rules{grid-template-columns:repeat(2,minmax(0,1fr))}.dcl .heading{align-items:flex-start;flex-direction:column}}@media(max-width:650px){.dcl .wrap{width:min(100% - 26px,1180px)}.dcl .hero{padding:52px 0 44px}.dcl .section{padding:48px 0}.dcl .rules,.dcl-next{grid-template-columns:1fr}.dcl .actions .btn{width:100%;justify-content:center}}
  </style>`;
  const rules = [
    ['Describe first','Name the organ, color, shape, distribution and progression before assigning a cause.'],
    ['Compare causes','Keep at least two plausible alternatives alive until evidence separates them.'],
    ['Measure next','Choose measurements that can change the ranking of the differential.'],
    ['Verify change','Judge success from new growth, incidence, counts or measurements—not hope.']
  ];
  const sources = data.sourceRefs.map((s) => `<article class="source"><h3>${esc(s.id)} · ${esc(s.citation)}</h3><p>${esc(s.supports)}</p>${s.pmcid ? `<a href="https://pmc.ncbi.nlm.nih.gov/articles/${esc(s.pmcid)}/" target="_blank" rel="noopener noreferrer">Open source →</a>` : ''}</article>`).join('');
  return `${css}<main class="dcl" data-dtf-diagnostic-case-lab-v1="true">
    <section class="hero"><div class="wrap"><p class="kicker">Teaching Healthy Cultivation · Diagnostic Case Lab</p><h1>${esc(data.title)}</h1><p class="lede">${esc(data.learningOutcome)}</p><div class="stats"><span class="stat">12 worked cases</span><span class="stat">6 decision trees</span><span class="stat">30 decision nodes</span><span class="stat">7 evidence sources</span></div><div class="actions"><a class="btn primary" href="#cases">Start a case</a><a class="btn secondary" href="/learn/diagnostics/">Open Diagnostic Index</a><a class="btn secondary" href="/thc-grow-doc/">Open Grow Doc</a></div></div></section>
    <section class="section"><div class="wrap"><div class="heading"><div><p class="kicker">Diagnostic method</p><h2>Reason before you treat.</h2></div><p>${esc(data.evidenceBoundary)}</p></div><div class="rules">${rules.map((r, i) => `<article class="rule"><b>${i + 1}</b><h3>${esc(r[0])}</h3><p>${esc(r[1])}</p></article>`).join('')}</div></div></section>
    <section class="section soft" id="cases"><div class="wrap"><div class="heading"><div><p class="kicker">Worked cases</p><h2>Try the diagnosis before revealing the answer.</h2></div><p>Each case includes enough evidence to rank explanations, but several intentionally stop short of species-level or laboratory certainty.</p></div><div class="case-grid">${data.cases.map(renderCase).join('')}</div></div></section>
    <section class="section"><div class="wrap"><div class="heading"><div><p class="kicker">Decision trees</p><h2>Use symptom patterns to choose the next useful observation.</h2></div><p>The trees are investigation guides, not automatic diagnoses. Branches tell you what evidence to collect next.</p></div><div class="tree-grid">${data.decisionTrees.map(renderTree).join('')}</div></div></section>
    <section class="section soft"><div class="wrap"><div class="boundary"><p class="kicker">Evidence boundary</p><h2>A close-up photo is not a laboratory result.</h2><p>${esc(data.evidenceBoundary)}</p><div class="actions"><a class="btn primary" href="/learn/research-methods/">Study Evidence & Measurement</a><a class="btn secondary" href="/learn/records/">Open Grow Records</a></div></div></div></section>
    <section class="section"><div class="wrap"><div class="heading"><div><p class="kicker">Research base</p><h2>Sources behind the case logic.</h2></div><p>These references support the biological and diagnostic distinctions used in this first case wave. They do not turn the cases into universal thresholds.</p></div><div class="sources">${sources}</div></div></section>
  </main>`;
}

function integrationBlock() {
  return `<!-- DTF-DIAGNOSTIC-CASE-LAB-LINK-V1:START --><style id="dtf-diagnostic-case-lab-link-v1-style">.dx5 .dcl-entry{margin-top:24px;padding:24px;border-radius:22px;background:linear-gradient(135deg,#102d1a,#176d39);color:#fff}.dx5 .dcl-entry h3{margin:0 0 8px;font-size:1.55rem}.dx5 .dcl-entry p{margin:0;color:#d9e6dd;line-height:1.6;max-width:780px}.dx5 .dcl-entry a{display:inline-block;margin-top:13px;padding:10px 15px;border-radius:999px;background:#d7b95f;color:#071b10!important;text-decoration:none!important;font-weight:900}</style><section class="dcl-entry" data-dtf-diagnostic-cases-link-v1="true"><h3>Practice with worked diagnostic cases</h3><p>Use 12 evidence-backed cases and 6 decision trees to compare look-alike causes before revealing the best-supported interpretation.</p><a href="/learn/diagnostic-cases/">Open Diagnostic Case Lab →</a></section><!-- DTF-DIAGNOSTIC-CASE-LAB-LINK-V1:END -->`;
}

function addOrReplaceIntegration(raw) {
  const block = integrationBlock();
  const re = /<!-- DTF-DIAGNOSTIC-CASE-LAB-LINK-V1:START -->[\s\S]*?<!-- DTF-DIAGNOSTIC-CASE-LAB-LINK-V1:END -->/;
  if (re.test(raw)) return raw.replace(re, block);
  const pos = raw.lastIndexOf('</main>');
  if (pos >= 0) return `${raw.slice(0, pos)}${block}${raw.slice(pos)}`;
  return `${raw}\n${block}`;
}

const learnRows = await rowsBySlug('learn');
if (learnRows.length !== 1) throw new Error(`Expected exactly one Learn parent; found ${learnRows.length}.`);
const learn = learnRows[0];
const diagnosticsRows = (await rowsBySlug('diagnostics')).filter((p) => Number(p.parent) === Number(learn.id));
if (diagnosticsRows.length !== 1) throw new Error(`Expected exactly one /learn/diagnostics/ child page; found ${diagnosticsRows.length}.`);
const diagnostics = diagnosticsRows[0];
const diagnosticsRaw = rendered(diagnostics.content);
if (!diagnosticsRaw.includes('data-dtf-diagnostic-index-v5="true"')) throw new Error('Existing diagnostics page is not owned by Diagnostic Index V5; refusing integration write.');

const caseRows = (await rowsBySlug(data.slug)).filter((p) => Number(p.parent) === Number(learn.id));
if (caseRows.length > 1) throw new Error(`Multiple /learn/${data.slug}/ children exist; refusing ambiguous write.`);
const existing = caseRows[0] || null;
const plannedCaseContent = renderPage();
const plannedDiagnosticsContent = addOrReplaceIntegration(diagnosticsRaw);
const stamp = new Date().toISOString().replace(/[-:.]/g, '');
const backupDir = join(backupRoot, `diagnostic-case-lab-v1-${stamp}`);
await mkdir(backupDir, { recursive: true });
await writeFile(join(backupDir, `diagnostics-${diagnostics.id}-before.html`), diagnosticsRaw);
await writeFile(join(backupDir, 'diagnostics-planned.html'), plannedDiagnosticsContent);
await writeFile(join(backupDir, 'case-lab-planned.html'), plannedCaseContent);
if (existing) await writeFile(join(backupDir, `case-lab-${existing.id}-before.html`), rendered(existing.content));

let casePage = existing;
let caseCreated = false;
let diagnosticsTouched = false;
let caseTouched = false;
try {
  const updatedDiagnostics = await request(`/wp-json/wp/v2/pages/${diagnostics.id}`, { method: 'POST', body: JSON.stringify({ content: plannedDiagnosticsContent, status: 'publish' }) });
  diagnosticsTouched = true;
  if (!rendered(updatedDiagnostics.content).includes('data-dtf-diagnostic-cases-link-v1="true"')) throw new Error('Diagnostics integration REST verification failed.');

  if (casePage) {
    casePage = await request(`/wp-json/wp/v2/pages/${casePage.id}`, { method: 'POST', body: JSON.stringify({ title: data.title, slug: data.slug, parent: learn.id, content: plannedCaseContent, status: 'publish' }) });
  } else {
    casePage = await request('/wp-json/wp/v2/pages', { method: 'POST', body: JSON.stringify({ title: data.title, slug: data.slug, parent: learn.id, content: plannedCaseContent, status: 'publish' }) });
    caseCreated = true;
  }
  caseTouched = true;
  const restCase = rendered(casePage.content);
  if (!restCase.includes('data-dtf-diagnostic-case-lab-v1="true"')) throw new Error('Case Lab marker missing after REST write.');
  if ((restCase.match(/data-dcl-case=/g) || []).length !== totals.cases) throw new Error('Case count mismatch after REST write.');
  if ((restCase.match(/data-dcl-tree=/g) || []).length !== totals.trees) throw new Error('Tree count mismatch after REST write.');
  if ((restCase.match(/class="dcl-node"/g) || []).length !== totals.decisionNodes) throw new Error('Decision-node count mismatch after REST write.');

  const freshDiagnostics = (await rowsBySlug('diagnostics')).filter((p) => Number(p.parent) === Number(learn.id))[0];
  const freshCase = (await rowsBySlug(data.slug)).filter((p) => Number(p.parent) === Number(learn.id))[0];
  if (!freshDiagnostics || !rendered(freshDiagnostics.content).includes('data-dtf-diagnostic-cases-link-v1="true"')) throw new Error('Fresh diagnostics REST verification failed.');
  if (!freshCase || !rendered(freshCase.content).includes('data-dtf-diagnostic-case-lab-v1="true"')) throw new Error('Fresh case page REST verification failed.');
} catch (error) {
  if (caseTouched && casePage?.id) {
    if (caseCreated) {
      try { await request(`/wp-json/wp/v2/pages/${casePage.id}?force=true`, { method: 'DELETE' }); } catch (rollbackError) { console.error(`Case page delete rollback failed: ${rollbackError.message}`); }
    } else if (existing) {
      try { await request(`/wp-json/wp/v2/pages/${existing.id}`, { method: 'POST', body: JSON.stringify({ title: existing.title?.raw || existing.title?.rendered, slug: existing.slug, parent: existing.parent, content: rendered(existing.content), status: existing.status || 'publish' }) }); } catch (rollbackError) { console.error(`Case page rollback failed: ${rollbackError.message}`); }
    }
  }
  if (diagnosticsTouched) {
    try { await request(`/wp-json/wp/v2/pages/${diagnostics.id}`, { method: 'POST', body: JSON.stringify({ content: diagnosticsRaw, status: diagnostics.status || 'publish' }) }); } catch (rollbackError) { console.error(`Diagnostics rollback failed: ${rollbackError.message}`); }
  }
  throw error;
}

const report = {
  generatedAt: new Date().toISOString(),
  route: data.route,
  casePageId: casePage.id,
  casePageAction: caseCreated ? 'created' : 'updated',
  diagnosticsPageId: diagnostics.id,
  cases: totals.cases,
  trees: totals.trees,
  decisionNodes: totals.decisionNodes,
  evidencePoints: totals.evidencePoints,
  differentials: totals.differentials,
  sources: totals.sources
};
await writeFile(join(backupDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ success: true, backupDir, ...report }, null, 2));

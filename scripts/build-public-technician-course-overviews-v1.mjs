import { readFile, writeFile } from 'node:fs/promises';

const catalogPath = 'site/wordpress/education/course-catalog-v4.json';
const publisherPath = 'scripts/publish-wordpress-certification-catalog-v4.mjs';
const workflowPath = '.github/workflows/wordpress-certification-catalog-v4.yml';
const ownershipPath = 'docs/DTFSEEDS_PRODUCTION_OWNERSHIP.md';
const sourceRevision = '895e042d3708aac0bd75f7c24b62e42b793a6390';
const sourceRepo = 'dtfgenetics/Thc-learning-courses-';

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const slugs = {
  'COURSE-LH-TECH1-002':'technician-i-course-2-plant-observation-growth-stages-crop-records',
  'COURSE-LH-TECH1-003':'technician-i-course-3-environmental-light-sensor-fundamentals',
  'COURSE-LH-TECH1-004':'technician-i-course-4-water-root-zone-nutrition-irrigation',
  'COURSE-LH-TECH1-005':'technician-i-course-5-propagation-canopy-ipm-crop-care',
  'COURSE-LH-TECH1-006':'technician-i-course-6-harvest-postharvest-traceability-handoff',
  'COURSE-LH-TECH1-007':'technician-i-course-7-integrated-practice-lab',
  'COURSE-LH-TECH2-001':'technician-ii-course-1-advanced-crop-observation-diagnostic-reasoning',
  'COURSE-LH-TECH2-002':'technician-ii-course-2-environmental-data-sensors-equipment-response',
  'COURSE-LH-TECH2-003':'technician-ii-course-3-fertigation-root-zone-interpretation',
  'COURSE-LH-TECH2-004':'technician-ii-course-4-plant-health-ipm-biosecurity-troubleshooting',
  'COURSE-LH-TECH2-005':'technician-ii-course-5-propagation-canopy-performance-troubleshooting',
  'COURSE-LH-TECH2-006':'technician-ii-course-6-postharvest-deviations-quality-response',
  'COURSE-LH-TECH2-007':'technician-ii-course-7-traceability-metrics-shift-coordination',
  'COURSE-LH-TECH2-008':'technician-ii-course-8-integrated-simulation-lab'
};
const performance = {
  'COURSE-LH-TECH1-002':'Practical A — crop observation and records',
  'COURSE-LH-TECH1-003':'Environmental/light/sensor performance validation gate',
  'COURSE-LH-TECH1-004':'Practical B — water/root-zone/irrigation execution',
  'COURSE-LH-TECH1-005':'Practicals C–E — propagation, canopy/crop care and IPM scouting',
  'COURSE-LH-TECH1-006':'Practical F — harvest-to-dry-room handoff',
  'COURSE-LH-TECH1-007':'Practicals A–F plus the integrated Technician I shift capstone',
  'COURSE-LH-TECH2-001':'Practical A — crop diagnostic workup',
  'COURSE-LH-TECH2-002':'Practical B — sensor and equipment verification',
  'COURSE-LH-TECH2-003':'Practical C — fertigation and root-zone troubleshooting',
  'COURSE-LH-TECH2-004':'Practical D — IPM trend and treatment follow-up',
  'COURSE-LH-TECH2-005':'Practical E — propagation and canopy performance review',
  'COURSE-LH-TECH2-006':'Practical F — postharvest deviation and lot scope',
  'COURSE-LH-TECH2-007':'Practical G — traceability, metrics and shift coordination',
  'COURSE-LH-TECH2-008':'Practicals A–G plus the Senior Technician Diagnostic Shift capstone'
};
const releaseNotes = {
  TECH1:'Human technical review, rendered accessibility review, mapped performance validation and applicable pilot/release evidence remain required before the academic course page is released.',
  TECH2:'Human technical/assessment/accessibility review, Technician II performance validation, pilot evidence and program release evidence remain required before the academic course page is released.'
};

for (const course of catalog.courses) {
  if (course.publicLessonReleaseAvailable === true) continue;
  const slug = slugs[course.id];
  if (!slug) throw new Error(`Missing overview slug for ${course.id}`);
  const encodedId = encodeURIComponent(course.id);
  course.overviewSlug = slug;
  course.overviewHref = `/courses/${slug}/`;
  course.performanceEvidence = performance[course.id] || 'Mapped performance evidence remains in development.';
  course.releaseRequirements = course.id.includes('TECH2') ? releaseNotes.TECH2 : releaseNotes.TECH1;
  course.sourceRevision = sourceRevision;
  course.sourceDefinitionUrl = `https://github.com/${sourceRepo}/blob/${sourceRevision}/content/courses/${encodedId}.json`;
  course.downloadDefinitionUrl = `https://raw.githubusercontent.com/${sourceRepo}/${sourceRevision}/content/courses/${encodedId}.json`;
}
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

let publisher = await readFile(publisherPath, 'utf8');
const pendingValidation = "must(data.courses.every(course => course.publicLessonReleaseAvailable === true || !course.href), 'Unreleased courses must not publish a live course href.');";
const overviewValidation = `${pendingValidation}\nconst pendingCourses = data.courses.filter(course => course.publicLessonReleaseAvailable !== true);\nmust(pendingCourses.length === 14, \`Expected 14 visible pending course overviews, found \${pendingCourses.length}.\`);\nmust(pendingCourses.every(course => course.overviewSlug && course.overviewHref && course.sourceDefinitionUrl && course.downloadDefinitionUrl && course.performanceEvidence && course.releaseRequirements), 'Every pending course requires overview routing, source/download links, performance evidence and release requirements.');\nmust(new Set(pendingCourses.map(course => course.overviewSlug)).size === 14, 'Pending course overview slugs must be unique.');`;
if (!publisher.includes(pendingValidation)) throw new Error('Could not locate pending-course validation contract.');
publisher = publisher.replace(pendingValidation, overviewValidation);

const oldOpenAction = "const openAction = course.href && course.publicLessonReleaseAvailable === true\n    ? `<div class=\"dc4-actions\"><a class=\"dc4-btn\" data-course-open=\"true\" href=\"${esc(course.href)}\">Open Course ${esc(course.number)}</a></div>`\n    : `<p class=\"dc4-meta\" data-course-open=\"false\"><strong>Public release:</strong> ${esc(course.availabilityNote || 'Curriculum is visible, but the public academic page is not released yet.')}</p>`;";
const newOpenAction = "const openAction = course.href && course.publicLessonReleaseAvailable === true\n    ? `<div class=\"dc4-actions\"><a class=\"dc4-btn\" data-course-open=\"true\" href=\"${esc(course.href)}\">Open Course ${esc(course.number)}</a></div>`\n    : `<p class=\"dc4-meta\" data-course-open=\"false\"><strong>Public release:</strong> ${esc(course.availabilityNote || 'Curriculum is visible, but the public academic page is not released yet.')}</p><div class=\"dc4-actions\"><a class=\"dc4-btn\" data-course-overview-link=\"true\" href=\"${esc(course.overviewHref)}\">View development overview</a></div>`;";
if (!publisher.includes(oldOpenAction)) throw new Error('Could not locate course card action renderer.');
publisher = publisher.replace(oldOpenAction, newOpenAction);

const surfacesMarker = "const surfaces = data.learningSurfaces.map";
const surfacesAt = publisher.indexOf(surfacesMarker);
if (surfacesAt < 0) throw new Error('Could not locate learning-surface renderer.');
const overviewHelpers = `const overviewCss = \`<style id="dtf-course-overview-v1-style">.dtf-course-overview-v1{--ink:#17271c;--muted:#5d6b61;--deep:#0d2c1a;--green:#1f6f3d;--paper:#fff;--soft:#f4f7f2;--line:#d7e2d8;background:linear-gradient(180deg,#f8f6ef,#f2f6f1);color:var(--ink);padding:34px 0 70px}.dco-wrap{width:min(980px,calc(100% - 28px));margin:auto}.dco-hero{padding:clamp(26px,5vw,52px);border-radius:22px;background:linear-gradient(135deg,#0b2417,#17452b);color:#fff}.dco-kicker{font-size:.76rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:#a9dfaf}.dco-hero h1{margin:.2em 0;font-size:clamp(2rem,5vw,4rem);line-height:1.02}.dco-hero p{color:#deebe1;line-height:1.7}.dco-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:18px}.dco-panel{padding:22px;border:1px solid var(--line);border-radius:16px;background:var(--paper)}.dco-panel h2{margin-top:0}.dco-panel p,.dco-panel li{color:var(--muted);line-height:1.65}.dco-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:9px}.dco-metric{padding:12px;border-radius:10px;background:var(--soft);border:1px solid var(--line)}.dco-metric strong{display:block;color:var(--green);font-size:1.2rem}.dco-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}.dco-btn{display:inline-flex;align-items:center;min-height:44px;padding:10px 15px;border-radius:9px;background:var(--green);color:#fff!important;text-decoration:none!important;font-weight:850}.dco-btn.secondary{background:#fff;color:var(--green)!important;border:1px solid var(--green)}.dco-boundary{margin-top:18px;padding:16px;border-left:5px solid #c7a24b;border-radius:10px;background:#fff8e7;color:#554b2c;line-height:1.6}@media(max-width:720px){.dco-grid{grid-template-columns:1fr}.dco-actions{display:grid}.dco-btn{width:100%;justify-content:center}}</style>\`;
const renderOverview = course => \`${'${overviewCss}'}<main class="dtf-course-overview-v1" data-dtf-course-development-overview="v1" data-course-id="${'${esc(course.id)}'}"><div class="dco-wrap"><section class="dco-hero"><span class="dco-kicker">Development overview · curriculum built</span><h1>${'${esc(course.pathLabel)}'} — Course ${'${esc(course.number)}'}<br>${'${esc(course.title)}'}</h1><p>${'${esc(course.summary)}'}</p><div class="dco-actions"><a class="dco-btn" href="/courses/">Back to Courses</a><a class="dco-btn secondary" href="${'${esc(course.sourceDefinitionUrl)}'}">View source definition</a><a class="dco-btn secondary" href="${'${esc(course.downloadDefinitionUrl)}'}" download>Download course JSON</a></div></section><section class="dco-grid"><article class="dco-panel"><h2>What is built</h2><div class="dco-metrics">${'${(course.metrics || []).map(metric => `<div class="dco-metric"><strong>${esc(metric.value)}</strong><span>${esc(metric.label)}</span></div>`).join(\'\')}'}</div><p><strong>Performance evidence:</strong> ${'${esc(course.performanceEvidence)}'}</p></article><article class="dco-panel"><h2>Public release status</h2><p>${'${esc(course.availabilityNote || \'Curriculum is built; public lesson release remains pending review.\')}'}</p><p>${'${esc(course.releaseRequirements)}'}</p></article></section><section class="dco-panel" style="margin-top:14px"><h2>Scope</h2><p>${'${esc(course.summary)}'}</p><p><strong>Source revision:</strong> <code>${'${esc(course.sourceRevision)}'}</code></p></section><div class="dco-boundary"><strong>Important:</strong> This page is a public development overview, not a released academic lesson tree and not credential evidence. Course learning assessments and professional credential examinations are separate systems; secure operational credential forms and answer keys are not published here.</div></div></main>\`;
const overviewPages = pendingCourses.map(course => ({ course, content: renderOverview(course) }));
`;
publisher = publisher.slice(0, surfacesAt) + overviewHelpers + publisher.slice(surfacesAt);

const validateMarker = "must((content.match(/data-course-open=\\\"true\\\"/g) || []).length === 1, 'Rendered catalog must expose exactly one currently released academic course link.');";
const validateExtra = `${validateMarker}\n  must((content.match(/data-course-overview-link=\\\"true\\\"/g) || []).length === 14, 'Rendered catalog must expose 14 development overview links.');\n  must(overviewPages.length === 14, 'Exactly 14 public development overview pages are required.');\n  for (const { course, content: overview } of overviewPages) {\n    must(overview.includes('data-dtf-course-development-overview=\"v1\"'), \`Overview marker missing for \${course.id}.\`);\n    must(overview.includes(course.id), \`Course ID missing from overview for \${course.id}.\`);\n    must(overview.includes(course.downloadDefinitionUrl), \`Download link missing from overview for \${course.id}.\`);\n  }`;
if (!publisher.includes(validateMarker)) throw new Error('Could not locate validate-only open-course assertion.');
publisher = publisher.replace(validateMarker, validateExtra);

const pageWriteMarker = "const readback = await wp(`pages/${page.id}?context=edit`);";
const overviewPublish = `const overviewResults = [];\nfor (const { course, content: overviewContent } of overviewPages) {\n  const existingOverviewRows = await wp(\`pages?slug=\${encodeURIComponent(course.overviewSlug)}&parent=\${page.id}&context=edit&per_page=100\`);\n  const existingOverview = existingOverviewRows[0] || null;\n  if (existingOverview) await writeFile(join(backupDir, \`overview-\${course.id}-before.html\`), rendered(existingOverview.content));\n  const overviewPayload = JSON.stringify({ slug: course.overviewSlug, title: \`${'${course.pathLabel}'} — Course ${'${course.number}'}: ${'${course.title}'} — Development Overview\`, status: 'publish', parent: page.id, content: overviewContent });\n  const written = existingOverview ? await wp(\`pages/\${existingOverview.id}\`, { method: 'POST', body: overviewPayload }) : await wp('pages', { method: 'POST', body: overviewPayload });\n  const overviewReadback = await wp(\`pages/\${written.id}?context=edit\`);\n  const overviewHtml = rendered(overviewReadback.content);\n  must(overviewReadback.status === 'publish', \`Overview page is not published for \${course.id}.\`);\n  must(overviewHtml.includes('data-dtf-course-development-overview="v1"'), \`Overview marker missing after write for \${course.id}.\`);\n  must(overviewHtml.includes(\`data-course-id="\${course.id}"\`), \`Course ID missing after overview write for \${course.id}.\`);\n  must(overviewHtml.includes(course.downloadDefinitionUrl), \`Course download link missing after overview write for \${course.id}.\`);\n  overviewResults.push({ id: course.id, pageId: written.id, href: course.overviewHref });\n}\n\n${pageWriteMarker}`;
if (!publisher.includes(pageWriteMarker)) throw new Error('Could not locate Courses readback marker.');
publisher = publisher.replace(pageWriteMarker, overviewPublish);

const readbackCourseCount = "must((html.match(/data-course-id=/g) || []).length === 15, 'WordPress readback does not contain all 15 Technician I/II course cards.');";
const readbackOverviewCount = `${readbackCourseCount}\nmust((html.match(/data-course-overview-link=\"true\"/g) || []).length === 14, 'WordPress readback does not contain 14 development overview links.');\nmust(overviewResults.length === 14, 'WordPress did not publish all 14 development overview pages.');`;
if (!publisher.includes(readbackCourseCount)) throw new Error('Could not locate WordPress course-card count assertion.');
publisher = publisher.replace(readbackCourseCount, readbackOverviewCount);

const reportLine = "const report = { result: 'success', version: 4, pageId: page.id, credentialOfferings: offerings.length, visibleTechnicianCourses: data.courses.length, publicAcademicPages: data.courses.filter(course => course.publicLessonReleaseAvailable === true).length, bytes: html.length, backupDir };";
const reportNew = "const report = { result: 'success', version: 4, pageId: page.id, credentialOfferings: offerings.length, visibleTechnicianCourses: data.courses.length, publicAcademicPages: data.courses.filter(course => course.publicLessonReleaseAvailable === true).length, developmentOverviewPages: overviewResults.length, bytes: html.length, backupDir };";
if (!publisher.includes(reportLine)) throw new Error('Could not locate Catalog V4 report object.');
publisher = publisher.replace(reportLine, reportNew);
await writeFile(publisherPath, publisher);

let workflow = await readFile(workflowPath, 'utf8');
workflow = workflow.replace(
  "open_count=\"$(grep -o 'data-course-open=\"true\"' \"$page\" | wc -l | tr -d ' ')\"",
  "open_count=\"$(grep -o 'data-course-open=\"true\"' \"$page\" | wc -l | tr -d ' ')\"\n              overview_count=\"$(grep -o 'data-course-overview-link=\"true\"' \"$page\" | wc -l | tr -d ' ')\""
);
workflow = workflow.replace(
  "if [[ \"$offering_count\" -eq 10 && \"$course_count\" -eq 15 && \"$open_count\" -eq 1 ]]; then",
  "if [[ \"$offering_count\" -eq 10 && \"$course_count\" -eq 15 && \"$open_count\" -eq 1 && \"$overview_count\" -eq 14 ]]; then"
);
workflow = workflow.replace(
  "[[ \"$ok\" -eq 1 ]] || { echo 'Certification catalog V4 did not become visitor-facing with all 10 credential offerings, all 15 Technician I/II course cards, and exactly one released course link.' >&2; exit 1; }",
  "[[ \"$ok\" -eq 1 ]] || { echo 'Certification catalog V4 did not become visitor-facing with all 10 credential offerings, all 15 Technician I/II course cards, 14 development overview links, and exactly one released course link.' >&2; exit 1; }\n          while IFS=$'\\t' read -r id href; do\n            overview=\"$RUNNER_TEMP/overview-${id}.html\"\n            nonce=\"${GITHUB_RUN_ID}-${id}-$(date +%s%N)\"\n            curl -4 --fail --silent --show-error --location --retry 2 --retry-delay 2 --header 'Cache-Control: no-cache, no-store, max-age=0' --header 'Pragma: no-cache' \"$WP_SITE_URL${href}?verify=${nonce}\" --output \"$overview\"\n            grep -Fq 'data-dtf-course-development-overview=\"v1\"' \"$overview\" || { echo \"Development overview marker missing for $id\" >&2; exit 1; }\n            grep -Fq \"data-course-id=\\\"${id}\\\"\" \"$overview\" || { echo \"Course ID missing from public overview for $id\" >&2; exit 1; }\n          done < <(node -e \"const d=require('./site/wordpress/education/course-catalog-v4.json'); for (const c of d.courses.filter(x=>x.publicLessonReleaseAvailable!==true)) console.log(c.id+'\\t'+c.overviewHref)\")"
);
await writeFile(workflowPath, workflow);

let ownership = await readFile(ownershipPath, 'utf8');
ownership = ownership.replace(
  "| `/courses/` | Certification Catalog V4 (`scripts/publish-wordpress-certification-catalog-v4.mjs`) | Sole production writer for the public course/certification catalog. It renders the complete two-certificate/eight-professional-credential roadmap, exposes only academically available courses, and must never mark an unfinished credential issuance-available. Legacy Catalog V3 is superseded and must not be used as a production writer. |",
  "| `/courses/` and `/courses/technician-*-course-*` development-overview descendants | Certification Catalog V4 (`scripts/publish-wordpress-certification-catalog-v4.mjs`) | Sole production writer for the public course/certification catalog and non-academic development overview pages. It renders the complete two-certificate/eight-professional-credential roadmap, keeps all built Technician I/II courses visible, exposes only academically released lesson trees as open courses, and must never mark an unfinished credential issuance-available. Legacy Catalog V3 is superseded and must not be used as a production writer. |"
);
await writeFile(ownershipPath, ownership);

console.log('Prepared 14 public Technician I/II development overview pages and Catalog V4 routing.');

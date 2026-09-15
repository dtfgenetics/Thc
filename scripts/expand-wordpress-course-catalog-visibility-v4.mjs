import { readFile, writeFile } from 'node:fs/promises';

const catalogPath = 'site/wordpress/education/course-catalog-v4.json';
const publisherPath = 'scripts/publish-wordpress-certification-catalog-v4.mjs';
const workflowPath = '.github/workflows/wordpress-certification-catalog-v4.yml';

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));

const metric = (value, label) => ({ value: String(value), label });
const pending = 'Curriculum built · public lesson release pending review';

catalog.intro = 'Structured cultivation learning paths built from researched instruction, guided practice, job tasks, course tests, practical work, and separate credential validation. The full Technician I and Technician II course sequence is visible here, while unreleased academic pages remain clearly marked as in development.';
catalog.coursesSection = {
  eyebrow: 'Technician curriculum',
  title: 'Technician I & II courses',
  intro: 'All 15 built Technician I and Technician II course packages are listed publicly. Only courses with an approved public academic page include an Open Course link; the others stay visible as curriculum-built work awaiting public lesson release review.'
};

const tech1 = catalog.credentialSections.flatMap((section) => section.offerings ?? []).find((item) => item.id === 'CREDPROG-CULT-TECH-I-001');
if (tech1?.availableCourse) tech1.availableCourse.label = 'Course 1 open now · all 7 course titles visible below';
const tech2 = catalog.credentialSections.flatMap((section) => section.offerings ?? []).find((item) => item.id === 'CREDPROG-CULT-TECH-II-001');
if (tech2) tech2.summary = 'Advanced technician pathway covering diagnostic reasoning, environmental systems, fertigation, plant-health troubleshooting, propagation and canopy performance, postharvest quality response, traceability, metrics, shift coordination, and integrated simulation. All 8 course titles are visible below; credential issuance remains blocked pending validation.';

catalog.courses = [
  {
    id: 'COURSE-LH-TECH1-001', number: 1, status: 'available-academic', statusLabel: 'Available academic course',
    title: 'Safety, Responsible Practice & Cultivation Workflows', pathLabel: 'THC Cultivation Technician I',
    summary: 'Build the workplace decision habits expected of a cultivation technician: hazard recognition, biosecurity, controlled instructions, traceability, equipment boundaries, trustworthy records, and professional shift handoff.',
    href: '/learn/learning-hub/cultivation-technician-i/safety-responsible-practice-cultivation-workflows/', publicLessonReleaseAvailable: true,
    metrics: [metric(6, 'modules'), metric(18, 'lessons'), metric(6, 'module tests'), metric(36, 'final-test items')],
    includes: ['Student workbook', 'Integrated practical', 'Lesson progress tracking', 'Module and final course assessments']
  },
  {
    id: 'COURSE-LH-TECH1-002', number: 2, status: 'in-development', statusLabel: pending,
    title: 'Plant Observation, Growth Stages & Crop Records', pathLabel: 'THC Cultivation Technician I',
    summary: 'Structured crop walks, representative observation, growth-stage and reproductive morphology records, diagnostic boundaries, photographs, crop records, and shift handoff.',
    publicLessonReleaseAvailable: false, availabilityNote: 'Course instruction and assessments are built in the curriculum repository. Public lesson release remains pending review.',
    metrics: [metric(4, 'lessons'), metric(12, 'formative items'), metric(20, 'final items'), metric(1, 'mapped practical')]
  },
  {
    id: 'COURSE-LH-TECH1-003', number: 3, status: 'in-development', statusLabel: pending,
    title: 'Environmental, Light & Sensor Fundamentals', pathLabel: 'THC Cultivation Technician I',
    summary: 'Temperature, RH and VPD context, PPFD and photoperiod checks, sensor placement and verification, alarm and trend interpretation, environmental records, and shift handoff.',
    publicLessonReleaseAvailable: false, availabilityNote: 'Course instruction and assessments are built. Public lesson release remains pending review.',
    metrics: [metric(4, 'lessons'), metric(12, 'formative items'), metric(20, 'final items'), metric(1, 'performance gate')]
  },
  {
    id: 'COURSE-LH-TECH1-004', number: 4, status: 'in-development', statusLabel: pending,
    title: 'Water, Root Zone, Nutrition & Irrigation Fundamentals', pathLabel: 'THC Cultivation Technician I',
    summary: 'Water sample identity, pH and EC measurement, root-zone moisture and dryback trends, nutrition evidence, authorized irrigation/fertigation work orders, equipment care, and reconstructable records.',
    publicLessonReleaseAvailable: false, availabilityNote: 'Course instruction, assessments, and Practical B mapping are built. Public lesson release remains pending review.',
    metrics: [metric(4, 'lessons'), metric(12, 'formative items'), metric(24, 'final items'), metric(1, 'mapped practical')]
  },
  {
    id: 'COURSE-LH-TECH1-005', number: 5, status: 'in-development', statusLabel: pending,
    title: 'Propagation, Canopy, IPM Scouting & Crop Care', pathLabel: 'THC Cultivation Technician I',
    summary: 'Propagation and transplant identity, routine canopy work, IPM scouting evidence, biosecurity and quarantine, SOP authority boundaries, QA records, and shift handoff.',
    publicLessonReleaseAvailable: false, availabilityNote: 'Course instruction, assessments, and Practicals C–E mapping are built. Public lesson release remains pending review.',
    metrics: [metric(4, 'lessons'), metric(12, 'formative items'), metric(24, 'final items'), metric(3, 'mapped practicals')]
  },
  {
    id: 'COURSE-LH-TECH1-006', number: 6, status: 'in-development', statusLabel: pending,
    title: 'Harvest, Postharvest, Traceability & Shift Handoff', pathLabel: 'THC Cultivation Technician I',
    summary: 'Harvest authorization, clean-work readiness, controlled handling, material protection, dry-room receiving, harvest genealogy, quantity reconciliation, holds, deviations, and reconstructable handoff.',
    publicLessonReleaseAvailable: false, availabilityNote: 'Course instruction, assessments, and Practical F mapping are built. Public lesson release remains pending review.',
    metrics: [metric(4, 'lessons'), metric(12, 'formative items'), metric(24, 'final items'), metric(1, 'mapped practical')]
  },
  {
    id: 'COURSE-LH-TECH1-007', number: 7, status: 'in-development', statusLabel: 'Integrated lab built · validation pending',
    title: 'Integrated Cultivation Technician Practice Lab', pathLabel: 'THC Cultivation Technician I',
    summary: 'Integrated supervised practice linking Technician I crop-work evidence, Practicals A–F, critical-failure controls, evaluator evidence, remediation/retest rules, and the shift capstone.',
    publicLessonReleaseAvailable: false, availabilityNote: 'Integrated lab structure is built. Public lab release remains pending human review, accessibility review, practical validation, and pilot evidence.',
    metrics: [metric(4, 'lab lessons'), metric(12, 'readiness items'), metric(6, 'required practicals'), metric(1, 'capstone')]
  },
  {
    id: 'COURSE-LH-TECH2-001', number: 1, status: 'in-development', statusLabel: pending,
    title: 'Advanced Crop Observation & Diagnostic Reasoning', pathLabel: 'THC Cultivation Technician II',
    summary: 'Multi-factor crop diagnosis using plant, environmental, root-zone, nutrition, spatial, temporal, and QA evidence while separating observation from unsupported causal claims.',
    publicLessonReleaseAvailable: false, availabilityNote: 'Advanced instruction, assessments, and Practical A mapping are built. Public lesson release remains pending review.',
    metrics: [metric(4, 'lessons'), metric(12, 'formative items'), metric(24, 'final items'), metric(1, 'mapped practical')]
  },
  {
    id: 'COURSE-LH-TECH2-002', number: 2, status: 'in-development', statusLabel: pending,
    title: 'Environmental Data, Sensors & Equipment Response', pathLabel: 'THC Cultivation Technician II',
    summary: 'Sensor validity, representative placement, command-versus-response checks, light mapping, measured irrigation distribution, safe troubleshooting boundaries, fault classification, maintenance handoff, and post-action verification.',
    publicLessonReleaseAvailable: false, availabilityNote: 'Advanced instruction, assessments, and Practical B mapping are built. Public lesson release remains pending review.',
    metrics: [metric(4, 'lessons'), metric(12, 'formative items'), metric(24, 'final items'), metric(1, 'mapped practical')]
  },
  {
    id: 'COURSE-LH-TECH2-003', number: 3, status: 'in-development', statusLabel: pending,
    title: 'Fertigation Execution, Verification & Root-Zone Interpretation', pathLabel: 'THC Cultivation Technician II',
    summary: 'Approved batch readiness, material identity, controlled fertigation execution, measurement verification, root-zone and irrigation troubleshooting, chemical-safety boundaries, and evidence-based escalation without independent recipe design.',
    publicLessonReleaseAvailable: false, availabilityNote: 'Advanced instruction, assessments, and Practical C mapping are built. Public lesson release remains pending review.',
    metrics: [metric(4, 'lessons'), metric(12, 'formative items'), metric(24, 'final items'), metric(1, 'mapped practical')]
  },
  {
    id: 'COURSE-LH-TECH2-004', number: 4, status: 'in-development', statusLabel: pending,
    title: 'Plant Health, IPM & Biosecurity Troubleshooting', pathLabel: 'THC Cultivation Technician II',
    summary: 'Comparable scouting, incidence and severity trends, spatial evidence, intervention follow-up, quarantine and biosecurity, QA records, and treatment-authority boundaries.',
    publicLessonReleaseAvailable: false, availabilityNote: 'Advanced instruction, assessments, and Practical D mapping are built. Public lesson release remains pending review.',
    metrics: [metric(4, 'lessons'), metric(12, 'formative items'), metric(24, 'final items'), metric(1, 'mapped practical')]
  },
  {
    id: 'COURSE-LH-TECH2-005', number: 5, status: 'in-development', statusLabel: pending,
    title: 'Propagation & Canopy Performance Troubleshooting', pathLabel: 'THC Cultivation Technician II',
    summary: 'Propagation performance, donor and batch comparisons, advanced canopy and flowering response review, sanitation/IPM context, evidence-based troubleshooting, and QA handoff.',
    publicLessonReleaseAvailable: false, availabilityNote: 'Advanced instruction, assessments, and Practical E mapping are built. Public lesson release remains pending review.',
    metrics: [metric(4, 'lessons'), metric(12, 'formative items'), metric(24, 'final items'), metric(1, 'mapped practical')]
  },
  {
    id: 'COURSE-LH-TECH2-006', number: 6, status: 'in-development', statusLabel: pending,
    title: 'Harvest/Postharvest Deviations & Quality Response', pathLabel: 'THC Cultivation Technician II',
    summary: 'Postharvest containment, process-trend interpretation, product measurements, lot genealogy and affected-scope reasoning, QA role boundaries, deviation evidence, and reconstructable handoff without independent product disposition authority.',
    publicLessonReleaseAvailable: false, availabilityNote: 'Advanced instruction, assessments, and Practical F mapping are built. Public lesson release remains pending review.',
    metrics: [metric(4, 'lessons'), metric(12, 'formative items'), metric(24, 'final items'), metric(1, 'mapped practical')]
  },
  {
    id: 'COURSE-LH-TECH2-007', number: 7, status: 'in-development', statusLabel: pending,
    title: 'Traceability, Production Metrics, Shift Coordination & Peer Support', pathLabel: 'THC Cultivation Technician II',
    summary: 'Genealogy and reconciliation, KPI denominator and trend discipline, controlled-record integrity, SOP-based peer coaching, unresolved-work prioritization, and supervisor-ready shift handoff without formal supervisory authority.',
    publicLessonReleaseAvailable: false, availabilityNote: 'Advanced instruction, assessments, and Practical G mapping are built. Public lesson release remains pending review.',
    metrics: [metric(4, 'lessons'), metric(12, 'formative items'), metric(24, 'final items'), metric(1, 'mapped practical')]
  },
  {
    id: 'COURSE-LH-TECH2-008', number: 8, status: 'in-development', statusLabel: 'Integrated lab built · validation pending',
    title: 'Integrated Technician II Simulation Lab', pathLabel: 'THC Cultivation Technician II',
    summary: 'Integrated diagnostic-shift practice linking all seven Technician II practicals, non-compensatory critical-error controls, evaluator calibration, accessibility and equivalent-form controls, remediation/retest rules, and the Senior Technician capstone.',
    publicLessonReleaseAvailable: false, availabilityNote: 'Integrated lab and capstone structure are built. Public lab release remains pending human review, practical/capstone validation, pilot evidence, evaluator calibration, and formal release approval.',
    metrics: [metric(4, 'lab lessons'), metric(16, 'readiness items'), metric(7, 'required practicals'), metric(1, 'capstone')]
  }
];

await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

let publisher = await readFile(publisherPath, 'utf8');
publisher = publisher.replace(
  "must(Array.isArray(data.courses) && data.courses.length >= 1, 'At least one public academic course is required.');",
  "must(Array.isArray(data.courses) && data.courses.length === 15, `Expected all 15 Technician I/II courses to be visible, found ${data.courses?.length ?? 0}.`);\nconst expectedCourseIds = [...Array.from({length:7},(_,i)=>`COURSE-LH-TECH1-00${i+1}`), ...Array.from({length:8},(_,i)=>`COURSE-LH-TECH2-00${i+1}`)];\nmust(expectedCourseIds.every(id => data.courses.some(course => course.id === id)), 'Certification catalog is missing one or more canonical Technician I/II course IDs.');\nmust(new Set(data.courses.map(course => course.id)).size === 15, 'Certification catalog course IDs must be unique.');\nmust(data.courses.filter(course => course.publicLessonReleaseAvailable === true).length === 1, 'Exactly one course is currently released as a public academic page.');"
);

const coursesStart = publisher.indexOf('const courses = data.courses.map(course =>');
const surfacesStart = publisher.indexOf('const surfaces = data.learningSurfaces.map', coursesStart);
if (coursesStart < 0 || surfacesStart < 0) throw new Error('Could not locate certification catalog course renderer.');
const courseRenderer = `const courses = data.courses.map(course => {
  const openAction = course.href && course.publicLessonReleaseAvailable === true
    ? \`<div class="dc4-actions"><a class="dc4-btn" data-course-open="true" href="\${esc(course.href)}">Open Course \${esc(course.number)}</a></div>\`
    : \`<p class="dc4-meta" data-course-open="false"><strong>Public release:</strong> \${esc(course.availabilityNote || 'Curriculum is visible, but the public academic page is not released yet.')}</p>\`;
  return \`<article class="dc4-course" data-course-id="\${esc(course.id)}" data-course-release="\${course.publicLessonReleaseAvailable === true ? 'available' : 'pending'}"><aside class="dc4-course-rail"><span class="dc4-status">\${esc(course.statusLabel || course.status)}</span><strong>\${esc(course.pathLabel || '')}</strong></aside><div class="dc4-course-body"><h3>Course \${esc(course.number)} — \${esc(course.title)}</h3><p>\${esc(course.summary)}</p><div class="dc4-metrics">\${(course.metrics || []).map(metric => \`<div class="dc4-metric"><strong>\${esc(metric.value)}</strong><span>\${esc(metric.label)}</span></div>\`).join('')}</div>\${openAction}</div></article>\`;
}).join('');
`;
publisher = publisher.slice(0, coursesStart) + courseRenderer + publisher.slice(surfacesStart);

publisher = publisher.replace(
  '<span class="dc4-kicker" style="color:#4c7759">Available learning</span><h2 id="dc4-available">Public academic courses</h2></div><p>Course 1 is currently available for public study while the broader Technician I certification pathway remains in development.</p>',
  '<span class="dc4-kicker" style="color:#4c7759">${esc(data.coursesSection?.eyebrow || "Technician curriculum")}</span><h2 id="dc4-available">${esc(data.coursesSection?.title || "Technician I & II courses")}</h2></div><p>${esc(data.coursesSection?.intro || "All built technician courses remain visible even when their public academic pages are still pending release review.")}</p>'
);

publisher = publisher.replace(
  "must(content.includes('CREDPROG-CULT-TECH-I-001') === false || true, 'Technician I render validation failed.');",
  "must((content.match(/data-course-id=/g) || []).length === 15, 'Rendered catalog must contain all 15 Technician I/II courses.');\n  must((content.match(/data-course-open=\\\"true\\\"/g) || []).length === 1, 'Rendered catalog must expose exactly one currently released academic course link.');\n  must(content.includes('COURSE-LH-TECH1-007') && content.includes('COURSE-LH-TECH2-008'), 'Rendered catalog must expose both integrated lab course cards.');"
);

publisher = publisher.replace(
  "console.log(JSON.stringify({ result: 'success', version: 4, credentialOfferings: offerings.length, publicCourses: data.courses.length, issuanceEnabled: 0 }, null, 2));",
  "console.log(JSON.stringify({ result: 'success', version: 4, credentialOfferings: offerings.length, visibleTechnicianCourses: data.courses.length, publicAcademicPages: data.courses.filter(course => course.publicLessonReleaseAvailable === true).length, issuanceEnabled: 0 }, null, 2));"
);

await writeFile(publisherPath, publisher);

let workflow = await readFile(workflowPath, 'utf8');
workflow = workflow.replace(
  "! grep -Fq 'data-issuance-available=\"true\"' \"$page\"; then",
  "grep -Fq 'data-course-id=\"COURSE-LH-TECH1-007\"' \"$page\" && \\\n               grep -Fq 'data-course-id=\"COURSE-LH-TECH2-008\"' \"$page\" && \\\n               ! grep -Fq 'data-issuance-available=\"true\"' \"$page\"; then"
);
workflow = workflow.replace(
  "if [[ \"$count\" -eq 10 ]]; then\n                ok=1\n                break\n              fi",
  "course_count=\"$(grep -o 'data-course-id=' \"$page\" | wc -l | tr -d ' ')\"\n              open_count=\"$(grep -o 'data-course-open=\"true\"' \"$page\" | wc -l | tr -d ' ')\"\n              if [[ \"$count\" -eq 10 && \"$course_count\" -eq 15 && \"$open_count\" -eq 1 ]]; then\n                ok=1\n                break\n              fi"
);
workflow = workflow.replace(
  "Certification catalog V4 did not become visitor-facing with all 10 offerings.",
  "Certification catalog V4 did not become visitor-facing with all 10 credential offerings and all 15 Technician I/II course cards."
);
await writeFile(workflowPath, workflow);

console.log('Expanded WordPress certification catalog visibility to all 15 Technician I/II courses.');

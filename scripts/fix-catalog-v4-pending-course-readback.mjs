import { readFile, writeFile } from 'node:fs/promises';

const path = 'scripts/publish-wordpress-certification-catalog-v4.mjs';
let source = await readFile(path, 'utf8');

const oldValidation = "must(data.courses.filter(course => course.publicLessonReleaseAvailable === true).length === 1, 'Exactly one course is currently released as a public academic page.');";
const newValidation = `${oldValidation}\nmust(data.courses.every(course => course.publicLessonReleaseAvailable === true || !course.href), 'Unreleased courses must not publish a live course href.');`;
if (!source.includes(oldValidation)) throw new Error('Could not locate released-course validation contract.');
source = source.replace(oldValidation, newValidation);

const oldReadback = "for (const course of data.courses) must(html.includes(course.href), `Course route missing after write: ${course.href}`);";
const newReadback = `must((html.match(/data-course-id=/g) || []).length === 15, 'WordPress readback does not contain all 15 Technician I/II course cards.');\nfor (const course of data.courses.filter(course => course.publicLessonReleaseAvailable === true)) {\n  must(course.href && html.includes(course.href), \`Released course route missing after write: \${course.id} -> \${course.href}\`);\n}\nfor (const course of data.courses.filter(course => course.publicLessonReleaseAvailable !== true)) {\n  must(!course.href, \`Pending course unexpectedly exposes a live href: \${course.id} -> \${course.href}\`);\n}`;
if (!source.includes(oldReadback)) throw new Error('Could not locate legacy all-course route readback assertion.');
source = source.replace(oldReadback, newReadback);

const oldReport = "const report = { result: 'success', version: 4, pageId: page.id, credentialOfferings: offerings.length, publicCourses: data.courses.length, bytes: html.length, backupDir };";
const newReport = "const report = { result: 'success', version: 4, pageId: page.id, credentialOfferings: offerings.length, visibleTechnicianCourses: data.courses.length, publicAcademicPages: data.courses.filter(course => course.publicLessonReleaseAvailable === true).length, bytes: html.length, backupDir };";
if (!source.includes(oldReport)) throw new Error('Could not locate Catalog V4 publish report.');
source = source.replace(oldReport, newReport);

await writeFile(path, source);
console.log('Catalog V4 pending-course readback contract repaired.');

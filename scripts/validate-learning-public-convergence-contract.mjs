#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { inspectLearningPublicHtml, publicRoutes, publicSemantics } from './learning-public-semantics.mjs';

const sourcePath = 'scripts/update-wordpress-learn-expansion-v1.mjs';
const workflowPath = '.github/workflows/deploy-thc-learning-center-expansion-v1.yml';
const helperPath = 'scripts/learning-public-semantics.mjs';
const source = readFileSync(sourcePath, 'utf8');
const workflow = readFileSync(workflowPath, 'utf8');
const helper = readFileSync(helperPath, 'utf8');
const failures = [];
const requireText = (haystack, text, message) => {
  if (!haystack.includes(text)) failures.push(message);
};

for (const marker of [
  'data-dtf-layout="learn-v3"',
  'data-dtf-learning-map="v4"',
  'data-dtf-learning-expanded-reference="v1"',
  '/learn/atlas/',
  'Open the THC Living Plant Atlas'
]) {
  requireText(source, marker, `stored Learn convergence contract is missing ${marker}`);
}

for (const semantic of publicSemantics) {
  requireText(helper, semantic, `anonymous Learn semantic helper is missing visible semantic: ${semantic}`);
}

for (const href of publicRoutes) {
  requireText(helper, href, `anonymous Learn semantic helper is missing route: ${href}`);
}

for (const token of [
  'LEARNING_ROOT_CONVERGENCE_ATTEMPTS',
  'LEARNING_ROOT_CONVERGENCE_DELAY_MS',
  'LEARNING_CONVERGENCE_HTML_PATH',
  'inspectLearningPublicHtml',
  'missingSemantics',
  'missingRoutes',
  "publicVerification: 'semantic-cache-convergence'",
  "semanticNormalization: 'html-entity-decoded'",
  "mutation: 'none'"
]) {
  requireText(source, token, `Learning convergence contract is missing ${token}`);
}

for (const token of [
  'decodeHtmlEntities',
  "['amp', '&']",
  'String.fromCodePoint',
  'inspectLearningPublicHtml'
]) {
  requireText(helper, token, `Learning semantic helper is missing ${token}`);
}

requireText(
  workflow,
  'node scripts/learning-public-semantics.mjs "$learn"',
  'final anonymous Learn verification does not reuse the entity-aware semantic helper'
);
requireText(
  workflow,
  '${{ runner.temp }}/education-learn-public-semantics.json',
  'Education artifact no longer preserves final semantic verification evidence'
);
requireText(
  workflow,
  '${{ runner.temp }}/live-*.html',
  'Education artifact no longer preserves anonymous HTML evidence'
);

const publicLoopStart = source.indexOf('let verified = false;');
const publicLoopEnd = source.indexOf('console.log(JSON.stringify({');
if (publicLoopStart < 0 || publicLoopEnd <= publicLoopStart) {
  failures.push('could not isolate anonymous Learn convergence loop');
} else {
  const publicLoop = source.slice(publicLoopStart, publicLoopEnd);
  if (publicLoop.includes('data-dtf-layout=') || publicLoop.includes('data-dtf-learning-map=') || publicLoop.includes('data-dtf-learning-expanded-reference=')) {
    failures.push('anonymous Learn convergence again depends on private WordPress storage attributes');
  }
  if (!publicLoop.includes('inspectLearningPublicHtml(html)')) {
    failures.push('anonymous Learn convergence no longer uses entity-aware semantic inspection');
  }
  if (!publicLoop.includes('writeFile(convergenceHtmlPath, html')) {
    failures.push('anonymous Learn convergence no longer persists the exact inspected HTML');
  }
}

if (source.includes("method: 'POST'") || source.includes('method: "POST"')) {
  failures.push('read-only Learn convergence verifier contains a WordPress POST mutation');
}

if (/grep -Fqi ['"]Plant Health & IPM['"] ["']?\$learn/m.test(workflow)
  || /grep -Fqi ['"]Evidence & Sources['"] ["']?\$learn/m.test(workflow)) {
  failures.push('final anonymous Learn verification again greps raw HTML for decoded ampersand labels');
}

const encodedFixture = [
  ...publicSemantics.map((semantic) => semantic
    .replace('Plant Health & IPM', 'Plant Health &amp; IPM')
    .replace('Evidence & Sources', 'Evidence &#x26; Sources')),
  ...publicRoutes
].join('\n');
const encodedResult = inspectLearningPublicHtml(encodedFixture);
if (!encodedResult.ok || encodedResult.missingSemantics.length || encodedResult.missingRoutes.length) {
  failures.push(`entity-aware semantic fixture failed: ${JSON.stringify(encodedResult)}`);
}

const brokenFixture = encodedFixture.replace('Printable Field Tools', 'Printable worksheets');
const brokenResult = inspectLearningPublicHtml(brokenFixture);
if (brokenResult.ok || !brokenResult.missingSemantics.includes('Printable Field Tools')) {
  failures.push('semantic helper does not fail closed when a required visible concept is actually absent');
}

if (failures.length) {
  console.error('Learning public convergence contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Learning public convergence contract passed.');
console.log('- authenticated REST proves private Learn owner markers');
console.log('- anonymous HTML is decoded before stable visitor semantics and routes are evaluated');
console.log('- encoded ampersand labels are accepted only when their decoded visible text matches the strict contract');
console.log('- inspected anonymous HTML and final semantic evidence are preserved in the Education artifact');
console.log('- public convergence is bounded and read-only');

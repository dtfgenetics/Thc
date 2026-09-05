#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const sourcePath = 'scripts/update-wordpress-learn-expansion-v1.mjs';
const normalizerPath = 'scripts/normalize-html-visible-text.mjs';
const workflowPath = '.github/workflows/deploy-thc-learning-center-expansion-v1.yml';
const source = readFileSync(sourcePath, 'utf8');
const normalizer = readFileSync(normalizerPath, 'utf8');
const workflow = readFileSync(workflowPath, 'utf8');
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

for (const semantic of [
  'Teaching Healthy Cultivation',
  'Learn in a sequence that makes the plant easier to understand.',
  'Open the THC Living Plant Atlas',
  'See how the systems connect before you go deep.',
  'Learn the plant as a connected system.',
  'Plant Health & IPM',
  'Cultivation Science',
  'Symptom Differentials',
  'Printable Field Tools',
  'Evidence & Sources'
]) {
  requireText(source, semantic, `anonymous Learn convergence contract is missing visible semantic: ${semantic}`);
}

for (const href of [
  '/learn/plant-health/',
  '/learn/cultivation-science/',
  '/learn/symptoms/',
  '/learn/tools/',
  '/learn/sources/'
]) {
  requireText(source, href, `anonymous Learn convergence contract is missing route: ${href}`);
}

for (const token of [
  'LEARNING_ROOT_CONVERGENCE_ATTEMPTS',
  'LEARNING_ROOT_CONVERGENCE_DELAY_MS',
  'missingSemantics',
  'missingRoutes',
  "import { normalizeHtmlVisibleText } from './normalize-html-visible-text.mjs';",
  'normalizeHtmlVisibleText(html)',
  'normalizedHtml.includes(normalizeHtmlVisibleText(marker))',
  "semanticNormalization: 'shared-visible-text-html-entities'",
  "publicVerification: 'semantic-cache-convergence'",
  "mutation: 'none'"
]) {
  requireText(source, token, `Learning convergence contract is missing ${token}`);
}

const publicLoopStart = source.indexOf('let verified = false;');
const publicLoopEnd = source.indexOf('console.log(JSON.stringify({');
if (publicLoopStart < 0 || publicLoopEnd <= publicLoopStart) {
  failures.push('could not isolate anonymous Learn convergence loop');
} else {
  const publicLoop = source.slice(publicLoopStart, publicLoopEnd);
  if (publicLoop.includes('data-dtf-layout=') || publicLoop.includes('data-dtf-learning-map=') || publicLoop.includes('data-dtf-learning-expanded-reference=')) {
    failures.push('anonymous Learn convergence again depends on private WordPress storage attributes');
  }
  if (!publicLoop.includes('publicSemantics.filter') || !publicLoop.includes('publicRoutes.filter')) {
    failures.push('anonymous Learn convergence no longer evaluates both semantic and route completeness');
  }
  if (!publicLoop.includes('normalizeHtmlVisibleText(html)') || !publicLoop.includes('normalizeHtmlVisibleText(marker)')) {
    failures.push('anonymous Learn convergence no longer compares normalized visitor-visible text');
  }
}

for (const token of [
  "export function decodeHtmlEntity",
  "export function normalizeHtmlVisibleText",
  "amp: '&'",
  'String.fromCodePoint',
  "replace(/<script\\b",
  "replace(/<style\\b",
  "replace(/<[^>]+>/g, ' ')",
  "Usage: node scripts/normalize-html-visible-text.mjs <html-file>"
]) {
  requireText(normalizer, token, `shared visible-text normalizer is missing ${token}`);
}

for (const token of [
  "- 'scripts/normalize-html-visible-text.mjs'",
  'node --check scripts/normalize-html-visible-text.mjs',
  'node scripts/normalize-html-visible-text.mjs "$learn" > "$learn_visible"',
  'grep -Fqi "$label" "$learn_visible"',
  'grep -Fq "$href" "$learn"'
]) {
  requireText(workflow, token, `Education production workflow is missing normalized fresh verification contract: ${token}`);
}

if (source.includes("method: 'POST'") || source.includes('method: "POST"')) {
  failures.push('read-only Learn convergence verifier contains a WordPress POST mutation');
}

if (failures.length) {
  console.error('Learning public convergence contract failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Learning public convergence contract passed.');
console.log('- authenticated REST proves private Learn owner markers');
console.log('- anonymous HTML proves stable visitor-facing semantics and routes');
console.log('- one shared normalizer decodes visitor-visible HTML text for both convergence and fresh verification');
console.log('- public convergence is bounded and read-only');

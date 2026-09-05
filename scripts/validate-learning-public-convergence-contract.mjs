#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const sourcePath = 'scripts/update-wordpress-learn-expansion-v1.mjs';
const source = readFileSync(sourcePath, 'utf8');
const failures = [];
const requireText = (text, message) => {
  if (!source.includes(text)) failures.push(message);
};

for (const marker of [
  'data-dtf-layout="learn-v3"',
  'data-dtf-learning-map="v4"',
  'data-dtf-learning-expanded-reference="v1"',
  '/learn/atlas/',
  'Open the THC Living Plant Atlas'
]) {
  requireText(marker, `stored Learn convergence contract is missing ${marker}`);
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
  requireText(semantic, `anonymous Learn convergence contract is missing visible semantic: ${semantic}`);
}

for (const href of [
  '/learn/plant-health/',
  '/learn/cultivation-science/',
  '/learn/symptoms/',
  '/learn/tools/',
  '/learn/sources/'
]) {
  requireText(href, `anonymous Learn convergence contract is missing route: ${href}`);
}

for (const token of [
  'LEARNING_ROOT_CONVERGENCE_ATTEMPTS',
  'LEARNING_ROOT_CONVERGENCE_DELAY_MS',
  'missingSemantics',
  'missingRoutes',
  "publicVerification: 'semantic-cache-convergence'",
  "mutation: 'none'"
]) {
  requireText(token, `Learning convergence contract is missing ${token}`);
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
console.log('- public convergence is bounded and read-only');

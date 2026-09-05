#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

const paths = {
  workflow: '.github/workflows/wordpress-harvest-outdoor-v6-production.yml',
  learningV4: 'scripts/enhance-wordpress-learning-v4.mjs',
  prerequisites: 'scripts/verify-wordpress-outdoor-owner-prerequisites.mjs'
};

const [workflow, learningV4, prerequisites] = await Promise.all([
  readFile(paths.workflow, 'utf8'),
  readFile(paths.learningV4, 'utf8'),
  readFile(paths.prerequisites, 'utf8')
]);

const failures = [];
const requireText = (source, token, message) => {
  if (!source.includes(token)) failures.push(message);
};
const forbidText = (source, token, message) => {
  if (source.includes(token)) failures.push(message);
};

// Harvest/Outdoor can publish subject layers, but it must serialize with the
// canonical Home/Learn owner and must never cancel that owner midway.
requireText(workflow, 'group: dtfseeds-learning-experience-v3', 'Outdoor production is not serialized with the canonical Learning owner.');
requireText(workflow, 'cancel-in-progress: false', 'Outdoor production can still cancel a canonical Learning owner transaction.');

// The old self-heal was a real second /learn/ writer and caused Atlas to be
// stripped between canonical publication and storage verification.
forbidText(workflow, 'node scripts/run-learning-v3-production.mjs', 'Outdoor production still invokes the base Learning V3 root writer.');
forbidText(workflow, "APPLY_LEARNING_V3: 'true'", 'Outdoor production still enables direct Learning V3 root mutation.');
requireText(workflow, 'Wait for and verify canonical Learning V3 prerequisites', 'Outdoor production no longer waits for canonical Learning prerequisites.');
requireText(workflow, 'verify-wordpress-outdoor-owner-prerequisites.mjs', 'Outdoor production no longer uses the read-only canonical owner prerequisite verifier.');
requireText(workflow, 'waiting without mutating /learn/', 'Outdoor prerequisite polling no longer documents its read-only contract.');

// Outdoor still needs the guided V4 layer on its subject pages. The V4 helper
// therefore supports a topics-only scope automatically when the Outdoor V6
// publication flag is present; root mutation stays available only to its
// canonical/general callers.
for (const token of [
  "const outdoorTopicsOnly = String(process.env.APPLY_HARVEST_OUTDOOR_V6 || '').toLowerCase() === 'true';",
  "outdoorTopicsOnly ? 'topics-only' : 'all'",
  "const validScopes = new Set(['all', 'topics-only']);",
  "if (scope === 'all')",
  "action: 'preserved-canonical-root'",
  "rootMutation: scope === 'all' ? 'enabled' : 'preserved-canonical-root'"
]) {
  requireText(learningV4, token, `Learning V4 topic-only root-preservation contract is missing: ${token}`);
}
requireText(workflow, "APPLY_HARVEST_OUTDOOR_V6: 'true'", 'Outdoor workflow no longer activates the topics-only V4 safety scope.');
requireText(workflow, 'node scripts/enhance-wordpress-learning-v4.mjs', 'Outdoor workflow no longer refreshes required V4 subject layers.');

// Before any Outdoor mutation, authenticated WordPress storage must prove that
// the canonical connected Learning transaction (including Atlas + V4 map) is
// already present. This verifier itself must remain read-only.
for (const token of [
  'data-dtf-layout="learn-v3"',
  '/learn/atlas/',
  'Open the THC Living Plant Atlas',
  'data-dtf-learning-map="v4"',
  "rootOwner:'canonical-learning-connected-transaction'",
  "mutation:'none'"
]) {
  requireText(prerequisites, token, `Outdoor canonical-owner prerequisite contract is missing: ${token}`);
}
forbidText(prerequisites, "method:'POST'", 'Outdoor prerequisite verifier contains a WordPress POST mutation.');
forbidText(prerequisites, "method: 'POST'", 'Outdoor prerequisite verifier contains a WordPress POST mutation.');

// Final visitor proof must verify Atlas survived the topic/V6 publication.
requireText(workflow, "grep -Fq '/learn/atlas/' \"$learn\"", 'Outdoor live verification no longer proves the Atlas route survived publication.');
requireText(workflow, "grep -Fq 'Open the THC Living Plant Atlas' \"$learn\"", 'Outdoor live verification no longer proves the Atlas CTA survived publication.');

if (failures.length) {
  console.error('Outdoor/Learning owner isolation validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Outdoor/Learning owner isolation validation passed.');
console.log('- Outdoor shares the canonical Learning serialization lock and cannot cancel it.');
console.log('- Outdoor no longer invokes the base V3 root writer.');
console.log('- Outdoor V4 refresh is topic-only and preserves /learn/.');
console.log('- authenticated prerequisites require the Atlas-aware connected owner before publication.');
console.log('- final visitor verification proves the Atlas affordance survives Outdoor publication.');

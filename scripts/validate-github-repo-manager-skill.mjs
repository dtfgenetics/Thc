import { readFile } from 'node:fs/promises';

const skillPath = '.agents/skills/github-repo-manager/SKILL.md';
const hardeningPath = '.agents/skills/github-repo-manager/references/github-platform-hardening.md';
const refs = [
  '.agents/skills/github-repo-manager/references/failure-research.md',
  '.agents/skills/github-repo-manager/references/git-operations-and-recovery.md',
  hardeningPath
];

const skill = await readFile(skillPath, 'utf8');
const required = [
  'name: github-repo-manager',
  'version: "2.0.0"',
  '## Repository preflight: build a health packet first',
  '## Intent router',
  '## Preserve user, canonical, and concurrent work',
  '## Merge-conflict repair',
  '## Pull/push and divergence rules',
  '## GitHub Actions / CI repair loop',
  '## Workflow-file and GitHub security rules',
  '## Repository audit mode: find the things the user did not know to ask about',
  '## Release and tag safety',
  '## Recovery and rollback',
  '## Failure research escalation',
  '## Parallel work and race prevention',
  '## Deployment handoff',
  '## Safety and irreversible operations',
  '## Completion gate',
  'references/git-operations-and-recovery.md',
  'references/github-platform-hardening.md',
  'references/failure-research.md'
];

const missing = required.filter(marker => !skill.includes(marker));
if (missing.length) {
  throw new Error(`GitHub repo manager skill is missing required contract markers:\n${missing.map(x => `- ${x}`).join('\n')}`);
}

for (const ref of refs) {
  const content = await readFile(ref, 'utf8');
  if (content.trim().length < 500) throw new Error(`${ref} is missing or unexpectedly small.`);
}

const hardening = await readFile(hardeningPath, 'utf8');
const v3Markers = [
  '## Production-branch governance target',
  '## Required status checks',
  '## PR review and fix-review loop',
  '## Deployment environments and protection',
  '## Workflow execution protections',
  '## Security feature audit',
  '## Reusable workflows',
  '## Continuous repository-health loop',
  '## Repository-manager state machine',
  'inspect → isolate → reproduce → repair → narrow-test → review → synchronize → PR → exact-head CI'
];
const missingV3 = v3Markers.filter(marker => !hardening.includes(marker));
if (missingV3.length) {
  throw new Error(`GitHub repo manager V3 hardening profile is incomplete:\n${missingV3.map(x => `- ${x}`).join('\n')}`);
}

const agents = await readFile('AGENTS.md', 'utf8');
if (!agents.includes('.agents/skills/github-repo-manager/SKILL.md')) {
  throw new Error('AGENTS.md no longer routes repository repair work through github-repo-manager.');
}

const forbidden = [
  /force-push production by default/i,
  /skip (?:all )?tests by default/i,
  /print secret values/i,
  /always use (?:ours|theirs)/i,
  /reset --hard main/i
];
for (const pattern of forbidden) {
  if (pattern.test(skill) || pattern.test(hardening)) throw new Error(`Unsafe guidance matched ${pattern}.`);
}

console.log(JSON.stringify({
  ok: true,
  skill: skillPath,
  coreSkillVersion: '2.0.0',
  operatingProfile: '3.0.0',
  requiredMarkers: required.length,
  v3HardeningMarkers: v3Markers.length,
  referencesChecked: refs.length,
  agentsRoutingVerified: true
}, null, 2));

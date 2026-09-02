import { readFile } from 'node:fs/promises';

const skillPath = '.agents/skills/github-repo-manager/SKILL.md';
const refs = [
  '.agents/skills/github-repo-manager/references/failure-research.md',
  '.agents/skills/github-repo-manager/references/git-operations-and-recovery.md',
  '.agents/skills/github-repo-manager/references/github-platform-hardening.md'
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
  if (pattern.test(skill)) throw new Error(`Unsafe guidance matched ${pattern}.`);
}

console.log(JSON.stringify({
  ok: true,
  skill: skillPath,
  version: '2.0.0',
  requiredMarkers: required.length,
  referencesChecked: refs.length,
  agentsRoutingVerified: true
}, null, 2));

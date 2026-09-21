import { appendFileSync, readFileSync } from 'node:fs';

const args = new Set(process.argv.slice(2));
const targetPath = process.env.ACADEMY_DEPLOYMENT_TARGET || 'site/wordpress/education/academy-deployment-target.json';
const target = JSON.parse(readFileSync(targetPath, 'utf8'));

const fail = (message) => {
  console.error(`Academy deployment target invalid: ${message}`);
  process.exit(1);
};

if (target.schemaVersion !== 1) fail('schemaVersion must equal 1.');
if (target.id !== 'academy-production-target-v1') fail('unexpected id.');
if (target.sourceRepository !== 'dtfgenetics/Thc-learning-courses-') fail('unexpected sourceRepository.');
if (!/^[0-9a-f]{40}$/.test(String(target.sourceSha || ''))) fail('sourceSha must be a full lowercase 40-character Git SHA.');

const result = {
  targetPath,
  sourceRepository: target.sourceRepository,
  sourceSha: target.sourceSha,
  updatedAt: target.updatedAt || null,
};

if (args.has('--github-env')) {
  const githubEnv = process.env.GITHUB_ENV;
  if (!githubEnv) fail('GITHUB_ENV is required with --github-env.');
  appendFileSync(githubEnv, `THC_LEARNING_SOURCE_SHA=${target.sourceSha}\n`);
}

console.log(JSON.stringify(result, null, 2));

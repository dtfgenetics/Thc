import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const sourcePath = process.env.LEARNING_V3_SOURCE_PUBLISHER || 'scripts/rebuild-wordpress-learning-experience-v3.mjs';
const outputPath = process.env.LEARNING_V3_OWNER_AWARE_PUBLISHER || '/tmp/rebuild-wordpress-learning-experience-v3-owner-aware.mjs';

let source = await readFile(sourcePath, 'utf8');

const original = `const checks = [];
if (apply) {
  checks.push(await publicCheck('/', 'data-dtf-layout="home-v3"'));
  checks.push(await publicCheck('/learn/', 'data-dtf-layout="learn-v3"'));
  for (const topic of topics) checks.push(await publicCheck(topic.route, \`data-dtf-topic="\${topic.id}"\`));
  const failures = checks.filter(check => check.status !== 200 || !check.markerFound);
  if (failures.length) throw new Error(\`Visitor verification failed: \${failures.map(item => \`\${item.path}:\${item.status}:\${item.markerFound}\`).join(', ')}\`);
}`;

const ownerAware = `const checks = [];
if (apply) {
  const storedRootCheck = async (slug, marker) => {
    const { body } = await request(\`/wp-json/wp/v2/pages?slug=\${encodeURIComponent(slug)}&context=edit&status=publish&per_page=100\`);
    const roots = (Array.isArray(body) ? body : []).filter(page => Number(page.parent || 0) === 0);
    if (roots.length !== 1) return { path: \`wordpress:/\${slug}/\`, status: 409, marker, markerFound: false, bytes: 0, owner: 'wordpress-rest' };
    const stored = rendered(roots[0]?.content);
    return { path: \`wordpress:/\${slug}/\`, status: 200, marker, markerFound: stored.includes(marker), bytes: stored.length, owner: 'wordpress-rest', pageId: roots[0].id };
  };
  checks.push(await storedRootCheck('home', 'data-dtf-layout="home-v3"'));
  checks.push(await storedRootCheck('learn', 'data-dtf-layout="learn-v3"'));
  for (const topic of topics) checks.push(await publicCheck(topic.route, \`data-dtf-topic="\${topic.id}"\`));
  const failures = checks.filter(check => check.status !== 200 || !check.markerFound);
  if (failures.length) throw new Error(\`Owner-aware verification failed: \${failures.map(item => \`\${item.path}:\${item.status}:\${item.markerFound}\`).join(', ')}\`);
}`;

if (!source.includes(original)) {
  throw new Error('Could not locate the Learning V3 mixed root/topic verification block; refusing an unreviewed owner-verification patch.');
}
source = source.replace(original, ownerAware);
await writeFile(outputPath, source, 'utf8');
console.log(JSON.stringify({ sourcePath, outputPath, rootVerification: 'wordpress-rest', topicVerification: 'anonymous-public' }, null, 2));

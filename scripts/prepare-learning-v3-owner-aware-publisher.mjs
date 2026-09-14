import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const sourcePath = process.env.LEARNING_V3_SOURCE_PUBLISHER || 'scripts/rebuild-wordpress-learning-experience-v3.mjs';
const outputPath = process.env.LEARNING_V3_OWNER_AWARE_PUBLISHER || '/tmp/rebuild-wordpress-learning-experience-v3-owner-aware.mjs';

let source = await readFile(sourcePath, 'utf8');

// Learning V3 must never fill public educational image slots by loosely keyword-
// matching the WordPress media library. Generic Learning media may only come from
// the dedicated approved-learning visual family. Strain cards are intentionally
// excluded here: the dedicated homepage release-card reconciler owns those exact
// product images after the Learning transaction. Missing educational matches must
// fall through to the publisher's image-less placeholder.
const originalMediaChooser = `function chooseMedia(media, groups, used = new Set()) {
  for (const group of groups) {
    const terms = Array.isArray(group) ? group : [group];
    const match = media.find(item => item?.source_url && !used.has(item.id) && terms.every(term => mediaText(item).includes(String(term).toLowerCase())));
    if (match) {
      used.add(match.id);
      return match;
    }
  }
  return null;
}`;

const approvedMediaChooser = `function isApprovedLearningMedia(item) {
  const slug = String(item?.slug || '').toLowerCase();
  const text = mediaText(item);
  if (slug.startsWith('dtf-strain-card-')) return false;
  return slug.startsWith('dtf-approved-visual-') ||
    text.includes('dtf_approved_public_visual') ||
    text.includes('dtf-approved-public-visual');
}

function chooseMedia(media, groups, used = new Set()) {
  for (const group of groups) {
    const terms = Array.isArray(group) ? group : [group];
    const match = media.find(item => item?.source_url && isApprovedLearningMedia(item) && !used.has(item.id) && terms.every(term => mediaText(item).includes(String(term).toLowerCase())));
    if (match) {
      used.add(match.id);
      return match;
    }
  }
  return null;
}`;

const chooserOriginalCount = source.split(originalMediaChooser).length - 1;
const chooserApprovedCount = source.split(approvedMediaChooser).length - 1;
if (chooserOriginalCount === 1) source = source.replace(originalMediaChooser, approvedMediaChooser);
else if (chooserApprovedCount !== 1) {
  throw new Error(`Could not locate exactly one Learning V3 automatic media chooser; original=${chooserOriginalCount}, approved=${chooserApprovedCount}`);
}

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

for (const marker of [
  'function isApprovedLearningMedia(item)',
  "slug.startsWith('dtf-approved-visual-')",
  "slug.startsWith('dtf-strain-card-')",
  'isApprovedLearningMedia(item) &&',
]) {
  if (!source.includes(marker)) throw new Error(`Prepared Learning V3 publisher is missing role-safe visual-quality gate marker: ${marker}`);
}

await writeFile(outputPath, source, 'utf8');
console.log(JSON.stringify({
  sourcePath,
  outputPath,
  rootVerification: 'wordpress-rest',
  topicVerification: 'anonymous-public',
  mediaSelection: 'approved-learning-only',
  strainCardsOwnedBy: 'homepage-release-reconciler',
  imageLessFallback: true
}, null, 2));

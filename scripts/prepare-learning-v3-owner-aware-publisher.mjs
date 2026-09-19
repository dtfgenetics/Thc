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

const guardedMediaChooser = `function chooseMedia(media, groups, used = new Set()) {
  for (const group of groups) {
    const terms = Array.isArray(group) ? group : [group];
    const match = media.find(item => item?.source_url && !isRetiredMedia(item) && !used.has(item.id) && terms.every(term => mediaText(item).includes(String(term).toLowerCase())));
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

const approvedGuardedMediaChooser = `function isApprovedLearningMedia(item) {
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
    const match = media.find(item => item?.source_url && !isRetiredMedia(item) && isApprovedLearningMedia(item) && !used.has(item.id) && terms.every(term => mediaText(item).includes(String(term).toLowerCase())));
    if (match) {
      used.add(match.id);
      return match;
    }
  }
  return null;
}`;

const chooserOriginalCount = source.split(originalMediaChooser).length - 1;
const chooserGuardedCount = source.split(guardedMediaChooser).length - 1;
const chooserApprovedCount = source.split(approvedMediaChooser).length - 1;
const chooserApprovedGuardedCount = source.split(approvedGuardedMediaChooser).length - 1;
if (chooserGuardedCount === 1) source = source.replace(guardedMediaChooser, approvedGuardedMediaChooser);
else if (chooserOriginalCount === 1) source = source.replace(originalMediaChooser, approvedMediaChooser);
else if (chooserApprovedGuardedCount !== 1 && chooserApprovedCount !== 1) {
  throw new Error(`Could not locate exactly one Learning V3 automatic media chooser; original=${chooserOriginalCount}, guarded=${chooserGuardedCount}, approved=${chooserApprovedCount}, approvedGuarded=${chooserApprovedGuardedCount}`);
}

// The topic-page "Visual references" rail has its own media search. It must use
// the same role-safe approval predicate as hero/topic media; otherwise keyword
// matches can pull product strain cards from the shared WordPress media library.
const originalRelatedFilter = `const scored = media.filter(item => item?.source_url).map(item => {`;
const guardedRelatedFilter = `const scored = media.filter(item => item?.source_url && !isRetiredMedia(item)).map(item => {`;
const approvedRelatedFilter = `const scored = media.filter(item => item?.source_url && isApprovedLearningMedia(item)).map(item => {`;
const approvedGuardedRelatedFilter = `const scored = media.filter(item => item?.source_url && !isRetiredMedia(item) && isApprovedLearningMedia(item)).map(item => {`;
const relatedOriginalCount = source.split(originalRelatedFilter).length - 1;
const relatedGuardedCount = source.split(guardedRelatedFilter).length - 1;
const relatedApprovedCount = source.split(approvedRelatedFilter).length - 1;
const relatedApprovedGuardedCount = source.split(approvedGuardedRelatedFilter).length - 1;
if (relatedGuardedCount === 1) source = source.replace(guardedRelatedFilter, approvedGuardedRelatedFilter);
else if (relatedOriginalCount === 1) source = source.replace(originalRelatedFilter, approvedRelatedFilter);
else if (relatedApprovedGuardedCount !== 1 && relatedApprovedCount !== 1) {
  throw new Error(`Could not locate exactly one Learning V3 related-media selector; original=${relatedOriginalCount}, guarded=${relatedGuardedCount}, approved=${relatedApprovedCount}, approvedGuarded=${relatedApprovedGuardedCount}`);
}

const original = `const checks = [];
if (apply) {
  checks.push(await publicCheck('/', 'data-dtf-layout="home-v3"'));
  checks.push(await publicCheck('/learn/', 'data-dtf-layout="learn-v3"'));
  for (const topic of topics) checks.push(await publicCheck(topic.route, \`data-dtf-topic="\${topic.id}"\`));
  const failures = checks.filter(check => check.status !== 200 || !check.markerFound);
  if (failures.length) throw new Error(\`Visitor verification failed: \${failures.map(item => \`\${item.path}:\${item.status}:\${item.markerFound}\`).join(', ')}\`);
}`;

const progressiveOriginal = `const checks = [];
if (apply) {
  checks.push(await publicCheck('/', 'data-dtf-layout="home-v3"'));
  checks.push(await publicCheck('/learn/', 'data-dtf-layout="learn-v3"'));
  for (const topic of topics) { checks.push(await publicCheck(topic.route, \`data-dtf-topic="\${topic.id}"\`)); checks.push(await publicCheck(topic.route, 'data-progressive-disclosure="true"')); }
  const failures = checks.filter(check => check.status !== 200 || !check.markerFound);
  if (failures.length) throw new Error(\`Visitor verification failed: \${failures.map(item => \`\${item.path}:\${item.status}:\${item.markerFound}\`).join(', ')}\`);
}`;

const ownerAware = `const checks = [];
if (apply) {
  const storedRootCheck = async (slug, marker) => {
    const { body } = await request(\`/wp-json/wp/v2/pages?slug=\${encodeURIComponent(slug)}&context=edit&status=publish&per_page=100\`);
    const roots = (Array.isArray(body) ? body : []).filter(page => Number(page.parent || 0) === 0);
    if (roots.length !== 1) return { path: \`wordpress:/\${slug}/\`, status: 409, marker, markerFound: false, bytes: 0, owner: 'wordpress-rest' };
    const content = roots[0]?.content;
    const stored = typeof content === 'string' ? content : (content?.raw || content?.rendered || '');
    return { path: \`wordpress:/\${slug}/\`, status: 200, marker, markerFound: stored.includes(marker), bytes: stored.length, owner: 'wordpress-rest-raw-first', pageId: roots[0].id };
  };
  checks.push(await storedRootCheck('home', 'data-dtf-layout="home-v3"'));
  checks.push(await storedRootCheck('learn', 'data-dtf-layout="learn-v3"'));
  for (const topic of topics) checks.push(await publicCheck(topic.route, \`data-dtf-topic="\${topic.id}"\`));
  const failures = checks.filter(check => check.status !== 200 || !check.markerFound);
  if (failures.length) throw new Error(\`Owner-aware verification failed: \${failures.map(item => \`\${item.path}:\${item.status}:\${item.markerFound}\`).join(', ')}\`);
}`;

const progressiveOwnerAware = `const checks = [];
if (apply) {
  const storedRootCheck = async (slug, marker) => {
    const { body } = await request(\`/wp-json/wp/v2/pages?slug=\${encodeURIComponent(slug)}&context=edit&status=publish&per_page=100\`);
    const roots = (Array.isArray(body) ? body : []).filter(page => Number(page.parent || 0) === 0);
    if (roots.length !== 1) return { path: \`wordpress:/\${slug}/\`, status: 409, marker, markerFound: false, bytes: 0, owner: 'wordpress-rest' };
    const content = roots[0]?.content;
    const stored = typeof content === 'string' ? content : (content?.raw || content?.rendered || '');
    return { path: \`wordpress:/\${slug}/\`, status: 200, marker, markerFound: stored.includes(marker), bytes: stored.length, owner: 'wordpress-rest-raw-first', pageId: roots[0].id };
  };
  checks.push(await storedRootCheck('home', 'data-dtf-layout="home-v3"'));
  checks.push(await storedRootCheck('learn', 'data-dtf-layout="learn-v3"'));
  for (const topic of topics) { checks.push(await publicCheck(topic.route, \`data-dtf-topic="\${topic.id}"\`)); checks.push(await publicCheck(topic.route, 'data-progressive-disclosure="true"')); }
  const failures = checks.filter(check => check.status !== 200 || !check.markerFound);
  if (failures.length) throw new Error(\`Owner-aware verification failed: \${failures.map(item => \`\${item.path}:\${item.status}:\${item.markerFound}\`).join(', ')}\`);
}`;

const originalCount = source.split(original).length - 1;
const progressiveOriginalCount = source.split(progressiveOriginal).length - 1;
const ownerAwareCount = source.split(ownerAware).length - 1;
const progressiveOwnerAwareCount = source.split(progressiveOwnerAware).length - 1;

if (progressiveOriginalCount === 1) source = source.replace(progressiveOriginal, progressiveOwnerAware);
else if (originalCount === 1) source = source.replace(original, ownerAware);
else if (progressiveOwnerAwareCount !== 1 && ownerAwareCount !== 1) {
  throw new Error(`Could not locate exactly one Learning V3 mixed root/topic verification block; original=${originalCount}, progressiveOriginal=${progressiveOriginalCount}, ownerAware=${ownerAwareCount}, progressiveOwnerAware=${progressiveOwnerAwareCount}. Refusing an unreviewed owner-verification patch.`);
}

for (const marker of [
  'function isApprovedLearningMedia(item)',
  "slug.startsWith('dtf-approved-visual-')",
  "slug.startsWith('dtf-strain-card-')",
  'isApprovedLearningMedia(item) &&',
  "content?.raw || content?.rendered || ''",
  "owner: 'wordpress-rest-raw-first'",
]) {
  if (!source.includes(marker)) throw new Error(`Prepared Learning V3 publisher is missing required owner/media marker: ${marker}`);
}

if (!source.includes(approvedRelatedFilter) && !source.includes(approvedGuardedRelatedFilter)) {
  throw new Error('Prepared Learning V3 publisher is missing an approved related-media selector.');
}
if (source.includes('function isRetiredMedia(item)')) {
  if (!source.includes('!isRetiredMedia(item) && isApprovedLearningMedia(item)')) {
    throw new Error('Prepared Learning V3 publisher lost the retired-media guard while applying approved-only selection.');
  }
}
if (progressiveOriginalCount === 1 || progressiveOwnerAwareCount === 1) {
  if (!source.includes('data-progressive-disclosure="true"')) throw new Error('Progressive Learning V3 source lost its progressive-disclosure verification during owner-aware preparation.');
}

await writeFile(outputPath, source, 'utf8');
console.log(JSON.stringify({
  sourcePath,
  outputPath,
  rootVerification: 'wordpress-rest',
  rootStorageRead: 'raw-first',
  topicVerification: 'anonymous-public',
  progressiveTopicVerification: source.includes('data-progressive-disclosure="true"'),
  mediaSelection: 'approved-learning-only',
  relatedMediaSelection: 'approved-learning-only',
  strainCardsOwnedBy: 'homepage-release-reconciler',
  imageLessFallback: true
}, null, 2));

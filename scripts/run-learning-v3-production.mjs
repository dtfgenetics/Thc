import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

// Canonical owner-chain trigger: V3 base owners -> V4 guided learning -> subject V6 finalizers.
const sourcePath = process.env.CANONICAL_TOPIC_LITERATURE_PATH || 'site/wordpress/education/topic-literature.json';
const normalizedPath = process.env.NORMALIZED_TOPIC_LITERATURE_PATH || '/tmp/dtf-topic-literature-v3-normalized.json';
const publisherPath = process.env.LEARNING_V3_PUBLISHER_PATH || 'scripts/rebuild-wordpress-learning-experience-v3.mjs';
const normalizedPublisherPath = process.env.NORMALIZED_LEARNING_V3_PUBLISHER_PATH || '/tmp/rebuild-wordpress-learning-experience-v3-normalized.mjs';
const source = JSON.parse(await readFile(sourcePath, 'utf8'));
if (!Array.isArray(source?.topics) || !source.topics.length) throw new Error('Canonical topic literature is empty');

const rules = [
  { id: 'plant-biology', terms: ['plant biology'] },
  { id: 'genetics-breeding', terms: ['genetics', 'breeding'] },
  { id: 'lifecycle-propagation', terms: ['lifecycle', 'propagation'] },
  { id: 'environment-vpd', terms: ['environment', 'vpd'] },
  { id: 'lighting', terms: ['lighting'] },
  { id: 'water-root-zone', terms: ['water', 'root zone'] },
  { id: 'nutrition-media', terms: ['nutrition', 'media'] },
  { id: 'training-canopy', terms: ['training', 'canopy'] },
  { id: 'plant-health-ipm', terms: ['plant health', 'ipm'] },
  { id: 'harvest-postharvest', terms: ['harvest', 'post-harvest'] },
  { id: 'outdoor-cultivation', terms: ['outdoor'] },
  { id: 'evidence-measurement', terms: ['evidence', 'measurement'] }
];

const used = new Set();
const topics = source.topics.map(topic => {
  const hay = `${topic.id || ''} ${topic.title || ''}`.toLowerCase();
  const rule = rules.find(candidate => !used.has(candidate.id) && candidate.terms.some(term => hay.includes(term)));
  if (!rule) return topic;
  used.add(rule.id);
  return { ...topic, id: rule.id, canonicalSourceId: topic.id };
});

const required = ['plant-biology','genetics-breeding','lifecycle-propagation','environment-vpd','lighting','water-root-zone','nutrition-media','training-canopy','plant-health-ipm','harvest-postharvest','outdoor-cultivation','evidence-measurement'];
const ids = new Set(topics.map(topic => topic.id));
const missing = required.filter(id => !ids.has(id));
if (missing.length) throw new Error(`Could not normalize required THC topics: ${missing.join(', ')}`);

await writeFile(normalizedPath, `${JSON.stringify({ ...source, normalizedFor: 'learning-v3', topics }, null, 2)}\n`);
process.env.TOPIC_LITERATURE_PATH = normalizedPath;

// Subject hero images are intentionally strict. A polished branded subject panel is preferable
// to a visually impressive but misleading image (for example a seedling card on Lighting or a
// root-pathogen diagram on a general water/pH/EC page).
let publisher = await readFile(publisherPath, 'utf8');
const selectorPatches = [
  {
    name: 'lighting',
    original: "  'lighting': [['ppfd'], ['dli'], ['lighting']],",
    strict: "  'lighting': [['dli', 'ppfd'], ['dli', 'light', 'education'], ['ppfd', 'light']],"
  },
  {
    name: 'water-root-zone',
    original: "  'water-root-zone': [['root', 'zone'], ['root', 'anatomy'], ['water']],",
    strict: "  'water-root-zone': [['nutrient', 'uptake', 'root', 'zone'], ['root', 'zone', 'chemistry'], ['ph', 'ec'], ['root', 'anatomy']],"
  },
  {
    name: 'harvest-postharvest',
    original: "  'harvest-postharvest': [['harvest'], ['drying'], ['curing'], ['trichome']],",
    strict: "  'harvest-postharvest': [['drying', 'environment'], ['curing'], ['trichome', 'maturity'], ['harvest', 'handling']],"
  },
  {
    name: 'outdoor-cultivation',
    original: "  'outdoor-cultivation': [['outdoor'], ['life', 'cycle'], ['plant', 'anatomy']],",
    strict: "  'outdoor-cultivation': [['outdoor', 'site'], ['outdoor', 'cultivation'], ['microclimate'], ['hardening', 'off']],"
  }
];

for (const patch of selectorPatches) {
  if (!publisher.includes(patch.original) && !publisher.includes(patch.strict)) {
    throw new Error(`Could not locate the Learning V3 ${patch.name} media selector; refusing an unreviewed runtime patch.`);
  }
  publisher = publisher.replace(patch.original, patch.strict);
}

const originalMissingVisual = `function img(item, alt, { ratio = '4/3', eager = false } = {}) {
  if (!item) return '<div class="v3-image-placeholder" aria-hidden="true"></div>';
  return \`<img src="\${esc(imageUrl(item))}" alt="\${esc(imageAlt(item, alt))}" \${eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async" style="aspect-ratio:\${esc(ratio)}">\`;
}`;
const brandedMissingVisual = `function img(item, alt, { ratio = '4/3', eager = false } = {}) {
  if (!item) return \`<div class="v3-image-placeholder" role="img" aria-label="\${esc(alt)}"><span>Teaching Healthy Cultivation</span><strong>\${esc(alt)}</strong></div>\`;
  return \`<img src="\${esc(imageUrl(item))}" alt="\${esc(imageAlt(item, alt))}" \${eager ? 'loading="eager" fetchpriority="high"' : 'loading="lazy"'} decoding="async" style="aspect-ratio:\${esc(ratio)}">\`;
}`;
if (!publisher.includes(originalMissingVisual) && !publisher.includes(brandedMissingVisual)) {
  throw new Error('Could not locate the Learning V3 missing-visual renderer; refusing an unreviewed runtime patch.');
}
publisher = publisher.replace(originalMissingVisual, brandedMissingVisual);

const originalPlaceholderCss = `.v3-image-placeholder{width:100%;aspect-ratio:4/3;border-radius:24px;background:linear-gradient(135deg,#dbe7dc,#edf2e9)}`;
const brandedPlaceholderCss = `.v3-image-placeholder{position:relative;display:flex;flex-direction:column;justify-content:flex-end;width:100%;aspect-ratio:4/3;overflow:hidden;border-radius:24px;padding:26px;background:radial-gradient(circle at 78% 20%,rgba(214,183,92,.34),transparent 28%),linear-gradient(145deg,#0a2114,#17482b);border:1px solid rgba(214,183,92,.38);color:#fff}.v3-image-placeholder:before{content:'THC';position:absolute;right:18px;top:12px;color:rgba(255,255,255,.07);font-size:clamp(4rem,10vw,8rem);font-weight:950;letter-spacing:-.08em}.v3-image-placeholder span{position:relative;z-index:1;margin-bottom:8px;color:#d6b75c;font-size:.72rem;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.v3-image-placeholder strong{position:relative;z-index:1;max-width:85%;font-size:clamp(1.3rem,3vw,2.25rem);line-height:1.02;letter-spacing:-.035em}`;
if (!publisher.includes(originalPlaceholderCss) && !publisher.includes(brandedPlaceholderCss)) {
  throw new Error('Could not locate the Learning V3 placeholder CSS; refusing an unreviewed runtime patch.');
}
publisher = publisher.replace(originalPlaceholderCss, brandedPlaceholderCss);

// Home is genetics-first. Reviewed release slots and the main hero must never use generic cultivation art.
const originalReleaseImages = `const releaseImages = {
  mangoRegular: chooseMedia(media, [['flower', 'anatomy'], ['trichome']], used) || fallbackHero,
  mangoFem: chooseMedia(media, [['trichome'], ['flower']], used) || fallbackHero,
  bubblegum: chooseMedia(media, [['sex', 'expression'], ['genetics']], used) || fallbackHero
};`;
const reviewedReleaseImages = `const releaseImages = {
  mangoRegular: chooseMedia(media, [['dtf-strain-card-blue-mango-f2-regular']], new Set()) || fallbackHero,
  mangoFem: chooseMedia(media, [['dtf-strain-card-blue-mango-f2-feminized']], new Set()) || fallbackHero,
  bubblegum: chooseMedia(media, [['dtf-strain-card-blue-bubblegum-f1-regular']], new Set()) || fallbackHero
};
const reviewedGeneticsHero = chooseMedia(media, [['dtf-strain-card-blue-mango-f2-regular']], new Set()) || releaseImages.mangoRegular || fallbackHero;`;
if (!publisher.includes(originalReleaseImages) && !publisher.includes(reviewedReleaseImages)) {
  throw new Error('Could not locate the Learning V3 Home release-image selector; refusing to publish education art into genetics positions.');
}
publisher = publisher.replace(originalReleaseImages, reviewedReleaseImages);

const originalReleaseCss = `.v3 .release img{display:block;width:100%;aspect-ratio:16/10;object-fit:cover}`;
const reviewedReleaseCss = `.v3 .release img{display:block;width:100%;aspect-ratio:2/3;object-fit:contain;background:#fff;padding:10px}.v3 .hero-media img{object-fit:contain!important;background:#fff!important;padding:10px}`;
if (!publisher.includes(originalReleaseCss) && !publisher.includes(reviewedReleaseCss)) {
  throw new Error('Could not locate the Learning V3 Home release image CSS.');
}
publisher = publisher.replace(originalReleaseCss, reviewedReleaseCss);

const originalHomeHero = "<div class=\"hero-media\">${img(fallbackHero, 'DTF Genetics and Teaching Healthy Cultivation plant science', { ratio: '1/1', eager: true })}</div>";
const reviewedHomeHero = "<div class=\"hero-media\">${img(reviewedGeneticsHero, 'Blue Mango F2 Regular DTF Genetics strain card', { ratio: '2/3', eager: true })}</div>";
if (!publisher.includes(originalHomeHero) && !publisher.includes(reviewedHomeHero)) {
  throw new Error('Could not locate the Learning V3 Home hero image slot.');
}
publisher = publisher.replace(originalHomeHero, reviewedHomeHero);

await writeFile(normalizedPublisherPath, publisher);
await import(pathToFileURL(normalizedPublisherPath).href);
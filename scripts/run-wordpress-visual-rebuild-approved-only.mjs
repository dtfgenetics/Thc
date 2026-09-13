import { readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import process from 'node:process';

const sourcePath=join(process.cwd(),'scripts/rebuild-wordpress-visual-site.mjs');
const policyPath=join(process.cwd(),'site/wordpress/visual-quality-policy.json');
const generatedPath=join(process.cwd(),'scripts/.rebuild-wordpress-visual-site-approved-only.generated.mjs');

const [source,policyRaw]=await Promise.all([
  readFile(sourcePath,'utf8'),
  readFile(policyPath,'utf8')
]);
const policy=JSON.parse(policyRaw);
if(Number(policy?.schemaVersion||0)<2) throw new Error('Visual quality policy v2+ is required');
if(policy?.replacementPolicy?.automaticKeywordMediaSelectionAllowed!==false) throw new Error('Automatic keyword media selection must stay disabled');

const approvedSlugs=JSON.stringify(policy.approvedMediaSlugs||[]);
const approvedPrefixes=JSON.stringify(policy.approvedMediaSlugPrefixes||[]);
const choosePattern=/function choose\(media, groups, used = new Set\(\)\) \{[\s\S]*?\n\}\n\nfunction imageUrl/;
if(!choosePattern.test(source)) throw new Error('Expected visual rebuild choose() implementation was not found');

const approvedChoose=`const approvedVisualSlugs = new Set(${approvedSlugs});
const approvedVisualPrefixes = ${approvedPrefixes};
function isApprovedVisualMedia(item) {
  const slug = String(item?.slug || '');
  return approvedVisualSlugs.has(slug) || approvedVisualPrefixes.some((prefix) => slug.startsWith(prefix));
}

function choose(media, groups, used = new Set()) {
  const approvedMedia = media.filter((item) => item?.source_url && isApprovedVisualMedia(item));
  for (const group of groups) {
    const needles = Array.isArray(group) ? group : [group];
    const found = approvedMedia.find((item) => !used.has(item.id) && needles.every((needle) => mediaText(item).includes(String(needle).toLowerCase())));
    if (found) {
      used.add(found.id);
      return found;
    }
  }
  return null;
}

function imageUrl`;

let generated=source.replace(choosePattern,approvedChoose);
const styleNeedle='  </style>`;';
if(!generated.includes(styleNeedle)) throw new Error('Expected page style terminator was not found');
generated=generated.replace(styleNeedle,`  .dtf-hero-media:empty{display:none}
  .dtf-hero-grid:has(.dtf-hero-media:empty){grid-template-columns:1fr;max-width:920px}
  .dtf-image-card:not(:has(.dtf-img)) .dtf-card-copy{padding-block:28px}
  </style>\`;`);
generated=generated.replace("stat('73+', 'finished teaching infographics')","stat('Approved', 'visuals only')");

const legacyMarkers=[
  'Cannabis_Plant_Anatomy_Infographic.png',
  'Cannabis_Sex_Expression_and_Chromosome_Combinations.png',
  'Beneficial_Insects_and_Biological_Controls.png',
  'dtf-edu-'
];
for(const marker of legacyMarkers){
  if(generated.includes(marker)) throw new Error(`Approved-only visual rebuild source still contains quarantined marker: ${marker}`);
}

await writeFile(generatedPath,generated,'utf8');
try{
  await import(`${pathToFileURL(generatedPath).href}?approved=${Date.now()}`);
}finally{
  await unlink(generatedPath).catch(()=>{});
}

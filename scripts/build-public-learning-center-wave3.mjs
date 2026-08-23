import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(process.cwd(), 'site/public-route-patch/learn');
const discord = 'https://discord.gg/xJbUeHFPMt';

const routes = [
  {
    slug: 'start-here',
    title: 'Start Here — Teaching Healthy Cultivation',
    description: 'A beginner-friendly starting path for cannabis plant science, safe grow-space setup, environment, root-zone fundamentals, plant health, and recordkeeping.',
    eyebrow: 'Start here',
    heading: 'Build the fundamentals before chasing fixes.',
    intro: 'Teaching Healthy Cultivation works best when the grow is treated as a connected system. Start with plant stage, environment, light, roots, water, sanitation, and records before jumping to a single diagnosis or product.',
    sections: [
      ['1. Know the plant stage', 'Identify whether the plant is germinating, a seedling, vegetative, transitioning, flowering, finishing, or recovering. Stage changes what should be measured and how symptoms are interpreted.', '/learn/encyclopedia/'],
      ['2. Make the space safe and measurable', 'Confirm electrical and water safety, airflow, sensor placement, sanitation, access, and emergency shutoffs before optimizing crop performance.', '/learn/setup/'],
      ['3. Measure the environment', 'Track temperature, relative humidity, leaf temperature when available, VPD, PPFD, DLI, photoperiod, and canopy variation instead of relying on room labels or fixture wattage.', '/learn/environment/'],
      ['4. Understand the root zone', 'Record media, container, source water, pH, EC, irrigation volume, drainage, dryback, oxygen, and root condition as one interacting system.', '/learn/root-zone/'],
      ['5. Observe before treating', 'Use symptom location, pattern, progression, plant stage, measurements, pests, roots, irrigation history, and recent changes before deciding what a plant problem is.', '/learn/plant-health/'],
      ['6. Keep records', 'Photos, dates, environmental readings, irrigation, feed records, plant labels, interventions, and outcomes turn memory into evidence you can compare later.', '/learn/records/']
    ],
    actions: [
      ['/learn/beginner-guides/', 'Open Beginner Guides'],
      ['/learn/search/', 'Search THC Education'],
      ['/thc-grow-doc/', 'Diagnose a Plant'],
      ['/growlens/', 'Open GrowLens']
    ]
  },
  {
    slug: 'beginner-guides',
    title: 'Beginner Grow Guides — Teaching Healthy Cultivation',
    description: 'Beginner cultivation guides organized around plant biology, grow-space setup, propagation, environment, root-zone care, plant health, harvest, and records.',
    eyebrow: 'Beginner guides',
    heading: 'A practical path from first setup to confident observation.',
    intro: 'These guides are organized to prevent the most common beginner mistake: changing several things at once without measuring what the plant is actually experiencing.',
    sections: [
      ['Before plants enter the space', 'Build the room around safety, drainage, airflow, sensors, sanitation, pest exclusion, and realistic equipment loads.', '/learn/setup/'],
      ['Seeds, clones, and early plants', 'Learn identity, provenance, germination and propagation concepts, rooting, acclimation, and early-stage observations.', '/learn/propagation/'],
      ['Light and climate', 'Learn PPFD, DLI, photoperiod, temperature, humidity, VPD, airflow, mapping, and canopy-level measurement.', '/learn/environment/'],
      ['Water, pH, EC, and media', 'Understand source water, alkalinity, conductivity, media physics, irrigation, drainage, dryback, root oxygen, and nutrient records.', '/learn/root-zone/'],
      ['Plant health and IPM', 'Use scouting, pattern recognition, pest identification, sanitation, quarantine, lawful controls, and follow-up records.', '/learn/plant-health/'],
      ['Use references instead of guesses', 'Move into the Encyclopedia, visual library, and search when you need deeper explanations or definitions.', '/learn/encyclopedia/']
    ],
    actions: [
      ['/learn/start-here/', 'Start at the beginning'],
      ['/learn/infographics/', 'Browse Infographics'],
      ['/learn/glossary/', 'Open Glossary'],
      ['/learn/search/', 'Search the Library']
    ]
  },
  {
    slug: 'sops',
    title: 'SOPs & Measurement — Teaching Healthy Cultivation',
    description: 'Measurement-first cultivation SOP guidance for pH, EC, PPFD, DLI, temperature, humidity, VPD, scouting, sanitation, calibration, and recordkeeping.',
    eyebrow: 'SOPs & measurement',
    heading: 'Repeatable measurements make cultivation decisions auditable.',
    intro: 'An SOP should make the same task repeatable across people and dates. Record the instrument, method, location, units, time, plant stage, and any conditions that could change the result.',
    sections: [
      ['pH measurement', 'Calibrate with appropriate standards, rinse and store probes correctly, record sample type and temperature context, and never compare incompatible sample methods as if they are identical.', '/learn/root-zone/'],
      ['EC / conductivity measurement', 'Preserve the original EC value and units, identify source water versus feed versus runoff or extract, and record the sampling method.', '/learn/root-zone/'],
      ['PPFD and DLI', 'Map more than one canopy point, record sensor position and photoperiod, and calculate DLI from representative PPFD rather than fixture wattage.', '/learn/environment/'],
      ['Temperature, RH, leaf temperature, and VPD', 'Record sensor location and time. Use VPD as context for plant water relations, not as a stand-alone diagnosis.', '/learn/environment/'],
      ['Scouting and plant-health records', 'Use a repeatable route, map locations, preserve photos and samples, and separate observation from confirmed cause.', '/learn/plant-health/'],
      ['Sanitation and change control', 'Document cleaning, quarantine, tool hygiene, equipment changes, corrective actions, and follow-up verification so recurring problems can be investigated.', '/learn/setup/']
    ],
    actions: [
      ['/learn/records/', 'Open Record Templates'],
      ['/learn/glossary/', 'Measurement Glossary'],
      ['/learn/infographics/', 'Visual References'],
      ['/tools/', 'Open Tools']
    ]
  },
  {
    slug: 'glossary',
    title: 'Cultivation Glossary — Teaching Healthy Cultivation',
    description: 'A practical cannabis cultivation glossary covering plant science, light, climate, water, root-zone chemistry, propagation, plant health, breeding, and measurement.',
    eyebrow: 'Glossary',
    heading: 'Use the same words for the same measurements.',
    intro: 'Clear terminology prevents errors. These definitions are short working references; use the Encyclopedia and learning centers when you need mechanism, evidence limits, or cultivation context.',
    glossary: [
      ['Alkalinity', 'Water’s acid-neutralizing capacity; it is not the same thing as pH.'],
      ['Anthesis', 'The period when a flower is functionally open; in male cannabis this includes pollen-shedding stages.'],
      ['CEC', 'Cation exchange capacity: the ability of a material to hold and exchange positively charged ions.'],
      ['Chemotype', 'A chemically characterized biological type, commonly used when discussing cannabinoid or other metabolite profiles.'],
      ['Clone', 'A plant propagated vegetatively from donor tissue and expected to share the donor genotype, subject to mutation, disease, and handling effects.'],
      ['DLI', 'Daily light integral: the total photosynthetically active photon exposure received per square meter per day.'],
      ['Dryback', 'A defined decline in substrate water content or weight between irrigation events; the measurement method must be stated.'],
      ['EC', 'Electrical conductivity: a measure related to dissolved ionic concentration, commonly reported in mS/cm or µS/cm.'],
      ['Genotype', 'The genetic constitution of an organism or the alleles considered at specified loci.'],
      ['Hardness', 'Primarily the concentration of dissolved calcium and magnesium ions in water; distinct from alkalinity.'],
      ['IPM', 'Integrated pest management: prevention, monitoring, identification, thresholds, lawful controls, and evaluation used as a coordinated system.'],
      ['PAR', 'Photosynthetically active radiation, conventionally the 400–700 nm photon waveband used in plant-light measurement.'],
      ['Phenotype', 'Observable traits produced by the interaction of genotype, development, and environment.'],
      ['Photoperiod', 'The duration and timing of light and dark within a 24-hour cycle.'],
      ['pH', 'A logarithmic measure related to hydrogen-ion activity; it does not directly measure alkalinity or nutrient concentration.'],
      ['PPFD', 'Photosynthetic photon flux density: PAR photons arriving at a surface per square meter per second, usually µmol·m⁻²·s⁻¹.'],
      ['Rhizosphere', 'The soil or substrate region directly influenced by roots and associated organisms.'],
      ['Runoff', 'Drainage leaving a container after irrigation; interpretation depends on system, sampling, timing, and method.'],
      ['Senescence', 'Regulated aging and remobilization processes that precede tissue death.'],
      ['VPD', 'Vapor pressure deficit: the difference between saturation vapor pressure and actual vapor pressure; plant interpretation depends on leaf and air conditions.']
    ],
    actions: [
      ['/learn/search/', 'Search Education'],
      ['/learn/encyclopedia/', 'Open Encyclopedia'],
      ['/learn/sops/', 'SOPs & Measurement'],
      ['/learn/infographics/', 'Visual Library']
    ]
  },
  {
    slug: 'records',
    title: 'Grow Records & Printables — Teaching Healthy Cultivation',
    description: 'Print-friendly cultivation record templates for daily grow logs, environmental readings, irrigation and feed records, plant observations, IPM scouting, and breeding selections.',
    eyebrow: 'Records & printables',
    heading: 'Turn observations into a usable grow history.',
    intro: 'Print this page or copy the fields into your preferred notebook or spreadsheet. Consistent records make it easier to compare plants, identify changes, investigate problems, and repeat successful decisions.',
    recordGroups: [
      ['Daily grow log', ['Date / time', 'Plant or room ID', 'Plant stage', 'Air temperature', 'Relative humidity', 'Leaf temperature if measured', 'Light / photoperiod notes', 'General observations', 'Actions taken', 'Photo IDs']],
      ['Irrigation & feed record', ['Date / time', 'Source water EC / pH if measured', 'Product / input names', 'Mix sequence', 'Final EC', 'Final pH', 'Volume applied', 'Drainage / runoff method and result', 'Dryback method / observation', 'Plant response']],
      ['Plant observation record', ['Plant ID', 'Cultivar / source / generation', 'Stage', 'Symptom location', 'Pattern and color', 'Progression', 'Roots / media observations', 'Recent environmental or irrigation changes', 'Possible causes being compared', 'Follow-up date']],
      ['IPM scouting record', ['Date / time', 'Scout', 'Area / map position', 'Trap or sample ID', 'Organism / symptom observed', 'Life stage if known', 'Count / severity', 'Photo or sample reference', 'Action / quarantine', 'Follow-up result']],
      ['Breeding & selection record', ['Cross / family ID', 'Generation', 'Plant ID', 'Parent IDs', 'Germination / establishment dates', 'Morphology', 'Flowering timing', 'Aroma / resin / structure observations', 'Health / stress notes', 'Selection decision and reason']]
    ],
    actions: [
      ['javascript:window.print()', 'Print This Page'],
      ['/growlens/', 'Use GrowLens'],
      ['/learn/sops/', 'Measurement SOPs'],
      ['/learn/search/', 'Search Education']
    ]
  },
  {
    slug: 'search',
    title: 'Search THC Education — Teaching Healthy Cultivation',
    description: 'Search Teaching Healthy Cultivation pages, the plant science encyclopedia, Academy, infographics, diagnostics, grow tools, and cultivation learning centers.',
    eyebrow: 'Education search',
    heading: 'Find the right THC resource quickly.',
    intro: 'Use the site search for a term such as VPD, pH, EC, roots, germination, spider mites, trichomes, cloning, PPFD, DLI, sex expression, or drying. Results may include related DTF pages in addition to education resources.',
    search: true,
    sections: [
      ['Plant science', 'Botany, anatomy, morphology, physiology, roots, leaves, flowers, trichomes, genetics, reproduction, seed biology, and development.', '/learn/encyclopedia/'],
      ['Cultivation systems', 'Setup, lighting, climate, root zone, irrigation, nutrition, propagation, plant health, IPM, and measurement.', '/learn/library/'],
      ['Visual references', 'Browse the public source-controlled infographic library.', '/learn/infographics/'],
      ['Diagnose a plant', 'Use structured evidence and differential reasoning with THC Grow Doc.', '/thc-grow-doc/'],
      ['Grow records and tools', 'Open GrowLens for cultivation records and calculations.', '/growlens/']
    ],
    actions: [
      ['/learn/', 'Back to Learn'],
      ['/learn/glossary/', 'Glossary'],
      ['/learn/academy/', 'Academy'],
      ['/learn/records/', 'Records']
    ]
  }
];

function esc(v='') {
  return String(v)
    .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
    .replaceAll('"','&quot;').replaceAll("'",'&#039;');
}

const style = `<style>
:root{--ink:#15341f;--muted:#496253;--green:#176d39;--deep:#0d2c1a;--lime:#d9f06e;--cream:#f7faf7;--line:#d6e4d9;--card:#fff}
*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
main{max-width:1180px;margin:auto;padding:42px 22px 72px}.hero{padding:34px 0 26px}.eyebrow{font-weight:900;letter-spacing:.11em;text-transform:uppercase;color:var(--green);font-size:.82rem}
h1{font-size:clamp(2.35rem,6vw,4.7rem);line-height:1.02;letter-spacing:-.045em;margin:.25em 0 .3em}h2{font-size:clamp(1.65rem,3vw,2.35rem);letter-spacing:-.025em}
.lede{max-width:850px;color:var(--muted);font-size:1.12rem;line-height:1.75}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:17px;margin:26px 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:22px;box-shadow:0 10px 26px rgba(22,64,35,.06)}.card h3{margin:0 0 8px;font-size:1.18rem}.card p{color:var(--muted);line-height:1.62}
.card a,.btn{display:inline-block;margin-top:8px;padding:10px 14px;border-radius:999px;background:var(--green);color:white;text-decoration:none;font-weight:900}.btn.alt{background:white;color:var(--green);border:1px solid var(--green)}
.actions{display:flex;gap:9px;flex-wrap:wrap;margin:24px 0}.panel{background:var(--deep);color:white;border-radius:24px;padding:28px;margin:30px 0}.panel p{color:#d8e7dc;line-height:1.7}
.glossary{display:grid;grid-template-columns:repeat(auto-fit,minmax(265px,1fr));gap:13px}.term{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px}.term dt{font-weight:900}.term dd{margin:7px 0 0;color:var(--muted);line-height:1.55}
.record{break-inside:avoid;background:#fff;border:1px solid var(--line);border-radius:18px;padding:20px;margin:16px 0}.record ul{columns:2;gap:28px}.searchbox{display:flex;gap:8px;flex-wrap:wrap;margin:22px 0}.searchbox input{min-width:min(100%,520px);flex:1;padding:14px 16px;border:1px solid #afc7b6;border-radius:999px;font-size:1rem}.searchbox button{border:0;border-radius:999px;padding:14px 19px;background:var(--green);color:#fff;font-weight:900}
@media(max-width:640px){main{padding-top:26px}.record ul{columns:1}}@media print{.actions,.searchbox{display:none}body{background:#fff}.record,.card{box-shadow:none}}
</style>`;

function actionsHtml(actions=[]) {
  return `<div class="actions">${actions.map(([href,label],i)=>`<a class="btn${i ? ' alt' : ''}" href="${esc(href)}">${esc(label)}</a>`).join('')}</div>`;
}

function render(route) {
  let body = `<section class="hero"><div class="eyebrow">${esc(route.eyebrow)}</div><h1>${esc(route.heading)}</h1><p class="lede">${esc(route.intro)}</p>${actionsHtml(route.actions)}</section>`;
  if (route.search) {
    body += `<section class="panel"><h2>Search dtfseeds.com</h2><p>Enter a cultivation or plant-science topic. Search results open on DTFSeeds.com.</p><form class="searchbox" action="/" method="get"><input type="search" name="s" placeholder="Try: VPD, pH, roots, germination, trichomes…" aria-label="Search DTFSeeds.com"><input type="hidden" name="post_type" value="page"><button type="submit">Search</button></form></section>`;
  }
  if (route.sections) {
    body += `<section><h2>Explore</h2><div class="grid">${route.sections.map(([title,text,href])=>`<article class="card"><h3>${esc(title)}</h3><p>${esc(text)}</p><a href="${esc(href)}">Open resource</a></article>`).join('')}</div></section>`;
  }
  if (route.glossary) {
    body += `<section><h2>Core terms</h2><dl class="glossary">${route.glossary.map(([term,def])=>`<div class="term"><dt>${esc(term)}</dt><dd>${esc(def)}</dd></div>`).join('')}</dl></section>`;
  }
  if (route.recordGroups) {
    body += `<section><h2>Print-friendly record templates</h2>${route.recordGroups.map(([title,fields])=>`<article class="record"><h3>${esc(title)}</h3><ul>${fields.map(field=>`<li>${esc(field)}: ______________________________</li>`).join('')}</ul></article>`).join('')}</section>`;
  }
  body += `<section class="panel"><h2>Teaching Healthy Cultivation</h2><p>Educational information only. Follow applicable law, product labels, electrical and fire guidance, pesticide rules, and professional safety requirements. Measurements and symptoms are evidence; they are not automatic proof of one cause.</p>${actionsHtml([['/learn/','Back to Learn'],[discord,'Join THC Discord']])}</section>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(route.title)}</title><meta name="description" content="${esc(route.description)}"><meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="https://dtfseeds.com/learn/${esc(route.slug)}/"></head><body>${style}<main>${body}</main></body></html>`;
}

await Promise.all(routes.map(async (route) => {
  const dir = join(root, route.slug);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'index.html'), `${render(route)}\n`, 'utf8');
}));

await writeFile(join(root, 'wave3-learning-routes.json'), `${JSON.stringify({
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  routes: routes.map(({slug,title,description})=>({slug,title,description,url:`/learn/${slug}/`}))
}, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({built: routes.length, routes: routes.map(r=>r.slug)}, null, 2));

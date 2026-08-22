import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = join(process.cwd(), 'site/public-route-patch/learn');
const discord = 'https://discord.gg/xJbUeHFPMt';

const images = {
  anatomy: 'https://dtfseeds.com/wp-content/uploads/2026/08/Cannabis_Plant_Anatomy_Infographic.png',
  roots: 'https://dtfseeds.com/wp-content/uploads/2026/08/THC-C005_Infographic_Root_Anatomy_and_Forensics.png',
  leaf: 'https://dtfseeds.com/wp-content/uploads/2026/08/THC-C007_Infographic_Leaf_Anatomy_Gas_Exchange.png',
  flower: 'https://dtfseeds.com/wp-content/uploads/2026/08/THC-C008_Infographic_Flower_Anatomy_Reproduction.png',
  trichome: 'https://dtfseeds.com/wp-content/uploads/2026/08/THC-C009_Infographic_Trichomes_Secretory_Biology.png',
  nutrition: 'https://dtfseeds.com/wp-content/uploads/2026/08/Cannabis_Nutrition_Science_Behind_Healthy_Growth.png',
  diagnose: 'https://dtfseeds.com/wp-content/uploads/2026/08/Diagnosing_Deficiency_vs_Toxicity_Infographic.png',
  ipm: 'https://dtfseeds.com/wp-content/uploads/2026/08/Beneficial_Insects_and_Biological_Controls.png',
  clone: 'https://dtfseeds.com/wp-content/uploads/2026/08/Cloning_Guide_with_Environment_Targets.png',
  lifecycle: 'https://dtfseeds.com/wp-content/uploads/2026/08/Cannabis_Plant_Life_Cycle_Seed_to_Harvest_Infographic.png',
  vpd: 'https://dtfseeds.com/wp-content/uploads/2026/08/THC-ENC-086_Air_VPD_Versus_Leaf_VPD.jpg'
};

const centers = [
  {
    slug: 'setup',
    id: 'THC-SETUP',
    title: 'Set Up Before You Grow',
    eyebrow: 'Grow-space readiness',
    summary: 'A six-part pathway for choosing a suitable location, controlling electrical and water hazards, mapping equipment and sensors, building sanitation routines, and testing the space before plants enter it.',
    image: images.anatomy,
    modules: [
      ['THC-SETUP-001', 'Location, Permission, and Risk Screen', 'Confirm the location, access, property rules, emergency access, neighboring-space impacts, structural concerns, and stop conditions before installation.'],
      ['THC-SETUP-002', 'Electrical, Fire, and Equipment-Load Safety', 'Inventory equipment, protect cords and connections from water and heat, preserve service access, and escalate circuit decisions to qualified electrical professionals.'],
      ['THC-SETUP-003', 'Water, Drainage, Leak, and Spill Containment', 'Map water entry, irrigation, tanks, condensate, runoff, drains, spill paths, shutoffs, and the areas that could be affected by a leak.'],
      ['THC-SETUP-004', 'Equipment, Airflow, and Sensor Zone Map', 'Place equipment and sensors deliberately so measurements represent the crop and service access remains possible.'],
      ['THC-SETUP-005', 'Sanitation, Biosecurity, and Pest Exclusion', 'Build clean-entry routines, tool hygiene, exclusion barriers, inspection habits, and contamination-response rules before plant material arrives.'],
      ['THC-SETUP-006', 'Empty-Room Commissioning and Plant-Entry Readiness', 'Run the complete system without plants, test normal and failure conditions, document alarms and shutdowns, and resolve holds before plant entry.']
    ],
    checks: ['Permission and access are documented.', 'Electrical capacity and installation questions are resolved by qualified help.', 'Water paths, drainage, containment, and shutoffs are mapped.', 'Sensors are placed by measurement purpose, not convenience.', 'Sanitation and pest-exclusion routines are ready before plant entry.', 'The empty room has been tested under realistic simultaneous load.']
  },
  {
    slug: 'root-zone',
    id: 'THC-RZN',
    title: 'Root Zone, Water, and Nutrition',
    eyebrow: 'Measure the root environment',
    summary: 'A six-part learning center covering media and root oxygen, source water, pH and EC, irrigation and dryback, nutrient mixing, and evidence-based root-zone diagnosis.',
    image: images.roots,
    modules: [
      ['THC-RZN-001', 'Media, Containers, and Root Oxygen', 'Treat media as a physical root environment: pore space, water retention, drainage, container geometry, temperature, biology, and irrigation frequency interact.'],
      ['THC-RZN-002', 'Source Water, Alkalinity, Hardness, and Treatment', 'Separate pH from alkalinity and hardness, identify treatment goals, and keep source-water measurements tied to method and date.'],
      ['THC-RZN-003', 'pH, EC, Sampling, and Meter Control', 'Use calibrated instruments, record the sampling method, preserve original EC, and avoid comparing incompatible sample types as if they are equivalent.'],
      ['THC-RZN-004', 'Irrigation, Drainage, Runoff, and Dryback', 'Define how water is applied, where it moves, how drainage is observed, and what measurement method defines dryback in that specific system.'],
      ['THC-RZN-005', 'Nutrient Mixing, Compatibility, and Feed Records', 'Build repeatable mixing records around product labels, water chemistry, sequence, compatibility, measured EC/pH, and crop response rather than universal recipes.'],
      ['THC-RZN-006', 'Root-Zone Diagnosis, Correction, and CAPA', 'Combine symptoms with measurements, roots, irrigation history, media condition, environment, and recent changes before choosing a corrective action.']
    ],
    checks: ['Name the media and container system precisely.', 'Record source-water chemistry separately from nutrient-solution measurements.', 'Calibrate and document pH/EC meters and sampling method.', 'Define irrigation and dryback using repeatable measurements.', 'Keep feed records tied to actual products, water, sequence, and measured result.', 'Treat visual symptoms as evidence, not a complete diagnosis.']
  },
  {
    slug: 'environment',
    id: 'THC-ENV',
    title: 'Light, Climate, and Canopy Environment',
    eyebrow: 'Measure the environment the plant experiences',
    summary: 'Six modules connecting PPFD and DLI, fixture layout, photoperiod, air and leaf temperature, humidity and VPD, airflow, environmental mapping, alarms, CO₂ safety, and corrective action.',
    image: images.vpd,
    modules: [
      ['THC-ENV-001', 'Light Metrics: PPF, PPFD, DLI, and Measurement', 'Distinguish fixture output from crop-plane intensity and daily light exposure; measure the canopy rather than relying on wattage or marketing labels.'],
      ['THC-ENV-002', 'Fixture Layout, Uniformity, Spectrum, and UV', 'Evaluate distribution, overlap, edge falloff, sensor limits, spectrum context, and safety instead of assuming one hanging height fits every room.'],
      ['THC-ENV-003', 'Photoperiod, Dark-Period Integrity, and Flowering Control', 'Treat timing, interruptions, controller behavior, and cultivar response as measurable parts of crop management.'],
      ['THC-ENV-004', 'Air Temperature, Leaf Temperature, Transitions, and Heat', 'Track air and leaf temperature, day/night transitions, localized heat, sensor location, and plant response together.'],
      ['THC-ENV-005', 'Relative Humidity, VPD, Airflow, and Moisture Removal', 'Use RH and VPD as environmental descriptors, not diagnoses; distinguish air movement from actual moisture removal and inspect canopy microclimates.'],
      ['THC-ENV-006', 'Environmental Mapping, Alarms, CO₂ Safety, Diagnosis, and CAPA', 'Map multiple zones, define alarms and stop conditions, separate crop-control sensors from worker-safety monitoring, and verify corrections over time.']
    ],
    checks: ['Measure PPFD at the crop plane across more than one point.', 'Calculate DLI from the actual photoperiod and representative PPFD.', 'Track air and leaf temperature where possible.', 'Inspect canopy microclimates instead of relying only on room averages.', 'Use VPD as context, not as a stand-alone diagnosis.', 'Define alarm, shutdown, and re-entry rules for environmental failures.']
  },
  {
    slug: 'plant-health',
    id: 'THC-IPM',
    title: 'Plant Health, Scouting, Disease, Pests, and IPM',
    eyebrow: 'Observe first, diagnose second',
    summary: 'A six-module pathway for risk, mapped scouting, abiotic-versus-biotic reasoning, arthropod identification, disease prevention, quarantine, lawful controls, disposal, and corrective action.',
    image: images.ipm,
    modules: [
      ['THC-IPM-001', 'Plant Health, the Disease Triangle, and Risk', 'Organize plant health around the interaction of a susceptible host, a damaging agent or stressor, and an environment that allows the problem to develop.'],
      ['THC-IPM-002', 'Scouting Maps, Traps, Sampling, and Records', 'Scout on a repeatable map, preserve location and time, inspect clean-to-suspect, and use traps as one data stream rather than the whole diagnosis.'],
      ['THC-IPM-003', 'Abiotic versus Biotic Pattern Diagnosis', 'Compare distribution, progression, tissue age, environment, roots, irrigation, recent changes, pest evidence, and measurements before assigning cause.'],
      ['THC-IPM-004', 'Arthropod Pest Identification and Life Cycles', 'Identify the organism and life stage before deciding whether it is a pest, beneficial, incidental, or evidence of a larger sanitation problem.'],
      ['THC-IPM-005', 'Disease and Pathogen Prevention, Testing, and Quarantine', 'Use sanitation, source control, quarantine, symptom mapping, appropriate testing, and contamination boundaries to reduce spread and preserve evidence.'],
      ['THC-IPM-006', 'IPM Decisions, Lawful Controls, Quarantine, Disposal, and CAPA', 'Choose controls by confirmed problem, label and jurisdiction, crop/site allowance, risk, timing, and follow-up—not internet lists or another grower’s recipe.']
    ],
    checks: ['Map where symptoms or organisms are found.', 'Separate abiotic and biotic possibilities before treatment.', 'Preserve samples and evidence before cleaning or disposal when diagnosis is uncertain.', 'Identify pests and life stages with appropriate tools.', 'Use quarantine and clean-to-dirty workflow when spread is plausible.', 'Follow the exact pesticide label and applicable law when a pesticide is used.']
  },
  {
    slug: 'propagation',
    id: 'THC-PROP',
    title: 'Genetics, Crop Planning, Mother Stock, Cloning, and Propagation',
    eyebrow: 'Protect identity from source to rooted plant',
    summary: 'Six modules connecting plant identity and provenance, crop planning, mother-stock health, cutting selection, rooting, acclimation, clone release, tissue culture, genetic preservation, failure investigation, and CAPA.',
    image: images.clone,
    modules: [
      ['THC-PROP-001', 'Genetic Identity, Provenance, and Cultivar Claims', 'Separate source-reported lineage and trade names from verified identity; preserve labels, source, dates, generation or clone context, and uncertainty.'],
      ['THC-PROP-002', 'Crop Planning, Plant Counts, Timing, and Risk', 'Plan plant numbers and timing around legal limits, room capacity, propagation losses, quarantine, flowering space, and the cost of delays.'],
      ['THC-PROP-003', 'Mother Stock Health, Records, and Cutting Selection', 'Use healthy, correctly identified mother stock with traceable history; do not propagate from quarantined, contaminated, or severely stressed plants.'],
      ['THC-PROP-004', 'Cutting Selection, Sanitation, Rooting Media, and Auxin Context', 'Control sanitation, cutting quality, media condition, handling, and product-label directions while treating research auxin rates as context rather than universal instructions.'],
      ['THC-PROP-005', 'Rooting Environment, Acclimation, Hardening, and Clone Release', 'Manage humidity, light, temperature, water status, rooting evidence, acclimation, and release criteria instead of releasing clones by elapsed days alone.'],
      ['THC-PROP-006', 'Tissue Culture, Genetic Preservation, Propagation Failure, and CAPA', 'Use tissue culture as a specialized preservation and propagation tool with contamination control, identity checks, trained technique, and realistic limits.']
    ],
    checks: ['Preserve source and identity records for every line.', 'Keep plant-count and room-capacity constraints visible during planning.', 'Quarantine unhealthy or uncertain mother stock.', 'Use clean tools and controlled handling for cuttings.', 'Release clones by observed readiness, not a fixed number of days.', 'Investigate recurring propagation failures and verify corrective action.']
  }
];

const encyclopediaTopics = [
  'How to Read Cannabis Plant Science Critically',
  'Accepted Botanical Identity and Nomenclature',
  'Taxonomic Debate: One Species, Multiple Lineages',
  'Domestication, Dispersal, and Human Selection',
  'Hemp, Drug-Type Cannabis, and Botanical Versus Legal Categories',
  'Annual Growth Habit and the Whole-Plant Life Cycle',
  'The Cannabis Achene: What Growers Call a Seed',
  'Embryo, Cotyledons, Radicle, Hypocotyl, and Plumule',
  'Root System Architecture',
  'Stem Anatomy and Vascular Transport',
  'Nodes, Internodes, and Branch Attachment',
  'Leaf Morphology, Leaflets, and Phyllotaxy',
  'Meristems, Buds, and Apical Dominance',
  'Primary Growth, Secondary Thickening, and Structural Support',
  'Dioecy, Monoecy, and Sexual Plasticity',
  'Male Flower and Inflorescence Anatomy',
  'Female Flower, Bract, Stigma, and Inflorescence Anatomy',
  'Wind Pollination, Fertilization, and Seed Set',
  'Glandular and Nonglandular Trichome Classes',
  'Morphological Measurement and Botanical Recordkeeping'
];

const academyLessons = [
  'Cannabis as a Living Plant',
  'Names, Cultivars, Chemotypes, and Trade Labels',
  'Origins and the Limits of Origin Claims',
  'Domestication and Human Selection',
  'Major Use Types and Biological Tradeoffs',
  'Dispersal, Regional Populations, and Landrace',
  'Markets, Prohibition, Legal Categories, and Names',
  'How Cannabis Is Studied',
  'Provenance, Traceability, and Material Identity',
  'Responsible Interpretation and Claim Auditing'
];

function esc(v='') { return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
function nav() {
  return `<header class="sitebar"><a class="brand" href="/"><span class="leaf">☘</span><span>DTF Genetics</span></a><nav><a href="/learn/">Learn</a><a href="/learn/infographics/">Infographics</a><a href="/thc-grow-doc/">Grow Doc</a><a href="/tools/">Tools</a><a href="/games/">Games</a><a href="${discord}" target="_blank" rel="noopener noreferrer">Discord</a></nav></header>`;
}
function footer() {
  return `<footer><div><strong>Teaching Healthy Cultivation</strong><p>Plant science, cultivation education, visual references, diagnostics, tools, and community resources.</p></div><div><a href="/learn/">Learn</a> · <a href="/learn/library/">Library</a> · <a href="/learn/infographics/">Infographics</a> · <a href="${discord}" target="_blank" rel="noopener noreferrer">Discord</a></div><p>© 2026 DTF Genetics · Dream the Future</p></footer>`;
}
const style = `<style>
:root{--ink:#15341f;--muted:#496253;--green:#176d39;--deep:#0d2c1a;--lime:#d9f06e;--cream:#f7faf7;--line:#d6e4d9;--card:#fff}*{box-sizing:border-box}body{margin:0;background:var(--cream);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.sitebar{position:sticky;top:0;z-index:20;background:rgba(13,44,26,.96);color:#fff;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:14px clamp(18px,4vw,46px);border-bottom:1px solid rgba(255,255,255,.1)}.sitebar a{color:#fff;text-decoration:none}.brand{display:flex;align-items:center;gap:10px;font-weight:900}.leaf{font-size:1.5rem;color:var(--lime)}nav{display:flex;gap:6px;flex-wrap:wrap}nav a{padding:8px 10px;border-radius:999px;font-weight:700;font-size:.92rem}nav a:hover{background:rgba(255,255,255,.1)}main{min-height:60vh}.hero{max-width:1220px;margin:auto;padding:56px 22px 34px;display:grid;grid-template-columns:1.1fr .9fr;gap:42px;align-items:center}.eyebrow{font-weight:900;letter-spacing:.11em;text-transform:uppercase;color:var(--green);font-size:.82rem}.hero h1{font-size:clamp(2.6rem,6vw,5rem);line-height:.98;letter-spacing:-.045em;margin:.35rem 0 1rem}.hero p{font-size:1.08rem;line-height:1.75;color:var(--muted)}.hero img{width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:28px;box-shadow:0 18px 50px rgba(0,0,0,.15)}.buttons{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}.btn{display:inline-block;padding:11px 16px;border-radius:999px;border:1px solid var(--green);text-decoration:none;font-weight:900}.btn.primary{background:var(--green);color:#fff}.btn.secondary{color:var(--green);background:#fff}.section{max-width:1220px;margin:auto;padding:34px 22px 60px}.section h2{font-size:clamp(2rem,4vw,3.15rem);letter-spacing:-.03em}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:18px}.card{background:var(--card);border:1px solid var(--line);border-radius:20px;padding:22px;box-shadow:0 10px 26px rgba(22,64,35,.06)}.card h3{margin:.3rem 0 .65rem;font-size:1.18rem}.card p,.card li{color:var(--muted);line-height:1.65}.id{font-size:.76rem;font-weight:900;letter-spacing:.08em;color:var(--green)}.dark{background:var(--deep);color:#fff}.dark .section{padding-top:56px}.dark p,.dark li{color:#c7d8cb}.checks{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;padding:0;list-style:none}.checks li{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px;color:var(--ink)}.checks li:before{content:'✓';font-weight:900;color:var(--green);margin-right:8px}.visualrow{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}.visualrow img{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:18px;background:#fff;border:1px solid var(--line)}.topiclist{columns:2;column-gap:28px}.topiclist li{break-inside:avoid;margin-bottom:8px;line-height:1.55;color:var(--muted)}footer{background:#0b2516;color:#c9d9ce;padding:38px clamp(18px,4vw,46px);display:grid;gap:12px}footer a{color:var(--lime)}footer p{margin:.35rem 0;max-width:780px}@media(max-width:800px){.hero{grid-template-columns:1fr;padding-top:38px}.sitebar{position:static;align-items:flex-start;flex-direction:column}.topiclist{columns:1}}
</style>`;

function shell({title, description, body}) {
  const canonical = `https://dtfseeds.com${body.route || ''}`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | THC · DTF Genetics</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="article">${style}</head><body>${nav()}<main>${body.html}</main>${footer()}</body></html>`;
}

function centerHtml(center) {
  const route = `/learn/${center.slug}/`;
  const moduleCards = center.modules.map(([id,title,text])=>`<article class="card"><div class="id">${esc(id)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`).join('');
  const checkItems = center.checks.map(x=>`<li>${esc(x)}</li>`).join('');
  return shell({title:center.title, description:center.summary, body:{route, html:`
<section class="hero"><div><div class="eyebrow">${esc(center.eyebrow)}</div><h1>${esc(center.title)}</h1><p>${esc(center.summary)}</p><div class="buttons"><a class="btn primary" href="/learn/library/">Education Library</a><a class="btn secondary" href="/learn/infographics/">Visual Library</a><a class="btn secondary" href="/thc-grow-doc/">Grow Doc</a></div></div><img src="${esc(center.image)}" alt="${esc(center.title)} educational visual" loading="eager"></section>
<section class="section"><div class="eyebrow">Six-module pathway</div><h2>What this learning center covers</h2><div class="grid">${moduleCards}</div></section>
<section class="dark"><div class="section"><div class="eyebrow" style="color:#d9f06e">Use the system, not one number</div><h2>Core checkpoints</h2><ul class="checks">${checkItems}</ul><p style="margin-top:26px">Measurements, symptoms, product directions, local rules, cultivar response, and grow-system context all matter. Use the references as a structured decision framework rather than a universal recipe.</p></div></section>
<section class="section"><div class="eyebrow">Connected resources</div><h2>Keep learning</h2><div class="visualrow"><a href="/learn/infographics/"><img src="${images.anatomy}" alt="Cannabis plant anatomy infographic" loading="lazy"></a><a href="/learn/infographics/"><img src="${images.nutrition}" alt="Cannabis nutrition science infographic" loading="lazy"></a><a href="/learn/infographics/"><img src="${images.diagnose}" alt="Deficiency versus toxicity diagnostic infographic" loading="lazy"></a></div><div class="buttons"><a class="btn primary" href="/learn/infographics/">Browse 100+ visuals</a><a class="btn secondary" href="/learn/encyclopedia/">Encyclopedia</a><a class="btn secondary" href="/learn/academy/">Academy</a></div></section>`}});
}

function libraryHtml() {
  const cards = centers.map(c=>`<article class="card"><div class="id">${c.id}</div><h3>${esc(c.title)}</h3><p>${esc(c.summary)}</p><a class="btn secondary" href="/learn/${c.slug}/">Open center</a></article>`).join('');
  return shell({title:'Teaching Healthy Cultivation Education Library', description:'The public THC education library: cultivation learning centers, encyclopedia, academy, infographics, diagnostics, tools, and source-aware grow education.', body:{route:'/learn/library/', html:`
<section class="hero"><div><div class="eyebrow">Teaching Healthy Cultivation</div><h1>The cultivation library we have been building.</h1><p>This is the public gateway into the structured THC education system: grow-space setup, root-zone science, environment and lighting, plant health and IPM, genetics and propagation, Academy learning, Encyclopedia topics, visual references, diagnostics, and grow tools.</p><div class="buttons"><a class="btn primary" href="/learn/infographics/">Open visual library</a><a class="btn secondary" href="/thc-grow-doc/">Plant diagnosis</a><a class="btn secondary" href="/growlens/">Grow tools</a></div></div><img src="${images.lifecycle}" alt="Cannabis lifecycle educational infographic" loading="eager"></section>
<section class="section"><div class="eyebrow">Learning centers</div><h2>Start with the part of the grow you are working on.</h2><div class="grid">${cards}</div></section>
<section class="dark"><div class="section"><div class="eyebrow" style="color:#d9f06e">Deeper plant science</div><h2>Academy + Encyclopedia</h2><div class="grid"><article class="card"><div class="id">THC Academy</div><h3>Structured courses and lessons</h3><p>Course-based learning that connects plant science, evidence, cultivation decisions, worksheets, and practical interpretation.</p><a class="btn secondary" href="/learn/academy/">Open Academy</a></article><article class="card"><div class="id">THC Encyclopedia</div><h3>Plant-science reference library</h3><p>Botanical identity, anatomy, morphology, seed biology, germination, seedlings, roots, leaves, flowers, trichomes, and the expanding 420-entry reference system.</p><a class="btn secondary" href="/learn/encyclopedia/">Open Encyclopedia</a></article><article class="card"><div class="id">Visual Education</div><h3>100+ live educational visuals</h3><p>Infographics covering anatomy, roots, nutrition, environmental measurements, plant health, propagation, training, and more.</p><a class="btn secondary" href="/learn/infographics/">Browse visuals</a></article></div></div></section>`}});
}

function encyclopediaHtml() {
  return shell({title:'THC Plant Science Encyclopedia', description:'Public gateway to the THC plant science encyclopedia: botanical identity and morphology, seed biology, germination, seedlings, and the expanding 420-entry reference system.', body:{route:'/learn/encyclopedia/', html:`
<section class="hero"><div><div class="eyebrow">THC Plant Science Encyclopedia</div><h1>Plant science organized as a reference system.</h1><p>The Encyclopedia is structured as 21 parts and 420 permanent lesson records. The first production wave covers Botanical Identity and Morphology plus Seed Biology, Germination, and Seedlings. This public gateway exposes the subject map while detailed lesson pages continue to be reconciled into the live site.</p><div class="buttons"><a class="btn primary" href="/learn/library/">Education Library</a><a class="btn secondary" href="/learn/infographics/">Visual references</a></div></div><img src="${images.anatomy}" alt="Cannabis plant anatomy infographic" loading="eager"></section>
<section class="section"><div class="eyebrow">Volume 01 · Botanical Identity and Morphology</div><h2>Core reference topics</h2><ol class="topiclist">${encyclopediaTopics.map(t=>`<li>${esc(t)}</li>`).join('')}</ol></section>
<section class="dark"><div class="section"><div class="eyebrow" style="color:#d9f06e">Volume 02</div><h2>Seed Biology, Germination, and Seedlings</h2><p>The next twenty-entry volume follows the plant from achene structure and embryo biology through germination, emergence, cotyledons, early roots and shoots, seedling establishment, and the environmental conditions that shape early development.</p><div class="visualrow"><img src="${images.lifecycle}" alt="Cannabis lifecycle infographic" loading="lazy"><img src="${images.roots}" alt="Cannabis root anatomy infographic" loading="lazy"><img src="${images.leaf}" alt="Cannabis leaf anatomy infographic" loading="lazy"></div></div></section>`}});
}

function academyHtml() {
  return shell({title:'THC Academy', description:'Structured Teaching Healthy Cultivation Academy courses connecting plant science, evidence, cultivation interpretation, and practical learning pathways.', body:{route:'/learn/academy/', html:`
<section class="hero"><div><div class="eyebrow">THC Academy</div><h1>Learn in courses, not disconnected tips.</h1><p>The Academy organizes the larger THC knowledge base into course and lesson pathways. The first controlled course begins with cannabis as a living plant, then moves through names and classifications, origins and selection, provenance, research methods, and responsible claim interpretation.</p><div class="buttons"><a class="btn primary" href="/learn/library/">Education Library</a><a class="btn secondary" href="/learn/encyclopedia/">Encyclopedia</a><a class="btn secondary" href="/learn/infographics/">Visual library</a></div></div><img src="${images.flower}" alt="Cannabis flower anatomy educational visual" loading="eager"></section>
<section class="section"><div class="eyebrow">THC-C001</div><h2>Cannabis as a Plant: Origins, Uses, and Study</h2><div class="grid">${academyLessons.map((t,i)=>`<article class="card"><div class="id">Lesson ${String(i+1).padStart(2,'0')}</div><h3>${esc(t)}</h3><p>Part of the first Academy course, connecting plant identity and evidence to careful cultivation interpretation.</p></article>`).join('')}</div></section>
<section class="dark"><div class="section"><div class="eyebrow" style="color:#d9f06e">How the Academy connects</div><h2>Use the right depth for the question.</h2><div class="grid"><article class="card"><h3>Academy</h3><p>Guided course sequence and learner progression.</p></article><article class="card"><h3>Encyclopedia</h3><p>Deeper reference detail on individual plant-science concepts.</p></article><article class="card"><h3>Learning centers</h3><p>Practical cultivation systems organized around the grower’s workflow.</p></article><article class="card"><h3>Grow Doc</h3><p>Observation-first plant-health reasoning when a real problem appears.</p></article></div></div></section>`}});
}

const outputs = [
  ['library', libraryHtml()],
  ['encyclopedia', encyclopediaHtml()],
  ['academy', academyHtml()],
  ...centers.map(center => [center.slug, centerHtml(center)])
];

for (const [slug, html] of outputs) {
  const dir = join(root, slug);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'index.html'), html, 'utf8');
}

const manifest = {
  generatedAt: new Date().toISOString(),
  routes: outputs.map(([slug]) => `/learn/${slug}/`),
  centers: centers.map(c => ({ id: c.id, title: c.title, route: `/learn/${c.slug}/`, modules: c.modules.length })),
  encyclopedia: { permanentLessonRecords: 420, productionWaveLessons: 40 },
  academy: { catalogTarget: 420, firstCourseLessons: academyLessons.length }
};
await writeFile(join(root, 'public-learning-center-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Built ${outputs.length} public THC education routes.`);

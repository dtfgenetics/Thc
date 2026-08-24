import { readFile, writeFile } from 'node:fs/promises';

const files = [
  {
    path: 'site/wordpress/education/plant-health-ipm-v6.json',
    replacements: [
      ['"slug": "plant-health-ipm"', '"slug": "ipm"'],
      ['"route": "/learn/plant-health-ipm/"', '"route": "/learn/ipm/"']
    ]
  },
  {
    path: 'scripts/publish-wordpress-plant-health-ipm-v6.mjs',
    replacements: [
      ["curriculum.slug!=='plant-health-ipm'||curriculum.route!=='/learn/plant-health-ipm/'", "curriculum.slug!=='ipm'||curriculum.route!=='/learn/ipm/'"],
      ["pageBySlug('plant-health-ipm')", "pageBySlug('ipm')"],
      ["pageBySlug('plant-health-ipm')", "pageBySlug('ipm')"]
    ]
  },
  {
    path: 'site/wordpress/education/evidence-measurement-v6.json',
    replacements: [
      ['"slug": "evidence-measurement"', '"slug": "research-methods"'],
      ['"route": "/learn/evidence-measurement/"', '"route": "/learn/research-methods/"']
    ]
  },
  {
    path: 'scripts/publish-wordpress-genetics-evidence-v6.mjs',
    replacements: [
      ["topicId:'evidence-measurement',slug:'evidence-measurement',route:'/learn/evidence-measurement/'", "topicId:'evidence-measurement',slug:'research-methods',route:'/learn/research-methods/'"]
    ]
  }
];

let changedFiles = 0;
let changedReplacements = 0;
for (const file of files) {
  let text = await readFile(file.path, 'utf8');
  const before = text;
  for (const [from, to] of file.replacements) {
    if (text.includes(to)) continue;
    const occurrences = text.split(from).length - 1;
    if (occurrences < 1) throw new Error(`${file.path}: required stale route marker not found: ${from}`);
    text = text.replaceAll(from, to);
    changedReplacements += occurrences;
  }
  if (text !== before) {
    await writeFile(file.path, text);
    changedFiles += 1;
  }
}

const plant = JSON.parse(await readFile('site/wordpress/education/plant-health-ipm-v6.json','utf8'));
const evidence = JSON.parse(await readFile('site/wordpress/education/evidence-measurement-v6.json','utf8'));
if (plant.topicId !== 'plant-health-ipm' || plant.slug !== 'ipm' || plant.route !== '/learn/ipm/') throw new Error('Plant Health route repair verification failed.');
if (evidence.topicId !== 'evidence-measurement' || evidence.slug !== 'research-methods' || evidence.route !== '/learn/research-methods/') throw new Error('Evidence route repair verification failed.');

console.log(JSON.stringify({valid:true,changedFiles,changedReplacements,plantHealth:{topicId:plant.topicId,slug:plant.slug,route:plant.route},evidence:{topicId:evidence.topicId,slug:evidence.slug,route:evidence.route}},null,2));

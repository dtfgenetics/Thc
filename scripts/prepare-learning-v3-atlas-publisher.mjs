import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';

const sourcePath = process.env.LEARNING_V3_BASE_PUBLISHER || 'scripts/rebuild-wordpress-learning-experience-v3.mjs';
const outputPath = process.env.LEARNING_V3_ATLAS_PUBLISHER || '/tmp/rebuild-wordpress-learning-experience-v3-atlas.mjs';

let source = await readFile(sourcePath, 'utf8');
const original = "${btn('/learn/start-here/', 'Start here', true)}${btn('/learn/search/', 'Search education', false)}${btn('/learn/infographics/', 'Browse visuals', false)}";
const atlasAware = "${btn('/learn/atlas/', 'Open the THC Living Plant Atlas', true)}${btn('/learn/start-here/', 'Start here', false)}${btn('/learn/search/', 'Search education', false)}${btn('/learn/infographics/', 'Browse visuals', false)}";

const originalCount = source.split(original).length - 1;
const atlasCount = source.split(atlasAware).length - 1;
if (originalCount === 1) source = source.replace(original, atlasAware);
else if (atlasCount !== 1) throw new Error(`Expected one canonical Learn hero action group, found original=${originalCount}, atlasAware=${atlasCount}`);

// Subject pages should scan like a reference index instead of rendering every
// literature section at full length. Native <details>/<summary> keeps the full
// content in the document while making the default visitor view compact,
// keyboard accessible, and usable without client-side JavaScript.
const lessonLine = source.split('\n').find(line => line.includes('const lessonCards ='));
if (!lessonLine) throw new Error('Could not locate Learning V3 lesson-card renderer for progressive disclosure.');
if (!lessonLine.includes('data-progressive-disclosure="true"')) {
  let progressiveLessonLine = lessonLine;
  if (progressiveLessonLine.includes('<article class="lesson" id="${esc(id)}">')) {
    progressiveLessonLine = progressiveLessonLine
      .replace('<article class="lesson" id="${esc(id)}">', '<details class="lesson" id="${esc(id)}" data-progressive-disclosure="true"><summary>')
      .replace('<h2>', '<span class="lesson-title">')
      .replace('</h2>${(section.paragraphs', '</span></summary><div class="lesson-body">${(section.paragraphs')
      .replace('</article>`;', '</div></details>`;');
  } else {
    progressiveLessonLine = progressiveLessonLine
      .replace('<article class="lesson">', '<details class="lesson" data-progressive-disclosure="true"><summary>')
      .replace('<h2>', '<span class="lesson-title">')
      .replace('</h2>${(section.paragraphs', '</span></summary><div class="lesson-body">${(section.paragraphs')
      .replace('</article>`).join', '</div></details>`).join');
  }
  if (progressiveLessonLine === lessonLine || !progressiveLessonLine.includes('<details class="lesson"') || !progressiveLessonLine.includes('data-progressive-disclosure="true"') || !progressiveLessonLine.includes('<div class="lesson-body">')) {
    throw new Error('Learning V3 lesson-card renderer did not transform cleanly; refusing a partial accordion patch.');
  }
  source = source.replace(lessonLine, progressiveLessonLine);
}

const progressiveLessonStyles = '.v3 details.lesson{padding:0!important;overflow:hidden!important}.v3 details.lesson>summary{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px;align-items:center;min-height:70px;padding:17px 20px;cursor:pointer;list-style:none}.v3 details.lesson>summary::-webkit-details-marker{display:none}.v3 details.lesson>summary:after{content:"+";display:grid;place-items:center;width:30px;height:30px;border:1px solid var(--v3-line);border-radius:999px;background:#f3f6f1;color:var(--v3-green);font-size:1.25rem;font-weight:900;line-height:1}.v3 details.lesson[open]>summary:after{content:"−"}.v3 details.lesson[open]>summary{background:#f7faf6}.v3 details.lesson>summary:focus-visible{outline:3px solid var(--v3-gold);outline-offset:-3px}.v3 .lesson-title{font-size:clamp(1.12rem,2vw,1.35rem);font-weight:900;line-height:1.25;color:var(--v3-ink)}.v3 .lesson-body{padding:0 20px 24px;border-top:1px solid var(--v3-line)}.v3 .lesson-body>p:first-child{margin-top:18px}@media print{.v3 details.lesson>.lesson-body{display:block!important}}';
if (!source.includes(progressiveLessonStyles)) {
  const styleClose = '</style>`;';
  const styleCloseCount = source.split(styleClose).length - 1;
  if (styleCloseCount < 1) throw new Error('Could not locate Learning V3 style block terminator for progressive-disclosure CSS.');
  source = source.replace(styleClose, progressiveLessonStyles + styleClose);
}

const oldLiteratureCopies = [
  'The sections below keep plant science, observation, and practical checkpoints together so the page works as a usable reference instead of a text dump.',
  'Use the section navigator to move through the topic as a reference instead of scanning a wall of equal-weight cards.'
];
const progressiveLiteratureCopy = 'Scan the section titles first. Expand only the topic you need; full explanations and checkpoints stay available without turning the page into a wall of text.';
if (!source.includes(progressiveLiteratureCopy)) {
  const matched = oldLiteratureCopies.find(copy => source.includes(copy));
  if (!matched) throw new Error('Could not locate Learning V3 core-literature guidance copy.');
  source = source.replace(matched, progressiveLiteratureCopy);
}

// Require the public publisher itself to prove the new interaction reached every
// subject route. This turns a visual-structure regression into a failed release
// instead of a silent return to the old wall-of-text layout.
const progressivePublicCheckMarker = "checks.push(await publicCheck(topic.route, 'data-progressive-disclosure=\"true\"'))";
const topicCheckLine = source.split('\n').find(line => line.includes('for (const topic of topics) checks.push(await publicCheck(topic.route'));
if (topicCheckLine && !topicCheckLine.includes('data-progressive-disclosure')) {
  const originalCheck = "checks.push(await publicCheck(topic.route, `data-dtf-topic=\"${topic.id}\"`));";
  const progressiveCheck = "{ checks.push(await publicCheck(topic.route, `data-dtf-topic=\"${topic.id}\"`)); checks.push(await publicCheck(topic.route, 'data-progressive-disclosure=\"true\"')); }";
  const progressiveTopicCheckLine = topicCheckLine.replace(originalCheck, progressiveCheck);
  if (progressiveTopicCheckLine === topicCheckLine) throw new Error('Could not strengthen Learning V3 public verification for progressive disclosure.');
  source = source.replace(topicCheckLine, progressiveTopicCheckLine);
} else if (!source.includes(progressivePublicCheckMarker)) {
  throw new Error('Prepared Learning V3 publisher has no progressive-disclosure public verification marker.');
}

for (const marker of [
  'data-dtf-layout="learn-v3"',
  "btn('/learn/atlas/', 'Open the THC Living Plant Atlas', true)",
  "btn('/learn/start-here/', 'Start here', false)",
  'data-progressive-disclosure="true"',
  'data-progressive-disclosure="true"',
  progressivePublicCheckMarker,
  progressiveLiteratureCopy,
]) {
  if (!source.includes(marker)) throw new Error(`Prepared Learning V3 publisher is missing ${marker}`);
}

await writeFile(outputPath, source, 'utf8');
console.log(JSON.stringify({ sourcePath, outputPath, atlasCta: true, progressiveDisclosure: true }));

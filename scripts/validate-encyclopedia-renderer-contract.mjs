import fs from 'node:fs';
import { preserveExistingLessonVisual } from './lib/encyclopedia-visual-preservation.mjs';

const file='scripts/publish-wordpress-encyclopedia-canonical-batch.mjs';
const src=fs.readFileSync(file,'utf8');
const visualHelper=fs.readFileSync('scripts/lib/encyclopedia-visual-preservation.mjs','utf8');
const errors=[];
const required=[
  ['lesson navigation','thc-lesson-nav'],
  ['related tools panel','toolLinksFor'],
  ['GrowLens link',"'GrowLens','/growlens/'"],
  ['education search link','/learn/search/'],
  ['measurement section','<h2 id="measure">Measure and record</h2>'],
  ['misconception section','<h2 id="misconceptions">Common misconceptions</h2>'],
  ['evidence limits section','<h2 id="evidence-limits">Evidence limits and uncertainty</h2>'],
  ['assessment section','<h2 id="reasoning">Check your reasoning</h2>'],
  ['approved practical-resource section','practicalResourcesHtml'],
  ['practical-resource approval gate',"status==='approved'&&x.publicRoute"],
  ['learner answer rationales','rationaleHtml'],
  ['rationale disclosure UI','thc-rationale'],
  ['desktop article/sidebar layout','thc-layout'],
  ['mobile breakpoint','@media(max-width:640px)'],
  ['previous lesson behavior','← Previous'],
  ['next lesson behavior','Next →'],
  ['canonical live fingerprint','data-thc-source-fingerprint'],
  ['structured-data renderer','encyclopediaStructuredDataHtml'],
  ['breadcrumb navigation','thc-breadcrumbs'],
  ['long-page contents navigation','thc-toc'],
  ['glossary integration','/learn/glossary/'],
  ['titled related lesson cards','thc-related-card'],
  ['source/evidence section','Sources and evidence'],
  ['source link handling','noopener noreferrer'],
  ['source register loading','source-register.json'],
  ['reader-facing source titles','source.title||source.id||raw'],
  ['source applicability context','source.useAndLimitation'],
  ['source provenance identifier','thc-source-id'],
  ['explicit uncertainty messaging','Evidence limits and uncertainty'],
  ['review state note','thc-review-note'],
  ['download state','thc-downloads'],
  ['small-phone breakpoint','@media(max-width:380px)'],
  ['tablet breakpoint','@media(max-width:900px)'],
  ['horizontal table overflow','overflow-x:auto'],
  ['print/offline reading support','@media print'],
  ['stable lesson visual anchor','<!-- THC-ENC-VISUAL-ANCHOR -->']
];
for(const [label,needle] of required)if(!src.includes(needle))errors.push('renderer missing '+label);
for(const [label,needle] of [['durable lesson visual preservation marker','data-thc-lesson-visual-id='],['durable lesson visual figure fallback','lessonVisualFigurePattern']])if(!visualHelper.includes(needle))errors.push('visual preservation helper missing '+label);
if(src.includes('fake visual')||src.includes('placeholder teaching visual'))errors.push('renderer must not emit fake visual placeholders');
const visualFixture='<figure class="thc-lesson-visual" data-thc-lesson-visual-id="THC-ENC-041"><img src="https://dtfseeds.com/wp-content/uploads/example.jpg" alt="Root tip visual"></figure>';
const freshFixture='<article>before<!-- THC-ENC-VISUAL-ANCHOR --><h2>Core science</h2></article>';
const preserved=preserveExistingLessonVisual({slug:'thc-enc-041',existingRaw:visualFixture,content:freshFixture});
if(!preserved.includes(visualFixture))errors.push('renderer must preserve a WordPress-normalized lesson visual figure when wrapper comments are absent');
if((preserved.match(/data-thc-lesson-visual-id=/g)||[]).length!==1)errors.push('renderer visual preservation must not duplicate lesson visual markers');
const alreadyRendered=preserveExistingLessonVisual({slug:'thc-enc-041',existingRaw:visualFixture,content:freshFixture.replace('<!-- THC-ENC-VISUAL-ANCHOR -->',visualFixture+'<!-- THC-ENC-VISUAL-ANCHOR -->')});
if((alreadyRendered.match(/data-thc-lesson-visual-id=/g)||[]).length!==1)errors.push('renderer must not duplicate a visual already present in new content');

if(errors.length){
  console.error('Encyclopedia renderer validation failed:');
  errors.forEach(e=>console.error(' - '+e));
  process.exit(1);
}
console.log('Encyclopedia renderer contract validation passed.');

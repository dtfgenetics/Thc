import fs from 'node:fs';

const file='scripts/publish-wordpress-encyclopedia-canonical-batch.mjs';
const src=fs.readFileSync(file,'utf8');
const errors=[];
const required=[
  ['lesson navigation','thc-lesson-nav'],
  ['related tools panel','toolLinksFor'],
  ['GrowLens link',"'GrowLens','/growlens/'"],
  ['education search link','/learn/search/'],
  ['measurement section','<h2>Measure and record</h2>'],
  ['misconception section','<h2>Common misconceptions</h2>'],
  ['evidence limits section','<h2>Evidence limits</h2>'],
  ['assessment section','<h2>Check your reasoning</h2>'],
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
  ['explicit uncertainty messaging','Evidence limits and uncertainty'],
  ['review state note','thc-review-note'],
  ['download state','thc-downloads'],
  ['small-phone breakpoint','@media(max-width:380px)'],
  ['tablet breakpoint','@media(max-width:900px)'],
  ['horizontal table overflow','overflow-x:auto'],
  ['print/offline reading support','@media print']
];
for(const [label,needle] of required)if(!src.includes(needle))errors.push('renderer missing '+label);
if(src.includes('fake visual')||src.includes('placeholder teaching visual'))errors.push('renderer must not emit fake visual placeholders');
if(errors.length){
  console.error('Encyclopedia renderer validation failed:');
  errors.forEach(e=>console.error(' - '+e));
  process.exit(1);
}
console.log('Encyclopedia renderer contract validation passed.');

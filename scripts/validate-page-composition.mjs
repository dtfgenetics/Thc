import fs from 'node:fs';

const ux=fs.readFileSync('site/wordpress/assets/sitewide-ux-polish-v1.css','utf8');
const tools=fs.readFileSync('site/public-route-patch/tools/index.html','utf8');
const courses=fs.readFileSync('scripts/publish-wordpress-certification-catalog-v6.mjs','utf8');
const failures=[];
const need=(src,token,label)=>{if(!src.includes(token)) failures.push(`${label}: missing ${token}`);};

for(const token of [
  'Production composition pass v2',
  '.v3[data-dtf-layout="learn-v3"] .path{',
  '.v3[data-dtf-layout="learn-v3"] .reference-desk{',
  'body:has(.tool-chooser) .reference-grid{',
  'body:has(.tool-chooser) .flow{',
  'body:has(.dc6) .dc6-credential-group{',
  'body:has(.dc6) .dc6-surfaces{',
  '@media(max-width:700px)'
]) need(ux,token,'shared composition');

for(const token of [
  'class="tool-chooser"',
  'class="reference-grid"',
  'class="flow"',
  'id="choose-tool"',
  'id="workflow"',
  'id="measure"',
  'id="diagnose"',
  'id="learn"'
]) need(tools,token,'Tools hub');

for(const token of [
  'data-dtf-courses-catalog="v6"',
  'dc6-disclosure',
  'dc6-course',
  'dc6-surfaces',
  'Course completion and professional credential issuance are separate stages'
]) need(courses,token,'Courses catalog');

if((tools.match(/class="tool-feature"/g)||[]).length!==2) {
  failures.push('Tools hub must keep the two primary job tools visually dominant.');
}
if((tools.match(/class="reference-card"/g)||[]).length<5) {
  failures.push('Tools hub must retain the reference desk.');
}
if(!ux.includes('grid-template-columns:1fr!important')) {
  failures.push('Shared composition must retain deliberate mobile single-column states.');
}

if(failures.length){
  console.error('Page composition verification failed:');
  for(const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(JSON.stringify({
  ok:true,
  surfaces:['Learn','Tools','Courses'],
  enforced:[
    'editorial Learn entry rows',
    'compact Tools reference desk',
    'linear Tools workflow',
    'flattened Courses credential sections',
    'mobile composition states'
  ]
},null,2));

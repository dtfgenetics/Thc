import fs from 'node:fs';

const ux=fs.readFileSync('site/wordpress/assets/sitewide-ux-polish-v1.css','utf8');
const tools=fs.readFileSync('site/public-route-patch/tools/index.html','utf8');
const courses=fs.readFileSync('scripts/publish-wordpress-certification-catalog-v6.mjs','utf8');
const games=fs.readFileSync('site/public-route-patch/games/index.html','utf8');
const seeds=fs.readFileSync('site/wordpress/pages/seeds.html','utf8');
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
  'dc6-course-path'
]) need(courses,token,'Courses catalog');

for(const token of [
  'UX simplicity pass: keep navigation and reference choices compact',
  '.primary-nav{width:100%;flex-wrap:nowrap;overflow-x:auto',
  '.reference-grid{display:flex;gap:9px;overflow-x:auto'
]) need(tools,token,'Tools responsive simplicity');

for(const token of [
  'UX simplicity pass: compact controls and keep the first playable choices visible',
  '.game-hub-page .primary-nav{display:flex;flex-wrap:nowrap;overflow-x:auto',
  '.game-hub-page .quicknav{display:flex;flex-wrap:nowrap;overflow-x:auto'
]) need(games,token,'Games responsive simplicity');

for(const token of [
  'UX simplicity pass: keep release-first hierarchy clear',
  '.genetics-v2 .board-stats{display:none}',
  '.genetics-v2 .genetics-actions a{width:100%}'
]) need(seeds,token,'Genetics responsive simplicity');

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
  surfaces:['Learn','Tools','Courses','Games','Seeds'],
  enforced:[
    'editorial Learn entry rows',
    'compact Tools reference desk',
    'linear Tools workflow',
    'grouped Technician I and II course paths',
    'secondary certification roadmap',
    'mobile composition states',
    'scrollable mobile navigation rails',
    'compact mobile reference tools',
    'release-first genetics hierarchy'
  ]
},null,2));

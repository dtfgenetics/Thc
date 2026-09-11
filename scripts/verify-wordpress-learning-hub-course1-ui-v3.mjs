import { readFile } from 'node:fs/promises';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const local=JSON.parse(await readFile(process.env.LEARNING_HUB_COURSE1_PATH||'site/wordpress/education/learning-hub-course1.json','utf8'));
const ui=JSON.parse(await readFile(process.env.LEARNING_HUB_COURSE1_UI_PATH||'site/wordpress/education/learning-hub-course1-ui-v3.json','utf8'));
const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const must=(v,m)=>{if(!v)throw new Error(m);};
const rendered=v=>typeof v==='string'?v:(v?.raw||v?.rendered||'');
must(user&&pass,'WordPress credentials are required.');

async function wp(path){const r=await fetch(`${site}/wp-json/wp/v2/${path}`,{signal:AbortSignal.timeout(30000),headers:{Authorization:auth,'User-Agent':'DTF-Learning-Hub-Course1-UI-Verify/3.0'}});const text=await r.text();if(!r.ok)throw new Error(`WordPress ${path} returned ${r.status}: ${text.slice(0,300)}`);return text?JSON.parse(text):null;}
async function findPage(slug,parent){const rows=await wp(`pages?slug=${encodeURIComponent(slug)}&parent=${parent}&context=edit&per_page=100`);return rows[0]||null;}
function checkContent(page,label){const html=rendered(page.content);must(/dtf-learning-hub-course1-ui-v3/.test(html),`${label}: guided Course 1 UI marker missing.`);must(!/\b(draft|preview only|tbd|todo|lorem ipsum)\b/i.test(html),`${label}: unfinished public wording found.`);must(!/<svg\b/i.test(html),`${label}: inline SVG teaching art is not allowed in Course 1 guided UI.`);must(!/interactive academic visual/i.test(html),`${label}: rejected visual treatment detected.`);return html;}

const hub=await findPage('learning-hub',869);must(hub,'Learning Hub page not found.');
const program=await findPage(local.program.slug,hub.id);must(program,'Technician I page not found.');
const course=await findPage(local.course.slug,program.id);must(course,'Course 1 page not found.');
const courseHtml=checkContent(course,'Course 1');
must(/Course map/.test(courseHtml)&&/18 lessons/.test(courseHtml)&&/How to use this course/.test(courseHtml),'Course 1 page lacks guided-learning orientation.');

const pages=[];
let lessonIndex=0;
for(const mod of local.modules){
  const modulePage=await findPage(mod.slug,course.id);must(modulePage,`Module ${mod.number} page missing.`);const moduleHtml=checkContent(modulePage,`Module ${mod.number}`);must(/Lessons in this module/.test(moduleHtml),`Module ${mod.number}: lesson list missing.`);must(new RegExp(`Module ${mod.number} of 6`).test(moduleHtml),`Module ${mod.number}: module position missing.`);
  for(let j=0;j<3;j++){
    const def=ui.lessons[lessonIndex++];
    const lessonPage=await findPage(def.slug,modulePage.id);must(lessonPage,`${def.id}: lesson page missing.`);const html=checkContent(lessonPage,def.id);
    must(html.includes('Learning objective'),`${def.id}: learning objective block missing.`);
    must(html.includes('Mark lesson complete'),`${def.id}: completion control missing.`);
    must(html.includes('Course outline'),`${def.id}: course outline missing.`);
    must(html.includes(`Lesson ${def.lesson}`),`${def.id}: lesson position missing.`);
    if(def.visual.status==='approved'){
      must(html.includes(def.visual.src),`${def.id}: approved instructional visual missing.`);
      must(html.includes(def.visual.alt),`${def.id}: instructional visual alt text missing.`);
    }else{
      must(!/<img\b/i.test(html),`${def.id}: unapproved image rendered instead of a reviewed teaching visual.`);
    }
    pages.push({id:lessonPage.id,slug:def.slug,module:def.module,lesson:def.lesson,visual:def.visual.status});
  }
}
must(pages.length===18,'Expected 18 lesson pages.');
console.log(JSON.stringify({verifiedAt:new Date().toISOString(),site,courseId:local.course.id,modulePages:6,lessonPages:pages.length,approvedVisuals:pages.filter(p=>p.visual==='approved').length,pages,result:'success'},null,2));

import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const auth='Basic '+Buffer.from(`${user}:${pass}`).toString('base64');
const rendered=value=>typeof value==='string'?value:(value?.raw||value?.rendered||'');
const must=(value,message)=>{if(!value)throw new Error(message)};

must(user&&pass,'WordPress application credentials are required.');

async function wp(path){
  const response=await fetch(`${site}${path}`,{
    redirect:'follow',
    signal:AbortSignal.timeout(60000),
    headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTF-Learning-Architecture-ReadOnly-Guard/2.0'}
  });
  const text=await response.text();
  let body=text;
  try{body=text?JSON.parse(text):null}catch{}
  if(!response.ok) throw new Error(`GET ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,700):JSON.stringify(body).slice(0,700)}`);
  return body;
}

const rows=await wp('/wp-json/wp/v2/pages?slug=learn&context=edit&status=publish&per_page=100');
must(Array.isArray(rows),'WordPress did not return a page array for /learn/.');
must(rows.length===1,`Expected exactly one published /learn/ page; found ${rows.length}.`);

const content=rendered(rows[0].content);
const failures=[];
const requireText=(needle,label)=>{if(!content.includes(needle))failures.push(`missing ${label}: ${needle}`)};
const forbidText=(needle,label)=>{if(content.includes(needle))failures.push(`forbidden ${label}: ${needle}`)};

requireText('/courses/','canonical Courses route');
requireText('/learn/encyclopedia/','Encyclopedia route');
requireText('/learn/start-here/','Start Here route');
requireText('data-dtf-layout="learn-v3"','Learning Experience V3 owner marker');
requireText('data-dtf-learning-map="v4"','Learning map V4 marker');

forbidText('/learn/academy/','legacy Academy route promotion');
forbidText('<span class="pill">Course</span><h3>THC Academy</h3>','legacy Academy-as-Course card');
forbidText('THC Learning Academy for broad guided study','competing Academy taxonomy');
forbidText('DTF_LEARNING_HUB_COURSE1_START','foreign Learning Hub block written into Learn root');

if(failures.length){
  for(const failure of failures) console.error('ERROR: '+failure);
  console.error('The /learn/ root is owned only by Learning Experience V3. This guard is read-only and will not repair production by writing over the owner.');
  process.exit(1);
}

console.log(JSON.stringify({
  result:'success',
  mode:'read-only-single-writer-guard',
  pageId:rows[0].id,
  owner:'Learning Experience V3',
  coursesRoute:'/courses/',
  legacyAcademyPromoted:false
},null,2));

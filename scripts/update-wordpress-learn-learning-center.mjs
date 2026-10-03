import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth='Basic '+Buffer.from(`${username}:${password}`).toString('base64');
const response=await fetch(`${siteUrl}/wp-json/wp/v2/pages?slug=learn&context=edit&status=publish&per_page=10`,{
  headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Learning-Center-Root-Guard/2.0'},
  redirect:'follow',
  signal:AbortSignal.timeout(60000)
});
if(!response.ok) throw new Error(`WordPress Learn lookup failed (${response.status})`);
const pages=await response.json();
if(!Array.isArray(pages)||pages.length!==1) throw new Error(`Expected exactly one published Learn page, found ${Array.isArray(pages)?pages.length:'invalid response'}`);
const content=typeof pages[0].content==='string'?pages[0].content:(pages[0].content?.raw||pages[0].content?.rendered||'');

const required=[
  'data-dtf-layout="learn-v3"',
  'data-dtf-learning-map="v4"',
  '/courses/',
  '/learn/encyclopedia/',
  '/learn/start-here/'
];
const forbidden=[
  '<!-- DTF-LEARNING-CENTER-START -->',
  'Teaching Healthy Cultivation · Customer Learning System',
  'Academy courses',
  "['/learn/academy/', 'THC Academy'",
  'Course-based learning that connects plant science'
];
const failures=[];
for(const needle of required) if(!content.includes(needle)) failures.push(`missing canonical Learn marker/link: ${needle}`);
for(const needle of forbidden) if(content.includes(needle)) failures.push(`legacy Learning Center root injection remains in stored Learn content: ${needle}`);

if(failures.length){
  failures.forEach(item=>console.error('ERROR: '+item));
  console.error('The Learning Centers lane is child-route-only. It will not mutate /learn/; Learning Experience V3 must reconcile the canonical root.');
  process.exit(1);
}
console.log(JSON.stringify({
  ok:true,
  mode:'read-only-root-guard',
  pageId:pages[0].id,
  owner:'Learning Experience V3',
  childPublisher:'Deploy THC Learning Centers',
  canonicalCourses:'/courses/'
},null,2));

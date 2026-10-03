import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
if(!username||!password) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');

const auth='Basic '+Buffer.from(`${username}:${password}`).toString('base64');
const response=await fetch(`${siteUrl}/wp-json/wp/v2/pages?slug=learn&context=edit&status=publish&per_page=10`,{
  headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTFSeeds-Learn-V4-Retirement-Guard/1.0'},
  redirect:'follow',
  signal:AbortSignal.timeout(60000)
});
if(!response.ok) throw new Error(`Learn REST lookup failed (${response.status})`);
const pages=await response.json();
if(!Array.isArray(pages)||pages.length!==1) throw new Error(`Expected one published Learn page; found ${Array.isArray(pages)?pages.length:'invalid response'}`);
const content=typeof pages[0].content==='string'?pages[0].content:(pages[0].content?.raw||pages[0].content?.rendered||'');

const required=[
  'data-dtf-layout="learn-v3"',
  'data-dtf-learning-map="v4"',
  '/courses/',
  '/learn/encyclopedia/'
];
const forbidden=[
  'data-dtf-layout="learn-v4"',
  "href="/learn/academy/"",
  '>Academy<',
  'Structured learning paths for people who want progression instead of random articles.'
];
const failures=[];
for(const needle of required) if(!content.includes(needle)) failures.push(`missing canonical owner marker/link: ${needle}`);
for(const needle of forbidden) if(content.includes(needle)) failures.push(`retired standalone Learn V4 fingerprint remains in stored Learn content: ${needle}`);

if(failures.length){
  failures.forEach(x=>console.error('ERROR: '+x));
  console.error('Standalone Learn Visual V4 is retired. Learning Experience V3 owns /learn/ and must reconcile any drift.');
  process.exit(1);
}
console.log(JSON.stringify({
  ok:true,
  mode:'read-only-retirement-guard',
  owner:'Learning Experience V3',
  retiredWriter:'WordPress Learn Visual V4 Production',
  pageId:pages[0].id
},null,2));

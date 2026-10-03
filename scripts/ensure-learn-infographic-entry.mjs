import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
if(!user||!pass) throw new Error('WP_API_USERNAME and WP_API_PASSWORD are required');
const auth='Basic '+Buffer.from(`${user}:${pass}`).toString('base64');

const response=await fetch(`${site}/wp-json/wp/v2/pages?slug=learn&context=edit&status=publish&per_page=10`,{
  headers:{Authorization:auth,Accept:'application/json','User-Agent':'DTF-Learn-Infographic-Retirement-Guard/1.0'},
  redirect:'follow',
  signal:AbortSignal.timeout(60000)
});
if(!response.ok) throw new Error(`Learn REST lookup failed (${response.status})`);
const rows=await response.json();
if(!Array.isArray(rows)||rows.length!==1) throw new Error(`Expected one published Learn page, found ${Array.isArray(rows)?rows.length:'invalid response'}`);
const html=typeof rows[0].content==='string'?rows[0].content:(rows[0].content?.raw||rows[0].content?.rendered||'');

const required=[
  'data-dtf-layout="learn-v3"',
  'data-dtf-learning-map="v4"',
  '/learn/infographics/',
  'Browse visuals'
];
const forbidden=[
  'dtf-learn-infographic-entry:start',
  'Browse THC Infographics'
];
const errors=[];
for(const needle of required) if(!html.includes(needle)) errors.push(`missing canonical visual-library capability: ${needle}`);
for(const needle of forbidden) if(html.includes(needle)) errors.push(`retired standalone infographic injection remains in stored Learn content: ${needle}`);
if(errors.length){
  errors.forEach(x=>console.error('ERROR: '+x));
  console.error('The infographic library remains a child route. Learning Experience V3 owns visual navigation on /learn/.');
  process.exit(1);
}
console.log(JSON.stringify({ok:true,mode:'read-only-retirement-guard',owner:'Learning Experience V3',visualLibrary:'/learn/infographics/',pageId:rows[0].id},null,2));

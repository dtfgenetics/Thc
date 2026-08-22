const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
if(!user||!pass)throw new Error('WordPress credentials required');
const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function get(path){let last;for(let i=1;i<=8;i++){try{const r=await fetch(`${site}${path}`,{headers:{Authorization:auth,Accept:'application/json'}});const t=await r.text();if(!r.ok)throw new Error(`${path} ${r.status}: ${t.slice(0,400)}`);return JSON.parse(t)}catch(e){last=e;await sleep(1000+i*800)}}throw last;}
const flags=value=>{const x=String(value||'').toLowerCase();const has=s=>x.includes(s.toLowerCase());return{currentLearn:has('Explore by subject'),oldLearn:has('Grow education belongs in a clean, readable library.'),oldLearn2:has('MOPS, cultivation notes, THC basics'),currentHome:has('Genetics. Plant science. Tools. Games. Community.'),postContent:has('wp:post-content')}};
const strip=s=>String(s||'').replace(/<script\b[\s\S]*?<\/script>/gi,' ').replace(/<style\b[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(0,900);
const [learn,templates,parts]=await Promise.all([get('/wp-json/wp/v2/pages/869?context=edit'),get('/wp-json/wp/v2/templates?context=edit&per_page=100'),get('/wp-json/wp/v2/template-parts?context=edit&per_page=100')]);
const content=String(learn.content?.raw||learn.content?.rendered||'');
const candidates=(templates||[]).map(t=>{const c=String(t.content?.raw||t.content?.rendered||'');return{id:t.id,slug:t.slug,theme:t.theme,source:t.source,origin:t.origin,status:t.status,flags:flags(c),length:c.length,preview:strip(c)}}).filter(t=>t.flags.currentLearn||t.flags.oldLearn||t.flags.oldLearn2||t.slug==='page'||t.slug==='front-page'||String(learn.template||'')===String(t.slug||'')||String(learn.template||'')===String(t.id||''));
const partCandidates=(parts||[]).map(t=>{const c=String(t.content?.raw||t.content?.rendered||'');return{id:t.id,slug:t.slug,theme:t.theme,source:t.source,status:t.status,flags:flags(c),length:c.length,preview:strip(c)}}).filter(t=>t.flags.currentLearn||t.flags.oldLearn||t.flags.oldLearn2);
console.log(JSON.stringify({learn:{id:learn.id,slug:learn.slug,status:learn.status,link:String(learn.link||'').replace(site,''),template:learn.template||'',contentLength:content.length,flags:flags(content),preview:strip(content)},templates:candidates,templateParts:partCandidates}));

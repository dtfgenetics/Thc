import { readFile } from 'node:fs/promises';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_APPROVED_DESIGN_REFERENCE||'').toLowerCase()==='true';
const assetPath=process.env.APPROVED_DESIGN_REFERENCE_PATH||'site/wordpress/assets/design-references/dtf-course-header-approved-reference-v1.jpg';
const slug='dtf-course-header-approved-reference-v1';
const filename='DTF_Course_Header_Approved_Reference_v1.jpg';
const driveUrl='https://drive.google.com/file/d/1kJMXWFSz_2BICRlQJZnmZqoC45ee875x/view?usp=drivesdk';
const repoPath='site/wordpress/assets/design-references/dtf-course-header-approved-reference-v1.jpg';
const auth=user&&pass?`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`:'';
const must=(v,m)=>{if(!v)throw new Error(m)};

must(user&&pass,'WordPress credentials are required.');
const bytes=await readFile(assetPath);
must(bytes.length>10_000,'Approved design reference asset is unexpectedly small.');

async function request(path,options={}){
  const response=await fetch(`${site}${path}`,{
    ...options,
    signal:AbortSignal.timeout(60_000),
    headers:{Authorization:auth,'User-Agent':'DTF-Approved-Design-Reference/1.0',...(options.headers||{})}
  });
  const text=await response.text();let body=text;try{body=text?JSON.parse(text):null}catch{}
  if(!response.ok)throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${typeof body==='string'?body.slice(0,500):JSON.stringify(body).slice(0,500)}`);
  return body;
}

let media=await request(`/wp-json/wp/v2/media?slug=${encodeURIComponent(slug)}&context=edit&per_page=10`);
let item=Array.isArray(media)?media[0]:null;
if(!item&&apply){
  item=await request('/wp-json/wp/v2/media',{
    method:'POST',
    body:bytes,
    headers:{'Content-Type':'image/jpeg','Content-Disposition':`attachment; filename="${filename}"`}
  });
}
must(item?.id&&item?.source_url,'Approved design reference is not present in WordPress media.');

if(apply){
  item=await request(`/wp-json/wp/v2/media/${item.id}`,{
    method:'POST',
    body:JSON.stringify({
      slug,
      title:'DTF Course Header — Approved Sitewide Design Reference v1',
      alt_text:'Approved DTF Genetics course and sitewide header design reference showing the dark evergreen navigation and structured learning interface.',
      caption:'Approved sitewide DTF Genetics header and course-interface design reference.',
      description:`Canonical visual design reference for the DTF Genetics shared site header and Course 1 learning interface. GitHub: ${repoPath}. Google Drive: ${driveUrl}. This image is a design reference; live navigation remains semantic HTML/CSS.`
    }),
    headers:{'Content-Type':'application/json'}
  });
}

const verify=await request(`/wp-json/wp/v2/media/${item.id}?context=edit`);
must(verify.slug===slug,`Unexpected WordPress media slug: ${verify.slug}`);
must(/^https:\/\//.test(verify.source_url||''),'WordPress media source URL is missing.');
must((verify.mime_type||'').startsWith('image/'),'WordPress media is not an image.');
console.log(JSON.stringify({result:'success',mediaId:verify.id,slug:verify.slug,sourceUrl:verify.source_url,repoPath,driveUrl,bytes:bytes.length},null,2));

import { readFile } from 'node:fs/promises';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_APPROVED_DESIGN_REFERENCE||'').toLowerCase()==='true';
const assetPath=process.env.APPROVED_DESIGN_REFERENCE_PATH||'site/wordpress/assets/design-references/dtf-course-header-approved-reference-v1.jpg';
const slug='dtf-course-header-approved-reference-v1';
const driveUrl='https://drive.google.com/file/d/1kJMXWFSz_2BICRlQJZnmZqoC45ee875x/view?usp=drivesdk';
const repoPath='site/wordpress/assets/design-references/dtf-course-header-approved-reference-v1.jpg';
const auth=user&&pass?`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`:'';
const must=(v,m)=>{if(!v)throw new Error(m)};

function readJpegDimensions(buffer){
  if(buffer.length<4||buffer[0]!==0xff||buffer[1]!==0xd8) return null;
  const sof=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
  let offset=2;
  while(offset+4<=buffer.length){
    while(offset<buffer.length&&buffer[offset]!==0xff) offset+=1;
    while(offset<buffer.length&&buffer[offset]===0xff) offset+=1;
    if(offset>=buffer.length) break;
    const marker=buffer[offset++];
    if(marker===0xd8||marker===0xd9||marker===0x01||(marker>=0xd0&&marker<=0xd7)) continue;
    if(offset+2>buffer.length) break;
    const length=buffer.readUInt16BE(offset);
    if(length<2||offset+length>buffer.length) break;
    if(sof.has(marker)&&length>=7){
      return {width:buffer.readUInt16BE(offset+5),height:buffer.readUInt16BE(offset+3)};
    }
    offset+=length;
  }
  return null;
}

function inspectImage(buffer){
  const jpeg=readJpegDimensions(buffer);
  if(jpeg) return {...jpeg,mime:'image/jpeg',extension:'jpg'};
  const pngSignature=Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  if(buffer.length>=24&&buffer.subarray(0,8).equals(pngSignature)){
    return {width:buffer.readUInt32BE(16),height:buffer.readUInt32BE(20),mime:'image/png',extension:'png'};
  }
  if(buffer.length>=30&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP'){
    const chunk=buffer.toString('ascii',12,16);
    if(chunk==='VP8X'){
      const width=1+buffer[24]+(buffer[25]<<8)+(buffer[26]<<16);
      const height=1+buffer[27]+(buffer[28]<<8)+(buffer[29]<<16);
      return {width,height,mime:'image/webp',extension:'webp'};
    }
    for(let i=20;i+9<buffer.length;i++){
      if(buffer[i]===0x9d&&buffer[i+1]===0x01&&buffer[i+2]===0x2a){
        const width=buffer.readUInt16LE(i+3)&0x3fff;
        const height=buffer.readUInt16LE(i+5)&0x3fff;
        if(width&&height) return {width,height,mime:'image/webp',extension:'webp'};
      }
    }
  }
  return null;
}

must(user&&pass,'WordPress credentials are required.');
const bytes=await readFile(assetPath);
const image=inspectImage(bytes);
const magic=bytes.subarray(0,16).toString('hex');
must(bytes.length>4_096,'Approved design reference asset is unexpectedly small.');
must(image,`Approved design reference has an unsupported or invalid image format (magic ${magic}).`);
must(image.width>=800&&image.height>=500,`Approved design reference resolution is too small: ${image.width}x${image.height}.`);
const filename=`DTF_Course_Header_Approved_Reference_v1.${image.extension}`;

async function request(path,options={}){
  const response=await fetch(`${site}${path}`,{
    ...options,
    signal:AbortSignal.timeout(60_000),
    headers:{Authorization:auth,'User-Agent':'DTF-Approved-Design-Reference/1.2',...(options.headers||{})}
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
    headers:{'Content-Type':image.mime,'Content-Disposition':`attachment; filename="${filename}"`}
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
console.log(JSON.stringify({result:'success',mediaId:verify.id,slug:verify.slug,sourceUrl:verify.source_url,repoPath,driveUrl,bytes:bytes.length,image},null,2));

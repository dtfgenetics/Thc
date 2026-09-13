import { readFile } from 'node:fs/promises';
import process from 'node:process';

const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
const apply=String(process.env.APPLY_APPROVED_DESIGN_REFERENCE||'').toLowerCase()==='true';
const inspectOnly=String(process.env.APPROVED_DESIGN_REFERENCE_INSPECT_ONLY||'').toLowerCase()==='true';
const assetPath=process.env.APPROVED_DESIGN_REFERENCE_PATH||'site/wordpress/assets/design-references/dtf-course-header-approved-reference-v1.jpg';
const slug='dtf-course-header-approved-reference-v1';
const driveUrl='https://drive.google.com/file/d/1kJMXWFSz_2BICRlQJZnmZqoC45ee875x/view?usp=drivesdk';
const repoPath='site/wordpress/assets/design-references/dtf-course-header-approved-reference-v1.jpg';
const assetRole='optimized preview derivative of the full-resolution Google Drive canonical';
const auth=user&&pass?`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`:'';
const must=(v,m)=>{if(!v)throw new Error(m)};

function readJpegDimensions(buffer){
  if(buffer.length<11||buffer[0]!==0xff||buffer[1]!==0xd8) return null;
  const sof=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
  const limit=Math.min(buffer.length-9,131_072);

  // SOF markers are metadata markers that occur before scan data. Search for the
  // marker directly instead of trusting every preceding segment length: optimized
  // JPEG/JFIF encoders can include uncommon metadata layouts that make a strict
  // hand-rolled segment walker unnecessarily brittle.
  for(let i=2;i<=limit;i+=1){
    if(buffer[i]!==0xff) continue;
    let markerIndex=i+1;
    while(markerIndex<buffer.length&&buffer[markerIndex]===0xff) markerIndex+=1;
    if(markerIndex>=buffer.length) break;
    const marker=buffer[markerIndex];
    if(marker===0x00){i=markerIndex;continue;}
    if(marker===0xda) break; // Start of Scan: SOF must already have appeared.
    if(!sof.has(marker)){i=markerIndex;continue;}
    if(markerIndex+8>=buffer.length) continue;

    const segmentLength=buffer.readUInt16BE(markerIndex+1);
    const segmentEnd=markerIndex+1+segmentLength;
    if(segmentLength<8||segmentEnd>buffer.length) continue;
    const precision=buffer[markerIndex+3];
    const height=buffer.readUInt16BE(markerIndex+4);
    const width=buffer.readUInt16BE(markerIndex+6);
    if(![8,12,16].includes(precision)||width<1||height<1||width>32_768||height>32_768) continue;
    return {width,height,precision,sofMarker:`0x${marker.toString(16)}`};
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

const bytes=await readFile(assetPath);
const image=inspectImage(bytes);
const magic=bytes.subarray(0,16).toString('hex');
must(bytes.length>1_024,'Approved design reference preview asset is unexpectedly small.');
must(image,`Approved design reference has an unsupported or invalid image format (magic ${magic}).`);
const shortSide=Math.min(image.width,image.height);
const longSide=Math.max(image.width,image.height);
must(shortSide>=300&&longSide>=450,`Approved design reference preview resolution is too small: ${image.width}x${image.height}.`);
const filename=`DTF_Course_Header_Approved_Reference_v1.${image.extension}`;
const inspection={result:'success',mode:'inspect',repoPath,driveUrl,assetRole,bytes:bytes.length,image};

if(inspectOnly){
  console.log(JSON.stringify(inspection,null,2));
  process.exit(0);
}

must(user&&pass,'WordPress credentials are required.');

async function request(path,options={}){
  const response=await fetch(`${site}${path}`,{
    ...options,
    signal:AbortSignal.timeout(60_000),
    headers:{Authorization:auth,'User-Agent':'DTF-Approved-Design-Reference/1.4',...(options.headers||{})}
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
      caption:'Approved sitewide DTF Genetics header and course-interface design reference. Full-resolution canonical master is archived in Google Drive.',
      description:`Approved visual design reference for the DTF Genetics shared site header and Course 1 learning interface. WordPress and GitHub store an optimized preview derivative for durable site/repository reference. The full-resolution canonical master remains in Google Drive: ${driveUrl}. GitHub preview: ${repoPath}. Live navigation remains semantic HTML/CSS.`
    }),
    headers:{'Content-Type':'application/json'}
  });
}

const verify=await request(`/wp-json/wp/v2/media/${item.id}?context=edit`);
must(verify.slug===slug,`Unexpected WordPress media slug: ${verify.slug}`);
must(/^https:\/\//.test(verify.source_url||''),'WordPress media source URL is missing.');
must((verify.mime_type||'').startsWith('image/'),'WordPress media is not an image.');
console.log(JSON.stringify({result:'success',mode:apply?'publish':'readback',mediaId:verify.id,slug:verify.slug,sourceUrl:verify.source_url,repoPath,driveUrl,assetRole,bytes:bytes.length,image},null,2));

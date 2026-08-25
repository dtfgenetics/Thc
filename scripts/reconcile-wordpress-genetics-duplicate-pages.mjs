import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';

const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));

function contentText(page){
  return `${page?.content?.raw||''}\n${page?.content?.rendered||''}`;
}
function modifiedTime(page){
  const value=page?.modified_gmt||page?.modified||'';
  const time=Date.parse(value);
  return Number.isFinite(time)?time:0;
}
function scorePage(page,slug){
  const marker=`data-dtf-genetics-line=\"${slug}\"`;
  const exactLink=String(page?.link||'').replace(/\?.*$/,'').replace(/\/$/,'').endsWith(`/seeds/${slug}`);
  return {
    page,
    published:page?.status==='publish'?1:0,
    marker:contentText(page).includes(marker)?1:0,
    exactLink:exactLink?1:0,
    modified:modifiedTime(page),
    id:Number(page?.id)||0
  };
}
export function chooseCanonical(rows,slug){
  return rows.map(page=>scorePage(page,slug)).sort((a,b)=>
    b.published-a.published ||
    b.marker-a.marker ||
    b.exactLink-a.exactLink ||
    b.modified-a.modified ||
    a.id-b.id
  )[0]?.page||null;
}

export async function reconcileDuplicateGeneticsPages(){
  const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
  const username=process.env.WP_API_USERNAME||'';
  const password=process.env.WP_API_PASSWORD||'';
  const apply=String(process.env.APPLY_GENETICS_LIBRARY||'').toLowerCase()==='true';
  const catalogPath=process.env.SEED_LINE_CATALOG||'site/wordpress/products/seed-line-catalog.json';
  const backupRoot=process.env.BACKUP_ROOT||'/tmp/wordpress-genetics-library';

  if(!username||!password) throw new Error('WordPress credentials are required for genetics duplicate-page reconciliation.');
  const catalog=JSON.parse(await readFile(catalogPath,'utf8'));
  if(catalog?.schemaVersion!==1||!Array.isArray(catalog?.lines)||catalog.lines.length===0) throw new Error('Seed line catalog is missing or empty.');

  const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  const stamp=new Date().toISOString().replace(/[-:.]/g,'');
  const backupDir=join(backupRoot,`duplicate-page-reconcile-${stamp}`);
  await mkdir(backupDir,{recursive:true});

  async function request(path,options={},attempts=4){
    let last;
    for(let attempt=1;attempt<=attempts;attempt+=1){
      try{
        const response=await fetch(`${siteUrl}${path}`,{
          ...options,
          redirect:'follow',
          signal:AbortSignal.timeout(45_000),
          headers:{
            Authorization:auth,
            Accept:'application/json',
            'User-Agent':'DTFSeeds-Genetics-Duplicate-Reconciler/1.0',
            ...(options.body?{'Content-Type':'application/json'}:{}),
            ...(options.headers||{})
          }
        });
        const text=await response.text();
        let body=null;
        try{body=text?JSON.parse(text):null;}catch{body={raw:text.slice(0,1200)};}
        if(!response.ok) throw new Error(`${options.method||'GET'} ${path} failed (${response.status}): ${body?.message||body?.raw||'request failed'}`);
        return body;
      }catch(error){
        last=error;
        if(attempt<attempts) await sleep(attempt*1500);
      }
    }
    throw last;
  }

  const seedsRows=await request('/wp-json/wp/v2/pages?slug=seeds&context=edit&per_page=20');
  if(!Array.isArray(seedsRows)||seedsRows.length!==1) throw new Error(`Expected exactly one canonical Seeds page; found ${Array.isArray(seedsRows)?seedsRows.length:'invalid response'}.`);
  const seedsPage=seedsRows[0];
  const results=[];

  for(const line of catalog.lines){
    const params=new URLSearchParams({slug:line.slug,context:'edit',per_page:'20',parent:String(seedsPage.id)});
    const rows=await request(`/wp-json/wp/v2/pages?${params}`);
    if(!Array.isArray(rows)) throw new Error(`${line.slug}: unexpected WordPress page response.`);
    if(rows.length<=1){
      results.push({slug:line.slug,candidateCount:rows.length,canonicalId:rows[0]?.id||null,reconciled:false});
      continue;
    }

    await writeFile(join(backupDir,`${line.slug}-candidates-before.json`),`${JSON.stringify(rows,null,2)}\n`,'utf8');
    const canonical=chooseCanonical(rows,line.slug);
    if(!canonical?.id) throw new Error(`${line.slug}: duplicate candidates exist but no canonical page could be selected.`);
    const redundant=rows.filter(page=>page.id!==canonical.id);

    if(apply){
      for(const page of redundant){
        const backupSlug=`${line.slug}-duplicate-${page.id}`;
        await request(`/wp-json/wp/v2/pages/${page.id}`,{
          method:'POST',
          body:JSON.stringify({status:'draft',slug:backupSlug})
        });
      }
      const after=await request(`/wp-json/wp/v2/pages?${params}`);
      if(!Array.isArray(after)||after.length!==1||after[0].id!==canonical.id){
        throw new Error(`${line.slug}: duplicate reconciliation did not leave exactly one canonical page.`);
      }
      await writeFile(join(backupDir,`${line.slug}-after.json`),`${JSON.stringify(after,null,2)}\n`,'utf8');
    }

    results.push({
      slug:line.slug,
      candidateCount:rows.length,
      canonicalId:canonical.id,
      canonicalStatus:canonical.status,
      redundantIds:redundant.map(page=>page.id),
      reconciled:apply
    });
  }

  const report={generatedAt:new Date().toISOString(),siteUrl,apply,backupDir,seedsPageId:seedsPage.id,results};
  await writeFile(join(backupDir,'duplicate-page-reconciliation-report.json'),`${JSON.stringify(report,null,2)}\n`,'utf8');
  await writeFile(join(backupRoot,'duplicate-page-reconciliation-backup-path.txt'),`${backupDir}\n`,'utf8');
  console.log(JSON.stringify(report,null,2));
  return report;
}

if(String(process.env.GENETICS_DUPLICATE_RECONCILE_TEST||'').toLowerCase()!=='true'){
  await reconcileDuplicateGeneticsPages();
}

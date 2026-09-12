import process from 'node:process';

const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
// The default scope belongs to the WordPress shared-shell owner. Static application
// routes are verified after their separate public-suite deployment by passing
// RESPONSIVE_LAYOUT_VERIFY_ROUTES explicitly.
const routes=(process.env.RESPONSIVE_LAYOUT_VERIFY_ROUTES||'/,/learn/,/courses/')
  .split(',').map(value=>value.trim()).filter(Boolean);
const attempts=Math.max(1,Number(process.env.RESPONSIVE_LAYOUT_VERIFY_ATTEMPTS||6));
const pauseMs=Math.max(250,Number(process.env.RESPONSIVE_LAYOUT_VERIFY_PAUSE_MS||3000));
const marker='id="dtf-responsive-layout-v1"';
const requiredCssTokens=[
  '--dtf-layout-max:1360px',
  '@media (min-width:701px) and (max-width:1120px)',
  '@media (max-width:700px)',
  'scroll-snap-type:x proximity',
  '--dtf-layout-touch:44px'
];

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

async function fetchRoute(route,attempt){
  const url=new URL(route,`${siteUrl}/`);
  url.searchParams.set('dtf_responsive_layout_v1',`${Date.now()}-${process.pid}-${attempt}`);
  const response=await fetch(url,{
    redirect:'follow',
    headers:{
      'cache-control':'no-cache, no-store, max-age=0',
      pragma:'no-cache',
      accept:'text/html',
      'user-agent':'DTFSeeds-Responsive-Layout-Live/1.1'
    },
    signal:AbortSignal.timeout(30_000)
  });
  const body=await response.text();
  if(!response.ok) throw new Error(`${route} returned HTTP ${response.status}`);
  return body;
}

function inspect(route,body){
  const missing=[];
  if(!body.includes('data-dtf-shell="header-v5"')) missing.push('approved V5 header');
  if(!body.includes(marker)) missing.push('responsive layout style marker');
  for(const token of requiredCssTokens){
    if(!body.includes(token)) missing.push(`CSS token ${JSON.stringify(token)}`);
  }
  if(!/<meta[^>]+name=["']viewport["'][^>]+width=device-width/i.test(body) && !/<meta[^>]+content=["'][^"']*width=device-width[^"']*["'][^>]+name=["']viewport["']/i.test(body)) {
    missing.push('responsive viewport meta');
  }
  return missing;
}

const results=[];
for(const route of routes){
  let finalMissing=[];
  let lastError=null;
  let passed=false;
  for(let attempt=1;attempt<=attempts;attempt++){
    try{
      const body=await fetchRoute(route,attempt);
      finalMissing=inspect(route,body);
      if(finalMissing.length===0){
        passed=true;
        results.push({route,ok:true,attempt});
        console.log(`PASS responsive layout ${route}`);
        break;
      }
      lastError=new Error(`${route} missing ${finalMissing.join(', ')}`);
    }catch(error){
      lastError=error;
    }
    if(attempt<attempts) await sleep(pauseMs);
  }
  if(!passed){
    results.push({route,ok:false,missing:finalMissing,error:lastError?.message||'unknown error'});
    console.error(`FAIL responsive layout ${route}: ${lastError?.message||'unknown error'}`);
  }
}

const failed=results.filter(row=>!row.ok);
console.log(JSON.stringify({siteUrl,marker,routes:results,ok:failed.length===0},null,2));
if(failed.length) process.exit(1);

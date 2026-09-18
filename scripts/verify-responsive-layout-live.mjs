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
const uxMarker='id="dtf-sitewide-ux-polish-v1"';
const mobileMarker='id="dtf-sitewide-mobile-polish-v1-style"';
const requiredCssTokens=[
  '--dtf-layout-max:1360px',
  '--dtf-global-header-height:92px',
  '@media (min-width:701px) and (max-width:1120px)',
  '@media (max-width:700px)',
  'scroll-snap-type:x proximity',
  '--dtf-layout-touch:44px',
  '.high-iq-shell .quiz-scoreboard{top:calc(var(--dtf-global-header-height) + 8px)!important}'
];
const requiredUxTokens=[
  'DTFSeeds sitewide UX polish v1',
  'scroll-padding-top:',
  ':focus-visible',
  'min-height:44px',
  'overscroll-behavior:contain',
  '--dtf-ux-focus:#8fea76'
];
const requiredMobileTokens=[
  '--dtf-mobile-gutter:16px',
  '--dtf-mobile-section:clamp(38px,10vw,54px)',
  'grid-template-columns:repeat(2,minmax(0,1fr))!important',
  'font-size:clamp(2.15rem,10vw,3.25rem)!important',
  'padding:18px!important'
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
      'user-agent':'DTFSeeds-Responsive-Layout-Live/1.7'
    },
    signal:AbortSignal.timeout(30_000)
  });
  const body=await response.text();
  if(!response.ok) throw new Error(`${route} returned HTTP ${response.status}`);
  return body;
}

function inspect(route,body){
  const missing=[];
  if(!body.includes('data-dtf-shell="header-v6"')) missing.push('canonical V6 header');
  if(!body.includes('data-dtf-sitewide-header="canonical-six-v1"')) missing.push('canonical six-link navigation marker');
  if(!body.includes(marker)) missing.push('responsive layout style marker');
  if(!body.includes(uxMarker)) missing.push('sitewide UX polish style marker');
  if(!body.includes(mobileMarker)) missing.push('sitewide mobile polish style marker');
  const responsiveIndex=body.indexOf(marker);
  const uxIndex=body.indexOf(uxMarker);
  const mobileIndex=body.indexOf(mobileMarker);
  if(responsiveIndex>=0&&uxIndex>=0&&mobileIndex>=0&&!(mobileIndex>responsiveIndex&&mobileIndex>uxIndex)) {
    missing.push('mobile polish must be the final shared responsive style layer');
  }
  for(const token of requiredCssTokens){
    if(!body.includes(token)) missing.push(`responsive CSS token ${JSON.stringify(token)}`);
  }
  for(const token of requiredUxTokens){
    if(!body.includes(token)) missing.push(`UX CSS token ${JSON.stringify(token)}`);
  }
  for(const token of requiredMobileTokens){
    if(!body.includes(token)) missing.push(`mobile CSS token ${JSON.stringify(token)}`);
  }
  if(!/<meta[^>]+name=["']viewport["'][^>]+width=device-width/i.test(body) && !/<meta[^>]+content=["'][^"']*width=device-width[^"']*["'][^>]+name=["']viewport["']/i.test(body)) {
    missing.push('responsive viewport meta');
  }
  if(route==='/games/high-iq/' && !body.includes('class="high-iq-shell"')) {
    missing.push('High IQ gameplay shell');
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
        console.log(`PASS responsive layout, UX polish, and final mobile polish ${route}`);
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
    console.error(`FAIL responsive layout, UX polish, and final mobile polish ${route}: ${lastError?.message||'unknown error'}`);
  }
}

const failed=results.filter(row=>!row.ok);
console.log(JSON.stringify({siteUrl,header:'v6',navigation:'canonical-six-v1',marker,uxMarker,mobileMarker,mobilePolishFinal:true,routes:results,ok:failed.length===0},null,2));
if(failed.length) process.exit(1);

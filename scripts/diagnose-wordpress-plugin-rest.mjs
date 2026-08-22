const site=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const user=process.env.WP_API_USERNAME||'';
const pass=process.env.WP_API_PASSWORD||'';
if(!user||!pass) throw new Error('WordPress credentials required');
const auth=`Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function get(path){
  let last;
  for(let i=1;i<=6;i++){
    try{
      const r=await fetch(`${site}${path}`,{headers:{Authorization:auth,Accept:'application/json','Cache-Control':'no-cache'}});
      const text=await r.text();
      let body=text; try{body=JSON.parse(text)}catch{}
      if(r.status<500 || i===6) return {status:r.status,ok:r.ok,body};
      last=new Error(`HTTP ${r.status}`);
    }catch(e){last=e; if(i===6) throw e;}
    await sleep(i*i*1000);
  }
  throw last;
}

const root=await get('/wp-json/');
const pluginRouteAdvertised=Boolean(root?.body?.routes?.['/wp/v2/plugins']);
const snippetsRouteAdvertised=Boolean(root?.body?.routes?.['/code-snippets/v1/snippets']);
const plugins=await get('/wp-json/wp/v2/plugins?per_page=100');
let codeSnippets=null;
if(Array.isArray(plugins.body)){
  codeSnippets=plugins.body.find(p=>String(p?.plugin||'').startsWith('code-snippets/'))||null;
}
const report={
  rootStatus:root.status,
  pluginRouteAdvertised,
  snippetsRouteAdvertised,
  pluginListStatus:plugins.status,
  pluginListAccessible:plugins.ok,
  codeSnippetsInstalled:Boolean(codeSnippets),
  codeSnippetsPluginFile:codeSnippets?.plugin||null,
  codeSnippetsStatus:codeSnippets?.status||null,
};
console.log(JSON.stringify(report));

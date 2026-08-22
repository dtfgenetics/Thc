const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
if(!username||!password) throw new Error('WordPress REST credentials are required');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const response=await fetch(`${siteUrl}/wp-json/`,{headers:{Authorization:auth,Accept:'application/json','Cache-Control':'no-cache'}});
if(!response.ok) throw new Error(`REST index failed: ${response.status}`);
const body=await response.json();
const routes=body.routes||{};
const terms=['hostinger','file','filesystem','cache','litespeed','plugin','theme','template','elementor','backup','import','media','site-health'];
const matches=[];
for(const [route,definition] of Object.entries(routes)){
  const lower=route.toLowerCase();
  if(!terms.some((term)=>lower.includes(term))) continue;
  const endpoints=Array.isArray(definition.endpoints)?definition.endpoints:[];
  matches.push({
    route,
    namespace:definition.namespace||null,
    methods:[...new Set(endpoints.flatMap((endpoint)=>Array.isArray(endpoint.methods)?endpoint.methods:Object.keys(endpoint.methods||{})))],
    args:[...new Set(endpoints.flatMap((endpoint)=>Object.keys(endpoint.args||{})))].sort(),
  });
}
console.log(JSON.stringify({generatedAt:new Date().toISOString(),namespaces:body.namespaces||[],matches},null,2));

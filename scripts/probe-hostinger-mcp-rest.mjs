const siteUrl=(process.env.WP_SITE_URL||'https://dtfseeds.com').replace(/\/$/,'');
const username=process.env.WP_API_USERNAME||'';
const password=process.env.WP_API_PASSWORD||'';
if(!username||!password) throw new Error('WordPress credentials are required');
const auth=`Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
const url=`${siteUrl}/wp-json/hostinger-ai-assistant/v1/mcp`;
async function probe(method){
  const response=await fetch(url,{method,headers:{Authorization:auth,Accept:'application/json','Cache-Control':'no-cache'}});
  const text=await response.text();
  let body=text;
  try{body=JSON.parse(text)}catch{}
  return {method,status:response.status,ok:response.ok,allow:response.headers.get('allow'),contentType:response.headers.get('content-type'),body};
}
const results=[];
for(const method of ['GET','OPTIONS']){
  try{results.push(await probe(method))}catch(error){results.push({method,error:String(error)})}
}
console.log(JSON.stringify({generatedAt:new Date().toISOString(),results},null,2));

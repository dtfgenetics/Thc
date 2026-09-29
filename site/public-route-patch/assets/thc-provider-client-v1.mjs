const PROVIDER_RE=/^[a-z0-9-]+$/i;
const DEVICE_RE=/^[a-z0-9._:-]+$/i;

const ensureProvider=value=>{
  const id=String(value??'').trim();
  if(!PROVIDER_RE.test(id))throw new Error('Provider ID is invalid.');
  return id;
};

const ensureDevice=value=>{
  const id=String(value??'').trim();
  if(!DEVICE_RE.test(id))throw new Error('Device ID is invalid.');
  return id;
};

export function createProviderTelemetryClient({
  baseUrl='/api/telemetry',
  fetchFn=globalThis.fetch?.bind(globalThis),
  origin=globalThis.location?.origin||'http://localhost'
}={}){
  if(typeof fetchFn!=='function')throw new Error('Provider client requires fetch.');
  const originUrl=new URL(String(origin));
  const base=new URL(String(baseUrl),originUrl);
  if(base.origin!==originUrl.origin)throw new Error('Provider client must use a same-origin gateway.');
  const basePath=base.pathname.replace(/\/+$/,'');

  const request=async path=>{
    const url=new URL(basePath+path,originUrl);
    if(url.origin!==originUrl.origin)throw new Error('Provider request must remain same-origin.');
    const response=await fetchFn(url.toString(),{method:'GET',credentials:'same-origin'});
    let body={};
    try{body=await response.json()}catch{}
    if(!response?.ok)throw new Error(String(body?.error||'Provider request failed.'));
    return body;
  };

  return {
    listProviders(){
      return request('/providers').then(body=>Array.isArray(body.providers)?body.providers:[]);
    },
    listDevices(providerId){
      const provider=ensureProvider(providerId);
      return request('/'+encodeURIComponent(provider)+'/devices').then(body=>Array.isArray(body.devices)?body.devices:[]);
    },
    async getRecent(providerId,deviceId){
      const provider=ensureProvider(providerId);
      const device=ensureDevice(deviceId);
      const body=await request('/'+encodeURIComponent(provider)+'/devices/'+encodeURIComponent(device)+'/recent');
      if(!body?.packet||typeof body.packet!=='object')throw new Error('Provider response did not contain a telemetry packet.');
      return body.packet;
    },
    async getDetails(providerId,deviceId){
      const provider=ensureProvider(providerId);
      const device=ensureDevice(deviceId);
      const body=await request('/'+encodeURIComponent(provider)+'/devices/'+encodeURIComponent(device)+'/details');
      if(!body?.details||typeof body.details!=='object')throw new Error('Provider response did not contain device details.');
      return body.details;
    }
  };
}

const CACHE='ptp-shell-v2-20260826';
const SHELL=['./','./index.html','./styles.css','./visual-fixes.css','./enhancements.css','./v2-extras.css','./app.js','./enhancements.js','./v2-extras.js','./plant.svg','./manifest.webmanifest'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('ptp-shell-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;
  const url=new URL(req.url);if(url.origin!==self.location.origin)return;
  if(url.pathname.endsWith('/api.php'))return;
  event.respondWith(fetch(req).then(response=>{if(response&&response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy)).catch(()=>{})}return response}).catch(async()=>{const cached=await caches.match(req);if(cached)return cached;if(req.mode==='navigate')return caches.match('./index.html');throw new Error('Offline and resource is not cached.')}));
});
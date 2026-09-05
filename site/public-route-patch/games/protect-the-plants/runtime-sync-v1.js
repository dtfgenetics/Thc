(()=>{
  const listeners=new Set();
  let queued=false;

  function flush(){
    queued=false;
    for(const listener of [...listeners]){
      try{listener()}catch(error){console.error('[Burn Buds sync]',error)}
    }
  }

  function request(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(flush);
  }

  function subscribe(listener,{immediate=true}={}){
    if(typeof listener!=='function')return()=>{};
    listeners.add(listener);
    if(immediate)request();
    return()=>listeners.delete(listener);
  }

  const root=document.querySelector('#app');
  if(root)new MutationObserver(request).observe(root,{childList:true,subtree:true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)request()});
  window.addEventListener('online',request);
  window.addEventListener('resize',request,{passive:true});

  window.BurnBudsSync=Object.freeze({request,subscribe});
  request();
})();

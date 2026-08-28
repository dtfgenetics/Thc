(()=>{
  function releaseHeldTouchControls(){
    document.querySelectorAll('[data-hold].active').forEach(button=>{
      button.dispatchEvent(new Event('pointercancel',{bubbles:true,cancelable:true}));
    });
  }

  function pauseThroughExistingControls(){
    if(!document.hidden)return;
    releaseHeldTouchControls();
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));
    window.dispatchEvent(new KeyboardEvent('keyup',{key:'Escape',code:'Escape',bubbles:true}));
  }

  document.addEventListener('visibilitychange',pauseThroughExistingControls);
})();

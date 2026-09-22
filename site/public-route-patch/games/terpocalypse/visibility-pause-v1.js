(()=>{
  const heldKeyboardCodes=[
    'KeyW','KeyA','KeyS','KeyD',
    'ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
    'ShiftLeft','ShiftRight','Space'
  ];

  function releaseHeldTouchControls(){
    document.querySelectorAll('[data-hold].active').forEach(button=>{
      button.dispatchEvent(new Event('pointercancel',{bubbles:true,cancelable:true}));
    });
  }

  function releaseHeldKeyboardControls(){
    heldKeyboardCodes.forEach(code=>{
      window.dispatchEvent(new KeyboardEvent('keyup',{code,bubbles:true}));
    });
  }

  function pauseThroughExistingControls(){
    if(!document.hidden)return;
    releaseHeldTouchControls();
    releaseHeldKeyboardControls();
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',bubbles:true}));
    window.dispatchEvent(new KeyboardEvent('keyup',{key:'Escape',code:'Escape',bubbles:true}));
  }

  document.addEventListener('visibilitychange',pauseThroughExistingControls);
})();

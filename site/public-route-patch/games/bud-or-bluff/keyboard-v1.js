(()=>{
  const voteControls=document.querySelector('#voteControls');
  const doubleWrap=document.querySelector('#doubleWrap');
  const doubleToggle=document.querySelector('#doubleToggle');
  if(!voteControls)return;

  const hint=document.createElement('p');
  hint.className='vote-keyboard-hint';
  hint.textContent='Keyboard: 1 = BUD · 2 = BLUFF · D = Double Hit';
  voteControls.insertAdjacentElement('afterend',hint);

  function isTypingTarget(target){
    return target instanceof HTMLElement&&(target.matches('input,textarea,select,button')||target.isContentEditable);
  }

  function visible(element){
    if(!element||element.hidden||element.closest('.hidden'))return false;
    const style=getComputedStyle(element);
    return style.display!=='none'&&style.visibility!=='hidden';
  }

  document.addEventListener('keydown',event=>{
    if(event.repeat||event.altKey||event.ctrlKey||event.metaKey||isTypingTarget(event.target)||!visible(voteControls))return;
    const bud=voteControls.querySelector('[data-vote="BUD"]');
    const bluff=voteControls.querySelector('[data-vote="BLUFF"]');

    if(event.key==='1'&&bud&&!bud.disabled&&visible(bud)){
      event.preventDefault();
      bud.click();
      return;
    }
    if(event.key==='2'&&bluff&&!bluff.disabled&&visible(bluff)){
      event.preventDefault();
      bluff.click();
      return;
    }
    if(event.key.toLowerCase()==='d'&&visible(doubleWrap)&&doubleToggle&&!doubleToggle.disabled){
      event.preventDefault();
      doubleToggle.checked=!doubleToggle.checked;
      doubleToggle.dispatchEvent(new Event('change',{bubbles:true}));
    }
  });
})();

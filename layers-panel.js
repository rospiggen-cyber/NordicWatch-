(function(){
  'use strict';
  const panel=document.getElementById('layersPanel'),toggle=document.getElementById('layersToggle'),close=document.getElementById('layersClose'),backdrop=document.getElementById('layersBackdrop');
  const mobile=matchMedia('(max-width:850px)'),key='nordicWatchLayers';
  let ownsEntry=false,waitingForBack=false;
  function render(open){
    panel.classList.toggle('collapsed',!open);
    toggle.textContent=open?'−':'+';
    toggle.setAttribute('aria-expanded',String(open));
    toggle.setAttribute('aria-label',open?'Collapse Layers':'Open Layers');
    close.hidden=!open;
    backdrop.hidden=!(open&&mobile.matches);
  }
  function dismiss({fromHistory=false,restoreFocus=true}={}){
    const wasOpen=!panel.classList.contains('collapsed');
    render(false);
    if(ownsEntry&&!fromHistory){
      ownsEntry=false;
      waitingForBack=true;
      history.back();
    }else ownsEntry=false;
    if(wasOpen&&restoreFocus)toggle.focus();
  }
  function open(){
    if(waitingForBack)return;
    if(mobile.matches){
      try{history.pushState({...history.state,[key]:true},'');ownsEntry=true}catch{ownsEntry=false}
    }
    render(true);
  }
  toggle.addEventListener('click',()=>panel.classList.contains('collapsed')?open():dismiss());
  close.addEventListener('click',()=>dismiss());
  backdrop.addEventListener('click',()=>dismiss());
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&!panel.classList.contains('collapsed')){event.preventDefault();dismiss()}
  });
  window.addEventListener('popstate',()=>{
    waitingForBack=false;
    dismiss({fromHistory:true});
    // Forward must not leave an invisible panel entry on the back stack.
    if(history.state?.[key]){const state={...history.state};delete state[key];history.replaceState(state,'')}
  });
  mobile.addEventListener('change',()=>dismiss());
  window.NordicWatchLayers={close:dismiss};
  render(!mobile.matches);
})();

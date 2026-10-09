/* Navigation must work independently of map, data and situation initialization. */
(function(){
  'use strict';
  const openButton=document.getElementById('mobileIntel');
  const closeButton=document.getElementById('mobileIntelClose');
  const panel=document.getElementById('mobileIntelPanel');
  function close(){
    const wasOpen=panel.classList.contains('mobile-open');
    panel.classList.remove('mobile-open');
    openButton.setAttribute('aria-expanded','false');
    if(wasOpen)openButton.focus();
  }
  openButton.addEventListener('click',()=>{
    panel.classList.add('mobile-open');
    openButton.setAttribute('aria-expanded','true');
    panel.scrollTop=0;
    closeButton.focus();
  });
  closeButton.addEventListener('click',close);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&panel.classList.contains('mobile-open')){event.preventDefault();close()}
  });
  matchMedia('(max-width:850px)').addEventListener('change',close);
  close();
})();

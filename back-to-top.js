/* Shared page action: all four navigation views use the same document scroller. */
(()=>{
  const button=document.getElementById('backToTop');if(!button)return;
  let queued=false;
  function update(){
    queued=false;
    const covered=document.body.classList.contains('sheet')||document.documentElement.classList.contains('modal-scroll-locked')||document.querySelector('dialog[open]');
    button.hidden=!!covered||window.scrollY<Math.min(360,window.innerHeight*.65);
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(update);}}
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule,{passive:true});
  window.visualViewport?.addEventListener('resize',schedule,{passive:true});
  const state=new MutationObserver(schedule);
  state.observe(document.documentElement,{attributes:true,attributeFilter:['class']});
  state.observe(document.body,{attributes:true,attributeFilter:['class','data-tab']});
  new MutationObserver(schedule).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  button.addEventListener('click',()=>{
    const heading=document.querySelector(document.body.dataset.tab==='me'?'.mehead h2':'#intro h1');
    if(heading){heading.setAttribute('tabindex','-1');heading.focus({preventScroll:true});}
    window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    schedule();
  });
  schedule();
})();

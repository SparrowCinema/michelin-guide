/* Personal dashboard: stable anchors, native disclosures, and a bounded restaurant list. */
const MGMe=(()=>{
  let mounted=false;
  const $=id=>document.getElementById(id);
  const icons={passport:'M5 3h12a2 2 0 0 1 2 2v15H7a2 2 0 0 1-2-2V3Zm0 13h14M9 8h6M12 5v6',trips:'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15',want:'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11Z',been:'m5 12 4 4L19 6',sync:'M4 9a8 8 0 0 1 14-4l2 2m0-5v5h-5M20 15a8 8 0 0 1-14 4l-2-2m0 5v-5h5',backup:'M4 15v5h16v-5M12 3v12m-5-5 5 5 5-5',settings:'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6'};
  const navItems=[['passport','护照','mePassport'],['trips','旅行','meTrips'],['want','想去','meCollection',1],['been','去过','meCollection',2],['sync','同步','meSync'],['backup','备份','meBackup'],['settings','设置','meSettings']];
  function fold(id,title,subtitle,nodes,open=false){
    const box=document.createElement('details');box.id=id;box.className='me-fold';box.open=open;
    box.innerHTML=`<summary><span><strong>${title}</strong><small>${subtitle}</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 7 7-7 7"/></svg></summary><div class="me-fold-body"></div>`;
    nodes[0].before(box);nodes.forEach(n=>box.lastElementChild.append(n));return box;
  }
  function mount(){
    if(mounted||!$('mePage'))return;mounted=true;
    const head=$('mePage').querySelector('.mehead');
    const nav=document.createElement('nav');nav.className='me-jumps';nav.id='meJumps';nav.setAttribute('aria-label','我的页面直达');
    nav.innerHTML=navItems.map(([key,label,target,mode])=>`<button type="button" data-me-jump="${target}"${mode?` data-me-mode="${mode}"`:''} aria-controls="${target}"><span class="me-jump-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[key]}"/></svg>${mode?`<b data-me-count="${mode}">0</b>`:''}</span><span>${label}</span></button>`).join('');head.after(nav);
    nav.after($('meStats'));$('meStats').after($('meLv'));
    const passport=$('passportContent').closest('section'),trips=$('tripCards').closest('section');
    fold('mePassport','美食护照','签章与我的旅行记录',[passport],true);
    fold('meTrips','旅行美食地图','规划旅程，收藏沿途餐厅',[trips]);
    const tabs=$('mePage').querySelector('.metabs');fold('meCollection','餐厅清单','想去与去过，随时展开查看',[tabs,$('meList')]);
    const more=document.createElement('button');more.id='meMore';more.type='button';more.className='me-more';more.hidden=true;$('meList').after(more);
    more.onclick=()=>{meLimit+=24;renderMe();};
    const backup=$('exportBtn').closest('.card'),appearance=$('themeSeg').closest('.card'),about=$('installBtn').closest('.card');
    if($('syncCard'))fold('meSync','云端同步','手机与电脑，共享一份收藏',[$('syncCard')]);
    fold('meBackup','备份与恢复','导出一份，安心保留',[backup]);
    fold('meSettings','偏好与关于','主题、语言与使用帮助',[appearance,about]);
    nav.addEventListener('click',e=>{
      const b=e.target.closest('[data-me-jump]');if(!b)return;const target=$(b.dataset.meJump);if(!target)return;
      if(b.dataset.meMode){meTab=+b.dataset.meMode;meLimit=12;renderMe();}
      target.open=true;nav.querySelectorAll('button').forEach(x=>x.removeAttribute('aria-current'));b.setAttribute('aria-current','location');
      const controls=document.querySelector('.controls');target.style.scrollMarginTop=((controls?.getBoundingClientRect().height||0)+18)+'px';
      target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});target.querySelector('summary').focus({preventScroll:true});
    });
    renderMe();
  }
  function update(want,been,total){
    if(!mounted)return;$('meJumps').querySelectorAll('[data-me-count]').forEach(x=>{const n=x.dataset.meCount==='1'?want:been;x.textContent=n>999?'999+':n;});
    const summary=$('meCollection').querySelector('summary small');summary.textContent=`想去 ${want} · 去过 ${been}`;
    const b=$('meMore');b.hidden=total<=meLimit;b.textContent=`再显示 ${Math.min(24,Math.max(0,total-meLimit))} 家（还有 ${Math.max(0,total-meLimit)} 家）`;
  }
  return {mount,update};
})();

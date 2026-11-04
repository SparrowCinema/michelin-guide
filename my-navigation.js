/* Personal dashboard: stable anchors, native disclosures, and a bounded restaurant list. */
const MGMe=(()=>{
  let mounted=false;
  const $=id=>document.getElementById(id);
  const icons={passport:'M5 3h12a2 2 0 0 1 2 2v15H7a2 2 0 0 1-2-2V3Zm0 13h14M9 8h6M12 5v6',trips:'M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15',want:'M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11Z',been:'m5 12 4 4L19 6',sync:'M4 9a8 8 0 0 1 14-4l2 2m0-5v5h-5M20 15a8 8 0 0 1-14 4l-2-2m0 5v-5h5',backup:'M4 15v5h16v-5M12 3v12m-5-5 5 5 5-5',settings:'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6',friends:'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'};
  icons.guide='M3 5h7a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H3V5Zm18 0h-7a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h7V5Z';
  icons.recap='M4 3h16v18H4V3Zm4 5h8m-8 4h5m-5 4h8';
  icons.phone='M7 2h10a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Zm3 17h4';
  const GUIDE=[['找餐厅','在“名录”搜索店名、城市或菜系，用等级和筛选缩小范围；“附近”按距离、“地图”按位置查看。'],['标记想去与去过','点餐厅旁的“想去”收藏；吃过后点“去过”，可记录日期、评分和备注。'],['翻开护照','每家去过的餐厅都有专属章，每页十枚；手机竖屏单页阅读，横屏或平板展开双页，左右滑动翻页。'],['旅行美食地图','新建一段旅行，把想去的餐厅排进行程，规划沿途路线。'],['生成结算地图','在“我的米其林结算地图”生成长图：足迹地图、到访清单和我的评分，可保存分享。'],['备份与同步','在“数据与同步”连接手机与电脑；展开“高级选项”，可导出独立备份或从文件恢复。'],['添加到主屏幕','展开“添加到手机”，查看主屏幕安装步骤或微信浮窗用法。'],['切换语言','点页面顶部右侧的“中 / EN”即可切换界面语言。']];
  const navItems=[['passport','护照','mePassport'],['trips','旅行','meTrips'],['want','想去','meCollection',1],['been','去过','meCollection',2],['sync','同步','meSync'],['backup','备份','meBackup'],['settings','设置','meSettings']];
  function fold(id,title,subtitle,nodes,icon,open=false){
    const box=document.createElement('details');box.id=id;box.className='me-fold';box.open=open;
    box.innerHTML=`<summary><svg class="me-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[icon]}"/></svg><span><strong>${title}</strong><small>${subtitle}</small></span><svg class="me-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 7 7-7 7"/></svg></summary><div class="me-fold-body"></div>`;
    nodes[0].before(box);nodes.forEach(n=>box.lastElementChild.append(n));return box;
  }
  function mount(){
    if(mounted||!$('mePage'))return;mounted=true;
    const head=$('mePage').querySelector('.mehead');
    const nav=document.createElement('nav');nav.className='me-jumps';nav.id='meJumps';nav.setAttribute('aria-label','我的页面直达');
    nav.innerHTML=navItems.map(([key,label,target,mode])=>`<button type="button" data-me-jump="${target}"${mode?` data-me-mode="${mode}"`:''} aria-controls="${target}"><span class="me-jump-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${icons[key]}"/></svg>${mode?`<b data-me-count="${mode}">0</b>`:''}</span><span>${label}</span></button>`).join('');head.after(nav);
    nav.after($('meStats'));$('meStats').after($('meLv'));
    const passport=$('passportContent').closest('section'),trips=$('tripCards').closest('section');
    fold('mePassport','美食护照','签章与我的旅行记录',[passport],'passport');
    const recap=document.createElement('div');recap.id='meRecap';recap.className='me-fold';
    recap.innerHTML=`<button type="button" class="me-entry" data-passport-share aria-haspopup="dialog"><svg class="me-ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${icons.recap}"/></svg><span><strong>我的米其林结算地图</strong><small>足迹地图、到访清单与评分 · 生成分享长图</small></span><svg class="me-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 7 7-7 7"/></svg></button>`;
    $('mePassport').after(recap);
    fold('meTrips','旅行美食地图','规划旅程，收藏沿途餐厅',[trips],'trips');
    const tabs=$('mePage').querySelector('.metabs');fold('meCollection','餐厅清单','想去与去过，随时展开查看',[tabs,$('meList')],'want');
    const more=document.createElement('button');more.id='meMore';more.type='button';more.className='me-more';more.hidden=true;$('meList').after(more);
    more.onclick=()=>{meLimit+=24;renderMe();};
    const backup=$('exportBtn').closest('.card'),appearance=$('themeSeg').closest('.card'),about=$('installBtn').closest('.card');
    const advanced=document.createElement('details');advanced.id='meBackup';advanced.className='me-sync-advanced';
    advanced.innerHTML='<summary><span><strong>高级选项</strong><small>导出备份 · 从备份恢复</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 7 7-7 7"/></svg></summary><div class="me-sync-advanced-body"></div>';
    backup.before(advanced);advanced.lastElementChild.append(backup);
    fold('meSync','数据与同步','多端同步，独立备份',[...($('syncCard')?[$('syncCard')]:[]),advanced],'sync');
    const guide=document.createElement('section');guide.className='me-guide';guide.innerHTML='<ol>'+GUIDE.map(([t,d])=>`<li><strong>${t}</strong><span>${d}</span></li>`).join('')+'</ol>';
    $('meSync').after(guide);fold('meGuide','使用指南','如何使用米其林全球美食护照',[guide],'guide');
    const install=document.createElement('section');install.className='me-install';
    install.innerHTML='<div class="install-intro"><img src="icon-192.png" width="52" height="52" alt=""><div><h3>把美食护照带在身边</h3><p>放到桌面，随时记录下一餐。</p></div></div><div class="install-actions"></div><div class="install-options"></div><p class="install-sync-note">微信、浏览器与桌面入口的记录可能分开保存。已有记录？先在“数据与同步”连接云端，再在新入口连接同一份档案。</p>';
    const options=[['apple','iPhone / iPad · Safari',['在 Safari 打开本网站，点“分享”（方框加向上箭头）；部分布局需先点页面菜单。','选择“添加到主屏幕”；找不到时，在分享菜单的“编辑操作”中添加。','如有“作为网页 App 打开”，将它开启，再点“添加”。以后从桌面图标进入。']],['android','安卓 · 手机浏览器',['在 Chrome 打开本网站，点地址栏旁的“⋮”菜单。','选择“安装并创建快捷方式”→“安装”；部分浏览器显示为“安装应用”或“添加到主屏幕”。','按提示确认。其他浏览器可在菜单中找“添加到桌面”或“创建快捷方式”。']],['wechat','微信 · 浮窗与收藏',['在微信中打开本网站，点右上角“···”。','菜单里如有“浮窗”，点它可暂存页面，之后从微信浮窗入口返回。','没有“浮窗”时，可用“收藏”留存链接；若要添加到手机桌面，请选择“在浏览器中打开”，或复制网址到 Safari / Chrome。']]];
    const ua=navigator.userAgent,current=/MicroMessenger/i.test(ua)?'wechat':/iPhone|iPad|iPod/.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1)?'apple':/Android/.test(ua)?'android':'';
    install.querySelector('.install-options').innerHTML=options.map(([id,title,steps])=>`<details class="install-option"${id===current?' open':''}><summary>${title}<span aria-hidden="true">＋</span></summary><ol>${steps.map(step=>`<li>${step}</li>`).join('')}</ol>${id==='wechat'?'<p>微信菜单随版本和设备有所不同，以你实际看到的选项为准。</p>':''}</details>`).join('');
    $('meGuide').after(install);fold('meInstall','添加到手机','桌面像 App 一样打开 · 微信浮窗与收藏',[install],'phone');
    install.querySelector('.install-actions').append($('installBtn'));
    const copy=document.createElement('button');copy.type='button';copy.className='btn';copy.textContent='复制网址';copy.id='installCopyLink';
    copy.addEventListener('click',()=>copyText(location.origin+location.pathname).then(()=>toast('网址已复制，粘贴到浏览器地址栏打开'),()=>toast('没能复制，请手动复制地址栏里的网址')));install.querySelector('.install-actions').append(copy);
    fold('meSettings','偏好与关于','主题、语言与使用帮助',[appearance,about],'settings');
    const friends=document.createElement('section');friends.className='me-friends';
    friends.innerHTML='<a href="https://sparrowcinema.github.io/SparrowTribe/?v=2&amp;lang=zh#my" target="_blank" rel="noopener noreferrer"><img class="friend-logo" src="assets/tribe-logo.png" alt="" width="44" height="44" loading="lazy"><span class="friend-text"><strong>麻雀观影护照</strong><small>记录光影足迹，收藏每一次观影。</small></span><span aria-hidden="true">↗</span></a>';
    $('meSettings').after(friends);
    fold('meFriends','友情链接','发现更多生活记录',[friends],'friends');
    const menu=document.createElement('div');menu.id='meMenu';menu.className='me-menu';$('mePassport').before(menu);['mePassport','meRecap','meTrips','meCollection','meSync','meInstall','meGuide','meSettings','meFriends'].forEach(id=>{if($(id))menu.append($(id));});
    nav.addEventListener('click',e=>{
      const b=e.target.closest('[data-me-jump]');if(!b)return;const target=$(b.dataset.meJump);if(!target)return;
      if(b.dataset.meMode){meTab=+b.dataset.meMode;meLimit=12;renderMe();}
      target.closest('.me-fold').open=true;target.open=true;nav.querySelectorAll('button').forEach(x=>x.removeAttribute('aria-current'));b.setAttribute('aria-current','location');
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
  let wasMe=false;
  function enter(me){if(me&&!wasMe)document.querySelectorAll('#mePage details.me-fold,#meBackup').forEach(d=>{d.open=false;});wasMe=!!me;}
  return {mount,update,enter};
})();

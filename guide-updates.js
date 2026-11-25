/* Guide editions and the "本次更新" banner.
   data.json → editions: [id, zh, en, year, released, source, pending[[year, released, source]], scheduled]
   city[3] = index of the guide that covers it; updates.json = per-guide changes of recent updates. */
const MGUpdates=(()=>{
  'use strict';
  const EN=()=>typeof MGI18n!=='undefined'&&MGI18n.en;
  const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  // dates are YYYY-MM-DD, or YYYY-MM when MICHELIN has only given the month
  const day=d=>{if(!d)return '';const [y,m,dd]=d.split('-');if(!dd)return EN()?`${MON[+m-1]} ${y}`:`${y} 年 ${+m} 月`;return EN()?`${MON[+m-1]} ${+dd}, ${y}`:`${y} 年 ${+m} 月 ${+dd} 日`;};
  const dot=d=>d?d.replaceAll('-','.'):'';
  const short=d=>{if(!d)return '';const [y,m,dd]=d.split('-');if(!dd)return EN()?`${MON[+m-1]} ${y}`:`${y} 年 ${+m} 月`;return EN()?`${MON[+m-1]} ${+dd}`:`${+m} 月 ${+dd} 日`;};
  const h=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const LV_ZH=['三星','二星','一星','必比登','入选'],LV_EN=['3 Stars','2 Stars','1 Star','Bib Gourmand','Selected'];
  const lv=l=>(EN()?LV_EN:LV_ZH)[l];
  let UPD=null,open=false;
  const G=i=>DB.E&&DB.E[i];
  const byId=id=>(DB.E||[]).find(g=>g[0]===id);
  function guideOf(r){const c=DB.T[r.ci];return c&&c.length>3?G(c[3]):null;}
  function name(g){return EN()?`MICHELIN Guide ${g[2]}`:`米其林指南 ${g[1]}`;}
  function edition(g){return g[3]?`${name(g)} ${g[3]}`:name(g);}

  // ---- detail page line ----
  function detailHTML(r){
    const g=guideOf(r);if(!g)return '';
    const rel=g[4]?(EN()?` · released ${day(g[4])}`:` · ${day(g[4])}发布`):(EN()?' · release date to be confirmed':' · 发布日期待核实');
    const src=g[5]?`<a href="${h(g[5])}" target="_blank" rel="noopener" translate="no">${EN()?'Announcement':'官方发布'} ↗</a>`:'';
    const next=(g[6]||[]).filter(p=>p[1]).map(p=>EN()?`The ${p[0]} edition was released on ${day(p[1])}; this list will update when the data source does.`:`${p[0]} 新版已于 ${day(p[1])}发布，名单会在数据源更新后同步。`)[0];
    return `<div class="detail-guide" translate="no"><span class="dg-mark" aria-hidden="true">${g[3]||'—'}</span><div><b>${h(edition(g))}</b><small>${h(rel.replace(/^ · /,''))}${src?' · ':''}${src}</small>${next?`<em>${h(next)}</em>`:''}</div></div>`;
  }

  // ---- banner ----
  const sum=(gs,k)=>gs.reduce((t,g)=>t+g[k].length,0);
  function chip(label,n,cls){return n?`<span class="ub-stat ${cls}"><b>${n}</b>${label}</span>`:'';}
  function rowName(x){const zh=EN()?'':x[2];return h(zh||x[1]);}
  function guideBlock(gu){
    const g=byId(gu.id),title=g?`${EN()?g[2]:g[1]}${g[3]?' '+g[3]:''}`:gu.id,rel=g&&g[4]?(EN()?`released ${day(g[4])}`:`${day(g[4])}发布`):'';
    const list=(rows,kind)=>rows.length?`<div class="ub-list ub-${kind}"><h5>${{added:EN()?'New':'新增',removed:EN()?'Removed':'移出',up:EN()?'Promoted':'升星 / 升级',down:EN()?'Moved down':'降级'}[kind]} <span>${rows.length}</span></h5><ul>${rows.slice(0,40).map(x=>{
      const inData=DB.byU[x[0]],lvTxt=kind==='up'||kind==='down'?`${lv(x[3])} → ${lv(x[4])}`:lv(x[3]);
      return `<li>${inData?`<button type="button" class="ub-r" data-restaurant="${h(x[0])}">${rowName(x)}</button>`:`<span class="ub-r gone">${rowName(x)}</span>`}<i class="ub-lv l${kind==='up'||kind==='down'?x[4]:x[3]}">${h(lvTxt)}</i></li>`;}).join('')}${rows.length>40?`<li class="ub-more">${EN()?`+ ${rows.length-40} more`:`…另有 ${rows.length-40} 家`}</li>`:''}</ul></div>`:'';
    return `<details class="ub-guide"><summary><span class="ub-gname">${h(title)}</span><span class="ub-gmeta">${rel?h(rel)+' · ':''}${[gu.added.length?`+${gu.added.length}`:'',gu.removed.length?`−${gu.removed.length}`:'',gu.up.length?`↑${gu.up.length}`:'',gu.down.length?`↓${gu.down.length}`:''].filter(Boolean).join(' ')}</span></summary>${list(gu.up,'up')}${list(gu.down,'down')}${list(gu.added,'added')}${list(gu.removed,'removed')}</details>`;
  }
  function render(){
    const box=document.getElementById('updateBanner');if(!box||!UPD||!DB)return;
    const u=UPD.updates[0];if(!u){box.hidden=true;return;}
    let seen='';try{seen=localStorage.getItem('mg-upd-seen')||'';}catch(e){}
    const gs=u.guides,pending=(DB.E||[]).flatMap(g=>(g[6]||[]).filter(p=>p[1]).map(p=>[g,p])).sort((a,b)=>b[1][1].localeCompare(a[1][1]));
    const today=new Date().toISOString().slice(0,10),sched=(DB.E||[]).filter(g=>g[7]&&g[7][1]>=today.slice(0,g[7][1].length)).map(g=>[g,g[7]]).sort((a,b)=>a[1][1].localeCompare(b[1][1]));
    const fresh=(DB.E||[]).filter(g=>g[4]&&u.from&&g[4]>u.from&&g[4]<=u.data);
    box.hidden=false;
    // Folded to one line by default so the search box and restaurants lead the page; tap to expand.
    if(!open){box.classList.add('ub-compact');box.classList.toggle('ub-unseen',seen!==u.data);
      box.innerHTML=`<button type="button" class="ub-bar" data-ub="open" aria-expanded="false"><span class="ub-dot" aria-hidden="true"></span><b>${EN()?'This update':'本次更新'}</b><span>${h(short(u.data))}${fresh.length?` · ${fresh.map(g=>h(EN()?g[2]:g[1])+' '+g[3]).slice(0,2).join('、')}`:''}</span><span class="ub-bar-stats">${sum(gs,'added')?`+${sum(gs,'added')}`:''} ${sum(gs,'removed')?`−${sum(gs,'removed')}`:''} ${sum(gs,'up')?`↑${sum(gs,'up')}`:''}</span><i aria-hidden="true">›</i></button>`;return;}
    box.classList.remove('ub-compact','ub-unseen');
    box.innerHTML=`<div class="ub-head"><span class="ub-dot" aria-hidden="true"></span><div><p class="ub-kicker">${EN()?'THIS UPDATE':'本次更新'}</p><h2>${EN()?`Data as of ${day(u.data)}`:`名单更新至 ${day(u.data)}`}</h2></div><button type="button" class="ub-close" data-ub="close" aria-label="${EN()?'Hide':'收起'}">×</button></div>
      <div class="ub-stats">${chip(EN()?'new':'家新增',sum(gs,'added'),'add')}${chip(EN()?'removed':'家移出',sum(gs,'removed'),'rm')}${chip(EN()?'promoted':'家升星',sum(gs,'up'),'up')}${chip(EN()?'moved down':'家降级',sum(gs,'down'),'down')}</div>
      ${fresh.length?`<p class="ub-line"><b>${EN()?'New editions':'新版指南'}</b>${fresh.map(g=>`<span class="ub-tag new">${h(EN()?g[2]:g[1])} ${g[3]} · ${short(g[4])}</span>`).join('')}</p>`:''}
      ${pending.length||sched.length?`<details class="ub-more-wrap ub-pending"><summary>${[pending.length?(EN()?`${pending.length} released, syncing soon`:`${pending.length} 本新版已发布 · 待同步`):'',sched.length?(EN()?`${sched.length} coming up`:`${sched.length} 本即将发布`):''].filter(Boolean).join(' · ')}</summary>
        ${pending.length?`<p class="ub-line">${pending.map(([g,p])=>`<a class="ub-tag" href="${h(p[2])}" target="_blank" rel="noopener">${h(EN()?g[2]:g[1])} ${p[0]} · ${short(p[1])}</a>`).join('')}</p>`:''}
        ${sched.length?`<p class="ub-line"><b>${EN()?'Coming up':'即将发布'}</b>${sched.map(([g,s])=>`<a class="ub-tag soon" href="${h(s[2])}" target="_blank" rel="noopener">${h(EN()?g[2]:g[1])} ${s[0]} · ${short(s[1])}</a>`).join('')}</p>`:''}
        <p class="ub-note">${EN()?'Editions MICHELIN has already announced; their lists appear here once the data source catches up.':'米其林已公布、但数据源还没收录的新版；数据源更新后会自动同步进名录。'}</p></details>`:''}
      <details class="ub-more-wrap"${open?' open':''}><summary>${EN()?`Changes by guide (${gs.length})`:`按指南查看变化（${gs.length} 个地区）`}</summary><div class="ub-guides">${gs.map(guideBlock).join('')}</div><p class="ub-note">${EN()?'Removed means no longer in the source list (closed, moved or not yet republished), not necessarily stripped of a distinction.':'“移出”指不在最新名单中（可能闭店、迁址或该地区名单尚未发布），不一定是被摘星。'}</p></details>
      <button type="button" class="ub-all" data-ub="guides">${EN()?`All ${DB.E.length} guide editions & release dates`:`全部 ${DB.E.length} 本指南的版本与发布日期`} →</button>`;
  }
  // Next edition of a guide: released but not yet in the data > announced date > estimate from last year's release month.
  function nextOf(g,today){
    const p=(g[6]||[]).filter(x=>x[1]).slice(-1)[0];
    if(p)return {kind:'out',year:p[0],date:p[1],src:p[2],key:'0'+p[1]};
    const s=g[7];
    if(s)return {kind:s[3]===false?'about':'set',year:s[0],date:s[1],src:s[2],key:'1'+s[1]};
    if(!g[4])return {kind:'none',key:'9'};
    const [y,m]=g[4].split('-'),est=`${+y+1}-${m}`;
    return est<today.slice(0,7)?{kind:'late',year:(g[3]||+y)+1,month:+m,key:'3'+est}:{kind:'est',year:(g[3]||+y)+1,date:est,key:'2'+est};
  }
  function nextHTML(n){
    const lnk=(t,src)=>src?`<a href="${h(src)}" target="_blank" rel="noopener">${t}</a>`:t;
    const ed=y=>EN()?`${y}\u00a0edition`:`${y}\u00a0版`;
    const row=(cls,main,y,note)=>`<b class="gt-n ${cls}">${main}</b><small>${y?ed(y)+' · ':''}${note}</small>`;
    if(n.kind==='out')return row('out',lnk(h(dot(n.date)),n.src),n.year,EN()?'released, syncing':'已发布 · 待同步');
    if(n.kind==='set')return row('set',lnk(h(dot(n.date)),n.src),n.year,EN()?'announced':'官方已公布');
    if(n.kind==='about')return row('about',lnk((EN()?'c. ':'约 ')+h(dot(n.date)),n.src),n.year,EN()?'not fixed yet':'暂未定档');
    if(n.kind==='est')return row('est',`${EN()?'est.':'预计'} ${h(dot(n.date))}`,n.year,EN()?'from last year':'按往年推算');
    if(n.kind==='late')return row('est',EN()?'TBA':'待公布',n.year,EN()?`usually ${MON[n.month-1]}`:`往年 ${n.month} 月`);
    return row('est',EN()?'TBA':'待公布',0,'');
  }
  let GSORT='next';
  function guidesDialog(){
    let dlg=document.getElementById('guidesDlg');
    if(!dlg){document.body.insertAdjacentHTML('beforeend','<dialog id="guidesDlg" class="guides-dlg" aria-labelledby="guidesTitle"><div class="dlg"><button type="button" class="close" data-close>关闭</button><h2 id="guidesTitle"></h2><p class="note" id="guidesNote"></p><div class="gt-sort" id="guidesSort" role="group"></div><div id="guidesBody"></div></div></dialog>');dlg=document.getElementById('guidesDlg');
      dlg.addEventListener('click',e=>{if(e.target===dlg||e.target.closest('[data-close]'))closeAppDialog(dlg);const b=e.target.closest('[data-gsort]');if(b){GSORT=b.dataset.gsort;fillGuides();}});}
    fillGuides();showAppDialog(dlg);
  }
  function fillGuides(){
    const count=new Map();DB.rows.forEach(r=>{const c=DB.T[r.ci];if(c&&c.length>3)count.set(c[3],(count.get(c[3])||0)+1);});
    const today=new Date().toISOString().slice(0,10);
    const rows=(DB.E||[]).map((g,i)=>({g,i,n:count.get(i)||0,nx:nextOf(g,today)}));
    if(GSORT==='next')rows.sort((a,b)=>a.nx.key.localeCompare(b.nx.key)||(b.g[4]||'').localeCompare(a.g[4]||''));
    else rows.sort((a,b)=>(b.g[4]||'').localeCompare(a.g[4]||''));
    document.getElementById('guidesTitle').textContent=EN()?'Guide editions':'各地指南版本';
    document.getElementById('guidesNote').textContent=EN()?'Current edition and official release date of every guide, plus the next edition. Announced dates come from MICHELIN (a few from press reports, marked “c.”); the rest are estimated from the previous year’s release month.':'每本指南的当前版本、实际发布日期和下一版。已公布的日期取自米其林官方公告（个别来自媒体报道或官方只给了大致时间，标“约”）；其余按往年发布月份推算，仅供参考。';
    document.getElementById('guidesSort').innerHTML=[['next',EN()?'Coming up':'即将发布'],['recent',EN()?'Latest released':'最近发布']].map(([k,t])=>`<button type="button" data-gsort="${k}" aria-pressed="${GSORT===k}">${t}</button>`).join('');
    document.getElementById('guidesBody').innerHTML=`<table class="guides-table"><thead><tr><th>${EN()?'Guide':'指南'}</th><th>${EN()?'Edition':'版本'}</th><th>${EN()?'Released':'发布日期'}</th><th>${EN()?'Next':'下一版'}</th><th>${EN()?'Restaurants':'餐厅'}</th></tr></thead><tbody>${rows.map(({g,n,nx})=>`<tr><td>${h(EN()?g[2]:g[1])}${g[3]?'':`<small class="gt-new">${EN()?'New destination':'新目的地 · 首版'}</small>`}<div class="gt-nl">${nextHTML(nx)}</div></td><td>${g[3]||'—'}</td><td>${g[4]?(g[5]?`<a href="${h(g[5])}" target="_blank" rel="noopener">${h(dot(g[4]))}</a>`:h(dot(g[4]))):'—'}</td><td class="gt-nc">${nextHTML(nx)}</td><td>${n}</td></tr>`).join('')}</tbody></table>`;
  }
  function start(){
    if(!DB||!DB.E)return;
    const intro=document.getElementById('intro');if(intro&&!document.getElementById('updateBanner')){
      intro.insertAdjacentHTML('beforeend','<section class="update-banner" id="updateBanner" hidden aria-label="本次更新"></section>');
}
    document.addEventListener('click',e=>{const b=e.target.closest('[data-ub]');if(!b)return;const a=b.dataset.ub;
      if(a==='close'){open=false;try{localStorage.setItem('mg-upd-seen',UPD.updates[0].data);}catch(err){}render();}
      if(a==='open'){open=true;try{localStorage.setItem('mg-upd-seen',UPD.updates[0].data);}catch(err){}render();document.getElementById('updateBanner')?.scrollIntoView({block:'nearest',behavior:'smooth'});}
      if(a==='guides')guidesDialog();});
    fetch('updates.json?v='+(typeof DATA_VER!=='undefined'?DATA_VER:'')).then(r=>r.ok?r.json():null).then(j=>{UPD=j;render();}).catch(()=>{});
  }
  return {start,render,detailHTML,guideOf,edition,guidesDialog};
})();

/* Travel, details, passport and snapshot views. Existing restaurant IDs remain unchanged. */
// Must equal ASSET_VER in index.html and sw.js; index.html reloads fresh files when they disagree.
const UPGRADE_VER="16";
let PERSONAL={version:2,trips:[],records:Object.create(null)},PRICE_DB={items:{}},upSelected='',upPickU='',upLoaded=false,upReadError=false;
function upSave(next){
  if(upReadError){toast('已有旅行存储无法读取，已阻止覆盖。请先导出原始备份再恢复。');return false;}
  try{localStorage.setItem('mg-personal',JSON.stringify(next));PERSONAL=next;return true;}
  catch(e){toast('保存失败，请先导出备份并检查浏览器存储空间');return false;}
}
function upImportBackup(d){
  if(!d||d.app!=='michelin-guide'||![1,2].includes(d.version)||!Array.isArray(d.items))throw new Error('不是支持的清单备份');
  if(upReadError)throw new Error('请先导出并恢复原始旅行存储');
  const nextFav=Object.assign(Object.create(null),FAV);let n=0;
  for(const x of d.items){
    if(!x||typeof x.u!=='string'||(!Object.hasOwn(DB.byU,x.u)&&!/^\S{1,500}\/restaurant\/\S{1,500}$/.test(x.u))||!['want','been'].includes(x.state))continue;
    const state=x.state==='been'?2:1;
    if(!nextFav[x.u]||nextFav[x.u][0]!==2||state===2){nextFav[x.u]=[state,Number.isFinite(x.at)?x.at:Date.now()];n++;}
  }
  const nextPersonal=d.personal?MG.mergePersonal(PERSONAL,MG.personal(d.personal,DB.byU)):PERSONAL;
  const oldFav=localStorage.getItem('mg-fav'),oldPersonal=localStorage.getItem('mg-personal');
  try{localStorage.setItem('mg-fav',JSON.stringify(nextFav));localStorage.setItem('mg-personal',JSON.stringify(nextPersonal));}
  catch(e){try{oldFav===null?localStorage.removeItem('mg-fav'):localStorage.setItem('mg-fav',oldFav);oldPersonal===null?localStorage.removeItem('mg-personal'):localStorage.setItem('mg-personal',oldPersonal);}catch(rollbackError){}throw new Error('浏览器未能保存，请检查存储空间');}
  FAV=nextFav;PERSONAL=nextPersonal;return n;
}
function upTrip(id){return PERSONAL.trips.find(t=>t.id===id);}
function upRows(id){return (upTrip(id)?.items||[]).map(u=>DB.byU[u]).filter(Boolean).sort((a,b)=>DB.crank[a.co]-DB.crank[b.co]||a.ci-b.ci||a.l-b.l||a.s.localeCompare(b.s,'zh'));}
function upTripCities(id){const cities=new Map();upRows(id).forEach(r=>cities.set(r.ci,(cities.get(r.ci)||0)+1));return [...cities];}
function upUid(){return 'trip-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));}
function upDetailURL(u){const url=new URL(location.href);url.searchParams.set('restaurant',u);return url.href;}
function upNewTrip(name,u){
  if(!name.trim())return null;
  const t={id:upUid(),name:name.trim().slice(0,100),items:u?[u]:[],created:Date.now()};
  if(PERSONAL.trips.length>=300){toast('最多支持 300 个旅行清单');return null;}
  if(!upSave({...PERSONAL,trips:[...PERSONAL.trips,t]}))return null;
  return t;
}
// Passport presentation state is intentionally separate from saved travel data.
const PASSPORT={open:false,tab:'identity',sheet:0};
const passportEmblem=`<svg viewBox="0 0 120 120" fill="none" aria-hidden="true"><circle cx="60" cy="60" r="43"/><ellipse cx="60" cy="60" rx="22" ry="43"/><path d="M17 60h86M24 37h72M24 83h72M60 17v86"/><circle cx="60" cy="60" r="51" stroke-dasharray="1 5"/><path d="m60 45 4 10 11 1-8 7 2 11-9-6-9 6 2-11-8-7 11-1z" fill="currentColor" stroke="none"/></svg>`;
function upPassport(visit){
  const groups=new Map();
  visit.slice().sort((a,b)=>(FAV[b.u]?.[1]||0)-(FAV[a.u]?.[1]||0)).forEach(r=>{if(!groups.has(r.co))groups.set(r.co,[]);groups.get(r.co).push(r);});
  const countries=[...groups],cities=new Set(visit.map(r=>r.ci)),want=Object.values(FAV).filter(f=>f[0]===1).length;
  const pages=Math.max(1,Math.ceil(countries.length/4));PASSPORT.sheet=Math.min(PASSPORT.sheet,pages-1);
  const lv=LVN.map((name,l)=>({name,n:visit.filter(r=>r.l===l).length})).filter(x=>x.n);
  const stats=`<div class="pp-tallies"><span><b>${String(countries.length).padStart(2,'0')}</b>国家 / 地区</span><span><b>${String(cities.size).padStart(2,'0')}</b>到访城市</span><span><b>${String(visit.length).padStart(2,'0')}</b>去过的餐厅</span></div>`;
  const stamps=countries.slice(PASSPORT.sheet*4,PASSPORT.sheet*4+4).map(([co,rows],i)=>{
    const names=[...new Set(rows.map(r=>DB.T[r.ci][0]))],dates=rows.map(r=>PERSONAL.records[r.u]?.date).filter(Boolean).sort();
    const time=dates.length?dates[dates.length-1].replaceAll('-','.'):'味觉足迹 · 已记录';
    return `<div class="pp-stamp pp-ink-${(co%3)} pp-shape-${i%2}" style="--tilt:${[-5,4,3,-4][i]}deg" role="img" aria-label="${esc(DB.C[co][0])}：已到访 ${rows.length} 家餐厅"><span class="pp-stamp-top">TASTE EXPLORER · 已到访</span><strong>${esc(DB.C[co][0])}</strong><span class="pp-stamp-en">${esc(DB.C[co][1])}</span><span class="pp-stamp-count">${rows.length} 家餐厅 · ${names.length} 座城市</span><span class="pp-stamp-date">${esc(time)}</span></div>`;
  }).join('');
  const empty=`<div class="pp-blank-stamp"><span>YOUR FIRST STAMP</span><b>下一站，吃点什么？</b><p>在餐厅下点“去过”，<br>为护照盖下第一枚签章。</p><button type="button" data-passport-browse>去发现餐厅 ↗</button></div>`;
  const cover=`<button type="button" class="pp-cover" data-passport-open aria-label="翻开我的美食护照" aria-expanded="false"><span class="pp-cover-border"></span><span class="pp-cover-publisher">米其林全球名录<br><small>PERSONAL COLLECTION</small></span><span class="pp-cover-emblem">${passportEmblem}</span><span class="pp-cover-name">美食护照</span><span class="pp-cover-en">FOOD PASSPORT</span><span class="pp-cover-motto">A WORLD OF TASTE</span><span class="pp-cover-bottom"><svg viewBox="0 0 36 24" aria-hidden="true"><rect x="1" y="1" width="34" height="22" rx="2"/><circle cx="18" cy="12" r="6"/><path d="M1 12h11m12 0h11"/></svg>私人珍藏 · 每一餐都值得记住</span></button>`;
  const identity=`<section class="pp-page pp-identity" aria-label="护照资料页"><div class="pp-page-header"><span>FOOD PASSPORT / 资料页</span><span>01</span></div><div class="pp-identity-head"><div class="pp-portrait">${passportEmblem}</div><div><span class="pp-field-label">持有人 / HOLDER</span><h4>美食旅行者</h4><span class="pp-holder-en">THE FOOD EXPLORER</span><span class="pp-field-label pp-type">护照类型 / PERSONAL</span></div></div><p class="pp-intro">以一餐为起点，<br>收集与世界相遇的证据。</p>${stats}<div class="pp-document-row"><span>已收藏目的地 / WISHLIST</span><b>${want} 家想去</b></div><div class="pp-ratings">${lv.length?lv.map(x=>`<span>${x.name} <b>${x.n}</b></span>`).join(''):'尚未留下到访记录'}</div><p class="pp-dataset-note">星级以现有名单为准。</p><div class="pp-signature"><span>签名 / SIGNATURE</span><b>Bon appétit.</b></div><div class="pp-machine" aria-hidden="true">P&lt;FOOD&lt;EXPLORER&lt;&lt;A&lt;WORLD&lt;OF&lt;TASTE<br>JOURNEYS&lt;&lt;${String(countries.length).padStart(3,'0')}&lt;CITIES&lt;&lt;${String(cities.size).padStart(3,'0')}&lt;&lt;${String(visit.length).padStart(4,'0')}</div></section>`;
  const visas=`<section class="pp-page pp-visas" aria-label="护照签章页"><div class="pp-page-header"><span>VISAS / 味觉签章</span><span>${String(PASSPORT.sheet+2).padStart(2,'0')}</span></div><h4>世界的味道，逐页收藏。</h4><p class="pp-visa-sub">每到访一个国家或地区，留下属于你的印记。</p><div class="pp-stamp-grid">${stamps||empty}</div><p class="pp-stamp-hint">${visit.length?'每一枚签章，都记录一次与世界的相遇。':'真正的旅程，从你喜欢的那一家开始。'}</p><div class="pp-page-nav"><button type="button" data-passport-prev ${PASSPORT.sheet===0?'disabled':''} aria-label="上一页签章">←</button><span>签章 ${PASSPORT.sheet+1} / ${pages}</span><button type="button" data-passport-next ${PASSPORT.sheet===pages-1?'disabled':''} aria-label="下一页签章">→</button></div></section>`;
  $('passportContent').innerHTML=`<div class="pp ${PASSPORT.open?'is-open':''}" data-pp-tab="${PASSPORT.tab}"><div class="pp-heading"><div><span class="pp-kicker">THE TASTE OF EVERY JOURNEY</span><h3>我的美食护照</h3></div><button type="button" class="passport-share-trigger" data-passport-share>生成分享卡 ↗</button></div>${PASSPORT.open?`<div class="pp-toolbar"><div role="group" aria-label="护照页面"><button type="button" data-passport-tab="identity" aria-pressed="${PASSPORT.tab==='identity'}">资料页</button><button type="button" data-passport-tab="stamps" aria-pressed="${PASSPORT.tab==='stamps'}">签章页 <span>${countries.length}</span></button></div><button type="button" data-passport-close>合上护照 ↗</button></div><div class="pp-book">${identity}${visas}</div><div class="pp-footer"><span>${visit.length?`已到访 ${visit.length} 家餐厅 · ${countries.length} 个国家和地区`:'这本护照，等待你的第一枚签章。'}</span></div>`:`<div class="pp-cover-stage">${cover}<div class="pp-cover-caption"><span>世界很大，值得一口一口去认识。</span><span>轻触封面，翻开你的味觉旅程 →</span></div></div><div class="pp-cover-summary">${stats}</div>`}</div>`;
}

function upRender(){
  if(!DB||!upLoaded)return;
  const visit=DB.rows.filter(r=>favOf(r.u)===2);
  upPassport(visit);
  $('tripCards').innerHTML=PERSONAL.trips.length?PERSONAL.trips.map(t=>{
    const rs=upRows(t.id),city=new Set(rs.map(r=>r.ci)),been=rs.filter(r=>favOf(r.u)===2).length;
    return `<article class="trip-card"><h4>${esc(t.name)}</h4><p>${rs.length} 家餐厅 · ${city.size} 座城市 · 已去 ${been} 家${t.items.length>rs.length?' · '+(t.items.length-rs.length)+' 家不在现有名单中':''}</p><div class="trip-actions"><button class="linkbtn" data-trip-open="${t.id}">查看清单</button><button class="linkbtn" data-trip-map="${t.id}">查看地图 ↗</button><button class="linkbtn" data-share-trip="${t.id}">分享记录</button></div><div class="trip-city-chips">${upTripCities(t.id).map(([ci,n])=>`<button type="button" class="trip-city-link" data-trip-city-map="${t.id}" data-city="${ci}" aria-label="在旅行地图查看${esc(DB.T[ci][0])}的 ${n} 家餐厅">${esc(DB.T[ci][0])} · ${n}</button>`).join('')}</div></article>`;
  }).join(''):'<p class="note">创建一份旅行清单，然后在餐厅下方点“加入旅行”。一间餐厅可以放进多份清单。</p>';
  $('tripIntro').hidden=PERSONAL.trips.length>0;
  const sel=$('tripFilter'),value=S.trip||'';
  sel.innerHTML='<option value="">全部餐厅 / 不限旅行</option>'+PERSONAL.trips.map(t=>`<option value="${t.id}">${esc(t.name)}（${t.items.length}）</option>`).join('');sel.value=value;
  const active=upTrip(S.trip),label=active?'旅行：'+active.name:S.change?'星级变化：'+upChangeName(S.change):'';
  $('travelControls').hidden=S.v!=='map'&&!active;
  $('tripCityField').hidden=!active;
  const cityFilter=$('tripCityFilter');cityFilter.hidden=!active;$('tripCityLabel').hidden=!active;
  cityFilter.innerHTML='<option value="">全部旅行城市</option>'+(active?upTripCities(active.id).map(([ci,n])=>`<option value="${ci}">${esc(DB.T[ci][0])} · ${esc(DB.C[DB.T[ci][1]][0])}（${n}）</option>`).join(''):'');cityFilter.value=S.ci;
  $('travelMapTitle').hidden=S.v!=='map';
  $('journeyBanner').hidden=!label;$('journeyLabel').textContent=label;
  if(S.v==='map'&&active&&!upRows(active.id).some(r=>r.lat!=null))$('journeyLabel').textContent=label+' · 暂无可定位的餐厅，可先从名录添加';

  if(S.change)$('annualCard').open=true;
  const counts={three:0,two:0,one:0,streak:0};DB.rows.forEach(r=>Object.keys(counts).forEach(k=>{if(upChangeMatch(r,k))counts[k]++;}));
  $('annualChoices').innerHTML=Object.keys(counts).map(k=>`<button class="chip" data-change="${k}" aria-pressed="${S.change===k}">${upChangeName(k)} <b>${counts[k]}</b></button>`).join('');
}
function upChangeName(k){return {three:'新增三星',two:'新增二星',one:'新增一星',streak:'连续五年三星'}[k]||'';}
function upChangeMatch(r,k){
  const prev=r.h.length===4?r.h[3]:'?';
  if(k==='streak')return r.l===0&&r.h==='0000';
  const level={three:0,two:1,one:2}[k];
  return r.l===level&&'01234-'.includes(prev)&&(prev==='-'||+prev>level);
}
function upApplyTrip(id,city=''){
  if(id&&!upTrip(id))return;
  const ci=city!==''&&upRows(id).some(r=>r.ci===+city)?String(city):'';
  Object.assign(S,{trip:id,change:'',l:'all',c:'',co:ci!==''?String(DB.T[ci][1]):'',ci,q:'',cu:'',p:'',budget:0,near:false});S.f.clear();
}
function upScopeTrip(id,city=''){
  if(!upTrip(id))return;upApplyTrip(id,city);
  if($('tripDlg').open)closeAppDialog($('tripDlg'));goTab('map');
}
function upOpenTrip(id){
  const t=id?upTrip(id):null;upSelected=id||'';
  $('tripTitle').textContent=t?t.name:'创建旅行清单';$('tripName').value=t?.name||'';
  $('tripDelete').hidden=!t;$('tripMap').hidden=!t;
  const rs=t?upRows(id):[];$('tripItems').innerHTML=rs.length?grouped(rs,rs.length):'<p class="empty">还没有餐厅。在名录中找到感兴趣的餐厅，点“加入旅行”。</p>';
  showAppDialog($('tripDlg'));
}
function upPickTrip(u){
  if(!DB.byU[u])return;upPickU=u;$('tripPickTitle').textContent='加入旅行 · '+(DB.byU[u].zh||DB.byU[u].n);
  $('tripPickChoices').innerHTML=PERSONAL.trips.map(t=>`<label class="check-row"><input type="checkbox" value="${t.id}" ${t.items.includes(u)?'checked':''}>${esc(t.name)}</label>`).join('')||'<p>还没有旅行清单，可以在下方创建。</p>';
  $('tripQuickName').value='';showAppDialog($('tripPickDlg'));
}
function upPrice(r){
  const entry=PRICE_DB.items[r.u],items=Array.isArray(entry)?entry:[];
  if(!items.length)return '<p>暂无已核实的人均或套餐价格。</p><p class="note">米其林的 $ 符号仅表示当地价位，不能换算为具体金额。请到官网查看最新菜单及预约条件。</p>';
  return items.map(p=>`<p><b>${esc(p.meal)} · ${esc(p.currency)} ${p.min}${p.max!==p.min?'–'+p.max:''}</b></p><p>${esc(p.basis)} · ${esc(p.includes)}</p><p class="note">价格会变动，预订前请复核。核实于 ${esc(p.checked)} · <a href="${esc(p.source)}" target="_blank" rel="noopener">价格来源</a></p>`).join('');
}
function upHistory(r){
  const entries=[...r.h.padEnd(4,'?').slice(0,4),String(r.l)].map((code,i)=>({year:2022+i,code})).filter(x=>/^[0-4]$/.test(x.code));
  if(entries.length<2)return '';
  return `<details class="detail-history"><summary>历年评级<span>${entries[0].year}—${entries[entries.length-1].year}</span></summary><div class="timeline">${entries.map(x=>`<span>${x.year}<b>${LVN[+x.code]}</b></span>`).join('')}</div><p class="note">依据历年保存的名单整理。</p></details>`;
}
const ratingStarPath='M12 2.5 14.9 8.4 21.4 9.4 16.7 14 17.8 20.5 12 17.4 6.2 20.5 7.3 14 2.6 9.4 9.1 8.4Z';
function upRatingHTML(value,p=''){
  return `<div class="rating-field"><span>我的评分</span><input type="hidden" id="${p}visitRating" data-rating-input value="${value||0}"><div id="${p}starRating" class="star-rating" role="slider" tabindex="0" aria-label="我的评分，支持半星" aria-valuemin="0" aria-valuemax="5" aria-valuenow="${value||0}" aria-valuetext="${value?value+' 星':'未评分'}">${[1,2,3,4,5].map(n=>`<button type="button" data-rating-star="${n}" tabindex="-1" aria-hidden="true"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="rating-outline" d="${ratingStarPath}"/><path class="rating-fill" style="clip-path:inset(0 ${100-Math.max(0,Math.min(1,(value||0)-n+1))*100}% 0 0)" d="${ratingStarPath}"/></svg></button>`).join('')}</div><div class="rating-caption"><output id="${p}ratingValue" data-rating-output>${value?value+' 星':'轻点打分，支持半星（可不打）'}</output><button type="button" id="${p}clearRating" data-clear-rating>清除评分</button></div></div>`;
}
function upSetRating(value,root){
  root=root||$('detailDlg');const input=root.querySelector('[data-rating-input]'),stars=root.querySelector('.star-rating');if(!input||!stars)return;
  value=Math.max(0,Math.min(5,Math.round(value*2)/2));input.value=value;
  stars.setAttribute('aria-valuenow',value);stars.setAttribute('aria-valuetext',value?value+' 星':'未评分');
  root.querySelector('[data-rating-output]').textContent=value?value+' 星':'轻点打分，支持半星（可不打）';
  stars.querySelectorAll('[data-rating-star]').forEach(b=>{b.querySelector('.rating-fill').style.clipPath=`inset(0 ${100-Math.max(0,Math.min(1,value-(+b.dataset.ratingStar)+1))*100}% 0 0)`;});
  if(value>0&&root.matches('.visit-form')&&root.dataset.been==='false')upSetVisitState(root,true);
  upVisitDirty(root);
}
// "去过" and the personal rating are one record: saving the form marks the restaurant as visited.
function upToday(){return fmtDate(Date.now());}
function upVisitDate(u){return PERSONAL.records[u]?.date||'';}
function upVisitLabel(u){if(favOf(u)!==2)return '去过';const r=PERSONAL.records[u]?.rating;return r?`去过 ★${r}`:'去过 ✓';}
function upVisitHTML(u,p=''){
  const rec=PERSONAL.records[u]||{},been=favOf(u)===2,draftBeen=been||!Object.hasOwn(PERSONAL.records,u);
  return `<form id="${p}visitForm" class="upgrade-form visit-form" data-u="${esc(u)}" data-been="${draftBeen}"><p class="visit-status ${been?'is-been':''}">${been?'✓ 已去过'+(rec.date?' · '+esc(rec.date):''):draftBeen?'保存后标记为去过':'尚未标记去过'}</p>${upRatingHTML(rec.rating||0,p)}<label class="visit-date-label">实际用餐日期 · 可选<span class="visit-date-row"><input id="${p}visitDate" type="date" value="${esc(rec.date||'')}" aria-label="实际用餐日期"><button type="button" class="linkbtn" data-today>今天</button></span></label><label>笔记<textarea id="${p}visitNote" maxlength="3000" placeholder="点了什么、味道怎样、下次想试什么">${esc(rec.note||'')}</textarea></label><p class="visit-feedback" role="status" aria-live="polite">修改后，点保存记录生效</p><div class="visit-actions"><button type="button" class="linkbtn" data-unvisit ${draftBeen?'':'hidden'}>取消去过</button><button type="button" class="linkbtn" data-markvisit ${draftBeen?'hidden':''}>标记去过</button><button class="btn primary" type="submit">保存记录</button></div></form>`;
}
function upVisitDirty(form){if(form?.querySelector('.visit-feedback'))form.querySelector('.visit-feedback').textContent='有修改尚未保存';}
function upSetVisitState(form,been){
  form.dataset.been=String(been);form.querySelector('[data-unvisit]').hidden=!been;form.querySelector('[data-markvisit]').hidden=been;
  form.querySelector('.visit-status').textContent=been?'保存后标记为去过':'保存后取消去过与评分';
  form.querySelector('.visit-status').classList.toggle('is-been',been);
  if(!been){upSetRating(0,form);form.querySelector('input[type=date]').value='';}upVisitDirty(form);
}
function upVisitValues(form){
  return {date:/^\d{4}-\d{2}-\d{2}$/.test(form.querySelector('input[type=date]').value)?form.querySelector('input[type=date]').value:'',
    rating:+form.querySelector('[data-rating-input]').value||0,note:form.querySelector('textarea').value.trim().slice(0,3000)};
}
function upSaveVisit(u,values,markBeen){
  if(upReadError){toast('旅行记录暂时无法读取，请先备份');return false;}
  const nextPersonal={...PERSONAL,records:Object.assign(Object.create(null),PERSONAL.records,{[u]:values})},nextFav=Object.assign(Object.create(null),FAV);
  if(markBeen){if(nextFav[u]?.[0]!==2)nextFav[u]=[2,Date.now()];}else if(nextFav[u]?.[0]===2)delete nextFav[u];
  let oldPersonal,oldFav;
  try{
    oldPersonal=localStorage.getItem('mg-personal');oldFav=localStorage.getItem('mg-fav');
    localStorage.setItem('mg-personal',JSON.stringify(nextPersonal));localStorage.setItem('mg-fav',JSON.stringify(nextFav));
  }catch(e){try{if(oldPersonal!==undefined)oldPersonal===null?localStorage.removeItem('mg-personal'):localStorage.setItem('mg-personal',oldPersonal);if(oldFav!==undefined)oldFav===null?localStorage.removeItem('mg-fav'):localStorage.setItem('mg-fav',oldFav);}catch(rollback){}toast('保存失败，更改未生效，请检查存储空间');return false;}
  PERSONAL=nextPersonal;FAV=nextFav;return true;
}
function upRefreshVisit(u){
  // keep every visible "去过" button, the detail sheet and the 我的 page in step
  document.querySelectorAll(`.fav[data-u="${CSS.escape(u)}"]`).forEach(x=>{x.setAttribute('aria-pressed',favOf(u)===+x.dataset.v);if(x.dataset.v==='2')x.textContent=upVisitLabel(u);});
  if($('detailDlg').open&&$('detailDlg').dataset.u===u){const old=$('detailBody').querySelector('#visitForm');if(old)old.outerHTML=upVisitHTML(u);}
  updateBadge();if(S.v==='me')renderMe();else upRender();
}
function upOpenVisit(u){
  const r=DB.byU[u];if(!r)return;
  $('visitTitle').textContent=r.zh||r.n;$('visitMeta').textContent=[LVN[r.l],DB.T[r.ci][0],DB.C[r.co][0]].join(' · ');
  $('visitBody').innerHTML=upVisitHTML(u,'q');$('visitDlg').dataset.u=u;showAppDialog($('visitDlg'));
}
function upBindDetailSwipe(id='detailDlg'){
  const dialog=$(id);let gesture=null;
  const restore=()=>{dialog.classList.remove('is-dragging');dialog.style.removeProperty('--drag-y');};
  dialog.addEventListener('touchstart',e=>{
    restore();gesture=null;if(e.touches.length!==1)return;
    const handle=!!e.target.closest('.detail-sheet-head');
    if(e.target.closest('input,textarea,select,button,a,summary,[role="slider"]')&&!e.target.closest('.detail-drag'))return;
    gesture={x:e.touches[0].clientX,y:e.touches[0].clientY,dy:0,scroll:handle?0:dialog.scrollTop,handle,at:performance.now()};
  },{passive:true});
  dialog.addEventListener('touchmove',e=>{
    if(!gesture||e.touches.length!==1)return;
    const dy=e.touches[0].clientY-gesture.y,dx=e.touches[0].clientX-gesture.x;
    if(dy<0||Math.abs(dx)>Math.abs(dy)*1.25){gesture=null;restore();return;}
    gesture.dy=Math.max(0,dy-gesture.scroll);
    if(gesture.dy>6&&(gesture.handle||dialog.scrollTop<=1)){
      if(e.cancelable)e.preventDefault();dialog.classList.add('is-dragging');dialog.style.setProperty('--drag-y',Math.min(160,gesture.dy*.85)+'px');
    }
  },{passive:false});
  dialog.addEventListener('touchend',()=>{const close=gesture&&(gesture.dy>=(gesture.handle?32:48)||(gesture.dy>=24&&gesture.dy/Math.max(1,performance.now()-gesture.at)>.55));gesture=null;restore();if(close)closeAppDialog(dialog);});
  dialog.addEventListener('touchcancel',()=>{gesture=null;restore();});dialog.addEventListener('close',()=>{gesture=null;restore();});
}
function upBindVisitForms(){
  document.addEventListener('click',e=>{
    const form=e.target.closest('.visit-form');if(!form)return;
    const star=e.target.closest('[data-rating-star]');
    if(star){const rect=star.getBoundingClientRect(),value=+star.dataset.ratingStar-(e.clientX<rect.x+rect.width/2?.5:0);upSetRating(value,form);form.querySelector('.star-rating').focus({preventScroll:true});}
    if(e.target.closest('[data-clear-rating]'))upSetRating(0,form);
    const u=form.dataset.u;
    if(e.target.closest('[data-unvisit]'))upSetVisitState(form,false);
    if(e.target.closest('[data-markvisit]'))upSetVisitState(form,true);
    if(e.target.closest('[data-today]')){form.querySelector('input[type=date]').value=upToday();upVisitDirty(form);}
  });
  document.addEventListener('input',e=>{const form=e.target.closest('.visit-form');if(form)upVisitDirty(form);});
  document.addEventListener('keydown',e=>{
    const stars=e.target.closest?.('.visit-form .star-rating');if(!stars)return;
    const form=stars.closest('.visit-form'),current=+form.querySelector('[data-rating-input]').value;
    const values={ArrowRight:current+.5,ArrowUp:current+.5,ArrowLeft:current-.5,ArrowDown:current-.5,Home:0,End:5};
    if(Object.hasOwn(values,e.key)){e.preventDefault();upSetRating(values[e.key],form);}
  });
  document.addEventListener('submit',e=>{
    const form=e.target.closest('.visit-form');if(!form)return;e.preventDefault();
    const u=form.dataset.u,v=upVisitValues(form),been=form.dataset.been==='true',dialog=form.closest('dialog');
    if(!been){v.rating=0;v.date='';}
    if(!upSaveVisit(u,v,been))return;
    if(dialog?.open)closeAppDialog(dialog);upRefreshVisit(u);toast(been?'✓ 用餐记录已保存':'✓ 已保存，已取消去过与评分');
  });
}

function upOpenDetail(u,push=true){
  const r=DB.byU[u];if(!r){toast('这家餐厅不在现有名单中，请核对链接');return;}
  if(push){const url=upDetailURL(u);if(url!==location.href)history.pushState(null,'',url);}
  $('detailDlg').dataset.u=u;const m=mapLink(r);
  $('detailBody').innerHTML=`<h2 class="detail-title" id="detailTitle" tabindex="-1">${esc(r.zh||r.n)}</h2>${r.zh?`<p class="detail-origin">${esc(r.n)}${r.kind===2?' · 参考译名，非官方中文名':''}</p>`:''}<p>${esc(DB.C[r.co][0])} · ${esc(DB.T[r.ci][0])}</p>${badge(r)} ${tagsHTML(r)}<dl class="detail-facts">${r.cu?`<dt>菜系</dt><dd>${esc(r.cu)}</dd>`:''}${r.a?`<dt>地址</dt><dd>${esc(r.a)}</dd>`:''}${r.p?`<dt>价位</dt><dd>${'$'.repeat(r.p)} · 当地价位</dd>`:''}</dl><div class="detail-actions"><a href="https://guide.michelin.com/en/${esc(r.u)}" target="_blank" rel="noopener">米其林页面</a><a href="${esc(m.href)}" target="_blank" rel="noopener">导航</a>${r.w?`<a href="${esc(r.w)}" target="_blank" rel="noopener">官网 / 查询预约</a>`:''}<button class="linkbtn" id="copyRestaurant">复制餐厅链接</button></div><div class="links"><button class="fav" data-u="${esc(u)}" data-v="1" aria-pressed="${favOf(u)===1}">想去</button><button class="linkbtn" data-trip-pick="${esc(u)}">加入旅行</button></div><details class="detail-prices" ${(PRICE_DB.items[r.u]||[]).length?'':'hidden'}><summary>参考消费</summary><div class="price-note">${upPrice(r)}</div></details>${upHistory(r)}<details class="detail-record"><summary id="visitHeading">${favOf(u)===2?'修改用餐记录 · '+esc(upVisitLabel(u)):'记录一次用餐'}<span>评分 · 日期 · 笔记</span></summary>${upVisitHTML(u)}</details><p class="note">只保存在本设备，可在“我的”里导出备份。</p>`;
  document.title=(r.zh||r.n)+' · 米其林全球名录';if(!$('detailDlg').open)showAppDialog($('detailDlg'));$('detailDlg').scrollTop=0;$('detailTitle').focus({preventScroll:true});
}
function upRestoreDetail(){
  if(!DB)return;const u=new URL(location.href).searchParams.get('restaurant');
  if(u)upOpenDetail(u,false);else if($('detailDlg').open)closeAppDialog($('detailDlg'));
}
function upInit(){
  document.body.insertAdjacentHTML('beforeend',`<dialog id="detailDlg" aria-labelledby="detailTitle"><div class="dlg"><div class="detail-sheet-head"><button type="button" class="detail-drag" tabindex="-1" data-close aria-label="下滑或点击关闭餐厅详情"><span></span></button><button type="button" class="close" data-close>关闭</button></div><div id="detailBody"></div></div></dialog><dialog id="visitDlg" class="visit-sheet" aria-labelledby="visitTitle"><div class="dlg"><div class="detail-sheet-head"><button type="button" class="detail-drag" tabindex="-1" data-close aria-label="下滑或点击关闭用餐记录"><span></span></button><button type="button" class="close" data-close>关闭</button></div><p class="visit-kicker">去过 · 我的评分</p><h2 id="visitTitle"></h2><p class="detail-origin" id="visitMeta"></p><div id="visitBody"></div></div></dialog><dialog id="tripDlg" aria-labelledby="tripTitle"><div class="dlg"><button type="button" class="close" data-close>关闭</button><h2 id="tripTitle"></h2><form id="tripForm" class="upgrade-form"><label>旅行名称<input id="tripName" maxlength="100" required placeholder="例如：2026 欧洲旅行"></label><button class="btn primary" type="submit">保存名称</button></form><div class="row"><button class="btn" id="tripMap">在地图上查看</button><button class="btn danger" id="tripDelete">删除旅行清单</button></div><div id="tripItems" class="trip-content"></div></div></dialog><dialog id="tripPickDlg" aria-labelledby="tripPickTitle"><div class="dlg"><button type="button" class="close" data-close>关闭</button><h2 id="tripPickTitle"></h2><form id="tripPickForm" class="upgrade-form"><div id="tripPickChoices"></div><label>或创建新旅行<input id="tripQuickName" maxlength="100" placeholder="输入旅行名称"></label><button type="submit" class="btn primary">保存到所选旅行</button></form></div></dialog>`);
  $('meStats').insertAdjacentHTML('beforebegin',`<section class="passport-feature" aria-label="我的美食护照"><div id="passportContent"></div></section><section class="travel-section"><div class="section-heading"><h3>旅行美食地图</h3><button class="linkbtn" id="newTrip">＋ 新建旅行</button></div><p class="note" id="tripIntro">为下一段旅程，收藏想去的餐厅。</p><div id="tripCards"></div></section>`);
  $('browse').insertAdjacentHTML('afterbegin',`<h2 id="travelMapTitle" class="travel-map-title" hidden>旅行美食地图</h2><div class="journey-tools" id="travelControls" hidden><div class="travel-field"><label for="tripFilter">旅行</label><select id="tripFilter" aria-label="按旅行清单筛选"></select></div><div class="travel-field" id="tripCityField" hidden><label id="tripCityLabel" for="tripCityFilter">城市</label><select id="tripCityFilter" aria-label="按旅行城市筛选"></select></div><button type="button" class="linkbtn" id="newTripFromMap">＋ 新建旅行</button></div><div class="journey-banner" id="journeyBanner" hidden><span id="journeyLabel"></span><button class="linkbtn" id="exitJourney">清除</button></div><p class="search-note" id="searchNote" hidden>以下为拼写相近的结果。</p>`);
  $('more-f').insertAdjacentHTML('beforeend',`<details class="refine-fold" id="annualCard"><summary>星级变化<span>新增星级 · 历年记录</span></summary><div class="annual-chips" id="annualChoices"></div><details class="method-note"><summary>统计说明</summary><p>依据 2025 年 10 月与 ${esc(DB.updated)} 保存的名单对比，不等同于各地区官方年度发布名单。“连续五年三星”表示 2022—2026 年五份记录均为三星。</p></details></details>`);
  try{PERSONAL=MG.personal(JSON.parse(localStorage.getItem('mg-personal')||'{}'),DB.byU);}catch(e){upReadError=true;toast('旅行记录暂时无法读取，原始存储已保留，请先备份');}
  upLoaded=true;
  $('newTrip').onclick=()=>upOpenTrip('');
  $('tripFilter').onchange=e=>{upApplyTrip(e.target.value);reset();render();};
  $('tripCityFilter').onchange=e=>{upApplyTrip(S.trip,e.target.value);reset();render();};
  $('newTripFromMap').onclick=()=>upOpenTrip('');
  $('exitJourney').onclick=()=>{S.trip='';S.change='';reset();render();};
  $('tripForm').onsubmit=e=>{e.preventDefault();const name=$('tripName').value.trim();if(!name)return;
    if(upSelected){if(!upSave({...PERSONAL,trips:PERSONAL.trips.map(t=>t.id===upSelected?{...t,name}:t)}))return;}
    else {const t=upNewTrip(name);if(!t)return;if(S.v==='map')upApplyTrip(t.id);}closeAppDialog($('tripDlg'));render();toast('旅行清单已保存');};
  $('tripMap').onclick=()=>upScopeTrip(upSelected);
  $('tripDelete').onclick=()=>{const id=upSelected;if(!confirm('删除这份旅行清单？餐厅的“想去 / 去过”和用餐笔记会保留。'))return;
    if(!upSave({...PERSONAL,trips:PERSONAL.trips.filter(t=>t.id!==id)}))return;if(S.trip===id)S.trip='';closeAppDialog($('tripDlg'));render();};
  $('tripPickForm').onsubmit=e=>{e.preventDefault();const u=upPickU,selected=new Set([...$('tripPickChoices').querySelectorAll('input:checked')].map(x=>x.value)),name=$('tripQuickName').value.trim();
    const trips=PERSONAL.trips.map(t=>({...t,items:selected.has(t.id)?[...new Set([...t.items,u])]:t.items.filter(x=>x!==u)}));
    if(name){if(trips.length>=300){toast('最多支持 300 个旅行清单');return;}trips.push({id:upUid(),name:name.slice(0,100),items:[u],created:Date.now()});}
    if(!upSave({...PERSONAL,trips}))return;closeAppDialog($('tripPickDlg'));if($('tripDlg').open){const rs=upRows(upSelected);$('tripItems').innerHTML=grouped(rs,rs.length)||'<p class="empty">暂无餐厅，可在名录中添加。</p>';}render();toast('已更新旅行清单');};
  document.addEventListener('click',e=>{
    const control=e.target.closest('[data-passport-open],[data-passport-close],[data-passport-tab],[data-passport-prev],[data-passport-next],[data-passport-browse]');
    if(!control)return;
    const root=$('passportContent');
    if(control.hasAttribute('data-passport-browse')){goTab('list');return;}
    if(control.hasAttribute('data-passport-open')){PASSPORT.open=true;PASSPORT.tab='identity';}
    if(control.hasAttribute('data-passport-close'))PASSPORT.open=false;
    if(control.dataset.passportTab)PASSPORT.tab=control.dataset.passportTab;
    if(control.hasAttribute('data-passport-prev'))PASSPORT.sheet=Math.max(0,PASSPORT.sheet-1);
    if(control.hasAttribute('data-passport-next'))PASSPORT.sheet++;
    upPassport(DB.rows.filter(r=>favOf(r.u)===2));
    const focus=control.hasAttribute('data-passport-close')?root.querySelector('[data-passport-open]'):control.hasAttribute('data-passport-open')?root.querySelector('[data-passport-tab="identity"]'):control.dataset.passportTab?root.querySelector('[data-passport-tab="'+control.dataset.passportTab+'"]'):root.querySelector('[data-passport-'+(control.hasAttribute('data-passport-prev')?'prev':'next')+']');
    const focusTarget=focus&&!focus.disabled?focus:root.querySelector('[data-passport-prev]:not([disabled]),[data-passport-next]:not([disabled]),[data-passport-tab="stamps"]');
    focusTarget?.focus({preventScroll:true});
  });
  document.addEventListener('click',e=>{
    const el=e.target.closest('[data-trip-open],[data-trip-map],[data-trip-pick],[data-restaurant],[data-change],[data-trip-city-map],#copyRestaurant');if(!el)return;
    if(el.hasAttribute('data-restaurant')){if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();upOpenDetail(el.dataset.restaurant);}
    if(el.hasAttribute('data-trip-open'))upOpenTrip(el.dataset.tripOpen);
    if(el.hasAttribute('data-trip-map'))upScopeTrip(el.dataset.tripMap);
    if(el.hasAttribute('data-trip-city-map'))upScopeTrip(el.dataset.tripCityMap,el.dataset.city);
    if(el.hasAttribute('data-trip-pick'))upPickTrip(el.dataset.tripPick);
    if(el.hasAttribute('data-change')){S.change=S.change===el.dataset.change?'':el.dataset.change;S.trip='';reset();render();}
    if(el.id==='copyRestaurant')copyText(upDetailURL($('detailDlg').dataset.u)).then(()=>toast('已复制餐厅链接'),()=>toast('无法复制，请从地址栏复制链接'));
  });
  ['detailDlg','visitDlg','tripDlg','tripPickDlg'].forEach(id=>{const dlg=$(id);dlg.addEventListener('click',e=>{if(e.target===dlg||e.target.closest('[data-close]'))closeAppDialog(dlg);});});
  $('detailDlg').addEventListener('close',()=>{const url=new URL(location.href);url.searchParams.delete('restaurant');history.replaceState(null,'',url);document.title='米其林全球名录';});
  upBindDetailSwipe();upBindDetailSwipe('visitDlg');upBindVisitForms();upInitShare();
  window.addEventListener('popstate',upRestoreDetail);

  upRender();upRestoreDetail();
  fetch('prices.json').then(r=>{if(!r.ok)throw new Error('prices');return r.json();}).then(p=>{
    PRICE_DB={items:{}};for(const [u,items] of Object.entries(p.items||{}))if(DB.byU[u]&&Array.isArray(items))PRICE_DB.items[u]=items.filter(x=>x&&/^https:\/\//.test(x.source)&&/^\d{4}-\d{2}-\d{2}$/.test(x.checked)&&/^[A-Z]{3}$/.test(x.currency)&&Number.isFinite(x.min)&&Number.isFinite(x.max)&&x.min>=0&&x.max>=x.min&&['meal','basis','includes'].every(k=>typeof x[k]==='string'));

    if($('detailDlg').open){const r=DB.byU[$('detailDlg').dataset.u];$('detailBody').querySelector('.price-note').innerHTML=upPrice(r);$('detailBody').querySelector('.detail-prices').hidden=!(PRICE_DB.items[r.u]||[]).length;}

  }).catch(()=>{});
}

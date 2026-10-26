/* Travel, details, passport and snapshot views. Existing restaurant IDs remain unchanged. */
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
function upRows(id){return (upTrip(id)?.items||[]).map(u=>DB.byU[u]).filter(Boolean);}
function upUid(){return 'trip-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));}
function upDetailURL(u){const url=new URL(location.href);url.searchParams.set('restaurant',u);return url.href;}
function upNewTrip(name,u){
  if(!name.trim())return null;
  const t={id:upUid(),name:name.trim().slice(0,100),items:u?[u]:[],created:Date.now()};
  if(PERSONAL.trips.length>=300){toast('最多支持 300 个旅行清单');return null;}
  if(!upSave({...PERSONAL,trips:[...PERSONAL.trips,t]}))return null;
  return t;
}
function upRender(){
  if(!DB||!upLoaded)return;
  const visit=DB.rows.filter(r=>favOf(r.u)===2),countries=new Map();
  visit.forEach(r=>countries.set(r.co,(countries.get(r.co)||0)+1));
  $('passportContent').innerHTML=visit.length?`<p>已到访 <b>${visit.length}</b> 家餐厅，留下 <b>${new Set(visit.map(r=>r.ci)).size}</b> 座城市的味觉记忆。</p><div class="passport-places">${[...countries].map(([co,n])=>`<button class="chip" data-passport-country="${co}">${esc(DB.C[co][0])} · ${n}</button>`).join('')}</div><button class="btn" id="passportMap">查看我的足迹地图</button><p class="note">按当前快照的等级统计，不代表用餐当年的评级。用餐日期和笔记可在餐厅详情中补充。</p>`:'<p class="passport-empty">把吃过的餐厅标记为“去过”，你的美食护照就从这里开始。</p>';
  $('tripCards').innerHTML=PERSONAL.trips.length?PERSONAL.trips.map(t=>{
    const rs=upRows(t.id),city=new Set(rs.map(r=>r.ci)),been=rs.filter(r=>favOf(r.u)===2).length;
    return `<article class="trip-card"><h4>${esc(t.name)}</h4><p>${rs.length} 家餐厅 · ${city.size} 座城市 · 已去 ${been} 家${t.items.length>rs.length?' · '+(t.items.length-rs.length)+' 家不在当前快照中':''}</p><div class="row"><button class="btn" data-trip-open="${t.id}">查看清单</button><button class="btn" data-trip-map="${t.id}">旅行地图</button></div></article>`;
  }).join(''):'<p class="note">创建一份旅行清单，然后在餐厅下方点“加入旅行”。一间餐厅可以放进多份清单。</p>';
  const sel=$('tripFilter'),value=S.trip||'';
  sel.innerHTML='<option value="">全部餐厅 / 不限旅行</option>'+PERSONAL.trips.map(t=>`<option value="${t.id}">${esc(t.name)}（${t.items.length}）</option>`).join('');sel.value=value;
  if($('budgetMax')&&document.activeElement!==$('budgetMax'))$('budgetMax').value=S.budget||'';
  if($('budgetCurrency'))$('budgetCurrency').value=S.currency;
  const active=upTrip(S.trip),label=active?'旅行：'+active.name:S.passport?'我的足迹：只显示去过的餐厅':S.change?'快照变化：'+upChangeName(S.change):'';
  $('journeyBanner').hidden=!label;$('journeyLabel').textContent=label;
  if(S.v==='map'&&active&&!upRows(active.id).some(r=>r.lat!=null))$('journeyLabel').textContent=label+' · 暂无可定位的餐厅，可先从名录添加';
  $('annualCard').hidden=S.v==='me'||S.v==='map'||!!S.near;
  const counts={three:0,two:0,one:0,streak:0};DB.rows.forEach(r=>Object.keys(counts).forEach(k=>{if(upChangeMatch(r,k))counts[k]++;}));
  $('annualChoices').innerHTML=Object.keys(counts).map(k=>`<button class="chip" data-change="${k}" aria-pressed="${S.change===k}">${upChangeName(k)} <b>${counts[k]}</b></button>`).join('');
}
function upChangeName(k){return {three:'快照新增三星',two:'快照新增二星',one:'快照新增一星',streak:'连续快照三星'}[k]||'';}
function upChangeMatch(r,k){
  const prev=r.h.length===4?r.h[3]:'?';
  if(k==='streak')return r.l===0&&r.h==='0000';
  const level={three:0,two:1,one:2}[k];
  return r.l===level&&'01234-'.includes(prev)&&(prev==='-'||+prev>level);
}
function upScopeTrip(id){
  const t=upTrip(id);if(!t)return;
  Object.assign(S,{trip:id,passport:false,change:'',l:'all',c:'',co:'',ci:'',q:'',cu:'',p:'',budget:0,near:false});S.f.clear();
  if($('tripDlg').open)$('tripDlg').close();goTab('map');
}
function upOpenTrip(id){
  const t=id?upTrip(id):null;upSelected=id||'';
  $('tripTitle').textContent=t?t.name:'创建旅行清单';$('tripName').value=t?.name||'';
  $('tripDelete').hidden=!t;$('tripMap').hidden=!t;
  const rs=t?upRows(id):[];$('tripItems').innerHTML=rs.length?grouped(rs,rs.length):'<p class="empty">还没有餐厅。在名录中找到感兴趣的餐厅，点“加入旅行”。</p>';
  $('tripDlg').showModal();
}
function upPickTrip(u){
  if(!DB.byU[u])return;upPickU=u;$('tripPickTitle').textContent='加入旅行 · '+(DB.byU[u].zh||DB.byU[u].n);
  $('tripPickChoices').innerHTML=PERSONAL.trips.map(t=>`<label class="check-row"><input type="checkbox" value="${t.id}" ${t.items.includes(u)?'checked':''}>${esc(t.name)}</label>`).join('')||'<p>还没有旅行清单，可以在下方创建。</p>';
  $('tripQuickName').value='';$('tripPickDlg').showModal();
}
function upBudgetMatch(r){
  if(!S.budget)return true;
  return (PRICE_DB.items[r.u]||[]).some(p=>p.currency===S.currency&&p.max<=S.budget);
}
function upPrice(r){
  const entry=PRICE_DB.items[r.u],items=Array.isArray(entry)?entry:[];
  if(!items.length)return '<p>暂无已核实的人均或套餐价格。</p><p class="note">米其林的 $ 符号仅表示当地价位，不能换算为具体金额。请到官网查看最新菜单及预约条件。</p>';
  return items.map(p=>`<p><b>${esc(p.meal)} · ${esc(p.currency)} ${p.min}${p.max!==p.min?'–'+p.max:''}</b></p><p>${esc(p.basis)} · ${esc(p.includes)}</p><p class="note">价格会变动，预订前请复核。核实于 ${esc(p.checked)} · <a href="${esc(p.source)}" target="_blank" rel="noopener">价格来源</a></p>`).join('');
}
function upOpenDetail(u,push=true){
  const r=DB.byU[u];if(!r){toast('这家餐厅不在当前快照中，请核对链接');return;}
  if(push){const url=upDetailURL(u);if(url!==location.href)history.pushState(null,'',url);}
  $('detailDlg').dataset.u=u;const rec=PERSONAL.records[u]||{},m=mapLink(r);
  $('detailBody').innerHTML=`<div class="eyebrow">RESTAURANT / 餐厅档案</div><h2 class="detail-title" id="detailTitle">${esc(r.zh||r.n)}</h2>${r.zh?`<p class="detail-origin">${esc(r.n)}${r.kind===2?' · 参考译名，非官方中文名':''}</p>`:''}<p>${esc(DB.C[r.co][0])} · ${esc(DB.T[r.ci][0])}</p>${badge(r)} ${tagsHTML(r)}<dl class="detail-facts"><dt>菜系</dt><dd>${esc(r.cu||'暂无信息')}</dd><dt>地址</dt><dd>${esc(r.a||'暂无信息')}</dd><dt>价位</dt><dd>${r.p?'$'.repeat(r.p):'暂无信息'}（当地相对价位）</dd><dt>数据快照</dt><dd>${esc(DB.updated)}</dd></dl><div class="detail-actions"><a href="https://guide.michelin.com/en/${esc(r.u)}" target="_blank" rel="noopener">米其林页面</a><a href="${esc(m.href)}" target="_blank" rel="noopener">导航</a>${r.w?`<a href="${esc(r.w)}" target="_blank" rel="noopener">官网 / 查询预约</a>`:''}<button class="linkbtn" id="copyRestaurant">复制餐厅链接</button></div><div class="links"><button class="fav" data-u="${esc(u)}" data-v="1" aria-pressed="${favOf(u)===1}">想去</button><button class="fav" data-u="${esc(u)}" data-v="2" aria-pressed="${favOf(u)===2}">去过</button><button class="linkbtn" data-trip-pick="${esc(u)}">加入旅行</button></div><h3>参考消费</h3><div class="price-note">${upPrice(r)}</div><h3>历年快照记录</h3><div class="timeline">${[...r.h.padEnd(4,'?').slice(0,4),String(r.l)].map((l,i)=>`<span>${2022+i}<b>${'01234'.includes(l)?LVN[+l]:l==='-'?'未在快照中':'评级未提供'}</b></span>`).join('')}</div><p class="note">每年一份快照，不等于各地指南的完整年度发布记录；未出现不代表停业。</p><h3>我的用餐记录</h3><form id="visitForm" class="upgrade-form"><label>用餐日期<input id="visitDate" type="date" value="${esc(rec.date||'')}"></label><label>我的评分<select id="visitRating"><option value="0">暂不评分</option>${[1,2,3,4,5].map(n=>`<option value="${n}" ${rec.rating===n?'selected':''}>${n} / 5</option>`).join('')}</select></label><label>个人笔记<textarea id="visitNote" maxlength="3000" placeholder="想吃什么、预约注意事项，或这次用餐的记忆">${esc(rec.note||'')}</textarea></label><button class="btn primary" type="submit">保存记录</button></form><p class="note">记录仅保存在本设备；可随旅行清单一起导出备份。保存笔记不会自动标记“去过”。</p>`;
  document.title=(r.zh||r.n)+' · 米其林全球名录';if(!$('detailDlg').open)$('detailDlg').showModal();
}
function upRestoreDetail(){
  if(!DB)return;const u=new URL(location.href).searchParams.get('restaurant');
  if(u)upOpenDetail(u,false);else if($('detailDlg').open)$('detailDlg').close();
}
function upInit(){
  document.body.insertAdjacentHTML('beforeend',`<dialog id="detailDlg" aria-labelledby="detailTitle"><div class="dlg"><button type="button" class="close" data-close>关闭</button><div id="detailBody"></div></div></dialog><dialog id="tripDlg" aria-labelledby="tripTitle"><div class="dlg"><button type="button" class="close" data-close>关闭</button><h2 id="tripTitle"></h2><form id="tripForm" class="upgrade-form"><label>旅行名称<input id="tripName" maxlength="100" required placeholder="例如：2026 欧洲旅行"></label><button class="btn primary" type="submit">保存名称</button></form><div class="row"><button class="btn" id="tripMap">在地图上查看</button><button class="btn danger" id="tripDelete">删除旅行清单</button></div><div id="tripItems" class="trip-content"></div></div></dialog><dialog id="tripPickDlg" aria-labelledby="tripPickTitle"><div class="dlg"><button type="button" class="close" data-close>关闭</button><h2 id="tripPickTitle"></h2><form id="tripPickForm" class="upgrade-form"><div id="tripPickChoices"></div><label>或创建新旅行<input id="tripQuickName" maxlength="100" placeholder="输入旅行名称"></label><button type="submit" class="btn primary">保存到所选旅行</button></form></div></dialog>`);
  $('meStats').insertAdjacentHTML('beforebegin',`<section class="feature-card"><div class="eyebrow">MY MICHELIN PASSPORT</div><h3>我的米其林护照</h3><div id="passportContent"></div></section><section class="feature-card"><div class="eyebrow">TRAVEL COLLECTIONS</div><h3>我的旅行</h3><button class="btn" id="newTrip">＋ 创建旅行清单</button><div id="tripCards"></div></section>`);
  $('browse').insertAdjacentHTML('afterbegin',`<div class="journey-tools"><label for="tripFilter">旅行清单</label><select id="tripFilter" aria-label="按旅行清单筛选"></select></div><div class="journey-banner" id="journeyBanner" hidden><span id="journeyLabel"></span><button class="btn" id="exitJourney">退出专题 / 旅行</button></div><section class="feature-card" id="annualCard"><div class="eyebrow">2026 / SNAPSHOT CHANGES</div><h3>米其林快照变化</h3><p class="note">比较 2025 年 10 月快照与 ${esc(DB.updated)} 快照，不等同于完整的 2026 年官方新晋名单。连续三星表示 2022–2026 五份快照均为三星。</p><div class="annual-chips" id="annualChoices"></div><details><summary>从榜单消失的餐厅？</summary><p class="note">现有历史文件只保留当前餐厅的评级，无法完整还原已移除餐厅。暂不展示不完整名单。后续数据检查会输出“当前快照 → 新候选快照”的移除记录，供人工核实；不自动判定停业或降星。</p></details></section><p class="search-note" id="searchNote" hidden>未找到精确匹配，以下为拼写相近的结果。</p>`);
  try{PERSONAL=MG.personal(JSON.parse(localStorage.getItem('mg-personal')||'{}'),DB.byU);}catch(e){upReadError=true;toast('旅行记录暂时无法读取，原始存储已保留，请先备份');}
  upLoaded=true;
  $('more-f').insertAdjacentHTML('beforeend',`<div class="lbl">已核实套餐预算（<span id="budgetCoverage">正在加载</span>）</div><div class="row"><label for="budgetCurrency">币种</label><select id="budgetCurrency"><option value="EUR">EUR 欧元</option><option value="DKK">DKK 丹麦克朗</option></select><label for="budgetMax">每位上限</label><input type="number" id="budgetMax" min="1" step="1" placeholder="不限" style="width:100px"><button class="chip" id="clearBudget">清除预算</button></div><p class="note">仅匹配有来源的套餐价；不含未知价格餐厅，不折算汇率，也不代表含酒水的完整人均。</p>`);
  $('budgetCurrency').value=S.currency;$('budgetMax').value=S.budget||'';
  const budgetChange=()=>{S.currency=$('budgetCurrency').value;S.budget=Math.max(0,+$('budgetMax').value||0);reset();render();};
  $('budgetCurrency').onchange=budgetChange;$('budgetMax').onchange=budgetChange;
  $('clearBudget').onclick=()=>{S.budget=0;$('budgetMax').value='';reset();render();};
  $('newTrip').onclick=()=>upOpenTrip('');
  $('tripFilter').onchange=e=>{S.trip=e.target.value;S.passport=false;S.change='';reset();render();};
  $('exitJourney').onclick=()=>{S.trip='';S.passport=false;S.change='';reset();render();};
  $('tripForm').onsubmit=e=>{e.preventDefault();const name=$('tripName').value.trim();if(!name)return;
    if(upSelected){if(!upSave({...PERSONAL,trips:PERSONAL.trips.map(t=>t.id===upSelected?{...t,name}:t)}))return;}
    else if(!upNewTrip(name))return;$('tripDlg').close();render();toast('旅行清单已保存');};
  $('tripMap').onclick=()=>upScopeTrip(upSelected);
  $('tripDelete').onclick=()=>{const id=upSelected;if(!confirm('删除这份旅行清单？餐厅的“想去 / 去过”和用餐笔记会保留。'))return;
    if(!upSave({...PERSONAL,trips:PERSONAL.trips.filter(t=>t.id!==id)}))return;if(S.trip===id)S.trip='';$('tripDlg').close();render();};
  $('tripPickForm').onsubmit=e=>{e.preventDefault();const u=upPickU,selected=new Set([...$('tripPickChoices').querySelectorAll('input:checked')].map(x=>x.value)),name=$('tripQuickName').value.trim();
    const trips=PERSONAL.trips.map(t=>({...t,items:selected.has(t.id)?[...new Set([...t.items,u])]:t.items.filter(x=>x!==u)}));
    if(name){if(trips.length>=300){toast('最多支持 300 个旅行清单');return;}trips.push({id:upUid(),name:name.slice(0,100),items:[u],created:Date.now()});}
    if(!upSave({...PERSONAL,trips}))return;$('tripPickDlg').close();render();toast('已更新旅行清单');};
  document.addEventListener('click',e=>{
    const el=e.target.closest('[data-trip-open],[data-trip-map],[data-trip-pick],[data-restaurant],[data-change],[data-passport-country],#passportMap,#copyRestaurant');if(!el)return;
    if(el.hasAttribute('data-restaurant')){if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();upOpenDetail(el.dataset.restaurant);}
    if(el.hasAttribute('data-trip-open'))upOpenTrip(el.dataset.tripOpen);
    if(el.hasAttribute('data-trip-map'))upScopeTrip(el.dataset.tripMap);
    if(el.hasAttribute('data-trip-pick'))upPickTrip(el.dataset.tripPick);
    if(el.hasAttribute('data-change')){S.change=S.change===el.dataset.change?'':el.dataset.change;S.trip='';S.passport=false;reset();render();}
    if(el.id==='passportMap'||el.hasAttribute('data-passport-country')){
      Object.assign(S,{trip:'',change:'',passport:true,l:'all',c:'',co:el.dataset.passportCountry??'',ci:'',q:'',cu:'',p:'',budget:0,near:false});S.f.clear();goTab('map');}
    if(el.id==='copyRestaurant')copyText(upDetailURL($('detailDlg').dataset.u)).then(()=>toast('已复制餐厅链接'),()=>toast('无法复制，请从地址栏复制链接'));
  });
  document.addEventListener('submit',e=>{if(e.target.id!=='visitForm')return;e.preventDefault();const u=$('detailDlg').dataset.u;
    const records=Object.assign(Object.create(null),PERSONAL.records,{[u]:{date:$('visitDate').value,rating:+$('visitRating').value,note:$('visitNote').value.trim().slice(0,3000)}});
    if(upSave({...PERSONAL,records}))toast('用餐记录已保存');});
  ['detailDlg','tripDlg','tripPickDlg'].forEach(id=>{const dlg=$(id);dlg.addEventListener('click',e=>{if(e.target===dlg||e.target.closest('[data-close]'))dlg.close();});});
  $('detailDlg').addEventListener('close',()=>{const url=new URL(location.href);url.searchParams.delete('restaurant');history.replaceState(null,'',url);document.title='米其林全球名录';});
  window.addEventListener('popstate',upRestoreDetail);
  $('scope').insertAdjacentHTML('afterend',`<p class="search-note">数据快照：${esc(DB.updated)} · <a href="${REPO}/actions/workflows/check-data.yml" target="_blank" rel="noopener">查看更新检查</a></p>`);
  upRender();upRestoreDetail();
  fetch('prices.json').then(r=>{if(!r.ok)throw new Error('prices');return r.json();}).then(p=>{
    PRICE_DB={items:{}};for(const [u,items] of Object.entries(p.items||{}))if(DB.byU[u]&&Array.isArray(items))PRICE_DB.items[u]=items.filter(x=>x&&/^https:\/\//.test(x.source)&&/^\d{4}-\d{2}-\d{2}$/.test(x.checked)&&/^[A-Z]{3}$/.test(x.currency)&&Number.isFinite(x.min)&&Number.isFinite(x.max)&&x.min>=0&&x.max>=x.min&&['meal','basis','includes'].every(k=>typeof x[k]==='string'));
    $('budgetCoverage').textContent='目前覆盖 '+Object.keys(PRICE_DB.items).length+' 家';
    const currencies=[...new Set(Object.values(PRICE_DB.items).flatMap(items=>items.map(p=>p.currency)))];
    if(!currencies.includes(S.currency))currencies.push(S.currency);
    $('budgetCurrency').innerHTML=currencies.sort().map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');$('budgetCurrency').value=S.currency;
    if($('detailDlg').open){const r=DB.byU[$('detailDlg').dataset.u];$('detailBody').querySelector('.price-note').innerHTML=upPrice(r);}
    if(S.budget)render(); // Update results without replacing the open personal-note form.
  }).catch(()=>{$('budgetCoverage').textContent='价格暂时无法载入';});
}

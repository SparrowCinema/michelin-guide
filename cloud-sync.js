/* Cloud sync with a sync code (no account). Want-to-go / been, ratings, meal logs, trips and
   meal photos are kept in a Supabase project; only the SHA-256 of the code is stored there.
   Each sync is a three-way merge (last synced copy, this device, the cloud), so edits made on
   two devices are both kept and deletions carry over. */
const MGSync=(()=>{
  'use strict';
  const API='https://dclxhxxjktegyiwafmsv.supabase.co/rest/v1/rpc/',KEY='sb_publishable_2K9O3h8nn2I_I-cIAdks8A_QZ98xwZ2';
  const STORE='mg-sync';let st=null,busy=null,status={state:'idle',msg:'',at:0},lastPrint='',timer=0;
  try{st=JSON.parse(localStorage.getItem(STORE)||'null');}catch(e){st=null;}
  const save=()=>{try{st?localStorage.setItem(STORE,JSON.stringify(st)):localStorage.removeItem(STORE);}catch(e){}};
  const $=id=>document.getElementById(id),esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const T=s=>typeof MGI18n!=='undefined'?MGI18n.tr(s):s;

  // ---- code ----
  const B32='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function newCode(){const b=crypto.getRandomValues(new Uint8Array(24));let s='';for(const x of b)s+=B32[x%32];return 'MG-'+s.match(/.{4}/g).join('-');}
  function normalize(input){const raw=String(input||'').toUpperCase().replace(/[^A-Z0-9]/g,'').replace(/^MG/,'');
    return raw.length===24&&/^[A-Z2-9]+$/.test(raw)?'MG-'+raw.match(/.{4}/g).join('-'):'';}

  async function rpc(fn,body){
    const res=await fetch(API+fn,{method:'POST',headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
    if(!res.ok){let m='';try{m=(await res.json()).message||'';}catch(e){}throw new Error(m||('HTTP '+res.status));}
    return res.json();
  }

  // ---- merge ----
  const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
  function mergeMap(base,local,remote,resolve){
    const out={},keys=new Set([...Object.keys(local||{}),...Object.keys(remote||{})]);
    for(const k of keys){const b=base?.[k],l=local?.[k],r=remote?.[k];let v;
      if(same(l,r))v=l;else if(same(l,b))v=r;else if(same(r,b))v=l;else v=resolve(l,r,b);
      if(v!==undefined)out[k]=v;}
    return out;
  }
  const favResolve=(l,r)=>!l?r:!r?l:((r[1]||0)>(l[1]||0)?r:l);
  // Same restaurant edited on both devices: merge meal by meal against the last synced copy.
  function recordResolve(l,r,b){
    if(!l)return r;if(!r)return l;
    const byId=a=>Object.fromEntries((a||[]).map(v=>[v.id,v]));
    const visits=Object.values(mergeMap(byId(b?.visits),byId(l.visits),byId(r.visits),(lv,rv)=>lv||rv));
    visits.sort((a,b)=>(a.date||'').localeCompare(b.date||''));const last=visits[visits.length-1]||{};
    return {...r,...l,visits,date:last.date||l.date||'',rating:last.rating||0,note:last.note||''};
  }
  const tripResolve=(l,r)=>!l?r:!r?l:{...r,...l,items:[...new Set([...(l.items||[]),...(r.items||[])])]};
  function merge(base,local,remote){
    base=base||{fav:{},personal:{trips:[],records:{}}};
    const byId=a=>Object.fromEntries((a||[]).map(t=>[t.id,t]));
    const trips=mergeMap(byId(base.personal.trips),byId(local.personal.trips),byId(remote.personal.trips),tripResolve);
    const order=[...new Set([...(remote.personal.trips||[]).map(t=>t.id),...(local.personal.trips||[]).map(t=>t.id)])].filter(id=>trips[id]);
    return {v:1,fav:mergeMap(base.fav,local.fav,remote.fav,favResolve),
      personal:{version:2,trips:order.map(id=>trips[id]),records:mergeMap(base.personal.records,local.personal.records,remote.personal.records,recordResolve)}};
  }
  function snapshot(){return {v:1,fav:JSON.parse(JSON.stringify(FAV)),personal:JSON.parse(JSON.stringify({version:2,trips:PERSONAL.trips,records:PERSONAL.records}))};}
  function clean(d){
    if(!d||typeof d!=='object')return {v:1,fav:{},personal:{version:2,trips:[],records:{}}};
    const fav={};for(const [u,v] of Object.entries(d.fav||{}))if(typeof u==='string'&&Array.isArray(v)&&(v[0]===1||v[0]===2))fav[u]=[v[0],Number.isFinite(v[1])?v[1]:Date.now()];
    const p=MG.personal(d.personal||{},DB.byU);return {v:1,fav,personal:{version:2,trips:p.trips,records:{...p.records}}};
  }
  const print=()=>{try{return JSON.stringify([FAV,PERSONAL.trips,PERSONAL.records]);}catch(e){return '';}};
  function apply(data){
    FAV=Object.assign(Object.create(null),data.fav);
    const next={...PERSONAL,version:2,trips:data.personal.trips,records:Object.assign(Object.create(null),data.personal.records)};
    try{localStorage.setItem('mg-fav',JSON.stringify(FAV));localStorage.setItem('mg-personal',JSON.stringify(next));}catch(e){throw new Error(T('浏览器未能保存，请检查存储空间'));}
    PERSONAL=next;
  }

  // ---- photos ----
  const photoIDs=data=>{const s=new Set();for(const r of Object.values(data.personal.records||{}))for(const v of (r.visits||[]))for(const id of (typeof MP!=='undefined'?MP.clean(v.photos):[]))s.add(id);return s;};
  const toURL=blob=>new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=()=>rej(fr.error);fr.readAsDataURL(blob);});
  async function syncPhotos(code,data,remote){
    if(typeof MP==='undefined')return {up:0,down:0};
    const want=photoIDs(data),onServer=new Set(remote||[]),local=new Set(await MP._keys().catch(()=>[]));let up=0,down=0;
    for(const id of want)if(local.has(id)&&!onServer.has(id)){const rec=await MP._get(id);if(!rec)continue;status.msg=T('正在上传照片')+` ${++up}`;paint();await rpc('mg_photo_put',{code,photo_id:id,data:await toURL(rec.full)});}
    const missing=[...want].filter(id=>!local.has(id)&&onServer.has(id));
    for(let i=0;i<missing.length;i+=4){status.msg=T('正在下载照片')+` ${i+1}/${missing.length}`;paint();
      const got=await rpc('mg_photo_get',{code,ids:missing.slice(i,i+4)});const pack={};for(const [id,d] of Object.entries(got||{}))pack[id]={data:d};down+=await MP.importAll(pack);}
    const stale=[...onServer].filter(id=>!want.has(id));if(stale.length)await rpc('mg_photo_delete',{code,ids:stale}).catch(()=>{});
    return {up,down};
  }

  // ---- sync ----
  async function run(){
    if(!st?.code||typeof DB==='undefined'||!DB)return;
    if(typeof upReadError!=='undefined'&&upReadError)throw new Error(T('旅行记录暂时无法读取，请先备份'));
    status={state:'busy',msg:T('同步中…'),at:status.at};paint();
    let merged,rev,remotePhotos;
    for(let attempt=0;attempt<4;attempt++){
      const remote=await rpc('mg_pull',{code:st.code});
      const theirs=remote.data?clean(remote.data):null,mine=snapshot();
      merged=theirs?merge(st.base,mine,theirs):mine;remotePhotos=remote.photos||[];
      if(theirs&&same(merged,theirs)){rev=remote.rev;break;}
      const r=await rpc('mg_push',{code:st.code,data:merged,base_rev:remote.rev||0});
      if(r.ok){rev=r.rev;break;}
    }
    if(rev===undefined)throw new Error(T('云端有其他设备正在同步，请稍后再试'));
    const changed=!same(merged,snapshot());if(changed){apply(merged);if(typeof upRefreshAll==='function')upRefreshAll();else if(typeof render==='function')render();}
    st={...st,rev,base:merged,at:Date.now()};save();lastPrint=print();
    const ph=await syncPhotos(st.code,merged,remotePhotos);if(ph.down&&typeof render==='function')render();
    status={state:'ok',msg:'',at:Date.now()};paint();
    return {changed,...ph};
  }
  function sync(){if(busy)return busy;busy=run().catch(e=>{status={state:'error',msg:(e&&e.message)||String(e),at:status.at};paint();throw e;}).finally(()=>{busy=null;});return busy;}
  const quiet=()=>sync().catch(()=>{});

  // ---- UI ----
  function ago(t){if(!t)return '';const s=(Date.now()-t)/1000;return s<60?T('刚刚'):s<3600?Math.round(s/60)+T(' 分钟前'):s<86400?Math.round(s/3600)+T(' 小时前'):new Date(t).toLocaleDateString();}
  let mode='',reveal=false;
  function paint(){
    const box=$('syncCard');if(!box)return;
    if(!st?.code){
      box.innerHTML=`<h3>云端同步</h3><p class="sync-lead">用一串同步码，在手机和电脑之间同步“想去 / 去过”、评分、用餐记录、旅行和照片。不用注册账号。</p>${mode==='join'?`<form class="sync-join" id="syncJoin"><input id="syncInput" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="MG-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" aria-label="输入同步码"><button class="btn primary" type="submit">连接</button></form><p class="sync-note">输入另一台设备上的同步码。这台设备上已有的记录会和云端合并，不会丢。</p><button type="button" class="linkbtn" data-sync="cancel">取消</button>`:`<div class="sync-actions"><button type="button" class="btn primary" data-sync="start">开启同步</button><button type="button" class="btn" data-sync="join">我有同步码</button></div>`}`;
      return;}
    const code=st.code,shown=reveal?code:code.slice(0,8)+'-••••-••••-••••-••••-'+code.slice(-4);
    const line=status.state==='busy'?`<span class="sync-dot busy"></span>${esc(status.msg||'同步中…')}`:status.state==='error'?`<span class="sync-dot err"></span>同步失败：${esc(status.msg)}`:`<span class="sync-dot ok"></span>已同步${st.at?' · '+esc(ago(st.at)):''}`;
    box.innerHTML=`<h3>云端同步</h3><p class="sync-status" role="status" aria-live="polite">${line}</p><div class="sync-code"><span>同步码</span><code translate="no">${esc(shown)}</code><div><button type="button" class="linkbtn" data-sync="reveal">${reveal?'隐藏':'显示'}</button><button type="button" class="linkbtn" data-sync="copy">复制</button></div></div><p class="sync-warn">同步码就是钥匙：拿到它的人能看到并修改你的记录；丢了也无法找回。请存进备忘录或密码管理器，在另一台设备点“我有同步码”输入即可。</p><div class="sync-actions"><button type="button" class="btn primary" data-sync="now"${status.state==='busy'?' disabled':''}>立即同步</button><button type="button" class="btn" data-sync="stop">停止同步</button></div>`;
  }
  function mount(){
    const backup=$('exportBtn')?.closest('.card');if(!backup||$('syncCard'))return;
    backup.insertAdjacentHTML('beforebegin','<div class="card sync-card" id="syncCard"></div>');paint();
    $('syncCard').addEventListener('click',async e=>{const b=e.target.closest('[data-sync]');if(!b)return;const a=b.dataset.sync;
      if(a==='join'||a==='cancel'){mode=a==='join'?'join':'';paint();if(mode)$('syncInput')?.focus();return;}
      if(a==='start'){st={code:newCode(),rev:0,base:null,at:0};reveal=true;save();paint();try{await sync();toast(T('✓ 已开启同步，请保存好同步码'));}catch(err){toast(T('同步失败：')+err.message);}return;}
      if(a==='reveal'){reveal=!reveal;paint();return;}
      if(a==='copy'){copyText(st.code).then(()=>toast(T('同步码已复制')),()=>toast(T('复制失败')));return;}
      if(a==='now'){try{const r=await sync();toast(r&&(r.changed||r.down)?T('✓ 已同步，并合并了其他设备的更改'):T('✓ 已同步'));}catch(err){toast(T('同步失败：')+err.message);}return;}
      if(a==='stop'){if(!confirm('在这台设备停止同步？这台设备上的记录会保留，云端的记录也不会删除；以后输入同步码可以重新连接。'))return;st=null;save();status={state:'idle',msg:'',at:0};mode='';reveal=false;paint();toast(T('已在这台设备停止同步'));}
    });
    $('syncCard').addEventListener('submit',async e=>{if(e.target.id!=='syncJoin')return;e.preventDefault();
      const code=normalize($('syncInput').value);if(!code){toast(T('同步码格式不对，请检查'));return;}
      st={code,rev:0,base:null,at:0};save();mode='';paint();
      try{await sync();toast(T('✓ 已连接，记录已合并'));}catch(err){toast(T('同步失败：')+err.message);}});
  }
  function start(){
    mount();lastPrint=print();
    if(st?.code)quiet();
    // Push local changes a few seconds after they happen; pull again when the app comes back.
    setInterval(()=>{if(!st?.code||busy)return;const p=print();if(p!==lastPrint){lastPrint=p;clearTimeout(timer);timer=setTimeout(quiet,3000);}},2000);
    document.addEventListener('visibilitychange',()=>{if(!st?.code)return;if(document.visibilityState==='visible'&&Date.now()-(st.at||0)>30000)quiet();if(document.visibilityState==='hidden'&&print()!==JSON.stringify(st.base&&[st.base.fav,st.base.personal.trips,st.base.personal.records]))quiet();});
    setInterval(()=>{if(status.state==='ok')paint();},60000);
  }
  return {start,sync,merge,normalize,newCode,state:()=>st,_status:()=>status,_rpc:rpc};
})();
if(typeof module!=='undefined')module.exports=MGSync;

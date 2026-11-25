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

  // ---- compact ISO-18004 QR SVG (Byte mode, ECC-L, versions 1-6, <=134 bytes) ----
  const QR_SPEC=[[1,19,7,1,[]],[2,34,10,1,[6,18]],[3,55,15,1,[6,22]],[4,80,20,1,[6,26]],[5,108,26,1,[6,30]],[6,136,18,2,[6,34]]];
  function qrMatrix(text){
    const bytes=[...new TextEncoder().encode(text)];
    const spec=QR_SPEC.find(s=>bytes.length+2<=s[1]);if(!spec)return null;
    const [ver,dc,ec,blocks,align]=spec,N=17+ver*4,bits=[];
    const push=(v,n)=>{for(let i=n-1;i>=0;i--)bits.push((v>>>i)&1);};
    push(4,4);push(bytes.length,8);for(const b of bytes)push(b,8);
    for(let i=0;i<4&&bits.length<dc*8;i++)bits.push(0);
    while(bits.length%8)bits.push(0);
    for(let i=0;bits.length<dc*8;i++)push(i%2?17:236,8);
    const data=[];for(let i=0;i<dc;i++){let b=0;for(let j=0;j<8;j++)b=(b<<1)|bits[i*8+j];data.push(b);}
    const mul=(a,b)=>{let r=0;for(let i=0;i<8;i++){if(b&1)r^=a;const hi=a&128;a=(a<<1)&255;if(hi)a^=29;b>>>=1;}return r;};
    let poly=[1];for(let i=0,p=1;i<ec;i++){const nx=new Array(poly.length+1).fill(0);for(let j=0;j<poly.length;j++){nx[j]^=poly[j];nx[j+1]^=mul(poly[j],p);}poly=nx;p=mul(p,2);}
    const rs=arr=>{const rem=new Array(ec).fill(0);for(const x of arr){const f=x^rem.shift();rem.push(0);for(let i=0;i<ec;i++)rem[i]^=mul(poly[i+1],f);}return rem;};
    const dbs=[],ebs=[],bs=dc/blocks;
    for(let i=0;i<blocks;i++){const sl=data.slice(i*bs,(i+1)*bs);dbs.push(sl);ebs.push(rs(sl));}
    const cw=[];for(let i=0;i<bs;i++)for(const b of dbs)cw.push(b[i]);for(let i=0;i<ec;i++)for(const b of ebs)cw.push(b[i]);
    const g=Array.from({length:N},()=>new Int8Array(N)),res=Array.from({length:N},()=>new Uint8Array(N));
    const set=(r,c,v)=>{if(r>=0&&c>=0&&r<N&&c<N){g[r][c]=v?1:0;res[r][c]=1;}};
    const finder=(r0,c0)=>{for(let r=-1;r<=7;r++)for(let c=-1;c<=7;c++){const v=r>=0&&r<=6&&c>=0&&c<=6&&(r===0||r===6||c===0||c===6||(r>=2&&r<=4&&c>=2&&c<=4));set(r0+r,c0+c,v);}};
    finder(0,0);finder(0,N-7);finder(N-7,0);
    for(const r of align)for(const c of align){if(res[r][c])continue;for(let dr=-2;dr<=2;dr++)for(let dc2=-2;dc2<=2;dc2++)set(r+dr,c+dc2,Math.max(Math.abs(dr),Math.abs(dc2))!==1);}
    for(let i=8;i<N-8;i++){set(6,i,i%2===0);set(i,6,i%2===0);}
    set(N-8,8,1);
    for(let i=0;i<9;i++){if(i!==6){res[8][i]=1;res[i][8]=1;}}for(let i=0;i<8;i++){res[8][N-1-i]=1;res[N-1-i][8]=1;}
    let bi=0,up=true;
    for(let col=N-1;col>0;col-=2){if(col===6)col--;for(let k=0;k<N;k++){const r=up?N-1-k:k;
      for(let dc2=0;dc2<2;dc2++){const c=col-dc2;if(res[r][c])continue;const bit=bi<cw.length*8?((cw[bi>>3]>>>(7-(bi&7)))&1):0;bi++;g[r][c]=bit^(((r+c)%2===0)?1:0);}}up=!up;}
    // Format info for ECC-L (01) + Mask 0 (000) => data 01000 => masked 0x77c4
    const fmt=0x77c4;
    const f1=[[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,7],[8,8],[7,8],[5,8],[4,8],[3,8],[2,8],[1,8],[0,8]];
    const f2=[[N-1,8],[N-2,8],[N-3,8],[N-4,8],[N-5,8],[N-6,8],[N-7,8],[8,N-8],[8,N-7],[8,N-6],[8,N-5],[8,N-4],[8,N-3],[8,N-2],[8,N-1]];
    for(let i=0;i<15;i++){const v=(fmt>>>(14-i))&1;g[f1[i][0]][f1[i][1]]=v;g[f2[i][0]][f2[i][1]]=v;}
    return g;
  }
  function qrSVG(text){
    const m=qrMatrix(text);if(!m)return '';const N=m.length,q=2,S=N+q*2;let d='';
    for(let r=0;r<N;r++)for(let c=0;c<N;c++)if(m[r][c])d+=`M${c+q},${r+q}h1v1h-1z`;
    return `<svg class="sync-qr-svg" viewBox="0 0 ${S} ${S}" width="176" height="176" role="img" aria-label="${esc(T('扫码配对'))}"><rect width="${S}" height="${S}" fill="#fff" rx="1.5"/><path d="${d}" fill="#1f1b1a"/></svg>`;
  }
  function pairURL(code){const u=new URL(location.href);u.searchParams.delete('restaurant');u.searchParams.set('sync',code);u.hash='v=me';return u.href;}

  async function deleteCloud(code){
    try{await rpc('mg_delete',{code});return;}catch(e){}
    // Fallback for deployments without mg_delete: clear cloud payload and delete all stored photos.
    const remote=await rpc('mg_pull',{code});
    if(remote.photos&&remote.photos.length){for(let i=0;i<remote.photos.length;i+=20)await rpc('mg_photo_delete',{code,ids:remote.photos.slice(i,i+20)}).catch(()=>{});}
    if(remote.data){const empty={v:1,fav:{},personal:{version:2,trips:[],records:{}}};await rpc('mg_push',{code,data:empty,base_rev:remote.rev||0}).catch(()=>{});}
  }

  // ---- UI ----
  function ago(t){if(!t)return '';const s=(Date.now()-t)/1000;return s<60?T('刚刚'):s<3600?Math.round(s/60)+T(' 分钟前'):s<86400?Math.round(s/3600)+T(' 小时前'):new Date(t).toLocaleDateString();}
  let mode='',reveal=false,showQR=false;
  function statusHTML(){
    if(!st?.code)return '';
    return status.state==='busy'?`<span class="sync-dot busy"></span>${esc(status.msg||'同步中…')}`:status.state==='error'?`<span class="sync-dot err"></span>同步失败：${esc(status.msg)}`:`<span class="sync-dot ok"></span>已同步${st.at?' · '+esc(ago(st.at)):''}`;
  }
  function refreshStatus(){
    const el=$('syncCard')?.querySelector('.sync-status');
    if(el&&st?.code)el.innerHTML=statusHTML();
  }
  function paint(){
    const box=$('syncCard');if(!box)return;
    const privacy=`<details class="sync-privacy"><summary>隐私与存储说明</summary><p>同步数据与用餐照片存储在 Supabase（东京节点 ap-northeast-1），仅以同步码的 SHA-256 哈希作为索引，不收集邮箱或账号信息。随时可点击“清除云端副本”删除云端数据。</p></details>`;
    if(!st?.code){
      box.innerHTML=`<h3>云端同步</h3><p class="sync-lead">用一串同步码，在手机和电脑之间同步“想去 / 去过”、评分、用餐记录、旅行和照片。不用注册账号。</p>${mode==='join'?`<form class="sync-join" id="syncJoin"><input id="syncInput" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="MG-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" aria-label="输入同步码"><button class="btn primary" type="submit">连接</button></form><p class="sync-note">输入另一台设备上的同步码。这台设备上已有的记录会和云端合并，不会丢。</p><button type="button" class="linkbtn" data-sync="cancel">取消</button>`:`<div class="sync-actions"><button type="button" class="btn primary" data-sync="start">开启同步</button><button type="button" class="btn" data-sync="join">我有同步码</button></div>`}${privacy}`;
      return;}
    const code=st.code,shown=reveal?code:code.slice(0,8)+'-••••-••••-••••-••••-'+code.slice(-4);
    const line=statusHTML();
    const qrPanel=showQR?`<div class="sync-qr-box">${qrSVG(pairURL(code))}<p>用另一台设备扫码，自动填入同步码并合并记录</p><button type="button" class="linkbtn" data-sync="copy-pair">复制配对链接</button></div>`:'';
    box.innerHTML=`<h3>云端同步</h3><p class="sync-status" role="status" aria-live="polite">${line}</p><div class="sync-code"><span>同步码</span><code translate="no">${esc(shown)}</code><div><button type="button" class="linkbtn" data-sync="reveal">${reveal?'隐藏':'显示'}</button><button type="button" class="linkbtn" data-sync="copy">复制</button><button type="button" class="linkbtn" data-sync="qr">${showQR?'收起二维码':'扫码配对'}</button></div></div>${qrPanel}<p class="sync-warn">同步码就是钥匙：拿到它的人能看到并修改你的记录；丢了也无法找回。请存进备忘录或密码管理器，在另一台设备点“我有同步码”输入即可。</p><div class="sync-actions"><button type="button" class="btn primary" data-sync="now"${status.state==='busy'?' disabled':''}>立即同步</button><button type="button" class="btn" data-sync="stop">停止同步</button></div><div class="sync-danger-row"><button type="button" class="linkbtn sync-wipe" data-sync="wipe">清除云端副本</button></div>${privacy}`;
  }
  function mount(){
    const backup=$('exportBtn')?.closest('.card');if(!backup||$('syncCard'))return;
    backup.insertAdjacentHTML('beforebegin','<div class="card sync-card" id="syncCard"></div>');paint();
    $('syncCard').addEventListener('click',async e=>{const b=e.target.closest('[data-sync]');if(!b)return;const a=b.dataset.sync;
      if(a==='join'||a==='cancel'){mode=a==='join'?'join':'';paint();if(mode)$('syncInput')?.focus();return;}
      if(a==='start'){st={code:newCode(),rev:0,base:null,at:0};reveal=true;showQR=false;save();paint();try{await sync();toast(T('✓ 已开启同步，请保存好同步码'));}catch(err){toast(T('同步失败：')+err.message);}return;}
      if(a==='reveal'){reveal=!reveal;paint();return;}
      if(a==='qr'){showQR=!showQR;paint();return;}
      if(a==='copy'){copyText(st.code).then(()=>toast(T('同步码已复制')),()=>toast(T('复制失败')));return;}
      if(a==='copy-pair'){copyText(pairURL(st.code)).then(()=>toast(T('配对链接已复制')),()=>toast(T('复制失败')));return;}
      if(a==='now'){try{const r=await sync();toast(r&&(r.changed||r.down)?T('✓ 已同步，并合并了其他设备的更改'):T('✓ 已同步'));}catch(err){toast(T('同步失败：')+err.message);}return;}
      if(a==='stop'){if(!confirm('在这台设备停止同步？这台设备上的记录会保留，云端的记录也不会删除；以后输入同步码可以重新连接。'))return;st=null;save();status={state:'idle',msg:'',at:0};mode='';reveal=false;showQR=false;paint();toast(T('已在这台设备停止同步'));return;}
      if(a==='wipe'){if(!b.classList.contains('is-armed')){b.classList.add('is-armed');b.textContent=T('确认清除云端副本？');clearTimeout(b._t);b._t=setTimeout(()=>{b.classList.remove('is-armed');b.textContent=T('清除云端副本');},4500);return;}
        const code=st.code;try{await deleteCloud(code);st=null;save();status={state:'idle',msg:'',at:0};mode='';reveal=false;showQR=false;paint();toast(T('云端副本已清除，本机记录保留'));}catch(err){toast(T('同步失败：')+err.message);}return;}
    });
    $('syncCard').addEventListener('submit',async e=>{if(e.target.id!=='syncJoin')return;e.preventDefault();
      const code=normalize($('syncInput').value);if(!code){toast(T('同步码格式不对，请检查'));return;}
      st={code,rev:0,base:null,at:0};save();mode='';showQR=false;paint();
      try{await sync();toast(T('✓ 已连接，记录已合并'));}catch(err){toast(T('同步失败：')+err.message);}});
  }
  function checkPairingParam(){
    try{const u=new URL(location.href),raw=u.searchParams.get('sync');if(!raw)return;
      u.searchParams.delete('sync');history.replaceState(null,'',u.href);
      const code=normalize(raw);if(!code||st?.code===code)return;
      if(!confirm('检测到同步配对链接，是否连接到云端并合并记录？'))return;
      st={code,rev:0,base:null,at:0};save();mode='';paint();
      sync().then(()=>toast(T('✓ 已连接，记录已合并')),err=>toast(T('同步失败：')+err.message));}catch(e){}
  }
  function start(){
    mount();lastPrint=print();
    checkPairingParam();
    if(st?.code)quiet();
    // Push local changes a few seconds after they happen; pull again when the app comes back.
    setInterval(()=>{if(!st?.code||busy)return;const p=print();if(p!==lastPrint){lastPrint=p;clearTimeout(timer);timer=setTimeout(quiet,3000);}},2000);
    document.addEventListener('visibilitychange',()=>{if(!st?.code)return;if(document.visibilityState==='visible'&&Date.now()-(st.at||0)>30000)quiet();if(document.visibilityState==='hidden'&&print()!==JSON.stringify(st.base&&[st.base.fav,st.base.personal.trips,st.base.personal.records]))quiet();});
    setInterval(()=>{if(status.state==='ok')refreshStatus();},60000);
  }
  return {start,sync,merge,normalize,newCode,qrMatrix,qrSVG,pairURL,deleteCloud,state:()=>st,_status:()=>status,_rpc:rpc};
})();
if(typeof module!=='undefined')module.exports=MGSync;

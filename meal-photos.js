/* Meal photos: compressed on the device, kept in IndexedDB (not localStorage), referenced by id from each visit. */
const MP=(()=>{
  'use strict';
  const MAX=9,FULL=1600,THUMB=480,DB_NAME='mg-media',STORE='photos';
  const ID=/^p-[a-z0-9-]{4,60}$/;let dbp=null;const urls=new Map(),fulls=new Map();
  const open=()=>dbp||(dbp=new Promise((res,rej)=>{if(!('indexedDB' in window)){rej(new Error('此浏览器不支持保存照片'));return;}
    const q=indexedDB.open(DB_NAME,1);q.onupgradeneeded=()=>q.result.createObjectStore(STORE,{keyPath:'id'});q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error);}).catch(e=>{dbp=null;throw e;}));
  const tx=(mode,fn)=>open().then(db=>new Promise((res,rej)=>{const t=db.transaction(STORE,mode),s=t.objectStore(STORE);let out;const r=fn(s);if(r)r.onsuccess=()=>{out=r.result;};t.oncomplete=()=>res(out);t.onerror=t.onabort=()=>rej(t.error||new Error('照片保存失败'));}));
  const get=id=>tx('readonly',s=>s.get(id));
  const put=rec=>tx('readwrite',s=>s.put(rec));
  const del=id=>tx('readwrite',s=>s.delete(id));
  const keys=()=>tx('readonly',s=>s.getAllKeys());
  const uid=()=>'p-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clean=list=>Array.isArray(list)?[...new Set(list.filter(x=>typeof x==='string'&&ID.test(x)))].slice(0,MAX):[];

  async function decode(file){
    if('createImageBitmap' in window){try{return await createImageBitmap(file,{imageOrientation:'from-image'});}catch(e){}}
    const url=URL.createObjectURL(file);try{const img=new Image();img.decoding='async';img.src=url;await img.decode();return img;}finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
  }
  function scaled(src,max,q){
    const w=src.width||src.naturalWidth,h=src.height||src.naturalHeight,k=Math.min(1,max/Math.max(w,h));
    const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w*k));c.height=Math.max(1,Math.round(h*k));
    const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,c.width,c.height);g.drawImage(src,0,0,c.width,c.height);
    return new Promise((res,rej)=>c.toBlob(b=>b?res({blob:b,w:c.width,h:c.height}):rej(new Error('图片无法处理')),'image/jpeg',q));
  }
  async function add(file,u){
    if(!file||!/^image\//.test(file.type||'image/'))throw new Error('请选择图片文件');
    const src=await decode(file),full=await scaled(src,FULL,.84),thumb=await scaled(src,THUMB,.78);src.close?.();
    const rec={id:uid(),u,full:full.blob,thumb:thumb.blob,w:full.w,h:full.h,at:Date.now()};await put(rec);
    try{navigator.storage?.persist?.();}catch(e){}
    return rec.id;
  }
  async function url(id,big){
    const cache=big?fulls:urls;if(cache.has(id))return cache.get(id);
    const rec=await get(id);if(!rec)return '';const u=URL.createObjectURL(big?rec.full:rec.thumb);cache.set(id,u);return u;
  }
  // Fill every <img data-photo-id> that has no picture yet, wherever the meal log is rendered.
  function hydrate(root=document){
    root.querySelectorAll?.('img[data-photo-id]:not([data-ready])').forEach(img=>{img.dataset.ready='1';
      url(img.dataset.photoId).then(u=>{if(u){img.src=u;img.onload=()=>img.closest('.mp-tile')?.classList.add('is-loaded');}else img.closest('.mp-tile')?.classList.add('is-missing');}).catch(()=>img.closest('.mp-tile')?.classList.add('is-missing'));});
  }
  const camera='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.3-1.8c.3-.4.7-.7 1.2-.7h2.8c.5 0 .9.3 1.2.7L15.9 6h1.6A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"/><circle cx="12" cy="12.5" r="3.4"/></svg>';
  const tile=(id,i,edit)=>`<li class="mp-tile" data-photo-tile="${esc(id)}"><button type="button" class="mp-open" data-photo-open="${i}" aria-label="查看第 ${i+1} 张照片"><img data-photo-id="${esc(id)}" alt="" loading="lazy"></button>${edit?`${i===0?'<span class="mp-cover">封面</span>':''}<button type="button" class="mp-remove" data-photo-remove="${esc(id)}" aria-label="移除第 ${i+1} 张照片">×</button>`:''}</li>`;
  function editorHTML(list){
    const ids=clean(list);
    return `<div class="mp-edit" data-photos><div class="mp-head"><span>照片</span><small><b data-photo-count>${ids.length}</b> / ${MAX}</small></div><ul class="mp-grid">${ids.map((id,i)=>tile(id,i,true)).join('')}<li class="mp-add-tile"${ids.length>=MAX?' hidden':''}><label class="mp-add">${camera}<span>添加照片</span><input type="file" accept="image/*" multiple data-photo-input></label></li></ul><p class="mp-hint">照片只存在这台设备上，导出备份时一并带走。</p></div>`;
  }
  function cardHTML(list){
    const ids=clean(list);if(!ids.length)return '';const show=ids.slice(0,3),more=ids.length-show.length;
    return `<ul class="mp-strip mp-n${Math.min(3,ids.length)}" data-photos-view="${esc(ids.join(','))}">${show.map((id,i)=>`<li class="mp-tile"><button type="button" class="mp-open" data-photo-open="${i}" aria-label="查看照片 ${i+1}/${ids.length}"><img data-photo-id="${esc(id)}" alt="" loading="lazy">${i===2&&more>0?`<span class="mp-more">+${more}</span>`:''}</button></li>`).join('')}</ul>`;
  }
  const editIDs=box=>[...box.querySelectorAll('[data-photo-tile]')].map(x=>x.dataset.photoTile);
  function refreshEditor(box){
    const ids=editIDs(box);box.querySelector('[data-photo-count]').textContent=ids.length;box.querySelector('.mp-add-tile').hidden=ids.length>=MAX;
    box.querySelectorAll('[data-photo-tile]').forEach((li,i)=>{li.querySelector('.mp-open').dataset.photoOpen=i;li.querySelector('.mp-cover')?.remove();if(!i)li.querySelector('.mp-open').insertAdjacentHTML('afterend','<span class="mp-cover">封面</span>');});
  }
  // Remove photos no saved meal or open editor refers to (unsaved picks, removed or deleted meals).
  let gcTimer=0;
  function gc(){clearTimeout(gcTimer);gcTimer=setTimeout(async()=>{try{
    const keep=new Set();for(const r of Object.values(PERSONAL.records||{}))for(const v of (r.visits||[]))for(const id of clean(v.photos))keep.add(id);
    document.querySelectorAll('.mp-edit [data-photo-tile]').forEach(x=>keep.add(x.dataset.photoTile));
    for(const id of await keys())if(!keep.has(id)){await del(id);for(const m of [urls,fulls])if(m.has(id)){URL.revokeObjectURL(m.get(id));m.delete(id);}}
  }catch(e){}},800);}

  // Full-screen viewer with swipe, arrows and keyboard.
  let view={ids:[],i:0,caption:''};
  function ensureViewer(){
    if(document.getElementById('photoDlg'))return;
    document.body.insertAdjacentHTML('beforeend',`<dialog id="photoDlg" class="mp-viewer" aria-label="照片"><div class="mp-stage"><img id="photoBig" alt=""><button type="button" class="mp-nav mp-prev" data-photo-step="-1" aria-label="上一张">‹</button><button type="button" class="mp-nav mp-next" data-photo-step="1" aria-label="下一张">›</button></div><div class="mp-bar"><div><b id="photoCaption"></b><span id="photoCount"></span></div><button type="button" class="mp-close" data-photo-close aria-label="关闭">关闭</button></div></dialog>`);
    const dlg=document.getElementById('photoDlg');let x0=null;
    dlg.addEventListener('click',e=>{if(e.target.closest('[data-photo-close]')||e.target===dlg||e.target.classList.contains('mp-stage'))close();const s=e.target.closest('[data-photo-step]');if(s)step(+s.dataset.photoStep);});
    dlg.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')step(-1);if(e.key==='ArrowRight')step(1);});
    dlg.addEventListener('touchstart',e=>{x0=e.touches.length===1?e.touches[0].clientX:null;},{passive:true});
    dlg.addEventListener('touchend',e=>{if(x0==null)return;const dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)>45)step(dx<0?1:-1);});
  }
  const close=()=>{const d=document.getElementById('photoDlg');if(d?.open)(typeof closeAppDialog==='function'?closeAppDialog(d):d.close());};
  async function show(){
    const big=document.getElementById('photoBig'),id=view.ids[view.i];big.classList.add('is-loading');
    document.getElementById('photoCount').textContent=view.ids.length>1?`${view.i+1} / ${view.ids.length}`:'';
    document.getElementById('photoCaption').textContent=view.caption;
    document.querySelectorAll('#photoDlg .mp-nav').forEach(b=>b.hidden=view.ids.length<2);
    const u=await url(id,true).catch(()=>'');if(view.ids[view.i]!==id)return;big.src=u;big.onload=()=>big.classList.remove('is-loading');
  }
  function step(d){if(view.ids.length<2)return;view.i=(view.i+d+view.ids.length)%view.ids.length;show();}
  function openViewer(ids,i,caption){ensureViewer();view={ids,i,caption};const d=document.getElementById('photoDlg');if(!d.open)(typeof showAppDialog==='function'?showAppDialog(d):d.showModal());show();}

  function bind(){
    new MutationObserver(()=>hydrate()).observe(document.body,{childList:true,subtree:true});hydrate();
    document.addEventListener('change',async e=>{
      const input=e.target.closest?.('[data-photo-input]');if(!input)return;
      const box=input.closest('.mp-edit'),form=input.closest('.visit-form'),u=form?.dataset.u||'',files=[...input.files];input.value='';
      const room=MAX-editIDs(box).length;if(files.length>room&&typeof toast==='function')toast(`每次用餐最多 ${MAX} 张，已添加前 ${Math.max(0,room)} 张`);
      const grid=box.querySelector('.mp-grid'),addTile=box.querySelector('.mp-add-tile');
      for(const f of files.slice(0,Math.max(0,room))){
        const ph=document.createElement('li');ph.className='mp-tile is-pending';ph.innerHTML='<span class="mp-spin" aria-label="正在处理照片"></span>';grid.insertBefore(ph,addTile);
        try{const id=await add(f,u);ph.outerHTML=tile(id,0,true);}catch(err){ph.remove();if(typeof toast==='function')toast(err.message||'照片保存失败，请检查存储空间');}
        refreshEditor(box);
      }
      if(form&&typeof upVisitDirty==='function')upVisitDirty(form);
    });
    document.addEventListener('click',e=>{
      const rm=e.target.closest('[data-photo-remove]');
      if(rm){const box=rm.closest('.mp-edit');rm.closest('.mp-tile').remove();refreshEditor(box);const form=box.closest('.visit-form');if(form&&typeof upVisitDirty==='function')upVisitDirty(form);return;}
      const op=e.target.closest('[data-photo-open]');if(!op)return;
      const strip=op.closest('[data-photos-view]'),box=op.closest('.mp-edit');const ids=strip?strip.dataset.photosView.split(','):box?editIDs(box):[];if(!ids.length)return;
      const log=op.closest('.meal-log'),r=log&&typeof DB!=='undefined'?DB.byU[log.dataset.u]:null,card=op.closest('.meal-card'),date=card?.querySelector('.meal-date b')?.textContent||'',year=card?.querySelector('.meal-date span')?.textContent||'';
      openViewer(ids,+op.dataset.photoOpen||0,[r?(r.zh||r.n):'',/^\d{4}$/.test(year)?year+'.'+date:''].filter(Boolean).join(' · '));
    });
  }
  async function exportAll(){
    const ids=new Set();for(const r of Object.values(PERSONAL.records||{}))for(const v of (r.visits||[]))for(const id of clean(v.photos))ids.add(id);
    const out={};for(const id of ids){const rec=await get(id).catch(()=>null);if(!rec)continue;
      out[id]={u:rec.u,w:rec.w,h:rec.h,at:rec.at,data:await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.onerror=()=>rej(fr.error);fr.readAsDataURL(rec.full);})};}
    return out;
  }
  async function importAll(photos){
    if(!photos||typeof photos!=='object')return 0;let n=0;const have=new Set(await keys());
    for(const [id,p] of Object.entries(photos)){
      if(!ID.test(id)||have.has(id)||!p||typeof p.data!=='string'||!/^data:image\/(jpeg|png|webp);base64,/.test(p.data))continue;
      const blob=await (await fetch(p.data)).blob();const src=await decode(blob),thumb=await scaled(src,THUMB,.78);src.close?.();
      await put({id,u:typeof p.u==='string'?p.u:'',full:blob,thumb:thumb.blob,w:p.w|0,h:p.h|0,at:Number.isFinite(p.at)?p.at:Date.now()});n++;
    }
    hydrate();return n;
  }
  return {MAX,clean,editorHTML,cardHTML,editIDs,hydrate,gc,bind,add,exportAll,importAll,openViewer,_get:get,_keys:keys};
})();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>MP.bind());else MP.bind();

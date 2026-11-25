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
  const isHeic=f=>/hei[cf]/i.test(f.type||'')||/\.hei[cf]$/i.test(f.name||'');
  async function add(file,u){
    if(!file||!(/^image\//.test(file.type||'image/')||isHeic(file)))throw new Error('请选择图片文件');
    let src;try{src=await decode(file);}catch(e){throw new Error(isHeic(file)?'此浏览器无法读取 HEIC 照片，请在相册中导出为 JPG 后再添加':'这张图片无法读取，请换一张试试');}
    const full=await scaled(src,FULL,.84),thumb=await scaled(src,THUMB,.78);src.close?.();
    const rec={id:uid(),u,full:full.blob,thumb:thumb.blob,w:full.w,h:full.h,at:Date.now()};await put(rec);
    try{navigator.storage?.persist?.();}catch(e){}
    return rec.id;
  }
  // Date the photo was taken (JPEG EXIF DateTimeOriginal, else DateTime), as YYYY-MM-DD, or ''.
  async function takenDate(file){
    try{
      const buf=await file.slice(0,262144).arrayBuffer(),v=new DataView(buf);if(v.byteLength<4||v.getUint16(0)!==0xFFD8)return '';
      let o=2;while(o+4<v.byteLength){const m=v.getUint16(o),len=v.getUint16(o+2);if((m&0xFF00)!==0xFF00)return '';
        if(m===0xFFE1&&v.getUint32(o+4)===0x45786966){const t=o+10,le=v.getUint16(t)===0x4949,g16=x=>v.getUint16(x,le),g32=x=>v.getUint32(x,le);
          const read=(ifd,tag)=>{if(t+ifd+2>v.byteLength)return null;const n=g16(t+ifd);for(let i=0;i<n;i++){const e=t+ifd+2+i*12;if(e+12>v.byteLength)return null;if(g16(e)===tag)return e;}return null;};
          const ascii=e=>{if(!e)return '';const c=g32(e+4),off=c>4?t+g32(e+8):e+8;let out='';for(let i=0;i<c&&off+i<v.byteLength;i++){const ch=v.getUint8(off+i);if(!ch)break;out+=String.fromCharCode(ch);}return out;};
          const ifd0=g32(t+4),ex=read(ifd0,0x8769);let d=ex?ascii(read(g32(ex+8),0x9003)):'';if(!d)d=ascii(read(ifd0,0x0132));
          const m2=/^(\d{4}):(\d{2}):(\d{2})/.exec(d);if(!m2)return '';const iso=`${m2[1]}-${m2[2]}-${m2[3]}`,y=+m2[1];
          return y>=1990&&iso<=new Date().toISOString().slice(0,10)?iso:'';}
        o+=2+len;}
    }catch(e){}
    return '';
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
  const tile=(id,i,edit)=>`<li class="mp-tile" data-photo-tile="${esc(id)}"><button type="button" class="mp-open" data-photo-open="${i}" aria-label="${edit?`第 ${i+1} 张照片${i===0?'（封面）':''}，可拖动调整顺序`:`查看第 ${i+1} 张照片`}"><img data-photo-id="${esc(id)}" alt="用餐照片 ${i+1}" loading="lazy" draggable="false"></button>${edit?`${i===0?'<span class="mp-cover">封面</span>':''}<button type="button" class="mp-remove" data-photo-remove="${esc(id)}" aria-label="移除第 ${i+1} 张照片">×</button>`:''}</li>`;
  function editorHTML(list){
    const ids=clean(list);
    return `<div class="mp-edit" data-photos><div class="mp-head"><span>照片</span><small><b data-photo-count>${ids.length}</b> / ${MAX}</small></div><ul class="mp-grid">${ids.map((id,i)=>tile(id,i,true)).join('')}<li class="mp-add-tile"${ids.length>=MAX?' hidden':''}><label class="mp-add">${camera}<span>添加照片</span><input type="file" accept="image/*,.heic,.heif" multiple data-photo-input></label></li></ul><p class="mp-hint"><span class="mp-sort-hint"${ids.length>1?'':' hidden'}>长按拖动调整顺序，第一张是封面；点开大图也可以设为封面。</span>照片只存在这台设备上，导出备份时一并带走。</p><p class="mp-live" aria-live="polite"></p></div>`;
  }
  function cardHTML(list){
    const ids=clean(list);if(!ids.length)return '';const show=ids.slice(0,3),more=ids.length-show.length;
    return `<ul class="mp-strip mp-n${Math.min(3,ids.length)}" data-photos-view="${esc(ids.join(','))}">${show.map((id,i)=>`<li class="mp-tile"><button type="button" class="mp-open" data-photo-open="${i}" aria-label="查看照片 ${i+1}/${ids.length}"><img data-photo-id="${esc(id)}" alt="用餐照片 ${i+1}" loading="lazy">${i===2&&more>0?`<span class="mp-more">+${more}</span>`:''}</button></li>`).join('')}</ul>`;
  }
  const editIDs=box=>[...box.querySelectorAll('[data-photo-tile]')].map(x=>x.dataset.photoTile);
  const say=(box,msg)=>{const l=box?.querySelector('.mp-live');if(l){l.textContent='';setTimeout(()=>{l.textContent=msg;},30);}};
  function refreshEditor(box){
    const ids=editIDs(box);box.querySelector('[data-photo-count]').textContent=ids.length;box.querySelector('.mp-add-tile').hidden=ids.length>=MAX;
    const hint=box.querySelector('.mp-sort-hint');if(hint)hint.hidden=ids.length<2;
    box.querySelectorAll('[data-photo-tile]').forEach((li,i)=>{const op=li.querySelector('.mp-open');op.dataset.photoOpen=i;op.setAttribute('aria-label',`第 ${i+1} 张照片${i===0?'（封面）':''}，可拖动调整顺序`);
      const img=li.querySelector('img');if(img)img.alt='用餐照片 '+(i+1);li.querySelector('.mp-remove')?.setAttribute('aria-label',`移除第 ${i+1} 张照片`);
      li.querySelector('.mp-cover')?.remove();if(!i)op.insertAdjacentHTML('afterend','<span class="mp-cover">封面</span>');});
  }
  const dirty=box=>{const form=box.closest('.visit-form');if(form&&typeof upVisitDirty==='function')upVisitDirty(form);};
  // Move a tile to a new position (0 = cover) with a short FLIP animation.
  function moveTile(box,li,to){
    const tiles=[...box.querySelectorAll('[data-photo-tile]')],from=tiles.indexOf(li);to=Math.max(0,Math.min(tiles.length-1,to));if(from<0||from===to)return false;
    const before=new Map(tiles.map(t=>[t,t.getBoundingClientRect()]));
    const ref=to>from?tiles[to].nextSibling:tiles[to];li.parentNode.insertBefore(li,ref);
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches)tiles.forEach(t=>{if(t.classList.contains('is-placeholder'))return;const a=before.get(t),b=t.getBoundingClientRect(),dx=a.left-b.left,dy=a.top-b.top;if(!dx&&!dy)return;
      t.style.transition='none';t.style.transform=`translate(${dx}px,${dy}px)`;requestAnimationFrame(()=>{t.style.transition='transform .2s ease';t.style.transform='';});});
    refreshEditor(box);dirty(box);return true;
  }
  // Removing leaves an "undo" tile in place for a few seconds.
  function removeTile(box,li){
    const id=li.dataset.photoTile,at=editIDs(box).indexOf(id);
    const undo=document.createElement('li');undo.className='mp-tile mp-undo';undo.dataset.photoRemoved=id;undo.innerHTML='<button type="button" data-photo-undo>已移除<b>撤销</b></button>';
    li.replaceWith(undo);refreshEditor(box);dirty(box);say(box,`已移除第 ${at+1} 张照片，可撤销`);
    undo._t=setTimeout(()=>{if(undo.isConnected){undo.remove();refreshEditor(box);}},6000);
  }
  function undoRemove(box,undo){
    if(editIDs(box).length>=MAX){if(typeof toast==='function')toast(`每次用餐最多 ${MAX} 张`);return;}
    clearTimeout(undo._t);undo.outerHTML=tile(undo.dataset.photoRemoved,0,true);refreshEditor(box);hydrate(box);dirty(box);say(box,'已恢复照片');
  }
  // Remove photos no saved meal or open editor refers to (unsaved picks, removed or deleted meals).
  let gcTimer=0;
  function gc(){clearTimeout(gcTimer);gcTimer=setTimeout(async()=>{try{
    const keep=new Set();for(const r of Object.values(PERSONAL.records||{}))for(const v of (r.visits||[]))for(const id of clean(v.photos))keep.add(id);
    document.querySelectorAll('dialog[open] .mp-edit [data-photo-tile],dialog[open] .mp-edit [data-photo-removed],body>:not(dialog) .mp-edit [data-photo-tile]').forEach(x=>keep.add(x.dataset.photoTile||x.dataset.photoRemoved));
    for(const id of await keys())if(!keep.has(id)){await del(id);for(const m of [urls,fulls])if(m.has(id)){URL.revokeObjectURL(m.get(id));m.delete(id);}}
  }catch(e){}},800);}

  // Full-screen viewer with swipe, arrows and keyboard. Opened from an editor it can also reorder and remove.
  let view={ids:[],i:0,caption:'',box:null};
  function ensureViewer(){
    if(document.getElementById('photoDlg'))return;
    document.body.insertAdjacentHTML('beforeend',`<dialog id="photoDlg" class="mp-viewer" aria-label="照片"><div class="mp-stage"><img id="photoBig" alt=""><button type="button" class="mp-nav mp-prev" data-photo-step="-1" aria-label="上一张">‹</button><button type="button" class="mp-nav mp-next" data-photo-step="1" aria-label="下一张">›</button></div><div class="mp-tools" hidden><button type="button" data-photo-act="cover">设为封面</button><button type="button" data-photo-act="left" aria-label="往前移一位">‹ 前移</button><button type="button" data-photo-act="right" aria-label="往后移一位">后移 ›</button><button type="button" data-photo-act="remove" class="mp-tool-remove">移除</button></div><div class="mp-bar"><div><b id="photoCaption"></b><span id="photoCount"></span></div><button type="button" class="mp-close" data-photo-close aria-label="关闭">关闭</button></div></dialog>`);
    const dlg=document.getElementById('photoDlg');let x0=null,y0=null;
    dlg.addEventListener('click',e=>{if(e.target.closest('[data-photo-close]')||e.target===dlg||e.target.classList.contains('mp-stage'))close();const s=e.target.closest('[data-photo-step]');if(s)step(+s.dataset.photoStep);const a=e.target.closest('[data-photo-act]');if(a)act(a.dataset.photoAct);});
    dlg.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')step(-1);if(e.key==='ArrowRight')step(1);});
    dlg.addEventListener('touchstart',e=>{const one=e.touches.length===1;x0=one?e.touches[0].clientX:null;y0=one?e.touches[0].clientY:null;},{passive:true});
    dlg.addEventListener('touchend',e=>{if(x0==null)return;const dx=e.changedTouches[0].clientX-x0,dy=e.changedTouches[0].clientY-y0;x0=null;
      if(document.getElementById('photoBig').classList.contains('is-zoomed'))return;
      if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy))step(dx<0?1:-1);else if(dy>90&&Math.abs(dy)>Math.abs(dx)*1.5&&!e.target.closest('.mp-tools,.mp-bar'))close();});
    // Double-tap / double-click zooms in on the tapped point; again to fit.
    const big=document.getElementById('photoBig');
    big.addEventListener('dblclick',e=>{const on=big.classList.toggle('is-zoomed');if(on){const r=big.getBoundingClientRect();big.style.transformOrigin=`${((e.clientX-r.left)/r.width*100).toFixed(1)}% ${((e.clientY-r.top)/r.height*100).toFixed(1)}%`;}});
  }
  const close=()=>{const d=document.getElementById('photoDlg');if(d?.open)(typeof closeAppDialog==='function'?closeAppDialog(d):d.close());};
  async function show(){
    const big=document.getElementById('photoBig'),id=view.ids[view.i];big.classList.add('is-loading');big.classList.remove('is-zoomed');
    document.getElementById('photoCount').textContent=view.ids.length>1?`${view.i+1} / ${view.ids.length}`:'';
    document.getElementById('photoCaption').textContent=view.box?(view.i===0?'封面':'第 '+(view.i+1)+' 张'):view.caption;
    big.alt=view.caption?view.caption+' · 第 '+(view.i+1)+' 张':'用餐照片 '+(view.i+1);
    document.querySelectorAll('#photoDlg .mp-nav').forEach(b=>b.hidden=view.ids.length<2);
    const tools=document.querySelector('#photoDlg .mp-tools');tools.hidden=!view.box;
    if(view.box){tools.querySelector('[data-photo-act="cover"]').disabled=view.i===0;tools.querySelector('[data-photo-act="left"]').disabled=view.i===0;tools.querySelector('[data-photo-act="right"]').disabled=view.i>=view.ids.length-1;}
    const u=await url(id,true).catch(()=>'');if(view.ids[view.i]!==id)return;big.src=u;big.onload=()=>big.classList.remove('is-loading');
  }
  function step(d){if(view.ids.length<2)return;view.i=(view.i+d+view.ids.length)%view.ids.length;show();}
  function act(kind){
    const box=view.box;if(!box?.isConnected)return close();const id=view.ids[view.i],li=box.querySelector(`[data-photo-tile="${CSS.escape(id)}"]`);if(!li)return;
    if(kind==='remove'){removeTile(box,li);view.ids=editIDs(box);if(!view.ids.length)return close();view.i=Math.min(view.i,view.ids.length-1);return show();}
    const to=kind==='cover'?0:kind==='left'?view.i-1:view.i+1;
    if(moveTile(box,li,to)){view.ids=editIDs(box);view.i=view.ids.indexOf(id);say(box,to===0?'已设为封面':`已移到第 ${view.i+1} 张`);show();}
  }
  function openViewer(ids,i,caption,box){ensureViewer();view={ids,i,caption,box:box||null};const d=document.getElementById('photoDlg');if(!d.open)(typeof showAppDialog==='function'?showAppDialog(d):d.showModal());show();}

  // Drag to reorder inside an editor: mouse/pen start after a small move, touch after a long press.
  let drag=null,suppressClick=0;
  function dragStart(){
    const d=drag;d.active=true;const r=d.li.getBoundingClientRect();d.rect=r;
    const g=d.li.cloneNode(true);g.classList.add('mp-ghost');g.removeAttribute('data-photo-tile');g.querySelectorAll('[data-photo-remove],.mp-cover').forEach(x=>x.remove());
    g.style.cssText=`position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;margin:0;z-index:10000;pointer-events:none`;
    (d.li.closest('dialog')||document.body).appendChild(g);const gr=g.getBoundingClientRect();if(Math.abs(gr.left-r.left)>1||Math.abs(gr.top-r.top)>1){g.style.left=(2*r.left-gr.left)+'px';g.style.top=(2*r.top-gr.top)+'px';}d.ghost=g;d.li.classList.add('is-placeholder');d.box.classList.add('is-sorting');
    try{navigator.vibrate?.(12);}catch(e){}
  }
  function dragMove(x,y){
    const d=drag;d.ghost.style.transform=`translate(${x-d.x0}px,${y-d.y0}px) scale(1.06)`;
    const grid=d.li.parentNode,g=grid.getBoundingClientRect();// layout boxes, ignoring the FLIP transforms still running
    const over=[...d.box.querySelectorAll('[data-photo-tile]')].find(t=>{if(t===d.li)return false;const l=g.left+t.offsetLeft-grid.offsetLeft,tp=g.top+t.offsetTop-grid.offsetTop;return x>=l&&x<=l+t.offsetWidth&&y>=tp&&y<=tp+t.offsetHeight;});
    if(over)moveTile(d.box,d.li,editIDs(d.box).indexOf(over.dataset.photoTile));
  }
  function dragEnd(){
    const d=drag;drag=null;if(!d)return;clearTimeout(d.timer);if(!d.active)return;
    d.ghost?.remove();d.li.classList.remove('is-placeholder');d.box.classList.remove('is-sorting');suppressClick=performance.now()+120;
    const i=editIDs(d.box).indexOf(d.li.dataset.photoTile);if(i!==d.from)say(d.box,i===0?'已设为封面':`已移到第 ${i+1} 张`);
  }

  function bind(){
    new MutationObserver(()=>hydrate()).observe(document.body,{childList:true,subtree:true});hydrate();
    document.addEventListener('change',async e=>{
      const input=e.target.closest?.('[data-photo-input]');if(!input)return;
      const box=input.closest('.mp-edit'),form=input.closest('.visit-form'),u=form?.dataset.u||'',files=[...input.files];input.value='';
      const room=MAX-editIDs(box).length;if(files.length>room&&typeof toast==='function')toast(`每次用餐最多 ${MAX} 张，已添加前 ${Math.max(0,room)} 张`);
      const grid=box.querySelector('.mp-grid'),addTile=box.querySelector('.mp-add-tile'),todo=files.slice(0,Math.max(0,room));
      // Fill an empty meal date from the first photo's capture date.
      const date=form?.querySelector('input[type=date]');
      if(date&&!date.value&&todo.length){const d=(await Promise.all(todo.slice(0,3).map(takenDate))).find(Boolean);
        if(d&&!date.value){date.value=d;const lab=date.closest('label');lab?.querySelector('.mp-date-note')?.remove();lab?.insertAdjacentHTML('beforeend','<small class="mp-date-note">已按照片拍摄日期填写，可修改</small>');}}
      const phs=todo.map(()=>{const ph=document.createElement('li');ph.className='mp-tile is-pending';ph.innerHTML='<span class="mp-spin"></span>';grid.insertBefore(ph,addTile);return ph;});
      let n=0;for(const [k,f] of todo.entries()){
        const ph=phs[k];say(box,`正在处理照片 ${k+1}/${todo.length}`);ph.setAttribute('aria-label',`正在处理照片 ${k+1}/${todo.length}`);
        try{const id=await add(f,u);ph.outerHTML=tile(id,0,true);n++;}catch(err){ph.remove();if(typeof toast==='function')toast(err.message||'照片保存失败，请检查存储空间');}
        refreshEditor(box);
      }
      if(n)say(box,`已添加 ${n} 张照片`);
      if(form&&typeof upVisitDirty==='function')upVisitDirty(form);
    });
    document.addEventListener('click',e=>{
      if(performance.now()<suppressClick&&e.target.closest('.mp-edit')){e.preventDefault();e.stopPropagation();return;}
      const un=e.target.closest('[data-photo-undo]');if(un){undoRemove(un.closest('.mp-edit'),un.closest('.mp-undo'));return;}
      const rm=e.target.closest('[data-photo-remove]');
      if(rm){removeTile(rm.closest('.mp-edit'),rm.closest('.mp-tile'));return;}
      const op=e.target.closest('[data-photo-open]');if(!op)return;
      const strip=op.closest('[data-photos-view]'),box=op.closest('.mp-edit');const ids=strip?strip.dataset.photosView.split(','):box?editIDs(box):[];if(!ids.length)return;
      const log=op.closest('.meal-log'),r=log&&typeof DB!=='undefined'?DB.byU[log.dataset.u]:null,card=op.closest('.meal-card'),date=card?.querySelector('.meal-date b')?.textContent||'',year=card?.querySelector('.meal-date span')?.textContent||'';
      openViewer(ids,+op.dataset.photoOpen||0,[r?(r.zh||r.n):'',/^\d{4}$/.test(year)?year+'.'+date:''].filter(Boolean).join(' · '),box);
    },true);
    // Keyboard reordering: Alt + ← / → on a focused photo.
    document.addEventListener('keydown',e=>{
      const op=e.target.closest?.('.mp-edit .mp-open');if(!op||!e.altKey||!/^Arrow(Left|Right)$/.test(e.key))return;e.preventDefault();
      const box=op.closest('.mp-edit'),li=op.closest('[data-photo-tile]'),i=editIDs(box).indexOf(li.dataset.photoTile),to=i+(e.key==='ArrowLeft'?-1:1);
      if(moveTile(box,li,to)){li.querySelector('.mp-open').focus();say(box,to===0?'已设为封面':`已移到第 ${to+1} 张`);}
    });
    document.addEventListener('pointerdown',e=>{
      const li=e.target.closest?.('.mp-edit [data-photo-tile]');if(!li||e.target.closest('.mp-remove')||e.button>0)return;
      const box=li.closest('.mp-edit');if(editIDs(box).length<2)return;
      drag={li,box,x0:e.clientX,y0:e.clientY,touch:e.pointerType==='touch',active:false,from:editIDs(box).indexOf(li.dataset.photoTile),timer:0};
      if(drag.touch)drag.timer=setTimeout(()=>{if(drag&&!drag.active)dragStart();},280);
    });
    document.addEventListener('pointermove',e=>{
      if(!drag)return;const dist=Math.hypot(e.clientX-drag.x0,e.clientY-drag.y0);
      if(!drag.active){if(drag.touch){if(dist>10){clearTimeout(drag.timer);drag=null;}return;}if(dist<6)return;dragStart();}
      dragMove(e.clientX,e.clientY);
    });
    document.addEventListener('touchmove',e=>{if(drag?.active&&e.cancelable)e.preventDefault();},{passive:false});
    document.addEventListener('pointerup',dragEnd);document.addEventListener('pointercancel',dragEnd);
    document.addEventListener('contextmenu',e=>{if(e.target.closest?.('.mp-edit [data-photo-tile]'))e.preventDefault();});
    document.addEventListener('close',e=>{if(e.target.tagName==='DIALOG'&&e.target.id!=='photoDlg'&&e.target.querySelector('.mp-edit'))gc();},true);
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
  return {MAX,clean,editorHTML,cardHTML,editIDs,hydrate,gc,bind,add,takenDate,moveTile,exportAll,importAll,openViewer,_get:get,_keys:keys};
})();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>MP.bind());else MP.bind();

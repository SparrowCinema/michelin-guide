/* Personal travel postcards: real local records, generated artwork, client-side PNG export. */
const PASSPORT_SHARE={page:0,rows:[],pages:1,file:null,url:'',generation:0,art:null};
function upShareRows(){
  const trip=upTrip($('shareScope').value),from=$('shareFrom').value,to=$('shareTo').value;
  return DB.rows.filter(r=>favOf(r.u)===2&&(!trip||trip.items.includes(r.u))).filter(r=>{
    const date=PERSONAL.records[r.u]?.date||'';return (!from||date>=from)&&(!to||(date&&date<=to));
  }).sort((a,b)=>(PERSONAL.records[b.u]?.date||'').localeCompare(PERSONAL.records[a.u]?.date||'')||(FAV[b.u]?.[1]||0)-(FAV[a.u]?.[1]||0));
}
function upShareArt(){
  if(!PASSPORT_SHARE.art)PASSPORT_SHARE.art=new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>{PASSPORT_SHARE.art=null;resolve(null);};img.src='assets/passport-share-art.webp';});
  return PASSPORT_SHARE.art;
}
function upShareLines(ctx,text,width,max=2){
  const lines=[];let line='';
  for(const char of Array.from(text)){if(line&&ctx.measureText(line+char).width>width){lines.push(line);line=char;}else line+=char;}
  if(line)lines.push(line);
  if(lines.length>max){lines.length=max;let last=lines[max-1];while(last&&ctx.measureText(last+'…').width>width)last=last.slice(0,-1);lines[max-1]=last+'…';}
  return lines;
}
function upShareStars(ctx,value,x,y){
  ctx.save();for(let i=0;i<5;i++){
    const px=x+i*25,path=new Path2D();
    for(let j=0;j<10;j++){const angle=-Math.PI/2+j*Math.PI/5,r=j%2?5:11,xx=px+Math.cos(angle)*r,yy=y+Math.sin(angle)*r;j?path.lineTo(xx,yy):path.moveTo(xx,yy);}path.closePath();
    ctx.strokeStyle='#c9b9a9';ctx.lineWidth=1.2;ctx.stroke(path);ctx.save();ctx.beginPath();ctx.rect(px-12,y-12,24*Math.max(0,Math.min(1,value-i)),24);ctx.clip();ctx.fillStyle='#852d37';ctx.fill(path);ctx.restore();
  }ctx.restore();
}
async function upRenderShare(){
  const state=PASSPORT_SHARE,token=++state.generation;
  state.file=null;$('saveShare').disabled=true;$('nativeShare').disabled=true;
  const from=$('shareFrom').value,to=$('shareTo').value;
  if(from&&to&&from>to){$('shareStatus').textContent='结束日期不能早于开始日期';$('sharePreview').hidden=true;$('shareEmpty').hidden=false;return;}
  const rows=upShareRows();state.rows=rows;state.pages=Math.max(1,Math.ceil(rows.length/5));state.page=Math.min(state.page,state.pages-1);
  $('sharePrev').disabled=state.page===0;$('shareNext').disabled=state.page===state.pages-1;
  $('sharePage').textContent=`${state.page+1} / ${state.pages}`;$('sharePagination').hidden=state.pages===1;
  $('shareStatus').textContent=rows.length?`共 ${rows.length} 家到访餐厅${state.pages>1?'，分为 '+state.pages+' 张图片':''}`:'还没有这段旅行的到访记录。先标记“去过”，再来生成分享卡。';
  $('shareEmpty').hidden=!!rows.length;
  if(!rows.length){$('sharePreview').hidden=true;return;}
  const [art]=await Promise.all([upShareArt(),document.fonts?.ready]);if(token!==state.generation)return;
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1620;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#f6eddf';ctx.fillRect(0,0,1080,1620);if(art)ctx.drawImage(art,0,0,1080,1620);
  // A translucent paper panel keeps every real record readable over the illustration.
  ctx.fillStyle='rgba(255,251,243,.94)';ctx.beginPath();ctx.roundRect(46,58,988,1088,10);ctx.fill();
  ctx.strokeStyle='#bda58b';ctx.lineWidth=1;ctx.strokeRect(65,76,950,1052);
  ctx.textBaseline='alphabetic';ctx.fillStyle='#852d37';ctx.font='500 21px Georgia, serif';ctx.fillText('FOOD PASSPORT  /  TRAVEL JOURNAL',102,142);
  const title=($('shareTitle').value.trim()||'我的味觉旅行').slice(0,32);
  ctx.fillStyle='#342720';ctx.font='600 65px "Songti SC", "Noto Serif CJK SC", serif';
  upShareLines(ctx,title,870,2).forEach((line,i)=>ctx.fillText(line,100,237+i*78));
  const trip=upTrip($('shareScope').value),dates=rows.map(r=>PERSONAL.records[r.u]?.date).filter(Boolean).sort();
  const period=from||to?`${from||'最早记录'} — ${to||'最近记录'}`:dates.length?`${dates[0]}${dates[0]===dates[dates.length-1]?'':' — '+dates[dates.length-1]}`:'收藏每一次与世界的相遇';
  ctx.font='22px sans-serif';ctx.fillStyle='#8e7b69';ctx.fillText(period,103,350);
  const countries=new Set(rows.map(r=>r.co)),cities=new Set(rows.map(r=>r.ci));
  [[countries.size,'国家 / 地区'],[cities.size,'到访城市'],[rows.length,'去过的餐厅']].forEach(([n,label],i)=>{const x=104+i*310;ctx.font='52px Georgia, serif';ctx.fillStyle='#852d37';ctx.fillText(String(n).padStart(2,'0'),x,427);ctx.font='20px sans-serif';ctx.fillStyle='#8b7765';ctx.fillText(label,x,461);});
  ctx.strokeStyle='#d8c8b5';ctx.beginPath();ctx.moveTo(102,492);ctx.lineTo(978,492);ctx.stroke();
  ctx.font='22px sans-serif';ctx.fillStyle='#65513f';
  const scope=trip?trip.name:[...countries].map(co=>DB.C[co][0]).join(' · ');
  upShareLines(ctx,scope,870,1).forEach(line=>ctx.fillText(line,104,535));
  rows.slice(state.page*5,state.page*5+5).forEach((r,i)=>{
    const y=596+i*104,rec=PERSONAL.records[r.u]||{};
    ctx.fillStyle='#aa8d75';ctx.font='17px Georgia, serif';ctx.fillText(String(state.page*5+i+1).padStart(2,'0'),104,y);
    ctx.fillStyle='#342720';ctx.font='600 32px "Songti SC", "Noto Serif CJK SC", serif';
    const lines=upShareLines(ctx,r.zh||r.n,665,2);lines.forEach((line,j)=>ctx.fillText(line,150,y+j*35));
    ctx.font='18px sans-serif';ctx.fillStyle='#897461';const meta=[DB.T[r.ci][0],rec.date].filter(Boolean).join(' · ');ctx.fillText(upShareLines(ctx,meta,665,1)[0],150,y+(lines.length>1?65:31));
    if(rec.rating){upShareStars(ctx,rec.rating,842,y-9);ctx.font='18px Georgia, serif';ctx.fillStyle='#852d37';ctx.fillText(String(rec.rating),963,y+25);}
    if(i<4){ctx.strokeStyle='#e5d8c8';ctx.beginPath();ctx.moveTo(150,y+83);ctx.lineTo(973,y+83);ctx.stroke();}
  });
  ctx.fillStyle='#6b4232';ctx.font='italic 36px Georgia, serif';ctx.fillText('A world of taste.',104,1100);ctx.font='17px sans-serif';ctx.textAlign='right';ctx.fillText(`${String(state.page+1).padStart(2,'0')} / ${String(state.pages).padStart(2,'0')}`,973,1099);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(token!==state.generation||!blob)return;
  if(state.url)URL.revokeObjectURL(state.url);state.url=URL.createObjectURL(blob);state.file=new File([blob],`美食护照-${state.page+1}.png`,{type:'image/png'});
  $('sharePreview').src=state.url;$('sharePreview').hidden=false;$('saveShare').disabled=false;
  $('nativeShare').hidden=!(navigator.share&&navigator.canShare?.({files:[state.file]}));$('nativeShare').disabled=false;
  $('saveShare').textContent=state.pages>1?'保存本页图片':'保存图片';
}
function upOpenShare(scope=''){
  const sel=$('shareScope');sel.innerHTML='<option value="">全部到访记录</option>'+PERSONAL.trips.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');sel.value=scope;
  $('shareTitle').value=upTrip(scope)?.name||'我的味觉旅行';$('shareFrom').value='';$('shareTo').value='';PASSPORT_SHARE.page=0;
  $('passportShareDlg').showModal();upRenderShare();
}
function upInitShare(){
  document.body.insertAdjacentHTML('beforeend',`<dialog id="passportShareDlg" aria-labelledby="shareHeading"><div class="share-header"><div><p>PERSONAL TRAVEL JOURNAL</p><h2 id="shareHeading">把旅程，寄给朋友。</h2></div><button type="button" class="close" data-close>关闭</button></div><div class="share-layout"><div class="share-editor"><label>卡片标题<input id="shareTitle" maxlength="32" placeholder="我的味觉旅行"></label><label>分享哪段旅程<select id="shareScope"></select></label><details><summary>选择用餐日期范围</summary><div class="share-dates"><label>开始<input id="shareFrom" type="date"></label><label>结束<input id="shareTo" type="date"></label></div></details><p class="share-note">分享已去过的餐厅、评分和日期。私人笔记留在你的护照里。</p><p id="shareStatus" role="status" aria-live="polite"></p><div class="share-pagination" id="sharePagination" hidden><button type="button" id="sharePrev" aria-label="上一张分享卡">←</button><span id="sharePage"></span><button type="button" id="shareNext" aria-label="下一张分享卡">→</button></div><div class="share-actions"><button type="button" id="saveShare" class="btn primary" disabled>保存图片</button><button type="button" id="nativeShare" class="btn" disabled hidden>分享图片</button></div></div><div class="share-preview"><div id="shareEmpty" class="share-empty"><span>A WORLD OF TASTE</span><b>把下一餐，<br>写进旅程。</b><p>你的味觉旅行，<br>从第一枚到访印记开始。</p></div><img id="sharePreview" alt="个人美食旅行记录分享卡" hidden></div></div></dialog>`);
  document.addEventListener('click',e=>{const b=e.target.closest('[data-passport-share],[data-share-trip]');if(b)upOpenShare(b.dataset.shareTrip||'');});
  $('passportShareDlg').addEventListener('click',e=>{if(e.target===$('passportShareDlg')||e.target.closest('[data-close]'))$('passportShareDlg').close();});
  ['shareTitle','shareScope','shareFrom','shareTo'].forEach(id=>$(id).addEventListener(id==='shareTitle'?'input':'change',()=>{PASSPORT_SHARE.page=0;upRenderShare();}));
  $('sharePrev').onclick=()=>{PASSPORT_SHARE.page--;upRenderShare();};$('shareNext').onclick=()=>{PASSPORT_SHARE.page++;upRenderShare();};
  $('saveShare').onclick=()=>{if(!PASSPORT_SHARE.file)return;const a=document.createElement('a');a.href=PASSPORT_SHARE.url;a.download=PASSPORT_SHARE.file.name;document.body.appendChild(a);a.click();a.remove();toast('✓ 图片已生成，可保存或发送给朋友');};
  $('nativeShare').onclick=()=>{const file=PASSPORT_SHARE.file;if(file)navigator.share({files:[file],title:$('shareTitle').value}).catch(e=>{if(e.name!=='AbortError')toast('请点“保存图片”后分享');});};
  $('passportShareDlg').addEventListener('close',()=>{PASSPORT_SHARE.generation++;if(PASSPORT_SHARE.url)URL.revokeObjectURL(PASSPORT_SHARE.url);PASSPORT_SHARE.url='';PASSPORT_SHARE.file=null;});
}

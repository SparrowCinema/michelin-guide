/* Separate, measured print layouts. Private notes never enter exported images. */
const PASSPORT_SHARE={kind:'passport',page:0,rows:[],pages:1,file:null,url:'',generation:0,art:null,mapRows:[],tiles:new Map()};
function upShareBaseRows(){const trip=upTrip($('shareScope').value);return PASSPORT_SHARE.kind==='map'?(trip?upRows(trip.id):PASSPORT_SHARE.mapRows):DB.rows.filter(r=>favOf(r.u)===2&&(!trip||trip.items.includes(r.u)));}
function upShareVisits(r){const from=$('shareFrom').value,to=$('shareTo').value;return upVisits(r.u).filter(v=>PASSPORT_SHARE.kind==='map'||(!from||v.date>=from)&&(!to||(v.date&&v.date<=to)));}
function upShareRecord(r){const visits=upShareVisits(r).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));return {...(visits[0]||PERSONAL.records[r.u]||{}),count:visits.length};}
function upShareRows(){
  const from=$('shareFrom').value,to=$('shareTo').value,city=$('shareCity').value;
  return upShareBaseRows().filter(r=>!city||String(r.ci)===city).filter(r=>PASSPORT_SHARE.kind==='map'||!(from||to)||upShareVisits(r).length).sort((a,b)=>PASSPORT_SHARE.kind==='map'?a.ci-b.ci||a.l-b.l:(upShareRecord(b).date||'').localeCompare(upShareRecord(a).date||'')||(FAV[b.u]?.[1]||0)-(FAV[a.u]?.[1]||0));
}
function upShareArt(){if(!PASSPORT_SHARE.art)PASSPORT_SHARE.art=new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src='assets/passport-share-art.webp';});return PASSPORT_SHARE.art;}
function upShareLines(ctx,text,width,max=2){
  const lines=[];let line='';const words=String(text||'').match(/[A-Za-z0-9]+(?:[’'.,:/-][A-Za-z0-9]+)*|[^\x00-\x7F]|\s+|./gu)||[];
  for(const word of words){if(line&&ctx.measureText(line+word).width>width){lines.push(line.trimEnd());line='';}if(ctx.measureText(word).width>width){for(const ch of word){if(line&&ctx.measureText(line+ch).width>width){lines.push(line);line='';}line+=ch;}}else line+=line?word:word.trimStart();}
  if(line.trim())lines.push(line.trimEnd());if(lines.length>max){lines.length=max;let last=lines[max-1];while(last&&ctx.measureText(last+'…').width>width)last=last.slice(0,-1);lines[max-1]=last.trimEnd()+'…';}return lines;
}
function upShareText(ctx,text,x,y,width,size=24,max=2,color='#302d29',family='sans-serif',weight='400'){
  ctx.fillStyle=color;ctx.font=`${weight} ${size}px ${family}`;const lines=upShareLines(ctx,text,width,max);lines.forEach((line,i)=>ctx.fillText(line,x,y+size+i*size*1.4));return y+lines.length*size*1.4;
}
function upShareRule(ctx,y){ctx.strokeStyle='#d4c8b8';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(76,y);ctx.lineTo(1004,y);ctx.stroke();}
function upShareTile(z,x,y){const key=[z,x,y].join('/'),cache=PASSPORT_SHARE.tiles;if(cache.has(key))return cache.get(key);const promise=new Promise(resolve=>{const img=new Image();let done=false;const finish=v=>{if(done)return;done=true;clearTimeout(timer);resolve(v);};const timer=setTimeout(()=>finish(null),6000);img.crossOrigin='anonymous';img.onload=()=>finish(img);img.onerror=()=>finish(null);img.src=`https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`;});promise.then(img=>{if(!img&&cache.get(key)===promise)cache.delete(key);});cache.set(key,promise);if(cache.size>120)cache.delete(cache.keys().next().value);return promise;}
async function upShareMap(ctx,rows,current,box){
  const [bx,by,bw,bh]=box,valid=rows.filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lng)&&Math.abs(r.lat)<=85&&Math.abs(r.lng)<=180);
  ctx.fillStyle='#e8e9df';ctx.fillRect(bx,by,bw,bh);
  if(!valid.length){upShareText(ctx,'暂无可定位的餐厅',bx+35,by+bh/2-20,bw-70,28,1,'#6f776b');return '无坐标';}
  const lngs=valid.map(r=>(r.lng+360)%360).sort((a,b)=>a-b);let gap=-1,start=lngs[0];for(let i=0;i<lngs.length;i++){const next=lngs[(i+1)%lngs.length]+(i===lngs.length-1?360:0),g=next-lngs[i];if(g>gap){gap=g;start=next%360;}}
  const points=valid.map(r=>{let lng=(r.lng+360)%360;if(lng<start)lng+=360;const sin=Math.sin(r.lat*Math.PI/180);return {r,x:(lng+180)/360,y:.5-Math.log((1+sin)/(1-sin))/(4*Math.PI)};});
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const zoom=Math.max(1,Math.min(15,Math.floor(Math.log2(Math.min((bw-120)/(256*Math.max(maxX-minX,1e-7)),(bh-120)/(256*Math.max(maxY-minY,1e-7))))))),world=256*2**zoom,cx=(minX+maxX)/2*world,cy=(minY+maxY)/2*world,left=cx-bw/2,top=cy-bh/2;
  const jobs=[];for(let tx=Math.floor(left/256);tx<=Math.floor((left+bw)/256);tx++)for(let ty=Math.floor(top/256);ty<=Math.floor((top+bh)/256);ty++)if(ty>=0&&ty<2**zoom)jobs.push({x:tx,y:ty,tile:upShareTile(zoom,((tx%2**zoom)+2**zoom)%2**zoom,ty)});
  const loaded=await Promise.all(jobs.map(async j=>({...j,img:await j.tile}))),complete=loaded.length&&loaded.every(j=>j.img);
  ctx.save();ctx.beginPath();ctx.rect(bx,by,bw,bh);ctx.clip();
  if(complete){for(const j of loaded)ctx.drawImage(j.img,bx+j.x*256-left,by+j.y*256-top,256,256);ctx.fillStyle='#fff8e71c';ctx.fillRect(bx,by,bw,bh);}else{ctx.strokeStyle='#cbd1c4';ctx.lineWidth=1;for(let x=0;x<bw;x+=90){ctx.beginPath();ctx.moveTo(bx+x,by);ctx.lineTo(bx+x,by+bh);ctx.stroke();}for(let y=0;y<bh;y+=90){ctx.beginPath();ctx.moveTo(bx,by+y);ctx.lineTo(bx+bw,by+y);ctx.stroke();}}
  for(const p of points){const x=bx+p.x*world-left,y=by+p.y*world-top;ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fillStyle='#9f7770';ctx.fill();}
  const cities=new Set(),placed=[];
  for(const p of points){
    const number=current.findIndex(r=>r.u===p.r.u);if(number<0)continue;
    const ax=bx+p.x*world-left,ay=by+p.y*world-top;let x=ax,y=ay;
    const offsets=[[0,0],...[48,72,96].flatMap(radius=>Array.from({length:8},(_,i)=>[Math.sin(i*Math.PI/4)*radius,Math.cos(i*Math.PI/4)*radius]))];
    for(const [dx,dy] of offsets){const px=Math.max(bx+26,Math.min(bx+bw-26,ax+dx)),py=Math.max(by+26,Math.min(by+bh-60,ay+dy));if(placed.every(q=>Math.hypot(px-q.x,py-q.y)>=46)){x=px;y=py;break;}}
    placed.push({x,y});if(Math.hypot(x-ax,y-ay)>3){ctx.strokeStyle='#782e3b';ctx.lineWidth=1.5;ctx.beginPath();const distance=Math.hypot(x-ax,y-ay),inset=placed.slice(0,-1).some(q=>Math.hypot(ax-q.x,ay-q.y)<24)?22:0;ctx.moveTo(ax+(x-ax)/distance*inset,ay+(y-ay)/distance*inset);ctx.lineTo(x,y);ctx.stroke();}
    ctx.beginPath();ctx.arc(x,y,19,0,Math.PI*2);ctx.fillStyle='#782e3b';ctx.fill();ctx.strokeStyle='#fff8ec';ctx.lineWidth=3;ctx.stroke();ctx.font='600 19px sans-serif';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText(String(PASSPORT_SHARE.page*3+number+1),x,y+7);ctx.textAlign='left';
    const city=DB.T[p.r.ci][0];if(!cities.has(city)){cities.add(city);ctx.font='18px sans-serif';const width=Math.min(220,ctx.measureText(city).width+18),lx=Math.min(bx+bw-width-8,Math.max(bx+8,x+26)),ly=Math.max(by+28,Math.min(by+bh-42,y-12));ctx.fillStyle='#fffaf0ed';ctx.fillRect(lx-5,ly-22,width,30);upShareText(ctx,city,lx,ly-22,width-10,18,1,'#4d5148');}
  }
  ctx.restore();ctx.fillStyle='#fffaf0ee';ctx.fillRect(bx,by+bh-28,bw,28);upShareText(ctx,complete?'地图 © Esri · HERE · Garmin · OpenStreetMap contributors':'餐厅位置示意图 · 底图暂不可用 · 非导航底图',bx+12,by+bh-25,bw-24,14,1,'#62685d');return complete?'地图已加载':'底图暂不可用，已使用真实坐标位置示意图';
}
async function upRenderShare(){
  const state=PASSPORT_SHARE,token=++state.generation,map=state.kind==='map';state.file=null;$('saveShare').disabled=true;$('nativeShare').disabled=true;
  const from=$('shareFrom').value,to=$('shareTo').value;
  if(!map&&from&&to&&from>to){$('shareStatus').textContent='结束日期不能早于开始日期';$('sharePreview').hidden=true;$('shareEmpty').hidden=false;return;}
  const rows=upShareRows(),per=map?3:4;state.rows=rows;state.pages=Math.max(1,Math.ceil(rows.length/per));state.page=Math.min(state.page,state.pages-1);
  $('sharePrev').disabled=state.page===0;$('shareNext').disabled=state.page===state.pages-1;$('sharePage').textContent=`${state.page+1} / ${state.pages}`;$('sharePagination').hidden=state.pages===1;
  $('shareStatus').textContent=rows.length?`共 ${rows.length} 家餐厅 · ${state.pages} 张图片${map?' · 正在绘制地图…':''}`:map?'这个范围暂无餐厅，换一份旅行清单试试。':'还没有这段旅行的到访记录。先标记“去过”，再来生成分享卡。';
  $('shareEmpty').hidden=!!rows.length;$('sharePreview').hidden=true;if(!rows.length)return;
  const [art]=await Promise.all([upShareArt(),document.fonts?.ready]);if(token!==state.generation)return;
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=map?1200+Math.min(3,rows.length-state.page*3)*240:1620;const ctx=canvas.getContext('2d'),height=canvas.height;
  ctx.fillStyle='#f9f5ec';ctx.fillRect(0,0,1080,height);ctx.textBaseline='alphabetic';
  ctx.fillStyle='#782e3b';ctx.fillRect(0,0,1080,14);
  upShareText(ctx,map?'THE TRAVEL ATLAS  /  美食旅行地图':'FOOD PASSPORT  /  我的味觉旅行',76,65,928,20,1,'#782e3b','sans-serif','500');
  let y=upShareText(ctx,($('shareTitle').value.trim()||'我的味觉旅行').slice(0,32),72,125,936,62,2,'#302d29','"Songti SC", "Noto Serif CJK SC", serif','600')+18;
  const dates=rows.flatMap(r=>upShareVisits(r).map(v=>v.date)).filter(Boolean).sort(),trip=upTrip($('shareScope').value);
  const period=map?(trip?trip.name:'地图当前范围')+' · '+( $('shareCity').selectedOptions[0]?.textContent||'全部城市'):from||to?`${from||'最早记录'} — ${to||'最近记录'}`:dates.length?dates[0]+(dates.length>1&&dates[0]!==dates.at(-1)?' — '+dates.at(-1):''):'每一餐，都是一段旅程';
  y=upShareText(ctx,period,76,y,928,21,1,'#847465')+24;
  const countries=new Set(rows.map(r=>r.co)),cities=new Set(rows.map(r=>r.ci));
  [[countries.size,'国家 / 地区'],[cities.size,'旅行城市'],[rows.length,map?'计划餐厅':'到访餐厅']].forEach(([n,label],i)=>{const x=76+i*320;upShareText(ctx,String(n).padStart(2,'0'),x,y,280,48,1,'#782e3b','Georgia, serif');upShareText(ctx,label,x,y+65,280,19,1,'#847465');});y+=117;upShareRule(ctx,y);y+=28;
  const current=rows.slice(state.page*per,state.page*per+per);let mapStatus='';
  if(map){mapStatus=await upShareMap(ctx,rows,current,[76,y,928,420]);if(token!==state.generation)return;y+=452;upShareText(ctx,'RESTAURANT DOSSIER / 餐厅档案',76,y,928,20,1,'#782e3b');y+=52;}
  current.forEach((r,i)=>{
    const start=y,rec=upShareRecord(r),number=state.page*per+i+1;
    upShareText(ctx,String(number).padStart(2,'0'),76,y+3,60,22,1,'#9d8470','Georgia, serif');
    y=upShareText(ctx,r.zh||r.n,145,y,rec.rating&&!map?650:850,34,2,'#302d29','"Songti SC", "Noto Serif CJK SC", serif','600');
    if(rec.rating&&!map){ctx.textAlign='right';upShareText(ctx,`${rec.rating} / 5`,1000,start+1,170,29,1,'#782e3b','Georgia, serif');upShareText(ctx,'我的评分',1000,start+45,170,15,1,'#847465');ctx.textAlign='left';}
    const meta=map?[DB.C[r.co][0],DB.T[r.ci][0],LVN[r.l],r.cu].filter(Boolean).join(' · '):[DB.C[r.co][0],DB.T[r.ci][0],rec.count>1?rec.count+' 次到访':'',rec.date||'日期未填写'].filter(Boolean).join(' · ');
    y=upShareText(ctx,meta,145,y+9,850,20,1,'#847465');
    if(map){y=upShareText(ctx,r.a||'暂无地址',145,y+6,850,19,2,'#68675f');y=upShareText(ctx,favOf(r.u)===2?'已到访'+(rec.count>1?' '+rec.count+' 次':'')+(rec.date?' · '+rec.date:'')+(rec.rating?' · 我的评分 '+rec.rating+' / 5':''):'旅行计划 · 尚未标记去过',145,y+7,850,19,1,'#782e3b');}
    y=Math.max(y+24,start+(map?206:166));upShareRule(ctx,y);y+=26;
  });
  // Artwork lives in its own footer band, never under names, dates or ratings.
  const footer=map?height-100:Math.max(y+12,1240);
  if(!map&&art){ctx.save();ctx.beginPath();ctx.rect(0,footer+60,1080,height-footer-60);ctx.clip();ctx.drawImage(art,0,art.height*.65,art.width,art.height*.35,0,footer+60,1080,height-footer-60);ctx.restore();}
  upShareText(ctx,'A world of taste.',76,map?height-66:footer-5,650,26,1,'#782e3b','Georgia, serif');ctx.textAlign='right';upShareText(ctx,`${String(state.page+1).padStart(2,'0')} / ${String(state.pages).padStart(2,'0')}`,1004,map?height-62:footer-2,200,18,1,'#847465');ctx.textAlign='left';
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(token!==state.generation||!blob)return;if(state.url)URL.revokeObjectURL(state.url);state.url=URL.createObjectURL(blob);state.file=new File([blob],`${map?'旅行地图与档案':'美食护照'}-${state.page+1}.png`,{type:'image/png'});
  $('sharePreview').src=state.url;$('sharePreview').alt=map?'旅行地图与餐厅档案分享图':'个人美食旅行记录分享卡';$('sharePreview').hidden=false;$('saveShare').disabled=false;$('nativeShare').hidden=!(navigator.share&&navigator.canShare?.({files:[state.file]}));$('nativeShare').disabled=false;$('saveShare').textContent=state.pages>1?'保存本页高清图片':'保存高清图片';$('shareStatus').textContent=`共 ${rows.length} 家餐厅 · ${state.pages} 张图片${map?' · '+mapStatus:''}`;
}
function upShareMode(kind){PASSPORT_SHARE.kind=kind;PASSPORT_SHARE.page=0;document.querySelectorAll('[data-share-kind]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.shareKind===kind));$('shareDateOptions').hidden=kind==='map';$('shareCityField').hidden=kind!=='map';$('shareNote').textContent=kind==='map'?'导出真实地图与餐厅档案，包含计划餐厅；地图编号与本页档案对应。':'导出到访餐厅、评分和日期。私人笔记不会出现在图片中。';$('shareScope').options[0].text=kind==='map'?'地图当前范围':'全部到访记录';upShareCities();upRenderShare();}
function upShareCities(){const city=$('shareCity'),selected=city.value,ids=[...new Set(upShareBaseRows().map(r=>r.ci))];city.innerHTML='<option value="">全部城市</option>'+ids.map(ci=>`<option value="${ci}">${esc(DB.T[ci][0])}</option>`).join('');if(ids.some(ci=>String(ci)===selected))city.value=selected;}
function upOpenShare(scope='',kind='passport'){
  PASSPORT_SHARE.mapRows=S.v==='map'&&MAP.ready?listRows():filtered();const sel=$('shareScope');sel.innerHTML='<option value="">全部到访记录</option>'+PERSONAL.trips.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');sel.value=scope;$('shareTitle').value=upTrip(scope)?.name||(kind==='map'?'我的美食旅行地图':'我的味觉旅行');$('shareFrom').value='';$('shareTo').value='';$('shareCity').value='';$('shareSettings').open=matchMedia('(min-width: 701px)').matches;showAppDialog($('passportShareDlg'));upShareMode(kind);
}
function upInitShare(){
  document.body.insertAdjacentHTML('beforeend',`<dialog id="passportShareDlg" aria-labelledby="shareHeading"><div class="share-header"><div><p>YOUR JOURNEY, BEAUTIFULLY KEPT</p><h2 id="shareHeading">分享我的旅行</h2></div><button type="button" class="close" data-close>关闭</button></div><div class="share-mode-bar"><div class="share-kind" role="group" aria-label="分享图片类型"><button type="button" data-share-kind="passport" aria-pressed="true">护照记录</button><button type="button" data-share-kind="map" aria-pressed="false">地图与档案</button></div></div><div class="share-layout"><div class="share-editor"><details id="shareSettings" class="share-settings" open><summary>调整标题、旅程和日期</summary><div class="share-fields"><label>卡片标题<input id="shareTitle" maxlength="32" placeholder="我的味觉旅行"></label><label>分享哪段旅程<select id="shareScope"></select></label><label id="shareCityField" hidden>地图城市<select id="shareCity"><option value="">全部城市</option></select></label><details id="shareDateOptions"><summary>选择用餐日期范围</summary><div class="share-dates"><label>开始<input id="shareFrom" type="date"></label><label>结束<input id="shareTo" type="date"></label></div></details><p class="share-note" id="shareNote"></p></div></details><p id="shareStatus" role="status" aria-live="polite"></p><div class="share-pagination" id="sharePagination" hidden><button type="button" id="sharePrev" aria-label="上一张分享卡">←</button><span id="sharePage"></span><button type="button" id="shareNext" aria-label="下一张分享卡">→</button></div></div><div class="share-preview"><div id="shareEmpty" class="share-empty"><span>A WORLD OF TASTE</span><b>把下一餐，<br>写进旅程。</b><p>从第一枚到访印记开始，<br>收集你的旅行故事。</p></div><img id="sharePreview" alt="个人美食旅行记录分享卡" hidden></div></div><div class="share-actions"><span>PNG 高清图片 · 长按预览也可保存</span><button type="button" id="saveShare" class="btn primary" disabled>保存高清图片</button><button type="button" id="nativeShare" class="btn" disabled hidden>分享图片</button></div></dialog>`);
  document.addEventListener('click',e=>{const b=e.target.closest('[data-passport-share],[data-share-trip],[data-share-map],[data-share-trip-map]');if(b)upOpenShare(b.dataset.shareTrip||b.dataset.shareTripMap||(b.hasAttribute('data-share-map')?S.trip:'')||'',b.hasAttribute('data-share-map')||b.hasAttribute('data-share-trip-map')?'map':'passport');});
  $('passportShareDlg').addEventListener('click',e=>{if(e.target===$('passportShareDlg')||e.target.closest('[data-close]'))closeAppDialog($('passportShareDlg'));const mode=e.target.closest('[data-share-kind]');if(mode)upShareMode(mode.dataset.shareKind);});
  ['shareTitle','shareScope','shareFrom','shareTo','shareCity'].forEach(id=>$(id).addEventListener(id==='shareTitle'?'input':'change',()=>{PASSPORT_SHARE.page=0;if(id==='shareScope')upShareCities();upRenderShare();}));
  $('sharePrev').onclick=()=>{PASSPORT_SHARE.page--;upRenderShare();};$('shareNext').onclick=()=>{PASSPORT_SHARE.page++;upRenderShare();};
  $('saveShare').onclick=()=>{if(!PASSPORT_SHARE.file)return;const a=document.createElement('a');a.href=PASSPORT_SHARE.url;a.download=PASSPORT_SHARE.file.name;document.body.appendChild(a);a.click();a.remove();toast('✓ 高清图片已生成');};
  $('nativeShare').onclick=()=>{const file=PASSPORT_SHARE.file;if(file)navigator.share({files:[file],title:$('shareTitle').value}).catch(e=>{if(e.name!=='AbortError')toast('请点“保存高清图片”后分享');});};
  $('passportShareDlg').addEventListener('close',()=>{PASSPORT_SHARE.generation++;if(PASSPORT_SHARE.url)URL.revokeObjectURL(PASSPORT_SHARE.url);PASSPORT_SHARE.url='';PASSPORT_SHARE.file=null;});
}

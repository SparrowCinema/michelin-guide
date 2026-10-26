/* 我的米其林结算：one long PNG of the restaurants I have been to — footprint map, stats and every visit.
   Only restaurants marked 去过 are used; private notes never enter the image. */
const PASSPORT_SHARE={rows:[],file:null,url:'',generation:0,tiles:new Map()};
const RECAP_QR=["11111110010000001011101111111","10000010110110110100001000001","10111010011100110001101011101","10111010110101100101001011101","10111010001011001111001011101","10000010101000111010101000001","11111110101010101010101111111","00000000000010000000000000000","11111011111011110100010101010","10010100110001001001101110001","10010010010110011000110000000","11110100111100110010111011010","01011011110111100101000101100","10000000001011001111111110001","01100011110001111010101111100","00111001011100011010101010010","01111011011111000100000001100","10100001100111001001101110101","10011111000000111000000010100","10111100001000101001101010010","11110110001011100101111110111","00000000111100000010100011111","11111110100011111111101011100","10000010000000101011100010001","10111010101011100110111110101","10111010111100101111000101111","10111010100000111100111111110","10000010100010110010110101010","11111110110111100101001011100"]; // https://sparrowcinema.github.io/michelin-guide/ (verified by decoding)
const RECAP_C={bg:'#f7f2ea',paper:'#fffdf9',ink:'#1d1a17',ink2:'#57514a',ink3:'#8c857b',line:'#e7dfd2',dark:'#1e1416',cream:'#f7efe3',gold:'#d6a24c',red:'#a3242b',wash:'#f6e6e3',
  lv:['#6e0f15','#a3242b','#d4564d','#b9780a','#8f8a84']};
const RECAP_SANS='"PingFang SC","Hiragino Sans GB","Noto Sans SC","Noto Sans CJK SC","Microsoft YaHei",system-ui,sans-serif',RECAP_SERIF='"Songti SC","Noto Serif SC","Noto Serif CJK SC","STSong",serif',RECAP_NUM='Georgia,"Times New Roman",serif';
function upShareVisits(r){const from=$('shareFrom').value,to=$('shareTo').value;return upVisits(r.u).filter(v=>(!from||(v.date&&v.date>=from))&&(!to||(v.date&&v.date<=to)));}
function upShareRecord(r){const visits=upShareVisits(r).slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));const rated=visits.filter(v=>v.rating);
  return {...(visits[0]||PERSONAL.records[r.u]||{}),count:visits.length,best:rated.length?Math.max(...rated.map(v=>v.rating)):0};}
// Same country → city → level order as the directory, so map numbers read naturally down the list.
function upShareRows(){
  const trip=upTrip($('shareScope').value),from=$('shareFrom').value,to=$('shareTo').value;
  return DB.rows.filter(r=>favOf(r.u)===2&&(!trip||trip.items.includes(r.u))&&(!(from||to)||upShareVisits(r).length));
}
function upShareLines(ctx,text,width,max=2){
  const lines=[];let line='';const words=String(text||'').match(/[A-Za-z0-9]+(?:[’'.,:/-][A-Za-z0-9]+)*|[^\x00-\x7F]|\s+|./gu)||[];
  for(const word of words){if(line&&ctx.measureText(line+word).width>width){lines.push(line.trimEnd());line='';}if(ctx.measureText(word).width>width){for(const ch of word){if(line&&ctx.measureText(line+ch).width>width){lines.push(line);line='';}line+=ch;}}else line+=line?word:word.trimStart();}
  if(line.trim())lines.push(line.trimEnd());if(lines.length>max){lines.length=max;let last=lines[max-1];while(last&&ctx.measureText(last+'…').width>width)last=last.slice(0,-1);lines[max-1]=last.trimEnd()+'…';}return lines;
}
function upShareTile(z,x,y){const key=[z,x,y].join('/'),cache=PASSPORT_SHARE.tiles;if(cache.has(key))return cache.get(key);const promise=new Promise(resolve=>{const img=new Image();let done=false;const finish=v=>{if(done)return;done=true;clearTimeout(timer);resolve(v);};const timer=setTimeout(()=>finish(null),6000);img.crossOrigin='anonymous';img.onload=()=>finish(img);img.onerror=()=>finish(null);img.src=`https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`;});promise.then(img=>{if(!img&&cache.get(key)===promise)cache.delete(key);});cache.set(key,promise);if(cache.size>160)cache.delete(cache.keys().next().value);return promise;}
// Web-Mercator framing of all visited points; picks the shortest longitude span so Tokyo + Bangkok + Paris stays compact.
function upRecapFrame(rows,bw,bh){
  const valid=rows.filter(r=>Number.isFinite(r.lat)&&Number.isFinite(r.lng)&&Math.abs(r.lat)<=85);if(!valid.length)return null;
  const lngs=valid.map(r=>(r.lng+360)%360).sort((a,b)=>a-b);let gap=-1,start=lngs[0];for(let i=0;i<lngs.length;i++){const next=lngs[(i+1)%lngs.length]+(i===lngs.length-1?360:0),g=next-lngs[i];if(g>gap){gap=g;start=next%360;}}
  const pts=valid.map(r=>{let lng=(r.lng+360)%360;if(lng<start)lng+=360;const sin=Math.sin(r.lat*Math.PI/180);return {r,x:(lng+180)/360,y:.5-Math.log((1+sin)/(1-sin))/(4*Math.PI)};});
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const zoom=Math.max(1,Math.min(15,Math.floor(Math.log2(Math.min((bw-140)/(256*Math.max(maxX-minX,1e-7)),(bh-140)/(256*Math.max(maxY-minY,1e-7))))))),world=256*2**zoom;
  return {pts,zoom,world,left:(minX+maxX)/2*world-bw/2,top:(minY+maxY)/2*world-bh/2};
}
async function upRecapTiles(frame,bw,bh){
  if(!frame)return null;const {zoom,left,top}=frame,n=2**zoom,jobs=[];
  for(let tx=Math.floor(left/256);tx<=Math.floor((left+bw)/256);tx++)for(let ty=Math.floor(top/256);ty<=Math.floor((top+bh)/256);ty++)if(ty>=0&&ty<n)jobs.push({x:tx,y:ty,tile:upShareTile(zoom,((tx%n)+n)%n,ty)});
  const loaded=await Promise.all(jobs.map(async j=>({...j,img:await j.tile})));return loaded.length&&loaded.every(j=>j.img)?loaded:null;
}
function upRecapStats(rows){
  const visits=rows.flatMap(r=>upShareVisits(r)),rated=visits.filter(v=>v.rating),lv=[0,0,0,0,0];rows.forEach(r=>lv[r.l]++);
  const dates=visits.map(v=>v.date).filter(Boolean).sort();
  return {n:rows.length,meals:Math.max(visits.length,rows.length),stars:lv[0]*3+lv[1]*2+lv[2],avg:rated.length?Math.round(rated.reduce((s,v)=>s+v.rating,0)/rated.length*10)/10:0,lv,
    countries:new Set(rows.map(r=>r.co)).size,cities:new Set(rows.map(r=>r.ci)).size,first:dates[0]||'',last:dates.at(-1)||''};
}
function upRecapHighlights(rows){
  const recs=rows.map(r=>({r,rec:upShareRecord(r)})),out=[];
  const best=recs.filter(x=>x.rec.best).sort((a,b)=>b.rec.best-a.rec.best||a.r.l-b.r.l)[0];if(best)out.push(['我的最高分',best.r,`★ ${best.rec.best}`]);
  const most=recs.filter(x=>x.rec.count>1).sort((a,b)=>b.rec.count-a.rec.count)[0];if(most)out.push(['去得最多',most.r,`${most.rec.count} 次`]);
  const top=recs.slice().sort((a,b)=>a.r.l-b.r.l)[0];if(top&&top.r.l<=2&&top.r!==best?.r)out.push(['星级最高',top.r,LVN[top.r.l]]);
  const latest=recs.filter(x=>x.rec.date).sort((a,b)=>b.rec.date.localeCompare(a.rec.date))[0];if(latest&&out.length<3&&!out.some(o=>o[1]===latest.r))out.push(['最近一次',latest.r,latest.rec.date.replaceAll('-','.')]);
  return out.slice(0,3);
}
// Two passes like the IDF recap: measure the full height first, then draw once — one long image, no pages.
async function upDrawRecap(rows){
  const W=1080,P=72,C=RECAP_C,MAPW=W-2*P,MAPH=Math.min(760,Math.max(560,Math.round(MAPW*.66)));
  const st=upRecapStats(rows),hl=upRecapHighlights(rows),trip=upTrip($('shareScope').value),from=$('shareFrom').value,to=$('shareTo').value;
  const title=($('shareTitle').value.trim()||'我的米其林结算').slice(0,24);
  const frame=upRecapFrame(rows,MAPW,MAPH),tiles=await upRecapTiles(frame,MAPW,MAPH);
  const number=new Map(rows.map((r,i)=>[r.u,i+1]));
  const cv=document.createElement('canvas'),ctx=cv.getContext('2d');
  const run=draw=>{
    let y=0;const F=(sz,w,fam)=>ctx.font=`${w||400} ${sz}px ${fam||RECAP_SANS}`;
    const tx=(s,x,yy,col,al)=>{if(!draw)return;ctx.fillStyle=col;ctx.textAlign=al||'left';ctx.fillText(s,x,yy);ctx.textAlign='left';};
    const rr=(x,yy,w,h,r,fill,stroke)=>{if(!draw)return;ctx.beginPath();ctx.roundRect?ctx.roundRect(x,yy,w,h,r):ctx.rect(x,yy,w,h);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}};
    const rule=(x,yy,w,col)=>{if(draw){ctx.fillStyle=col||C.line;ctx.fillRect(x,yy,w,2);}};
    const lvLabel=l=>l<3?'★'.repeat(3-l)+' '+LVN[l]:LVN[l];
    // Michelin distinction badge (三星 / 二星 / 一星 / 必比登 / 入选) in the same colour as the map pin
    const badge=(l,x,yy,size=22)=>{F(size,700);const label=lvLabel(l),w=ctx.measureText(label).width+size*1.2,h=size*1.75;rr(x,yy,w,h,h/2,l<4?C.lv[l]:C.paper,l<4?null:C.lv[4]);tx(label,x+size*.6,yy+h*.69,l<4?'#fff':C.ink2);return w;};
    // header band
    const span=from||to?`${(from||'最早').replaceAll('-','.')} – ${(to||'至今').replaceAll('-','.')}`:st.first?`${st.first.replaceAll('-','.')}${st.last&&st.last!==st.first?' – '+st.last.replaceAll('-','.'):''}`:'';
    const ts=title.length>9?72:92;F(ts,700,RECAP_SERIF);const tl=upShareLines(ctx,title,W-2*P,2),tb=P+40+ts,sub=tb+(tl.length-1)*(ts+12)+72,HH=sub+66;
    if(draw){ctx.fillStyle=C.dark;ctx.fillRect(0,0,W,HH);ctx.fillStyle=C.red;ctx.fillRect(P,HH-8,140,8);}
    F(24,600);tx('MICHELIN GUIDE · 米其林全球名录',P,P+28,C.gold);
    F(ts,700,RECAP_SERIF);tl.forEach((l,i)=>tx(l,P,tb+i*(ts+12),C.cream));
    F(27,400);tx(upShareLines(ctx,[trip&&!title.includes(trip.name)?trip.name:'',span,`${st.countries} 个国家和地区 · ${st.cities} 座城市`].filter(Boolean).join('  ·  '),W-2*P,1)[0]||'',P,sub,'#c9bfb2');
    y=HH+56;
    // stats
    const stats=[[st.n,'家餐厅'],[st.meals,'次用餐'],[st.stars,'颗米其林星'],[st.avg?st.avg.toFixed(1):'—','我的平均分']],cw=(W-2*P-3*20)/4;
    stats.forEach((a,i)=>{const x=P+i*(cw+20);rr(x,y,cw,156,22,C.paper,C.line);F(66,700,RECAP_NUM);tx(String(a[0]),x+cw/2,y+90,i===3?C.red:C.ink,'center');F(24,500);tx(a[1],x+cw/2,y+130,C.ink3,'center');});
    y+=156+28;
    // level chips
    let cx=P;F(24,500);LVN.forEach((name,l)=>{if(!st.lv[l])return;const label=`${name} ${st.lv[l]}`,w=ctx.measureText(label).width+52;rr(cx,y,w,48,24,C.paper,C.line);if(draw){ctx.beginPath();ctx.arc(cx+22,y+24,7,0,Math.PI*2);ctx.fillStyle=C.lv[l];ctx.fill();}F(24,500);tx(label,cx+36,y+33,C.ink2);cx+=w+12;});
    y+=48+64;
    // footprint map
    const cityMode=!!frame&&st.cities>1;F(40,700,RECAP_SERIF);tx('我的足迹地图',P,y+38,C.ink);F(22,500);tx(cityMode?`${st.cities} 座城市 · 圆点里是去过的家数`:`共 ${rows.length} 家 · 编号对应下方餐厅`,W-P,y+36,C.ink3,'right');y+=68;
    const bx=P,by=y;rr(bx,by,MAPW,MAPH,26,'#e9eadf');
    if(draw&&frame){
      ctx.save();ctx.beginPath();ctx.roundRect?ctx.roundRect(bx,by,MAPW,MAPH,26):ctx.rect(bx,by,MAPW,MAPH);ctx.clip();
      if(tiles){for(const j of tiles)ctx.drawImage(j.img,bx+j.x*256-frame.left,by+j.y*256-frame.top,256,256);ctx.fillStyle='#fffaf024';ctx.fillRect(bx,by,MAPW,MAPH);}
      else{ctx.strokeStyle='#d3d7ca';ctx.lineWidth=1;for(let gx=0;gx<MAPW;gx+=90){ctx.beginPath();ctx.moveTo(bx+gx,by);ctx.lineTo(bx+gx,by+MAPH);ctx.stroke();}for(let gy=0;gy<MAPH;gy+=90){ctx.beginPath();ctx.moveTo(bx,by+gy);ctx.lineTo(bx+MAPW,by+gy);ctx.stroke();}}
      const placed=[],free=(px,py,r)=>placed.every(q=>Math.hypot(px-q.x,py-q.y)>=r+q.r+6);
      const spot=(ax,ay,r)=>{const offsets=[[0,0],...[1,1.6,2.3,3.1].flatMap(k=>Array.from({length:12},(_,i)=>[Math.sin(i*Math.PI/6)*r*2*k,Math.cos(i*Math.PI/6)*r*2*k]))];
        for(const [dx,dy] of offsets){const px=Math.max(bx+r+8,Math.min(bx+MAPW-r-8,ax+dx)),py=Math.max(by+r+8,Math.min(by+MAPH-r-44,ay+dy));if(free(px,py,r))return [px,py];}return [ax,ay];};
      const leader=(ax,ay,x,yy,col)=>{if(Math.hypot(x-ax,yy-ay)<4)return;ctx.strokeStyle=col;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(x,yy);ctx.stroke();ctx.beginPath();ctx.arc(ax,ay,5,0,Math.PI*2);ctx.fillStyle=col;ctx.fill();};
      const pin=(x,yy,r,col,label)=>{ctx.beginPath();ctx.arc(x,yy,r,0,Math.PI*2);ctx.fillStyle=col;ctx.fill();ctx.strokeStyle='#fffaf2';ctx.lineWidth=4;ctx.stroke();F(Math.round(r*.95),700);ctx.textAlign='center';ctx.fillStyle='#fff';ctx.fillText(label,x,yy+r*.34);ctx.textAlign='left';};
      const boxes=[];
      const tag=(text,x,yy,r)=>{F(21,600);const w=ctx.measureText(text).width+22,h=34;
        // try right, left, above, below (then wider rings) and keep clear of every pin and earlier label
        const cands=[[x+r+8,yy-h/2],[x-r-8-w,yy-h/2],[x-w/2,yy-r-8-h],[x-w/2,yy+r+8],[x+r+8,yy-r-h],[x+r+8,yy+r],[x-r-8-w,yy-r-h],[x-r-8-w,yy+r]];
        const hit=(lx,ly)=>lx<bx+6||lx+w>bx+MAPW-6||ly<by+6||ly+h>by+MAPH-40||placed.some(q=>q.x+q.r>lx-2&&q.x-q.r<lx+w+2&&q.y+q.r>ly-2&&q.y-q.r<ly+h+2)||boxes.some(b2=>b2.x<lx+w+4&&b2.x+b2.w>lx-4&&b2.y<ly+h+4&&b2.y+b2.h>ly-4);
        let [lx,ly]=cands.find(([a,b2])=>!hit(a,b2))||cands[0];lx=Math.max(bx+6,Math.min(bx+MAPW-6-w,lx));ly=Math.max(by+6,Math.min(by+MAPH-40-h,ly));boxes.push({x:lx,y:ly,w,h});
        ctx.fillStyle='#fffaf2f0';ctx.beginPath();ctx.roundRect?ctx.roundRect(lx,ly,w,h,9):ctx.rect(lx,ly,w,h);ctx.fill();ctx.fillStyle=C.ink;ctx.fillText(text,lx+11,ly+24);};
      if(cityMode){
        // one circle per city: size by count, colour by the best distinction there
        const cities=new Map();for(const p of frame.pts){const k=p.r.ci;if(!cities.has(k))cities.set(k,{n:0,x:0,y:0,best:4});const c=cities.get(k);c.n++;c.x+=p.x;c.y+=p.y;c.best=Math.min(c.best,p.r.l);}
        const list=[...cities].map(([ci,c])=>({ci,n:c.n,best:c.best,ax:bx+c.x/c.n*frame.world-frame.left,ay:by+c.y/c.n*frame.world-frame.top,r:22+Math.min(18,(c.n-1)*3)})).sort((a,b)=>b.n-a.n);
        const pos=list.map(c=>{const [x,yy]=spot(c.ax,c.ay,c.r);placed.push({x,y:yy,r:c.r});return {...c,x,y:yy};});
        pos.forEach(c=>leader(c.ax,c.ay,c.x,c.y,C.lv[c.best]));pos.forEach(c=>pin(c.x,c.y,c.r,C.lv[c.best],String(c.n)));pos.forEach(c=>tag(DB.T[c.ci][0],c.x,c.y,c.r));
      }else{
        const pts=frame.pts.slice().sort((a,b)=>number.get(a.r.u)-number.get(b.r.u)).map(p=>{const ax=bx+p.x*frame.world-frame.left,ay=by+p.y*frame.world-frame.top,[x,yy]=spot(ax,ay,19);placed.push({x,y:yy,r:19});return {p,ax,ay,x,y:yy};});
        pts.forEach(o=>leader(o.ax,o.ay,o.x,o.y,C.lv[o.p.r.l]));pts.forEach(o=>pin(o.x,o.y,19,C.lv[o.p.r.l],String(number.get(o.p.r.u))));
      }
      ctx.fillStyle='#fffaf2e6';ctx.fillRect(bx,by+MAPH-34,MAPW,34);F(15,400);ctx.fillStyle=C.ink3;ctx.fillText(tiles?'地图 © Esri · HERE · Garmin · OpenStreetMap contributors':'位置示意图 · 底图暂不可用，点位为真实坐标',bx+16,by+MAPH-12);
      ctx.restore();
    }else if(draw){F(26,500);tx('这些餐厅暂无坐标',bx+MAPW/2,by+MAPH/2,C.ink3,'center');}
    y+=MAPH+22;
    {let lx=P;F(20,500);LVN.forEach((name,l)=>{if(!st.lv[l])return;if(draw){ctx.beginPath();ctx.arc(lx+9,y+14,9,0,Math.PI*2);ctx.fillStyle=C.lv[l];ctx.fill();}F(20,500);tx(lvLabel(l),lx+26,y+21,C.ink2);lx+=ctx.measureText(lvLabel(l)).width+58;});}
    y+=70;
    // highlights
    if(hl.length){F(40,700,RECAP_SERIF);tx('这一路的高光',P,y+38,C.ink);y+=72;const hw=(W-2*P-(hl.length-1)*20)/hl.length;let hh=0;
      hl.forEach(([label,r,val],i)=>{const x=P+i*(hw+20);F(32,700,RECAP_SERIF);const nl=upShareLines(ctx,r.zh||r.n,hw-44,2);hh=Math.max(hh,200+nl.length*42);});
      hl.forEach(([label,r,val],i)=>{const x=P+i*(hw+20);rr(x,y,hw,hh,22,i===0?C.wash:C.paper,C.line);F(22,600);tx(label,x+22,y+42,C.red);F(32,700,RECAP_SERIF);const nl=upShareLines(ctx,r.zh||r.n,hw-44,2);nl.forEach((l,k)=>tx(l,x+22,y+92+k*42,C.ink));badge(r.l,x+22,y+hh-104,19);F(22,500);tx(`${DB.T[r.ci][0]} · ${val}`,x+22,y+hh-28,C.ink3);});
      y+=hh+70;}
    // every restaurant, grouped by country and city; numbers match the map
    F(40,700,RECAP_SERIF);tx('到访清单',P,y+38,C.ink);y+=78;
    let lastCo=-1,lastCi=-1;
    rows.forEach(r=>{
      if(r.co!==lastCo){if(lastCo!==-1)y+=18;F(34,700,RECAP_SERIF);tx(DB.C[r.co][0],P,y+34,C.ink);const n=rows.filter(x=>x.co===r.co).length;F(22,500);tx(`${n} 家`,W-P,y+32,C.ink3,'right');y+=52;rule(P,y,W-2*P,C.ink);y+=8;lastCo=r.co;lastCi=-1;}
      if(r.ci!==lastCi){F(24,600);tx(DB.T[r.ci][0],P,y+38,C.red);y+=54;lastCi=r.ci;}
      const rec=upShareRecord(r),x0=P+76,mw=W-P-x0-170,y0=y;
      if(draw){ctx.beginPath();ctx.arc(P+24,y+30,22,0,Math.PI*2);ctx.fillStyle=C.lv[r.l];ctx.fill();}F(19,700);tx(String(number.get(r.u)),P+24,y+37,'#fff','center');
      F(32,700,RECAP_SERIF);const nl=upShareLines(ctx,r.zh||r.n,mw,2);nl.forEach((l,k)=>tx(l,x0,y+38+k*42,C.ink));y+=nl.length*42;
      if(r.zh&&r.zh!==r.n){F(20,400);tx(upShareLines(ctx,r.n,mw,1)[0]||'',x0,y+24,C.ink3);y+=30;}
      y+=10;const bw=badge(r.l,x0,y,20);F(21,500);const meta=[r.cu,rec.count>1?`${rec.count} 次用餐`:'',rec.date?'最近 '+rec.date.replaceAll('-','.'):''].filter(Boolean).join('  ·  ');
      tx(upShareLines(ctx,meta,mw-bw-16,1)[0]||'',x0+bw+16,y+25,C.ink2);y+=46;
      // my score pill
      const val=rec.best?String(rec.best):'—',on=!!rec.best;F(30,700,RECAP_NUM);const vw=ctx.measureText(val).width;F(19,500);const lw=ctx.measureText('我的评分').width;const pw=Math.max(vw,lw)+40;
      rr(W-P-pw,y0+6,pw,78,18,on?C.wash:C.paper,on?'#e8c4bf':C.line);F(19,500);tx('我的评分',W-P-pw/2,y0+34,C.ink3,'center');F(30,700,RECAP_NUM);tx(val,W-P-pw/2,y0+70,on?C.red:C.ink3,'center');
      y=Math.max(y,y0+92)+14;rule(x0,y,W-P-x0);y+=16;
    });
    // footer: QR + credits, same as the IDF recap
    y+=50;rule(P,y,W-2*P);y+=44;
    const QS=196,qn=RECAP_QR.length,cell=Math.floor((QS-24)/qn),qw=cell*qn,qx=W-P-QS,qy=y,lw=W-2*P-QS-36;
    rr(qx,qy,QS,QS,18,'#ffffff',C.line);if(draw){ctx.fillStyle=C.ink;const o=(QS-qw)/2;for(let i=0;i<qn;i++)for(let j=0;j<qn;j++)if(RECAP_QR[i][j]==='1')ctx.fillRect(qx+o+j*cell,qy+o+i*cell,cell,cell);}
    F(20,500);tx('扫码打开米其林名录',qx+QS/2,qy+QS+32,C.ink3,'center');
    let ly=y+30;F(30,700);tx('麻雀映画 × Claude',P,ly,C.ink);ly+=42;F(26,600);tx('米其林全球名录',P,ly,C.ink2);ly+=40;
    F(22,500,'ui-monospace,"SF Mono",Menlo,monospace');tx('sparrowcinema.github.io/michelin-guide',P,ly,C.red);ly+=46;
    F(20,400);upShareLines(ctx,`星级以 ${DB.updated||''} 的米其林名单为准 · 我的评分满分 5 星 · 私人笔记不会出现在图中 · 与米其林官方无关`,lw,3).forEach(l=>{tx(l,P,ly,C.ink3);ly+=30;});
    return Math.max(ly,qy+QS+32)+P-10;
  };
  cv.width=W;cv.height=10;const H=Math.ceil(run(false));
  // iOS Safari refuses canvases above ~16.7 M pixels; very long recaps are scaled down instead of failing.
  const scale=Math.min(1,Math.sqrt(16e6/(W*H)));cv.width=Math.floor(W*scale);cv.height=Math.floor(H*scale);ctx.setTransform(scale,0,0,scale,0,0);
  ctx.fillStyle=C.bg;ctx.fillRect(0,0,W,H);ctx.textBaseline='alphabetic';run(true);
  return {canvas:cv,mapStatus:!frame?'无坐标':tiles?'地图已加载':'底图暂不可用，已用真实坐标画位置示意图'};
}
async function upRenderShare(){
  const state=PASSPORT_SHARE,token=++state.generation;state.file=null;$('saveShare').disabled=true;$('nativeShare').disabled=true;
  const from=$('shareFrom').value,to=$('shareTo').value;
  if(from&&to&&from>to){$('shareStatus').textContent='结束日期不能早于开始日期';$('sharePreview').hidden=true;$('shareEmpty').hidden=false;return;}
  const rows=upShareRows();state.rows=rows;
  $('shareStatus').textContent=rows.length?`共 ${rows.length} 家去过的餐厅 · 正在生成结算长图…`:upTrip($('shareScope').value)?'这份旅行里还没有去过的餐厅。吃过后点“去过”，就能生成结算图。':'这段时间还没有到访记录。先在餐厅里点“去过”，再来生成结算图。';
  $('shareEmpty').hidden=!!rows.length;$('sharePreview').hidden=true;if(!rows.length)return;
  await document.fonts?.ready;if(token!==state.generation)return;
  const {canvas,mapStatus}=await upDrawRecap(rows);if(token!==state.generation)return;
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(token!==state.generation||!blob)return;
  if(state.url)URL.revokeObjectURL(state.url);state.url=URL.createObjectURL(blob);state.file=new File([blob],'我的米其林结算.png',{type:'image/png'});
  $('sharePreview').src=state.url;$('sharePreview').alt='我的米其林结算长图：足迹地图、统计和到访清单';$('sharePreview').hidden=false;
  $('saveShare').disabled=false;$('nativeShare').hidden=!(navigator.share&&navigator.canShare?.({files:[state.file]}));$('nativeShare').disabled=false;
  $('shareStatus').textContent=`共 ${rows.length} 家去过的餐厅 · 一张长图 · ${mapStatus}`;
}
function upOpenShare(scope=''){
  const sel=$('shareScope');sel.innerHTML='<option value="">全部到访记录</option>'+PERSONAL.trips.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');sel.value=scope;
  $('shareTitle').value=upTrip(scope)?.name?upTrip(scope).name+' · 米其林结算':'我的米其林结算';$('shareFrom').value='';$('shareTo').value='';
  document.querySelectorAll('[data-recap-range]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.recapRange==='all'));
  showAppDialog($('passportShareDlg'));upRenderShare();
}
function upRecapRange(kind){
  const y=new Date().getFullYear();const set=(a,b)=>{$('shareFrom').value=a;$('shareTo').value=b;};
  if(kind==='all')set('','');if(kind==='this')set(`${y}-01-01`,`${y}-12-31`);if(kind==='last')set(`${y-1}-01-01`,`${y-1}-12-31`);
  document.querySelectorAll('[data-recap-range]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.recapRange===kind));
}
function upInitShare(){
  const y=new Date().getFullYear();
  document.body.insertAdjacentHTML('beforeend',`<dialog id="passportShareDlg" class="recap-dlg" aria-labelledby="shareHeading"><div class="share-header"><div><p>MY MICHELIN RECAP</p><h2 id="shareHeading">我的米其林结算地图</h2></div><button type="button" class="close" data-close>关闭</button></div><div class="share-layout"><div class="share-editor"><label>标题<input id="shareTitle" maxlength="24" placeholder="我的米其林结算"></label><label>范围<select id="shareScope"></select></label><div class="recap-range" role="group" aria-label="时间范围"><button type="button" data-recap-range="all" aria-pressed="true">全部</button><button type="button" data-recap-range="this" aria-pressed="false">${y} 年</button><button type="button" data-recap-range="last" aria-pressed="false">${y-1} 年</button><button type="button" data-recap-range="custom" aria-pressed="false">自定义</button></div><div class="share-dates" id="shareDateOptions" hidden><label>开始<input id="shareFrom" type="date"></label><label>结束<input id="shareTo" type="date"></label></div><p class="share-note">只包含你标记“去过”的餐厅。地图上的编号和下方到访清单一一对应，私人笔记不会出现在图中。</p><p id="shareStatus" role="status" aria-live="polite"></p></div><div class="share-preview recap-preview"><div id="shareEmpty" class="share-empty"><span>MY MICHELIN RECAP</span><b>把下一餐，<br>写进你的结算。</b><p>在餐厅里点“去过”打个分，<br>这里会生成你的米其林长图。</p></div><img id="sharePreview" alt="我的米其林结算长图" hidden></div></div><div class="share-actions"><span>PNG 长图 · 长按预览也可保存</span><button type="button" id="saveShare" class="btn primary" disabled>保存长图</button><button type="button" id="nativeShare" class="btn" disabled hidden>分享</button></div></dialog>`);
  document.addEventListener('click',e=>{const b=e.target.closest('[data-passport-share],[data-share-trip]');if(b)upOpenShare(b.dataset.shareTrip||'');});
  $('passportShareDlg').addEventListener('click',e=>{if(e.target===$('passportShareDlg')||e.target.closest('[data-close]'))closeAppDialog($('passportShareDlg'));
    const r=e.target.closest('[data-recap-range]');if(r){const k=r.dataset.recapRange;$('shareDateOptions').hidden=k!=='custom';if(k!=='custom'){upRecapRange(k);upRenderShare();}else document.querySelectorAll('[data-recap-range]').forEach(b=>b.setAttribute('aria-pressed',b===r));}});
  let t;$('shareTitle').addEventListener('input',()=>{clearTimeout(t);t=setTimeout(upRenderShare,350);});
  ['shareScope','shareFrom','shareTo'].forEach(id=>$(id).addEventListener('change',upRenderShare));
  $('saveShare').onclick=()=>{if(!PASSPORT_SHARE.file)return;const a=document.createElement('a');a.href=PASSPORT_SHARE.url;a.download=PASSPORT_SHARE.file.name;document.body.appendChild(a);a.click();a.remove();toast('✓ 长图已保存');};
  $('nativeShare').onclick=()=>{const file=PASSPORT_SHARE.file;if(file)navigator.share({files:[file],title:$('shareTitle').value}).catch(e=>{if(e.name!=='AbortError')toast('请点“保存长图”后分享');});};
  $('passportShareDlg').addEventListener('close',()=>{PASSPORT_SHARE.generation++;if(PASSPORT_SHARE.url)URL.revokeObjectURL(PASSPORT_SHARE.url);PASSPORT_SHARE.url='';PASSPORT_SHARE.file=null;});
}

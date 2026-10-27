/* Trip route planner: order one city's restaurants into a short path, split it into days,
   and show the distance between consecutive stops. Pure geometry, no map service needed. */
const MGRoute=(()=>{
  'use strict';
  const R=6371;
  const rad=d=>d*Math.PI/180;
  function km(a,b){const dLat=rad(b.lat-a.lat),dLng=rad(b.lng-a.lng),h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));}
  const pathLen=(p,start)=>p.reduce((t,x,i)=>t+(i?km(p[i-1],x):start?km(start,x):0),0);
  // Nearest neighbour from every possible start (or the given start), then 2-opt; good enough for a trip list.
  function order(points,start){
    const n=points.length;if(n<3&&!start)return points.slice();
    // Greedy walk from `from`; when `from` is a stop it opens the path, when it is the user's position it is not part of it.
    const greedy=(from,first)=>{const left=points.filter(x=>x!==first),out=first?[first]:[];let cur=from;
      while(left.length){let bi=0,bd=Infinity;left.forEach((q,i)=>{const d=km(cur,q);if(d<bd){bd=d;bi=i;}});cur=left.splice(bi,1)[0];out.push(cur);}return out;};
    let best=null,bestLen=Infinity;
    const starts=start?[null]:points.length<=12?points:points.filter((_,i)=>i%Math.ceil(points.length/5)===0);
    for(const s of starts){
      let p=start?greedy(start,null):greedy(s,s);
      for(let r=0;r<6;r++){const before=pathLen(p,start);p=points.length>35?twoOpt(p,start):orOpt(twoOpt(p,start),start);if(pathLen(p,start)>=before-1e-9)break;}const len=pathLen(p,start);if(len<bestLen){best=p;bestLen=len;}
    }
    return best;
  }
  // Move each stop (or pair of stops) to the position that shortens the path most.
  function orOpt(p,start){
    let best=pathLen(p,start);
    for(let seg=1;seg<=2;seg++)for(let i=0;i+seg<=p.length;i++){
      const piece=p.slice(i,i+seg),rest=p.slice(0,i).concat(p.slice(i+seg));
      for(let j=0;j<=rest.length;j++){if(j===i)continue;
        for(const pc of seg>1?[piece,piece.slice().reverse()]:[piece]){
          const q=rest.slice(0,j).concat(pc,rest.slice(j)),len=pathLen(q,start);if(len+1e-9<best){p=q;best=len;}}}
    }
    return p;
  }
  function twoOpt(p,start){
    let improved=true,guard=0;const pt=i=>i<0?start:p[i];
    while(improved&&guard++<200){improved=false;
      for(let i=start?0:1;i<p.length-1;i++)for(let k=i+1;k<p.length;k++){
        const a=pt(i-1),b=p[i],c=p[k],d=p[k+1];if(!a)continue;
        const before=km(a,b)+(d?km(c,d):0),after=km(a,c)+(d?km(b,d):0);
        if(after+1e-9<before){p=p.slice(0,i).concat(p.slice(i,k+1).reverse(),p.slice(k+1));improved=true;}
      }}
    return p;
  }
  // Road distance is longer than a straight line; 1.3× is a common rough factor in cities.
  function leg(a,b){const straight=km(a,b),road=straight*1.3;
    const walk=road<=2.2,min=walk?Math.round(road/4.8*60):Math.round(road/22*60+6);
    return {km:straight,road,walk,min:Math.max(1,min)};}
  function plan(points,{perDay=2,start=null}={}){
    const path=order(points,start),days=[];
    for(let i=0;i<path.length;i+=perDay)days.push(path.slice(i,i+perDay));
    return days.map((stops,d)=>{const legs=stops.slice(1).map((s,i)=>leg(stops[i],s));
      const first=d===0&&start?leg(start,stops[0]):null;
      return {stops,legs,first,road:legs.reduce((t,l)=>t+l.road,0)+(first?first.road:0)};});
  }
  const fmtKm=v=>v<1?Math.round(v*1000/10)*10+' 米':v.toFixed(v<10?1:0)+' 公里';
  const fmtMin=m=>m<60?m+' 分钟':Math.floor(m/60)+' 小时'+(m%60?(m%60)+' 分':'');
  return {km,order,plan,leg,fmtKm,fmtMin,pathLen};
})();
if(typeof module!=='undefined')module.exports=MGRoute;

if(typeof window!=='undefined')(()=>{
  const ST={trip:'',city:'',perDay:2,skip:true,start:null};
  const SLOT={1:['晚餐'],2:['午餐','晚餐'],3:['早午餐','午餐','晚餐'],4:['早午餐','午餐','下午','晚餐']};
  const COLORS=['#b3261e','#1f6f8b','#7a5c00','#5b3f8c','#2f7a3d','#a14d00','#38507a'];
  const html=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function ensure(){
    if(document.getElementById('routeDlg'))return;
    document.body.insertAdjacentHTML('beforeend',`<dialog id="routeDlg" class="route-sheet" aria-labelledby="routeTitle"><div class="dlg"><div class="detail-sheet-head"><button type="button" class="detail-drag" tabindex="-1" data-close aria-label="关闭路线"><span></span></button><button type="button" class="close" data-close>关闭</button></div><p class="route-kicker">旅行路线 · ROUTE</p><h2 id="routeTitle"></h2><div class="route-cities" id="routeCities" role="tablist" aria-label="选择城市"></div><div class="route-controls"><div class="route-step"><span>每天</span><button type="button" data-per="-1" aria-label="每天少一家">−</button><b id="routePer">2</b><button type="button" data-per="1" aria-label="每天多一家">＋</button><span>家</span></div><label class="route-toggle"><input type="checkbox" id="routeSkip" checked>跳过去过的</label><button type="button" class="route-here" id="routeHere">从我的位置出发</button></div><div id="routeBody"></div></div></dialog>`);
    const dlg=document.getElementById('routeDlg');
    if(typeof upBindDetailSwipe==='function')upBindDetailSwipe('routeDlg');
    dlg.addEventListener('click',e=>{
      if(e.target===dlg||e.target.closest('[data-close]')){closeAppDialog(dlg);return;}
      const c=e.target.closest('[data-route-city]');if(c){ST.city=c.dataset.routeCity;ST.start=null;draw();return;}
      const p=e.target.closest('[data-per]');if(p){ST.perDay=Math.max(1,Math.min(4,ST.perDay+ +p.dataset.per));draw();return;}
      if(e.target.closest('#routeHere')){
        if(ST.start){ST.start=null;draw();return;}
        if(!navigator.geolocation){toast('这个浏览器无法获取位置');return;}
        e.target.closest('#routeHere').textContent='定位中…';
        navigator.geolocation.getCurrentPosition(pos=>{ST.start={lat:pos.coords.latitude,lng:pos.coords.longitude,me:true};draw();},()=>{toast('没有拿到位置，仍从第一家出发');draw();},{enableHighAccuracy:false,timeout:10000,maximumAge:300000});return;}
      if(e.target.closest('[data-route-copy]')){copyText(textPlan()).then(()=>toast('已复制行程，可直接粘贴'),()=>toast('复制失败'));return;}
      const open=e.target.closest('[data-route-open]');if(open){upOpenDetail(open.dataset.routeOpen);return;}
    });
    document.getElementById('routeSkip').addEventListener('change',e=>{ST.skip=e.target.checked;draw();});
  }
  function rows(){return upRows(ST.trip).filter(r=>r.lat!=null);}
  function cities(){const m=new Map();rows().forEach(r=>m.set(r.ci,(m.get(r.ci)||0)+1));return [...m].sort((a,b)=>b[1]-a[1]);}
  function current(){
    const all=rows().filter(r=>String(r.ci)===ST.city),pts=ST.skip?all.filter(r=>favOf(r.u)!==2):all;
    return {all,days:pts.length?MGRoute.plan(pts,{perDay:ST.perDay,start:ST.start}):[],skipped:all.length-pts.length};
  }
  const name=r=>r.zh||r.n;
  function navLink(a,b,walk){
    const mode=walk?'walk':'car';
    if(b.ml||a.ml)return `https://uri.amap.com/navigation?${a.me?'':`from=${a.lng},${a.lat},${encodeURIComponent(name(a))}&`}to=${b.lng},${b.lat},${encodeURIComponent(name(b))}&mode=${mode}&coordinate=wgs84&callnative=1`;
    return `https://www.google.com/maps/dir/?api=1${a.me?'':`&origin=${a.lat},${a.lng}`}&destination=${b.lat},${b.lng}&travelmode=${walk?'walking':'driving'}&hl=zh-CN`;
  }
  function dayLink(day){
    const s=day.stops;if(s.length<2||s[0].ml)return '';
    const o=s[0],d=s[s.length-1],w=s.slice(1,-1).map(x=>x.lat+','+x.lng).join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${o.lat},${o.lng}&destination=${d.lat},${d.lng}${w?'&waypoints='+encodeURIComponent(w):''}&hl=zh-CN`;
  }
  function sketch(days){
    const pts=days.flatMap(d=>d.stops).concat(ST.start?[ST.start]:[]);if(!pts.length)return '';
    const lat0=pts.reduce((t,p)=>t+p.lat,0)/pts.length,k=Math.cos(rad(lat0));
    const xy=p=>[p.lng*k,-p.lat];const xs=pts.map(p=>xy(p)[0]),ys=pts.map(p=>xy(p)[1]);
    const W=640,H=300,pad=34,minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
    const s=Math.min((W-pad*2)/Math.max(maxX-minX,1e-6),(H-pad*2)/Math.max(maxY-minY,1e-6));
    const ox=(W-(maxX-minX)*s)/2,oy=(H-(maxY-minY)*s)/2,P=p=>{const [x,y]=xy(p);return [ox+(x-minX)*s,oy+(y-minY)*s];};
    let n=0,lines='',dots='';
    days.forEach((d,i)=>{const col=COLORS[i%COLORS.length],seq=(i===0&&ST.start?[ST.start]:[]).concat(d.stops);
      if(seq.length>1)lines+=`<polyline points="${seq.map(p=>P(p).join(',')).join(' ')}" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".9"/>`;
      d.stops.forEach(p=>{n++;const [x,y]=P(p);dots+=`<g><circle cx="${x}" cy="${y}" r="12" fill="${col}" stroke="var(--surface)" stroke-width="3"/><text x="${x}" y="${y+4.5}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">${n}</text></g>`;});
      if(i<days.length-1&&d.stops.length&&days[i+1].stops.length){const [x1,y1]=P(d.stops.at(-1)),[x2,y2]=P(days[i+1].stops[0]);lines+=`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--muted)" stroke-width="1.2" stroke-dasharray="2 5" opacity=".6"/>`;}
    });
    if(ST.start){const [x,y]=P(ST.start);dots+=`<g><circle cx="${x}" cy="${y}" r="9" fill="var(--surface)" stroke="${COLORS[0]}" stroke-width="3"/><circle cx="${x}" cy="${y}" r="3.5" fill="${COLORS[0]}"/></g>`;}
    return `<figure class="route-sketch"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="路线示意图">${lines}${dots}</svg><figcaption>${days.map((d,i)=>`<span><i style="background:${COLORS[i%COLORS.length]}"></i>第 ${i+1} 天</span>`).join('')}<em>示意图 · 直线距离</em></figcaption></figure>`;
  }
  function legHTML(l,a,b){return `<li class="route-leg"><span class="route-leg-line"></span><span>${l.walk?'步行':'车程'}约 ${MGRoute.fmtMin(l.min)} · ${MGRoute.fmtKm(l.road)}</span><a href="${html(navLink(a,b,l.walk))}" target="_blank" rel="noopener">导航 ↗</a></li>`;}
  function draw(){
    const t=upTrip(ST.trip);if(!t)return;
    document.getElementById('routeTitle').textContent=t.name;
    const cs=cities();if(!cs.some(([ci])=>String(ci)===ST.city))ST.city=cs.length?String(cs[0][0]):'';
    document.getElementById('routeCities').innerHTML=cs.map(([ci,n])=>`<button type="button" role="tab" data-route-city="${ci}" aria-selected="${String(ci)===ST.city}">${html(DB.T[ci][0])}<small>${n}</small></button>`).join('');
    document.getElementById('routePer').textContent=ST.perDay;document.getElementById('routeSkip').checked=ST.skip;
    const here=document.getElementById('routeHere');here.textContent=ST.start?'✓ 从我的位置出发':'从我的位置出发';here.setAttribute('aria-pressed',!!ST.start);
    const body=document.getElementById('routeBody');
    if(!cs.length){body.innerHTML='<p class="empty">这份清单里还没有能定位的餐厅。</p>';return;}
    const {days,skipped}=current();
    if(!days.length){body.innerHTML=`<p class="empty">这座城市的餐厅都去过了${skipped?`（${skipped} 家）`:''}。关掉“跳过去过的”可以看到全部。</p>`;return;}
    const total=days.reduce((t,d)=>t+d.road,0),stops=days.reduce((t,d)=>t+d.stops.length,0);let n=0;
    const slots=SLOT[ST.perDay];
    body.innerHTML=`<div class="route-summary"><div><b>${days.length}</b><span>天</span></div><div><b>${stops}</b><span>家餐厅</span></div><div><b>${MGRoute.fmtKm(total)}</b><span>总路程（估）</span></div></div>${sketch(days)}<ol class="route-days">${days.map((d,i)=>{
      const col=COLORS[i%COLORS.length],gl=dayLink(d);
      return `<li class="route-day" style="--day:${col}"><header><b>第 ${i+1} 天</b><span>${d.stops.length} 家 · 约 ${MGRoute.fmtKm(d.road)}</span>${gl?`<a href="${html(gl)}" target="_blank" rel="noopener">谷歌地图看全天 ↗</a>`:''}</header><ol class="route-stops">${d.first?legHTML(d.first,ST.start,d.stops[0]):''}${d.stops.map((r,j)=>{n++;return `${j?legHTML(d.legs[j-1],d.stops[j-1],r):''}<li class="route-stop"><span class="route-num">${n}</span><button type="button" class="route-name" data-route-open="${html(r.u)}"><b>${html(name(r))}</b><small>${slots[j]||''}${slots[j]?' · ':''}${r.zh&&r.zh!==r.n?html(r.n)+' · ':''}${html(r.cu||'')}</small></button>${badge(r)}</li>`;}).join('')}</ol></li>`;}).join('')}</ol><div class="route-foot"><button type="button" class="btn" data-route-copy>复制行程文字</button><p>距离按直线 × 1.3 估算，步行按每小时 4.8 公里、车程按城市平均车速估算，出发前以导航为准。${skipped?`已跳过 ${skipped} 家去过的餐厅。`:''}</p></div>`;
  }
  function textPlan(){
    const t=upTrip(ST.trip),{days}=current(),slots=SLOT[ST.perDay];let n=0;
    return [`${t.name} · ${DB.T[+ST.city][0]} 美食路线`,...days.map((d,i)=>[`\n第 ${i+1} 天（约 ${MGRoute.fmtKm(d.road)}）`,...d.stops.map((r,j)=>{n++;const l=j?d.legs[j-1]:null;return `${l?`  ↓ ${l.walk?'步行':'车程'}约 ${MGRoute.fmtMin(l.min)}\n`:''}${n}. ${slots[j]?slots[j]+' · ':''}${name(r)}（${LVN[r.l]}）`;})].join('\n')),'\n—— 来自 米其林全球名录'].join('\n');
  }
  function open(tripID,city){ensure();ST.trip=tripID;ST.city=city!=null?String(city):'';ST.start=null;draw();const d=document.getElementById('routeDlg');if(!d.open)showAppDialog(d);d.scrollTop=0;}
  const rad=d=>d*Math.PI/180;
  document.addEventListener('click',e=>{const b=e.target.closest('[data-trip-route]');if(!b)return;e.preventDefault();open(b.dataset.tripRoute,b.dataset.city);});
  window.MGRouteUI={open,draw,state:ST,text:textPlan};
})();

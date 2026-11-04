/* Travel, details, passport and snapshot views. Existing restaurant IDs remain unchanged. */
// Must equal ASSET_VER in index.html and sw.js; index.html reloads fresh files when they disagree.
const UPGRADE_VER="55";
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
const PASSPORT={tab:'book',tracks:new Set(),open:false,sheet:0,busy:false,observer:null,honor:'all'};
const passportEmblem=`<svg viewBox="0 0 64 64" fill="none" aria-hidden="true"><g><circle cx="32" cy="32" r="27.6" fill="none" stroke="#d9ae62" stroke-width="1.15"/><circle cx="32" cy="32" r="24.9" fill="none" stroke="#d9ae62" stroke-width=".7"/><g stroke="#f4e7cd" stroke-width="3.5" stroke-linecap="butt"><line x1="32" y1="18.6" x2="32" y2="50.3"/><line x1="13.9" y1="30.4" x2="50.7" y2="30.4"/><line x1="21.1" y1="19.4" x2="43.3" y2="44.2"/><line x1="43.0" y1="19.4" x2="20.8" y2="44.2"/></g><g fill="#f4e7cd"><circle cx="32" cy="50.3" r="2.7"/><circle cx="13.9" cy="30.4" r="2.7"/><circle cx="50.7" cy="30.4" r="2.7"/><circle cx="21.1" cy="19.4" r="2.7"/><circle cx="43.0" cy="19.4" r="2.7"/><circle cx="20.8" cy="44.2" r="2.7"/><circle cx="43.3" cy="44.2" r="2.7"/><path d="M32 9.4 Q32.9 12.2 35.7 13.1 Q32.9 14 32 16.8 Q31.1 14 28.3 13.1 Q31.1 12.2 32 9.4Z"/></g><circle cx="14.4" cy="30.2" r="1.15" fill="#d8532e" stroke="none"/></g></svg>`;
// Original vector engraving: a world served on a plate, framed by cutlery.
const passportTableEmblem=`<svg viewBox="0 0 240 210" fill="none" aria-hidden="true"><g stroke="currentColor" stroke-width=".85"><circle cx="120" cy="104" r="76"/><circle cx="120" cy="104" r="69"/><circle cx="120" cy="104" r="62" stroke-dasharray=".5 4" stroke-linecap="round"/><ellipse cx="120" cy="104" rx="31" ry="62" opacity=".36"/><path d="M58 104h124M66 74h108M66 134h108M120 42v124" opacity=".32"/><path d="M25 49v37q0 10 9 10t9-10V49M31 49v35m6-35v35M34 96v66M205 49q-13 25-13 48h13m0-48v113" stroke-width="1.5" stroke-linecap="round"/><path d="M66 182q54 27 108 0M71 181l-6 2m16 3-5 4m16-1-3 5m16-2-1 5m16-4v5m15-6 1 5m13-8 3 5m10-11 5 4m5-10 6 2"/><path d="m120 13 2.7 6.3 6.3 2.7-6.3 2.7L120 31l-2.7-6.3-6.3-2.7 6.3-2.7Z" fill="currentColor" stroke="none"/><path d="M52 29h34m68 0h34" opacity=".5"/></g><circle cx="120" cy="104" r="35" fill="#652632"/><g transform="translate(85 69) scale(1.09375)">${passportEmblem.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,'')}</g></svg>`;
// Landmark drawings are deliberately small monochrome passport engravings.
const CITY_LANDMARKS=[
 ['上海|Shanghai','东方明珠','pearl'],['北京|Beijing','天坛','temple'],['广州|Guangzhou','广州塔','tower'],['深圳|Shenzhen','平安金融中心','spire'],['香港|Hong Kong','中银大厦','spire'],['澳门|Macau','大三巴牌坊','arch'],['台北|Taipei','台北101','pagoda'],['杭州|Hangzhou','雷峰塔','pagoda'],['南京|Nanjing','紫峰大厦','spire'],['成都|Chengdu','安顺廊桥','bridge'],['重庆|Chongqing','洪崖洞','pagoda'],['西安|Xi’an|Xian','大雁塔','pagoda'],['武汉|Wuhan','黄鹤楼','temple'],['苏州|Suzhou','北寺塔','pagoda'],['天津|Tianjin','天津之眼','wheel'],
 ['巴黎|Paris','埃菲尔铁塔','eiffel'],['伦敦|London','伊丽莎白塔','clock'],['罗马|Rome|Roma','罗马斗兽场','colosseum'],['米兰|Milan|Milano','米兰大教堂','cathedral'],['佛罗伦萨|Florence|Firenze','圣母百花大教堂','dome'],['威尼斯|Venice|Venezia','圣马可钟楼','clock'],['比萨|Pisa','比萨斜塔','leaning'],['巴塞罗那|Barcelona','圣家堂','cathedral'],['马德里|Madrid','阿尔卡拉门','arch'],['里斯本|Lisbon','贝伦塔','castle'],['维也纳|Vienna','圣斯蒂芬大教堂','cathedral'],['布拉格|Prague','查理大桥','bridge'],['柏林|Berlin','勃兰登堡门','arch'],['阿姆斯特丹|Amsterdam','运河拱桥','bridge'],['哥本哈根|Copenhagen','圆塔','roundtower'],['斯德哥尔摩|Stockholm','斯德哥尔摩市政厅','clock'],
 ['东京|Tokyo','东京塔','eiffel'],['京都|Kyoto','东寺五重塔','pagoda'],['大阪|Osaka','大阪城','castle'],['首尔|Seoul','南山首尔塔','tower'],['新加坡|Singapore','滨海湾金沙','marina'],['曼谷|Bangkok','郑王庙','temple'],['吉隆坡|Kuala Lumpur','双子塔','twin'],['迪拜|Dubai','哈利法塔','spire'],['悉尼|Sydney','悉尼歌剧院','opera'],['纽约|New York','帝国大厦','spire'],['旧金山|San Francisco','金门大桥','bridge'],['洛杉矶|Los Angeles','格里菲斯天文台','dome'],['芝加哥|Chicago','威利斯大厦','twin'],['多伦多|Toronto','加拿大国家电视塔','tower'],['温哥华|Vancouver','加拿大广场','opera']
];
CITY_LANDMARKS.push(['上海|Shanghai','外滩海关大楼','clock'],['上海|Shanghai','上海环球金融中心','spire'],['巴黎|Paris','凯旋门','arch'],['巴黎|Paris','巴黎圣母院','cathedral'],['伦敦|London','伦敦眼','wheel'],['伦敦|London','伦敦塔桥','bridge'],['北京|Beijing','故宫角楼','temple'],['北京|Beijing','中央广播电视塔','tower'],['东京|Tokyo','东京晴空塔','tower'],['东京|Tokyo','浅草寺五重塔','pagoda'],['香港|Hong Kong','尖沙咀钟楼','clock'],['香港|Hong Kong','国际金融中心','tower'],['新加坡|Singapore','摩天观景轮','wheel'],['新加坡|Singapore','苏丹回教堂','dome'],['纽约|New York','布鲁克林大桥','bridge'],['纽约|New York','克莱斯勒大厦','spire'],['京都|Kyoto','京都塔','tower'],['大阪|Osaka','通天阁','tower'],['罗马|Rome|Roma','万神殿','dome'],['巴塞罗那|Barcelona','巴塞罗那大教堂','cathedral'],['旧金山|San Francisco','科伊特塔','roundtower'],['悉尼|Sydney','悉尼海港大桥','bridge']);
const CITY_ENGRAVINGS={
 pearl:'M60 8v12m0 0-13 20h26L60 20ZM60 40v15m-18 0a18 18 0 1 0 36 0 18 18 0 1 0-36 0M51 72l-8 27m26-27 8 27M60 73v26',
 tower:'M60 7v27M45 35h30l-5 12H50ZM55 48l-5 51m15-51 5 51M42 99h36',
 spire:'M40 99V55h8V33h7V15h10v18h7v22h8v44M48 99V63h24v36M60 5v10M53 71h14m-14 10h14',
 eiffel:'M60 8 48 52 30 99m30-91 12 44 18 47M44 62h32M37 81h46M50 99a10 15 0 0 1 20 0M48 52h24M55 30h10',
 clock:'M43 99V37h34v62M39 37h42L60 15 39 37ZM60 5v10M49 99V70h22v29M50 51a10 10 0 1 0 20 0 10 10 0 1 0-20 0M60 45v7l5 3',
 temple:'M28 99V77h64v22M23 77h74L60 60 23 77ZM35 60h50L60 43 35 60ZM43 43h34L60 28 43 43ZM60 16v12M40 82v17m20-17v17m20-17v17',
 pagoda:'M35 99h50M40 99V81h40v18M33 81h54L60 68 33 81ZM39 66h42L60 54 39 66ZM44 51h32L60 39 44 51ZM49 36h22L60 25 49 36ZM60 12v13',
 arch:'M18 99h84M24 99V49h72v50M18 49h84V35H18ZM28 35l32-15 32 15M35 99V68a8 8 0 0 1 16 0v31m18 0V68a8 8 0 0 1 16 0v31M57 99V60h6v39',
 colosseum:'M20 99V52q40-28 80 0v47ZM20 71q40-28 80 0M20 87q40-28 80 0M32 99V48m14 51V42m14 57V40m14 59V42m14 57V48',
 cathedral:'M20 99V65h80v34M30 65V36l7-20 7 20v29m12 0V26l7-20 7 20v39m10 0V36l7-20 7 20v29M52 99V82a8 8 0 0 1 16 0v17',
 dome:'M20 99h80M28 99V67h64v32M25 67h70M35 62a25 30 0 0 1 50 0ZM60 12v19M38 75v24m15-24v24m15-24v24m15-24v24',
 bridge:'M12 89h96M27 99V29h8v70m50 0V29h8v70M12 60q20 35 48 0 28 35 48 0M40 70v19m12-17v17m16-17v17m12-19v19',
 wheel:'M25 47a35 35 0 1 0 70 0 35 35 0 1 0-70 0M60 12v70M25 47h70M35 22l50 50m0-50L35 72M60 60 40 99m20-39 20 39',
 leaning:'M40 99 24 31l46-10 16 68ZM28 46l46-10M32 61l46-10M36 76l46-10M40 90l46-10M23 31l-2-9 46-10 3 9',
 castle:'M27 99V52h66v47M24 52h72V39H84V27H72v12H48V27H36v12H24ZM50 99V78a10 10 0 0 1 20 0v21',
 roundtower:'M37 99V35q23-12 46 0v64M33 35h54V25H33ZM60 13v12M47 49h7m13 0h7m-27 15h7m13 0h7M54 99V83h12v16',
 marina:'M22 99V47h17v52m13 0V47h17v52m13 0V47h17v52M14 41q45 8 90-12l-6 16q-39 17-80 6Z',
 twin:'M26 99V41h24v58m20 0V41h24v58M29 41V25h18v16m26 0V25h18v16M38 10v15m44-15v15M50 64h20v8H50',
 opera:'M12 99h96M20 91l5-46q28 6 35 46ZM40 91l17-69q35 15 32 69ZM65 91l34-45q4 27 2 45Z'
};
function upCityLandmark(ci,variant=0){const name=DB.T[ci][0];const options=CITY_LANDMARKS.filter(x=>x[0].split('|').some(n=>name.toLowerCase()===n.toLowerCase())),item=options[variant%options.length];return item?{label:item[1],svg:`<svg viewBox="0 0 120 110" aria-hidden="true"><path d="${CITY_ENGRAVINGS[item[2]]}"/></svg>`}:{label:'城市纪念章',svg:`<span class="pp-city-monogram" aria-hidden="true">${esc(Array.from(name).slice(0,2).join(''))}</span>`};}
function upStampDate(date){if(!date)return '日期未填写';const [y,m,d]=date.split('-');return `${d} ${['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][+m-1]||m} ${y}`;}
// One earned stamp per stable restaurant ID; dates never decide eligibility.
function upPassportEntries(visit){
  return [...new Map(visit.map(r=>[r.u,r])).values()].map(r=>{
    const visits=upVisits(r.u),date=visits.map(v=>v.date||'').filter(Boolean).sort().at(-1)||'';
    let code=2166136261;for(const ch of r.u)code=Math.imul(code^ch.charCodeAt(0),16777619)>>>0;
    return {r,date,count:visits.length,code:code.toString(36).toUpperCase().padStart(7,'0')};
  }).sort((a,b)=>b.date.localeCompare(a.date)||a.r.ci-b.r.ci||a.r.u.localeCompare(b.r.u));
}
function upPassportCities(visit){
  const totals=new Map(),done=new Map(),allT=new Map(),doneT=new Map(),bump=(m,ci,l)=>{if(!m.has(ci))m.set(ci,[0,0,0,0,0]);m.get(ci)[l]++;};
  DB.rows.forEach(r=>{totals.set(r.ci,(totals.get(r.ci)||0)+1);bump(allT,r.ci,r.l);});
  new Map(visit.map(r=>[r.u,r])).forEach(r=>{done.set(r.ci,(done.get(r.ci)||0)+1);bump(doneT,r.ci,r.l);});
  return [...done].map(([ci,n])=>({ci,n,total:totals.get(ci)||n,tiers:(allT.get(ci)||[0,0,0,0,0]).map((all,l)=>({l,all,done:(doneT.get(ci)||[0,0,0,0,0])[l]}))})).sort((a,b)=>b.n-a.n||a.ci-b.ci);
}
const PP_POINTS=[5,3,2,1,1];
const PP_LEVELS=[[0,'食客'],[5,'尝鲜者'],[15,'老饕'],[35,'行家'],[70,'美食家'],[120,'鉴赏家'],[200,'评鉴官'],[330,'宗师'],[500,'大宗师'],[800,'食神'],[1200,'传奇']];
const PP_TRACKS=[
  {id:'count',title:'味蕾里程',sub:'每一家，都算数',rule:'累计去过的不同餐厅。',glyph:null,val:j=>j.n,steps:[[1,'第一枚专属章'],[5,'五味初识'],[10,'十家探味'],[25,'二十五家珍藏'],[50,'五十家足迹'],[100,'百家纪念'],[200,'双百食录'],[365,'岁月一餐'],[500,'半千名册'],[1000,'千味归藏']]},
  {id:'star',title:'摘星',sub:'去过的星级餐厅',rule:'去过的一星、二星、三星餐厅合计。',glyph:'star',val:j=>j.stars,steps:[[1,'初次摘星'],[5,'五星在握'],[10,'十星连珠'],[25,'廿五星辰'],[50,'五十星耀'],[100,'百星璀璨'],[250,'星海无涯'],[500,'星河长明']]},
  {id:'crown',title:'星冠',sub:'三星餐厅的珍贵一餐',rule:'去过的三星餐厅数量。',glyph:'crown',val:j=>j.byL[0],steps:[[1,'星冠初见'],[3,'三星三见'],[5,'星冠五座'],[10,'十全星冠'],[25,'星冠廿五'],[50,'星冠半百'],[100,'星冠百座']]},
  {id:'bib',title:'必比登',sub:'好吃不贵的街巷滋味',rule:'去过的必比登餐厅数量。',glyph:'table',val:j=>j.byL[3],steps:[[1,'必比登发现者'],[5,'必比登常客'],[10,'街巷老饕'],[25,'必比登达人'],[50,'必比登名人堂'],[100,'百味街巷'],[200,'街巷传奇']]},
  {id:'city',title:'城市漫游',sub:'去过的不同城市',rule:'去过餐厅的不同城市数量。',glyph:'compass',val:j=>j.cities.length,steps:[[2,'双城记'],[3,'三城寻味'],[5,'五城漫游'],[10,'十城行者'],[20,'二十城名册'],[30,'三十城环游'],[50,'五十城传说']]},
  {id:'country',title:'环球足迹',sub:'去过的不同国家和地区',rule:'去过餐厅的不同国家或地区数量。',glyph:'globe',val:j=>j.countries,steps:[[2,'跨国一餐'],[3,'三国滋味'],[5,'五国漫游'],[10,'十国环球'],[15,'十五国远行'],[20,'二十国传说']]}
];
function upSlamStats(visited){
  const city=new Map(),country=new Map();let all3=0,done3=0,allS=0,doneS=0;
  for(const r of DB.rows){
    if(r.l>2)continue;const v=visited.has(r.u);allS++;if(v)doneS++;if(r.l===0){all3++;if(v)done3++;}
    for(const [m,k] of [[city,r.ci],[country,r.co]]){let e=m.get(k);if(!e){e={all:0,done:0};m.set(k,e);}e.all++;if(v)e.done++;}
  }
  const sweep=(m,min)=>{let full=0,best=null;for(const [k,e] of m){if(e.all<min)continue;if(e.done===e.all)full++;else if(!best||e.done/e.all>best.e.done/best.e.all)best={k,e};}return {full,best};};
  return {city:sweep(city,3),country:sweep(country,10),all3,done3,allS,doneS};
}
function upGrowthStore(key){try{const v=JSON.parse(localStorage.getItem(key)||'null');return Array.isArray(v)?v:null}catch(e){return null}}
function upGrowthSave(key,v){try{localStorage.setItem(key,JSON.stringify(v))}catch(e){}}
// Medals are kept once earned (with the date); older installs are migrated, and existing collections are seeded silently.
function upGrowthHall(){
  try{const v=JSON.parse(localStorage.getItem('mg-pp-hall')||'null');if(v&&typeof v==='object'&&!Array.isArray(v))return v;}catch(e){}
  const old=upGrowthStore('mg-pp-earned');return old?Object.fromEntries(old.map(l=>[l,''])):null;
}
function upPassportJourney(visit,hall){
  const rows=[...new Map(visit.map(r=>[r.u,r])).values()],cities=upPassportCities(rows),n=rows.length,countries=new Set(rows.map(r=>r.co)).size;
  const byL=[0,0,0,0,0];rows.forEach(r=>{byL[r.l]++;});
  const j={n,cities,countries,byL,stars:byL[0]+byL[1]+byL[2],points:byL.reduce((a,c,i)=>a+c*PP_POINTS[i],0)};
  const EN=typeof MGI18n!=='undefined'&&MGI18n.en,S=upSlamStats(new Set(rows.map(r=>r.u)));
  const cityName=k=>DB.T[k]?DB.T[k][0]:'',countryName=k=>DB.C&&DB.C[k]?DB.C[k][0]:'';
  const hint=(b,name)=>b?`${name(b.k)} ${b.e.done}/${b.e.all}`:'';
  const covered=byL.slice(0,4).filter(x=>x>0).length;
  const slamSteps=[
    {label:'四味俱全',desc:'三星、二星、一星、必比登，每一档都去过至少一家。',now:covered,at:4},
    {label:'小满贯',desc:'吃遍一座城市的所有星级餐厅（该城星级餐厅须有 3 家以上）。',now:Math.min(S.city.full,1),at:1,frac:S.city.full?1:S.city.best?S.city.best.e.done/S.city.best.e.all:0,hint:S.city.full?'':hint(S.city.best,cityName)},
    {label:'小满贯·三连',desc:'集齐 3 座城市的小满贯。',now:Math.min(S.city.full,3),at:3},
    {label:'小满贯·十全',desc:'集齐 10 座城市的小满贯。',now:Math.min(S.city.full,10),at:10},
    {label:'中满贯',desc:'吃遍一个国家或地区的所有星级餐厅（须有 10 家以上）。',now:Math.min(S.country.full,1),at:1,frac:S.country.full?1:S.country.best?S.country.best.e.done/S.country.best.e.all:0,hint:S.country.full?'':hint(S.country.best,countryName)},
    {label:'中满贯·三连',desc:'集齐 3 个国家或地区的中满贯。',now:Math.min(S.country.full,3),at:3},
    {label:'大满贯',desc:'吃遍全球所有三星餐厅。',now:S.done3,at:Math.max(S.all3,1)},
    {label:'超级大满贯',desc:'吃遍全球所有星级餐厅，传说中的终点。',now:S.doneS,at:Math.max(S.allS,1)}
  ];
  const tracks=[...PP_TRACKS.map(t=>({...t,items:t.steps.map(([at,label])=>({label,at,now:Math.min(t.val(j),at),cond:t.val(j)>=at,mark:t.glyph?t.glyph:String(at)}))})),
    {id:'slam',title:'满贯',sub:'把一整组，吃遍',rule:'集齐一整组，是最长的旅程。星级以当前名录为准；已获得的满贯不会因名录更新而收回。',glyph:'trophy',slam:true,items:slamSteps.map(s=>({...s,cond:s.now>=s.at,mark:'trophy'}))}];
  tracks.forEach(t=>t.items.forEach(m=>{m.track=t.id;m.ok=m.cond||!!(hall&&m.label in hall);m.date=hall&&hall[m.label]||'';m.frac=m.ok?1:(m.frac!==undefined?m.frac:m.now/m.at);}));
  const medals=tracks.flatMap(t=>t.items);
  tracks.forEach(t=>{t.earned=t.items.filter(m=>m.ok).length;t.next=t.items.find(m=>!m.ok)||null;});
  const closest=tracks.map(t=>t.next).filter(Boolean).sort((a,b)=>b.frac-a.frac||(a.at-a.now)-(b.at-b.now)).slice(0,3);
  let li=0;PP_LEVELS.forEach(([p],i)=>{if(j.points>=p)li=i;});
  const cur=PP_LEVELS[li],nxt=PP_LEVELS[li+1]||null;
  return {...j,tracks,medals,goals:medals,earned:medals.filter(m=>m.ok).length,total:medals.length,closest,next:closest[0]||null,level:{idx:li,title:cur[1],next:nxt?nxt[1]:null,toNext:nxt?nxt[0]-j.points:0,ratio:nxt?(j.points-cur[0])/(nxt[0]-cur[0]):1},EN};
}
function upGrowthSync(journey,hall){
  const today=new Date().toLocaleDateString('sv-SE'),cond=journey.medals.filter(m=>m.cond),fresh=[];
  let h=hall;
  if(!h){h={};if(journey.n)cond.forEach(m=>{h[m.label]='';});upGrowthSave('mg-pp-hall',h);}
  else{cond.forEach(m=>{if(!(m.label in h)){h[m.label]=today;fresh.push(m.label);}});if(fresh.length)upGrowthSave('mg-pp-hall',h);if(fresh.length)upGrowthSave('mg-pp-new',[...new Set([...(upGrowthStore('mg-pp-new')||[]),...fresh])]);}
  let up=null;try{const prev=localStorage.getItem('mg-pp-level');if(prev===null)localStorage.setItem('mg-pp-level',String(journey.level.idx));else if(journey.level.idx>+prev){up=journey.level.title;localStorage.setItem('mg-pp-level',String(journey.level.idx));}else if(journey.level.idx<+prev)localStorage.setItem('mg-pp-level',String(journey.level.idx));}catch(e){}
  return {fresh,up};
}
function upGrowthGlyph(kind){
  const paths={star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z',table:'M5 3v6q0 3 3 3t3-3V3M8 3v18M19 3q-4 5-4 10h4m0-10v18',compass:'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20Zm4 6-2 6-6 2 2-6Z',globe:'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20ZM2 12h20M12 2q-8 10 0 20 8-10 0-20Z',crown:'M3 18h18l-1.6-9-4.4 4-3-7-3 7-4.4-4Zm1 3h16',trophy:'M7 4h10v5a5 5 0 0 1-10 0V4Zm0 2H4v2a3 3 0 0 0 3 3m10-5h3v2a3 3 0 0 1-3 3M12 14v4m-4 3h8'};
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[kind]||paths.compass}"/></svg>`;
}
function upPassportGrowth(visit,journey,pending){
  const {n,cities,countries,earned,total,level,tracks,closest,EN}=journey,tierName=['三星','二星','一星','必比登','入选'];
  const L=PP_LEVELS.map(x=>x[1]),stroke=(Math.min(level.ratio,1)*263.9).toFixed(1);
  const fmtDate=d=>d?(EN?`Earned ${d.replaceAll('-','.')}`:`${d.replaceAll('-','.')} 获得`):(EN?'Earned':'已达成');
  const cityCard=c=>{
    const shown=c.tiers.filter(t=>t.l<4&&t.all>0),rows=shown.length?shown:c.tiers.filter(t=>t.all>0).slice(0,1);
    const sa=c.tiers.filter(t=>t.l<3).reduce((a,t)=>a+t.all,0),sd=c.tiers.filter(t=>t.l<3).reduce((a,t)=>a+t.done,0);
    const badge=sa>=3?(sd===sa?`<em class="pp-city-badge is-full">小满贯 ✓</em>`:`<em class="pp-city-badge">${EN?`Stars ${sd}/${sa}`:`星级 ${sd}/${sa}`}</em>`):'';
    return `<article class="pp-destination"><div class="pp-destination-top"><span class="pp-destination-icon">${upGrowthGlyph('globe')}</span><div><h6>${esc(DB.T[c.ci][0])}</h6><span>${EN?`Visited <b>${c.n}</b>`:`已去过 <b>${c.n}</b> 家`}</span></div>${badge}</div><ul class="pp-tiers" aria-label="${esc(DB.T[c.ci][0])}按荣誉探索">${rows.map(t=>`<li><span>${tierName[t.l]}</span><progress value="${t.done}" max="${t.all}" aria-label="${tierName[t.l]} ${t.done} / ${t.all}"></progress><b>${t.done}/${t.all}</b></li>`).join('')}</ul></article>`;
  };
  const status=m=>m.ok?fmtDate(m.date):(m.hint||`${m.now} / ${m.at}`);
  const medal=(m,t)=>{
    const isNext=t.next&&t.next.label===m.label,cls=[m.ok?'is-earned':'is-pending',isNext?'is-next':'',pending.includes(m.label)?'is-new':''].filter(Boolean).join(' ');
    return `<li class="${cls}" aria-label="${esc(m.label)} · ${status(m)}${isNext?(EN?' · next':' · 下一枚'):''}"><span class="pp-medallion">${/^\d+$/.test(m.mark)?`<b>${m.mark}</b>`:upGrowthGlyph(m.mark)}${m.ok?'<i aria-hidden="true">✓</i>':''}</span><strong>${m.label}</strong><small>${isNext?(EN?'Next · ':'下一枚 · ')+status(m):status(m)}</small></li>`;
  };
  const track=t=>{
    const nx=t.next;
    return `<details class="pp-track${t.slam?' pp-track-slam':''}" data-track="${t.id}"${PASSPORT.tracks.has(t.id)?' open':''}><summary><span class="pp-track-ico">${upGrowthGlyph(t.glyph||'star')}</span><span class="pp-track-info"><strong>${t.title}</strong><small>${t.sub}</small>${nx?`<span class="pp-track-next"><i style="width:${Math.min(nx.frac,1)*100}%"></i></span>`:''}</span><span class="pp-track-count"><b>${t.earned}</b>/${t.items.length}</span></summary><div class="pp-track-body"><p class="pp-track-rule">${t.rule}</p><ul class="pp-milestones">${t.items.map(m=>medal(m,t)).join('')}</ul>${t.slam?`<ul class="pp-slam-rules">${t.items.map(m=>`<li><b>${m.label}</b><span>${m.desc}</span></li>`).join('')}</ul>`:''}</div></details>`;
  };
  const almost=closest.length?`<section class="pp-almost"><div class="pp-journey-section-head"><div><span translate="no">ALMOST THERE</span><h5>接近达成</h5></div></div><ul>${closest.map(m=>`<li><span class="pp-almost-ico">${/^\d+$/.test(m.mark)?`<b>${m.mark}</b>`:upGrowthGlyph(m.mark)}</span><div><strong>${m.label}</strong><div class="pp-almost-meter" role="progressbar" aria-label="${esc(m.label)}" aria-valuemin="0" aria-valuemax="${m.at}" aria-valuenow="${m.now}"><i style="width:${Math.min(m.frac,1)*100}%"></i></div></div><b class="pp-almost-num">${m.hint||`${m.now} / ${m.at}`}</b></li>`).join('')}</ul></section>`:'';
  const lvCopy=level.next?(EN?`<b>${level.toNext}</b> more points to become “${L[level.idx+1]}”`:`再得 <b>${level.toNext}</b> 分，升为「${level.next}」`):(EN?'You have reached the top title.':'已登顶，继续珍藏每一餐。');
  return `<section class="pp-growth pp-journey" aria-label="护照成长"><header class="pp-growth-hero"><div class="pp-growth-head"><span class="pp-growth-eyebrow" translate="no">YOUR CULINARY JOURNAL</span><h4>护照成长</h4><p>把每一餐，变成你的世界。</p><div class="pp-journey-stats"><span><b>${n}</b> 家餐厅</span><span><b>${cities.length}</b> 座城市</span><span><b>${countries}</b> 国家 / 地区</span></div></div><div class="pp-next-goal"><div class="pp-journey-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle class="pp-ring-track" cx="50" cy="50" r="42"/><circle class="pp-ring-fill" cx="50" cy="50" r="42" stroke-dasharray="${stroke} 263.9"/></svg><span><b>Lv.${level.idx+1}</b><small>${journey.points} 分</small></span></div><div class="pp-next-copy"><span>当前称号</span><h5>${level.title}</h5><p>${lvCopy}</p><div class="pp-next-meter" role="progressbar" aria-label="${esc(level.title)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(Math.min(level.ratio,1)*100)}"><i style="width:${Math.min(level.ratio,1)*100}%"></i></div><small class="pp-points-rule">三星 5 分 · 二星 3 分 · 一星 2 分 · 必比登 / 入选 1 分</small><button type="button" class="pp-next-action" data-passport-browse>探索下一站 ↗</button></div></div></header>${almost}<div class="pp-journey-body"><section class="pp-journey-cities"><div class="pp-journey-section-head"><div><span translate="no">PLACES & MEMORIES</span><h5>城市足迹</h5></div><span>${cities.length} 座城市</span></div><p class="pp-journey-caption">一座城，从一张餐桌开始。</p><div class="pp-city-progress">${cities.slice(0,3).map(cityCard).join('')||`<div class="pp-journey-empty">${upGrowthGlyph('globe')}<h6>世界很大，第一站由你决定。</h6><p>标记一家“去过”，留下第一枚足迹。</p><button type="button" data-passport-browse>发现下一张餐桌 ↗</button></div>`}</div>${cities.length>3?`<details class="pp-more-cities"><summary>查看全部城市 · ${cities.length}</summary><div class="pp-city-progress">${cities.slice(3).map(cityCard).join('')}</div></details>`:''}</section><section class="pp-journey-awards"><div class="pp-journey-section-head"><div><span translate="no">COLLECTIONS</span><h5>纪念章系列</h5></div><span>${earned} / ${total}</span></div><p class="pp-journey-caption">慢慢集，十年二十年也不嫌长。</p><div class="pp-tracks">${tracks.map(track).join('')}</div></section></div><details class="pp-journey-rules"><summary>签章与进度如何计算</summary><p>标记“去过”即获章，日期可后补；仅“想去”不盖章。重复到访保存在店铺记录中。纪念章一旦获得会一直保留；城市与满贯的星级进度按当前名录统计，名录更新后分母可能变化。</p></details></section>`;
}
function upPassportSingle(){return typeof matchMedia==='function'&&matchMedia('(max-width:700px) and (orientation:portrait)').matches;}
function upPassportPlan(count,sheet,single){
  const total=1+Math.max(1,Math.ceil(count/10)),page=Math.max(0,Math.min(sheet,total-1)),step=single?1:2,start=single?page:Math.floor(page/2)*2;
  return {total,page,start,step,prev:start===0,next:start+step>=total};
}
function upPassport(visit){
  const groups=new Map();visit.forEach(r=>{if(!groups.has(r.ci))groups.set(r.ci,[]);groups.get(r.ci).push(r);});
  const countries=[...new Set(visit.map(r=>r.co))],cities=new Set(groups.keys()),want=Object.values(FAV).filter(f=>f[0]===1).length;
  const allEntries=upPassportEntries(visit),entries=allEntries.filter(e=>PASSPORT.honor==='all'||e.r.l===+PASSPORT.honor);
  const honorFilters=`<div class="pp-honor-filters" role="group" aria-label="签章荣誉分类">${[['all','全部'],...LVN.map((v,i)=>[String(i),v])].map(([key,label])=>`<button type="button" data-passport-honor="${key}" aria-pressed="${PASSPORT.honor===key}">${esc(label)} <span>${key==='all'?allEntries.length:allEntries.filter(e=>e.r.l===+key).length}</span></button>`).join('')}</div>`;
  const single=upPassportSingle(),plan=upPassportPlan(entries.length,PASSPORT.sheet,single);PASSPORT.sheet=plan.page;
  const lv=LVN.map((name,l)=>({name,n:visit.filter(r=>r.l===l).length})).filter(x=>x.n);
  const en=typeof MGI18n!=='undefined'&&MGI18n.en,hall=upGrowthHall(),journey=upPassportJourney(visit,hall),sync=upGrowthSync(journey,hall),pend=upGrowthStore('mg-pp-new')||[];
  if((sync.fresh.length||sync.up)&&typeof toast==='function'){
    const tl=l=>en?MGI18n.tr(l):l,parts=[];
    if(sync.fresh.length)parts.push(en?'Medal unlocked · '+sync.fresh.slice(0,2).map(tl).join(', ')+(sync.fresh.length>2?` +${sync.fresh.length-2}`:''):'解锁纪念章 · '+sync.fresh.slice(0,2).join('、')+(sync.fresh.length>2?` 等 ${sync.fresh.length} 枚`:''));
    if(sync.up)parts.push(en?'Level up · '+tl(sync.up):'升级 · 称号「'+sync.up+'」');
    toast(parts.join(' ｜ '));
  }
  const tabs=`<div class="pp-tabs" role="tablist" aria-label="护照视图"><button type="button" role="tab" data-passport-tab="book" aria-selected="${PASSPORT.tab!=='growth'}">签章</button><button type="button" role="tab" data-passport-tab="growth" aria-selected="${PASSPORT.tab==='growth'}">成长${pend.length&&PASSPORT.tab!=='growth'?'<i class="pp-tab-dot" role="img" aria-label="有新纪念章"></i>':''}</button></div>`,teaser=journey.next?`<button type="button" class="pp-teaser" data-passport-tab="growth"><span>${en?'Almost there':'接近达成'} · <b>${journey.next.label}</b></span><span>${journey.next.hint||`${journey.next.now} / ${journey.next.at}`} →</span></button>`:'';
  const stats=`<div class="pp-tallies"><span><b>${String(countries.length).padStart(2,'0')}</b>国家 / 地区</span><span><b>${String(cities.size).padStart(2,'0')}</b>到访城市</span><span><b>${String(visit.length).padStart(2,'0')}</b>去过的餐厅</span></div>`;
  const stampHTML=(entry,i)=>{
    const {r,date,count,code}=entry,city=DB.T[r.ci][0],name=r.zh||r.n,symbol=['★★★','★★','★','BIB','米'][r.l],seed=parseInt(code,36),tilt=(seed%37)-18,dx=(seed>>>3)%15-7,dy=(seed>>>7)%11-5,position=[[18,10],[51,7],[82,58],[21,105],[54,120],[82,165],[17,213],[53,230],[27,294],[76,299]][i];
    return `<button type="button" class="pp-stamp pp-restaurant-stamp pp-honor-${r.l}" data-passport-restaurant="${esc(r.u)}" style="--tilt:${tilt}deg;--stamp-x:${position[0]}%;--stamp-y:${position[1]}px;--stamp-dx:${dx}px;--stamp-dy:${dy}px;--stamp-opacity:${.83+(seed%12)/100}" aria-label="${esc(name)} · ${esc(LVN[r.l])} · ${esc(date||'日期未填写')} · ${count} 次用餐 · 查看用餐记录"><span class="pp-stamp-top">RESTAURANT · ${code}</span><span class="pp-honor-symbol" aria-hidden="true">${symbol}</span><strong translate="no">${esc(name)}</strong><span class="pp-stamp-en">${esc(city)} · ${esc(LVN[r.l])}</span><span class="pp-stamp-date">${upStampDate(date)}</span><span class="pp-stamp-count">${count?`${count} 次用餐`:'已去过'} · 点击查看</span></button>`;
  };
  const empty=`<div class="pp-blank-stamp"><span>YOUR FIRST STAMP</span><b>下一站，吃点什么？</b><p>在餐厅下点“去过”，<br>为护照盖下第一枚签章。</p><button type="button" data-passport-browse>去发现餐厅 ↗</button></div>`;
  const cover=`<button type="button" class="pp-cover pp-cover-atlas" data-passport-open aria-label="翻开我的美食护照" aria-expanded="false"><span class="pp-cover-border"></span><span class="pp-cover-edition" translate="no">THE PRIVATE TABLE · VOL. 01</span><span class="pp-cover-publisher">米其林全球名录<br><small translate="no">A PERSONAL CULINARY ATLAS</small></span><span class="pp-cover-emblem">${passportTableEmblem}</span><span class="pp-cover-name">美食护照</span><span class="pp-cover-en" translate="no">FOOD PASSPORT</span><span class="pp-cover-motto" translate="no">A WORLD AT YOUR TABLE</span><span class="pp-cover-bottom"><span class="pp-cover-rule" aria-hidden="true"></span><span>一餐一印，珍藏世界</span><small translate="no">TASTE · TRAVEL · REMEMBER</small></span></button>`;
  const companion=`<div class="pp-cover-companion"><span translate="no">A TABLE WITHOUT BORDERS</span><h4>以一餐，<br>与世界相遇。</h4><p>从街巷小馆到远方餐桌，<br>每一次到访，都值得珍藏。</p><div><b>${visit.length}</b><span>枚餐厅专属章</span><b>${cities.size}</b><span>座城市</span></div><small>轻触封面，开启味觉旅程 →</small></div>`;
  const identity=`<section class="pp-page pp-identity" data-passport-page="0" aria-label="护照资料页"><div class="pp-page-header"><span>FOOD PASSPORT / 资料页</span><span>01</span></div><div class="pp-identity-head"><div class="pp-portrait">${passportEmblem}</div><div><span class="pp-field-label">持有人 / HOLDER</span><h4>美食旅行者</h4><span class="pp-holder-en">THE FOOD EXPLORER</span><span class="pp-field-label pp-type">护照类型 / PERSONAL</span></div></div><p class="pp-intro">以一餐为起点，<br>收集与世界相遇的证据。</p>${stats}<div class="pp-document-row"><span>已收藏目的地 / WISHLIST</span><b>${want} 家想去</b></div><div class="pp-ratings">${lv.length?lv.map(x=>`<span>${x.name} <b>${x.n}</b></span>`).join(''):'尚未留下到访记录'}</div><p class="pp-dataset-note">星级以现有名单为准。独立私人收藏工具，非米其林官方产品。</p><div class="pp-signature"><span>签名 / SIGNATURE</span><b>Bon appétit.</b></div><div class="pp-machine" aria-hidden="true">P&lt;FOOD&lt;EXPLORER&lt;&lt;A&lt;WORLD&lt;OF&lt;TASTE<br>JOURNEYS&lt;&lt;${String(countries.length).padStart(3,'0')}&lt;CITIES&lt;&lt;${String(cities.size).padStart(3,'0')}&lt;&lt;${String(visit.length).padStart(4,'0')}</div></section>`;
  const stampPage=page=>{
    const stamps=entries.slice((page-1)*10,page*10).map(stampHTML).join('');
    return `<section class="pp-page pp-visas" data-passport-page="${page}" aria-label="护照签章页 ${page}"><div class="pp-page-header"><span>VISAS / 味觉签章</span><span>${String(page+1).padStart(2,'0')}</span></div><h4>世界的味道，逐页收藏。</h4><p class="pp-visa-sub">一家餐厅，一枚专属章；点击查看每次用餐。</p><div class="pp-stamp-grid">${stamps||(visit.length?'<p class="pp-filter-empty">暂无此类签章，试试其他荣誉分类。</p>':empty)}</div><p class="pp-stamp-hint">${visit.length?'不同荣誉，不同印记；日期可随时补记。':'真正的旅程，从你喜欢的那一家开始。'}</p><div class="pp-page-nav"><span>签章 ${page} / ${plan.total-1}</span><span>FOOD PASSPORT</span></div></section>`;
  };
  const pageHTML=page=>page===0?identity:page<plan.total?stampPage(page):`<section class="pp-page pp-end" aria-label="护照留白页"><span class="pp-end-emblem">${passportEmblem}</span><p>下一餐，新的故事。</p><small>TO BE CONTINUED</small></section>`;
  const bookPages=pageHTML(plan.start)+(single?'':pageHTML(plan.start+1));
  $('passportContent').innerHTML=`<div class="pp ${PASSPORT.open?'is-open':''}"><div class="pp-heading"><div><span class="pp-kicker">THE TASTE OF EVERY JOURNEY</span><h3>我的美食护照</h3></div></div>${tabs}${PASSPORT.tab==='growth'?'':PASSPORT.open?`${honorFilters}<div class="pp-toolbar"><span>${single?'单页阅读 · 左右滑动翻页':'双页展开 · 左右滑动翻页'}</span><button type="button" data-passport-close>合上护照</button></div><div class="pp-spread-stage ${single?'is-single':'is-spread'}"><div class="pp-book">${bookPages}</div></div><div class="pp-navigation"><button type="button" data-passport-prev ${plan.prev?'disabled':''} aria-label="上一页签章">← 上一页</button><span>${plan.start+1}${single?'':`–${Math.min(plan.start+2,plan.total)}`} / ${plan.total}</span><button type="button" data-passport-next ${plan.next?'disabled':''} aria-label="下一页签章">下一页 →</button></div><div class="pp-footer"><span>${visit.length?`已到访 ${visit.length} 家餐厅 · ${countries.length} 个国家和地区`:'这本护照，等待你的第一枚签章。'}</span></div>`:`<div class="pp-cover-stage"><div class="pp-cover-presentation">${cover}${companion}</div><div class="pp-cover-caption"><span>世界很大，值得一口一口去认识。</span><span>向左滑动或轻触封面，翻开护照 →</span></div></div><div class="pp-cover-summary">${stats}</div>`}${PASSPORT.tab==='growth'?upPassportGrowth(visit,journey,pend):teaser}<button type="button" class="passport-share-trigger" data-passport-share><span>生成我的米其林结算地图<small>一张长图 · 足迹地图 · 到访清单 · 我的评分</small></span><b>↗</b></button></div>`;
  if(PASSPORT.tab==='growth'&&pend.length)upGrowthSave('mg-pp-new',[]);
  PASSPORT.observer?.disconnect();
  const stage=$('passportContent').querySelector('.pp-spread-stage');
  if(stage){const resize=()=>{
    if(upPassportSingle()!==single){upPassport(DB.rows.filter(r=>favOf(r.u)===2));return;}
    const scale=Math.min(1,stage.clientWidth/(single?420:840));stage.style.setProperty('--pp-scale',scale);stage.style.height=(600*scale)+'px';
  };resize();PASSPORT.observer=new ResizeObserver(resize);PASSPORT.observer.observe(stage);}

}
function upTurnPassport(action){
  if(PASSPORT.busy)return;
  const root=$('passportContent'),cover=root.querySelector('.pp-cover')?.cloneNode(true),old=root.querySelector('.pp-book .pp-page')?.cloneNode(true);
  if(action==='open')PASSPORT.open=true;
  else if(action==='close')PASSPORT.open=false;
  else {const single=upPassportSingle(),start=single?PASSPORT.sheet:Math.floor(PASSPORT.sheet/2)*2,next=start+(action==='next'?1:-1)*(single?1:2);if(next<0||root.querySelector(`[data-passport-${action}]`)?.disabled)return;PASSPORT.sheet=next;}
  upPassport(DB.rows.filter(r=>favOf(r.u)===2));
  const book=root.querySelector('.pp-book');
  if(!book||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const leaf=document.createElement('div');leaf.className='pp-turning-leaf';leaf.setAttribute('aria-hidden','true');leaf.inert=true;
  const front=document.createElement('div'),back=document.createElement('div');front.className='pp-leaf-front';back.className='pp-leaf-back';
  front.append(action==='open'?cover:action==='prev'?root.querySelector('.pp-book .pp-page').cloneNode(true):old);back.innerHTML='<span>FOOD PASSPORT</span>'+passportEmblem;leaf.append(front,back);book.append(leaf);PASSPORT.busy=true;
  const reverse=action==='prev';const animation=leaf.animate([{transform:`rotateY(${reverse?-180:0}deg)`},{transform:`rotateY(${reverse?0:-180}deg)`}],{duration:650,easing:'cubic-bezier(.22,.7,.25,1)',fill:'forwards'});
  const done=()=>{leaf.remove();PASSPORT.busy=false;};animation.finished.then(done,done);
}
function upBindPassport(){
  let gesture=null,suppress=0;const root=$('passportContent');
  root.addEventListener('toggle',e=>{const d=e.target;if(d.classList&&d.classList.contains('pp-track')){if(d.open)PASSPORT.tracks.add(d.dataset.track);else PASSPORT.tracks.delete(d.dataset.track);}},true);
  root.addEventListener('touchstart',e=>{
    gesture=null;if(e.touches.length!==1||!e.target.closest('.pp-cover,.pp-book')||e.target.closest('button:not(.pp-cover):not(.pp-restaurant-stamp)'))return;
    const t=e.touches[0];gesture={x:t.clientX,y:t.clientY,id:t.identifier,axis:null};
  },{passive:true});
  // Decide before native scrolling starts. Once chosen, the axis cannot change mid-swipe.
  root.addEventListener('touchmove',e=>{
    if(!gesture)return;
    if(e.touches.length!==1||e.touches[0].identifier!==gesture.id){gesture=null;return;}
    const dx=Math.abs(e.touches[0].clientX-gesture.x),dy=Math.abs(e.touches[0].clientY-gesture.y);
    if(!gesture.axis){
      if(Math.max(dx,dy)<8)return;
      if(dx>dy*1.2)gesture.axis='x';
      else if(dy>dx*1.2||Math.max(dx,dy)>=16)gesture.axis='y';
    }
    if(gesture.axis==='x'){if(e.cancelable)e.preventDefault();suppress=performance.now()+400;}
  },{passive:false});
  root.addEventListener('touchend',e=>{
    if(!gesture)return;const g=gesture,t=e.changedTouches[0];gesture=null;
    if(g.axis!=='x'||!t||t.identifier!==g.id)return;
    suppress=performance.now()+400;const dx=t.clientX-g.x;
    if(Math.abs(dx)>=38)upTurnPassport(PASSPORT.open?(dx<0?'next':'prev'):'open');
  },{passive:true});
  root.addEventListener('touchcancel',()=>{gesture=null;},{passive:true});
  root.addEventListener('click',e=>{
    const stamp=e.target.closest('[data-passport-restaurant]');if(stamp){if(performance.now()<suppress)return;upOpenDetail(stamp.dataset.passportRestaurant);return;}
    const honor=e.target.closest('[data-passport-honor]');if(honor){PASSPORT.honor=honor.dataset.passportHonor;PASSPORT.sheet=upPassportSingle()?1:0;upPassport(DB.rows.filter(r=>favOf(r.u)===2));return;}
    const tab=e.target.closest('[data-passport-tab]');if(tab){PASSPORT.tab=tab.dataset.passportTab==='growth'?'growth':'book';PASSPORT.open=false;upRender();return;}const control=e.target.closest('[data-passport-open],[data-passport-close],[data-passport-prev],[data-passport-next],[data-passport-browse]');if(!control)return;if(performance.now()<suppress){e.preventDefault();return;}if(control.hasAttribute('data-passport-browse')){goTab('list');return;}for(const action of ['open','close','prev','next'])if(control.hasAttribute('data-passport-'+action)){upTurnPassport(action);break;}});

}

function upRender(){
  if(!DB||!upLoaded)return;
  const visit=DB.rows.filter(r=>favOf(r.u)===2);
  upPassport(visit);
  $('tripCards').innerHTML=PERSONAL.trips.length?PERSONAL.trips.map(t=>{
    const rs=upRows(t.id),city=new Set(rs.map(r=>r.ci)),been=rs.filter(r=>favOf(r.u)===2).length;
    return `<article class="trip-card"><h4 translate="no">${esc(t.name)}</h4><p>${rs.length} 家餐厅 · ${city.size} 座城市 · 已去 ${been} 家${t.items.length>rs.length?' · '+(t.items.length-rs.length)+' 家不在现有名单中':''}</p><div class="trip-actions"><button class="linkbtn" data-trip-open="${t.id}">查看清单</button><button class="linkbtn" data-trip-route="${t.id}">排路线</button><button class="linkbtn" data-trip-map="${t.id}">查看地图</button><button class="linkbtn" data-share-trip="${t.id}">结算图</button></div><div class="trip-city-chips">${upTripCities(t.id).map(([ci,n])=>`<button type="button" class="trip-city-link" data-trip-city-map="${t.id}" data-city="${ci}" aria-label="在旅行地图查看${esc(DB.T[ci][0])}的 ${n} 家餐厅">${esc(DB.T[ci][0])} · ${n}</button>`).join('')}</div></article>`;
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
  $('tripTitle').textContent=t?t.name:'创建旅行清单';$('tripTitle').translate=!t;$('tripName').value=t?.name||'';
  $('tripDelete').hidden=!t;$('tripMap').hidden=!t;$('tripRoute').hidden=!t;$('tripRoute').dataset.tripRoute=id||'';
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
  return `<details class="detail-history" open><summary>历年评级<span>${entries[0].year}—${entries[entries.length-1].year}</span></summary><div class="timeline">${entries.map(x=>`<span>${x.year}<b>${LVN[+x.code]}</b></span>`).join('')}</div><p class="note">依据历年保存的名单整理。</p></details>`;
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
  upVisitDirty(root);
}
// "去过" and the personal rating are one record: saving the form marks the restaurant as visited.
function upToday(){return fmtDate(Date.now());}
function upVisitDate(u){return PERSONAL.records[u]?.date||'';}
function upVisitLabel(u){if(favOf(u)!==2)return '去过';const r=PERSONAL.records[u]?.rating;return r?`去过 ★${r}`:'去过 ✓';}
function upVisits(u){const rec=PERSONAL.records[u];if(Array.isArray(rec?.visits))return rec.visits;return rec&&(favOf(u)===2||rec.date||rec.rating)?[{...rec,id:'legacy'}]:[];}
function upFmtDate(d){return d?d.replaceAll('-','.'):'';}
function upMealStars(v){
  return `<span class="meal-stars" role="img" aria-label="${v?'我的评分 '+v+' 星':'未评分'}">${[1,2,3,4,5].map(n=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path class="ms-o" d="${ratingStarPath}"/><path class="ms-f" style="clip-path:inset(0 ${100-Math.max(0,Math.min(1,v-n+1))*100}% 0 0)" d="${ratingStarPath}"/></svg>`).join('')}${v?`<b>${v}</b>`:'<i>未评分</i>'}</span>`;
}
// Meal log: a summary, a newest-first timeline of meals, and an editor that only opens when adding or editing one meal.
function upVisitHTML(u,p='',editing){
  const visits=upVisits(u);if(editing===undefined)editing=visits.length?null:'new';
  const order=visits.map((v,i)=>({v,i})).sort((a,b)=>(b.v.date||'').localeCompare(a.v.date||'')||b.i-a.i);
  const rated=visits.filter(v=>v.rating),avg=rated.length?Math.round(rated.reduce((t,v)=>t+v.rating,0)/rated.length*10)/10:0,latest=visits.map(v=>v.date).filter(Boolean).sort().at(-1);
  const editor=(entry,i)=>{const rec=entry||{};return `<form id="${p}visitForm" class="upgrade-form visit-form meal-editor" data-u="${esc(u)}" data-prefix="${p}" data-entry="${esc(entry?.id||'new')}" data-been="true"><div class="meal-editor-head"><b>${entry?`修改第 ${i+1} 次用餐`:visits.length?`记录第 ${visits.length+1} 次用餐`:'记录第一次用餐'}</b>${entry||visits.length?'<button type="button" class="linkbtn" data-cancel-edit>取消</button>':''}</div>${upRatingHTML(rec.rating||0,p)}<label class="visit-date-label">用餐日期<span class="visit-date-row"><input id="${p}visitDate" type="date" value="${esc(rec.date||'')}" aria-label="用餐日期"><button type="button" class="meal-chip" data-today>今天</button></span></label><label>笔记<textarea id="${p}visitNote" maxlength="3000" placeholder="点了什么、味道怎样、下次想试什么">${esc(rec.note||'')}</textarea></label>${typeof MP!=='undefined'?MP.editorHTML(rec.photos):''}<p class="visit-feedback" role="status" aria-live="polite">${entry?'':visits.length?'':'保存后，这家店会标记为“去过”'}</p><div class="visit-actions">${entry?`<button type="button" class="linkbtn meal-delete" data-delete-visit="${esc(entry.id)}">删除这次</button>`:''}<button class="btn primary" type="submit">${entry?'保存修改':'保存'}</button></div></form>`;};
  const card=(v,i)=>`<li class="visit-entry meal-card" data-entry-id="${esc(v.id)}"><div class="meal-date">${v.date?`<b>${v.date.slice(5).replace('-','.')}</b><span>${v.date.slice(0,4)}</span>`:'<b>—</b><span>未填日期</span>'}</div><div class="meal-main"><span class="meal-index">第 ${i+1} 次用餐</span>${upMealStars(v.rating||0)}${v.note?`<p class="meal-note" translate="no">${esc(v.note)}</p>`:''}${typeof MP!=='undefined'?MP.cardHTML(v.photos):''}</div><button type="button" class="meal-edit" data-edit-visit="${esc(v.id)}" aria-label="修改第 ${i+1} 次用餐">修改</button></li>`;
  const timeline=visits.length?`<ol class="meal-timeline">${order.map(({v,i})=>editing===v.id?`<li class="visit-entry meal-card is-editing">${editor(v,i)}</li>`:card(v,i)).join('')}</ol>`:'';
  const summary=visits.length?`<div class="meal-summary"><div><b>${visits.length}</b><span>次用餐</span></div><div><b>${avg?avg.toFixed(1):'—'}</b><span>平均评分</span></div><div><b>${latest?upFmtDate(latest):'—'}</b><span>最近一次</span></div></div>`:'';
  return `<section class="meal-log" id="${p}mealLog" data-u="${esc(u)}" data-prefix="${p}">${summary}${editing==='new'?`<div class="meal-new">${editor(null,visits.length)}</div>`:''}${timeline}${editing?'':`<button type="button" class="meal-add" data-add-visit>＋ 记录一次用餐</button>`}${visits.length?'<p class="meal-hint">删除最后一次用餐后，这家店会取消“去过”。</p>':''}</section>`;
}
function upRenderMealLog(log,editing){
  const u=log.dataset.u,p=log.dataset.prefix;log.outerHTML=upVisitHTML(u,p,editing);
  const next=document.getElementById(p+'mealLog');return next;
}
function upVisitDirty(form){if(form?.querySelector('.visit-feedback'))form.querySelector('.visit-feedback').textContent='有修改尚未保存';}
function upVisitValues(form){
  return {date:/^\d{4}-\d{2}-\d{2}$/.test(form.querySelector('input[type=date]').value)?form.querySelector('input[type=date]').value:'',
    rating:+form.querySelector('[data-rating-input]').value||0,note:form.querySelector('textarea').value.trim().slice(0,3000),
    photos:typeof MP!=='undefined'&&form.querySelector('.mp-edit')?MP.clean(MP.editIDs(form.querySelector('.mp-edit'))):[]};
}
function upSaveVisit(u,values,markBeen,entryID){
  if(upReadError){toast('旅行记录暂时无法读取，请先备份');return false;}
  const visits=upVisits(u).map(v=>({...v})),id=entryID||visits[visits.length-1]?.id||'new',at=visits.findIndex(v=>v.id===id);
  if(markBeen){const entry={...values,id:at>=0?id:upUid()};if(at>=0)visits[at]=entry;else visits.push(entry);}else if(at>=0)visits.splice(at,1);
  const latest=visits[visits.length-1],summary=latest?{date:latest.date,rating:latest.rating,note:latest.note}:{...values,date:'',rating:0};
  const nextPersonal={...PERSONAL,records:Object.assign(Object.create(null),PERSONAL.records,{[u]:{...summary,visits}})},nextFav=Object.assign(Object.create(null),FAV);
  if(visits.length){if(nextFav[u]?.[0]!==2)nextFav[u]=[2,Date.now()];}else if(nextFav[u]?.[0]===2)delete nextFav[u];
  let oldPersonal,oldFav;
  try{
    oldPersonal=localStorage.getItem('mg-personal');oldFav=localStorage.getItem('mg-fav');
    localStorage.setItem('mg-personal',JSON.stringify(nextPersonal));localStorage.setItem('mg-fav',JSON.stringify(nextFav));
  }catch(e){try{if(oldPersonal!==undefined)oldPersonal===null?localStorage.removeItem('mg-personal'):localStorage.setItem('mg-personal',oldPersonal);if(oldFav!==undefined)oldFav===null?localStorage.removeItem('mg-fav'):localStorage.setItem('mg-fav',oldFav);}catch(rollback){}toast('保存失败，更改未生效，请检查存储空间');return false;}
  PERSONAL=nextPersonal;FAV=nextFav;if(typeof MP!=='undefined')MP.gc();return true;
}
function upRefreshVisit(u){
  // keep every visible "去过" button, the detail sheet and the 我的 page in step
  document.querySelectorAll(`.fav[data-u="${CSS.escape(u)}"]`).forEach(x=>{x.setAttribute('aria-pressed',favOf(u)===+x.dataset.v);if(x.dataset.v==='2')x.textContent=upVisitLabel(u);});
  if($('detailDlg').open&&$('detailDlg').dataset.u===u){const old=$('detailBody').querySelector('#mealLog');if(old)old.outerHTML=upVisitHTML(u);const heading=$('visitHeading');if(heading){heading.firstChild.textContent=favOf(u)===2?'我的用餐记录':'记录一次用餐';heading.querySelector('span').textContent=favOf(u)===2?upVisits(u).length+' 次':'评分 · 日期 · 笔记';}}
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
    const log=e.target.closest('.meal-log');if(!log)return;const u=log.dataset.u;
    if(e.target.closest('[data-add-visit]')){const next=upRenderMealLog(log,'new');next.querySelector('.meal-new')?.scrollIntoView({block:'nearest',behavior:'smooth'});return;}
    const edit=e.target.closest('[data-edit-visit]');if(edit){const next=upRenderMealLog(log,edit.dataset.editVisit);next.querySelector('.is-editing')?.scrollIntoView({block:'nearest',behavior:'smooth'});return;}
    if(e.target.closest('[data-cancel-edit]')){upRenderMealLog(log,null);if(typeof MP!=='undefined')MP.gc();return;}
    const del=e.target.closest('[data-delete-visit]');
    if(del){ // two taps: the first arms the button, the second deletes
      if(!del.classList.contains('is-armed')){del.classList.add('is-armed');del.textContent=upVisits(u).length>1?'确认删除这次？':'确认删除？将取消“去过”';clearTimeout(del._t);del._t=setTimeout(()=>{del.classList.remove('is-armed');del.textContent='删除这次';},4000);return;}
      const last=upVisits(u).length===1;if(!upSaveVisit(u,{date:'',rating:0,note:''},false,del.dataset.deleteVisit))return;
      const inSheet=log.closest('#visitDlg');upRefreshVisit(u);if(inSheet&&last)closeAppDialog($('visitDlg'));else if(inSheet)upRenderMealLog(log,null);
      toast(last?'✓ 已删除，这家店已取消“去过”':'✓ 已删除这次用餐，其他记录保留');return;}
    const form=e.target.closest('.visit-form');if(!form)return;
    const star=e.target.closest('[data-rating-star]');
    if(star){const rect=star.getBoundingClientRect(),value=+star.dataset.ratingStar-(e.clientX<rect.x+rect.width/2?.5:0);upSetRating(value,form);form.querySelector('.star-rating').focus({preventScroll:true});upVisitDirty(form);}
    if(e.target.closest('[data-clear-rating]')){upSetRating(0,form);upVisitDirty(form);}
    if(e.target.closest('[data-today]')){form.querySelector('input[type=date]').value=upToday();upVisitDirty(form);}
  });
  document.addEventListener('input',e=>{const form=e.target.closest('.visit-form');if(form)upVisitDirty(form);});
  document.addEventListener('keydown',e=>{
    const stars=e.target.closest?.('.visit-form .star-rating');if(!stars)return;
    const form=stars.closest('.visit-form'),current=+form.querySelector('[data-rating-input]').value;
    const values={ArrowRight:current+.5,ArrowUp:current+.5,ArrowLeft:current-.5,ArrowDown:current-.5,Home:0,End:5};
    if(Object.hasOwn(values,e.key)){e.preventDefault();upSetRating(values[e.key],form);upVisitDirty(form);}
  });
  document.addEventListener('submit',e=>{
    const form=e.target.closest('.visit-form');if(!form)return;e.preventDefault();
    const u=form.dataset.u,v=upVisitValues(form),entry=form.dataset.entry,first=favOf(u)!==2,sheet=form.closest('#visitDlg');
    if(!upSaveVisit(u,v,true,entry))return;
    upRefreshVisit(u);
    if(sheet){closeAppDialog($('visitDlg'));}
    else{const id=entry!=='new'?entry:upVisits(u).at(-1)?.id,card=$('detailBody').querySelector(`.meal-card[data-entry-id="${CSS.escape(id||'')}"]`);if(card){card.classList.add('is-fresh');card.scrollIntoView({block:'nearest',behavior:'smooth'});}}
    toast(first?(v.rating?`✓ 已保存，标记去过 · ${v.rating} 星`:'✓ 已保存，标记去过'):'✓ 已保存');
  });
}

function upIntroHTML(r){
  if(typeof MGIntro==='undefined')return '';
  const t=DB.T[r.ci],c=DB.C[r.co],ctx={city:t[0],country:c[0],cityEn:t[2]||t[0],countryEn:c[1],cuisineEn:r.cue||''};
  const links=MGIntro.links(r,c[1]).map(l=>`<a href="${esc(l.href)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('');
  return `<section class="detail-intro" aria-labelledby="introTitle"><div class="intro-head"><h3 id="introTitle">简介 <span lang="en">About</span></h3></div><p class="intro-zh" lang="zh-CN" translate="no">${esc(MGIntro.zh(r,ctx))}</p><p class="intro-en" lang="en">${esc(MGIntro.en(r,ctx))}</p><div class="intro-review"><span>阅读米其林官方点评</span>${links}</div><p class="intro-note">简介由本站依据名单信息整理，并非米其林评审原文。</p></section>`;
}
function upLocalAddress(r){
  // Official address from the MICHELIN Guide's own Chinese / Japanese site; else the rule-based reference.
  if(r.la){const c=DB.C[r.co][1],ja=c==='Japan',hant=/Hong Kong|Macau|Taiwan/.test(c);
    return {text:r.la,lang:ja?'ja':hant?'zh-Hant':'zh-CN',official:true,label:ja?'米其林指南日文官网地址 · Official Japanese address':hant?'米其林指南繁体中文官网地址 · Official Chinese address':'米其林指南中文官网地址 · Official Chinese address'};}
  const zh=typeof MGAddress!=='undefined'?MGAddress.localize(r.a,DB.C[r.co][0],DB.T[r.ci][0]):'';
  return zh?{text:zh,lang:'zh-CN',official:false,label:'中文参考地址 · 未核实专名保留原文 · Reference translation'}:null;
}
function upAddressHTML(r){
  const loc=upLocalAddress(r);
  const query=encodeURIComponent(r.n+', '+r.a),maps=r.ml?`<a href="${esc(mapLink(r).href)}" target="_blank" rel="noopener">高德地图 AMap ↗</a>`:`<a href="https://www.google.com/maps/search/?api=1&query=${query}&hl=zh-CN" target="_blank" rel="noopener">Google 地图 ↗</a><a href="https://maps.apple.com/?q=${query}${Number.isFinite(r.lat)&&Number.isFinite(r.lng)?'&ll='+r.lat+','+r.lng:''}" target="_blank" rel="noopener">Apple 地图 ↗</a>`;
  return `<div class="address-display">${loc?`<p translate="no" class="address-zh${loc.official?' is-official':''}" lang="${loc.lang}">${esc(loc.text)}</p><small class="address-method">${loc.official?'<b>官方</b> ':''}${esc(loc.label)}</small><p class="address-en" lang="en"><span>EN</span>${esc(r.a)}</p>`:`<p class="address-raw" lang="en">${esc(r.a)}</p>`}<div class="address-tools">${maps}<button type="button" class="linkbtn" data-copy-address="${esc(r.u)}">复制地址 Copy</button></div></div>`;
}
const DETAIL_PHOTOS=new Map();
function upPhotoIndex(co){
  if(DETAIL_PHOTOS.has(co))return DETAIL_PHOTOS.get(co);
  const request=fetch(`photos/country-${co}.json?v=${UPGRADE_VER}-${typeof DATA_VER==="undefined"?"":DATA_VER}`).then(res=>{if(!res.ok)throw new Error('photo-index');return res.json();}).then(data=>{if(data.country!==DB.C[co][1]||!data.items||typeof data.items!=='object')throw new Error('photo-country');return data.items;}).catch(()=>{if(DETAIL_PHOTOS.get(co)===request)DETAIL_PHOTOS.delete(co);return null;});
  DETAIL_PHOTOS.set(co,request);return request;
}
async function upLoadDetailPhoto(r){
  const hero=$('detailBody').querySelector('.detail-hero'),img=hero.querySelector('.detail-photo'),credit=$('detailBody').querySelector('.detail-photo-credit');
  const current=()=>$('detailDlg').open&&$('detailDlg').dataset.u===r.u&&$('detailBody').querySelector('.detail-hero')===hero;
  const items=await upPhotoIndex(r.co);if(!current()||!items)return;
  const file=items[r.u];if(typeof file!=='string'||!/^[a-f0-9]{32}\.(jpeg|jpg|png|webp)$/.test(file))return;
  img.onload=()=>{if(!current())return;img.hidden=false;hero.classList.add('has-photo');credit.hidden=false;};
  img.onerror=()=>{if(!current())return;img.hidden=true;hero.classList.remove('has-photo');credit.hidden=true;};
  img.src=`https://prod-pics.guide.michelin.com/api/public/content/${file}?format=webp&w=1200&h=800`;
}
function upOpenDetail(u,push=true){
  const r=DB.byU[u];if(!r){toast('这家餐厅不在现有名单中，请核对链接');return;}
  if(push){const url=upDetailURL(u);if(url!==location.href)history.pushState(null,'',url);}
  $('detailDlg').dataset.u=u;const m=mapLink(r);
  $('detailBody').innerHTML=`<header class="detail-hero"><img class="detail-photo" alt="${esc(r.zh||r.n)} · 米其林指南配图" decoding="async" referrerpolicy="no-referrer" hidden><div class="detail-hero-content"><span class="detail-hero-kicker">THE MICHELIN SELECTION</span><h2 class="detail-title" id="detailTitle" tabindex="-1">${esc(r.zh||r.n)}</h2>${r.zh?`<p class="detail-origin">${esc(r.n)}${r.kind===2?' · 参考译名，非官方中文名':''}</p>`:r.zhn&&r.zhn!==r.n?`<p class="detail-origin" translate="no" lang="zh">${esc(r.zhn)}</p>`:''}<p>${esc(DB.C[r.co][0])} · ${esc(DB.T[r.ci][0])}</p>${badge(r)} ${tagsHTML(r)}</div></header><p class="detail-photo-credit" hidden><a href="https://guide.michelin.com/en/${esc(r.u)}" target="_blank" rel="noopener">图片来源：米其林指南 ↗</a><span>摄影版权归原权利人</span></p><dl class="detail-facts">${r.cu?`<dt>菜系</dt><dd>${esc(r.cu)}</dd>`:''}${r.a?`<dt>地址</dt><dd data-detail-address>${upAddressHTML(r)}</dd>`:''}${r.p?`<dt>价位</dt><dd>${'$'.repeat(r.p)} · 当地价位</dd>`:''}</dl>${typeof MGUpdates!=='undefined'?MGUpdates.detailHTML(r):''}${upIntroHTML(r)}<div class="detail-actions"><a href="https://guide.michelin.com/en/${esc(r.u)}" target="_blank" rel="noopener">米其林页面</a><a href="${esc(m.href)}" target="_blank" rel="noopener">导航</a>${r.w?`<a href="${esc(r.w)}" target="_blank" rel="noopener">官网 / 查询预约</a>`:''}<button class="linkbtn" id="copyRestaurant">复制餐厅链接</button></div><div class="links"><button class="fav" data-u="${esc(u)}" data-v="1" aria-pressed="${favOf(u)===1}">想去</button><button class="linkbtn" data-trip-pick="${esc(u)}">加入旅行</button></div><details class="detail-prices" ${(PRICE_DB.items[r.u]||[]).length?'':'hidden'}><summary>参考消费</summary><div class="price-note">${upPrice(r)}</div></details>${upHistory(r)}<details class="detail-record" open><summary id="visitHeading">${favOf(u)===2?'我的用餐记录':'记录一次用餐'}<span>${favOf(u)===2?upVisits(u).length+' 次':'评分 · 日期 · 笔记'}</span></summary>${upVisitHTML(u)}</details><p class="note">只保存在本设备，可在“我的”里导出备份。</p>`;
  document.title=(r.zh||r.n)+' · 米其林全球名录';if(!$('detailDlg').open)showAppDialog($('detailDlg'));$('detailDlg').scrollTop=0;$('detailTitle').focus({preventScroll:true});upLoadDetailPhoto(r);
}
function upRestoreDetail(){
  if(!DB)return;const u=new URL(location.href).searchParams.get('restaurant');
  if(u)upOpenDetail(u,false);else if($('detailDlg').open)closeAppDialog($('detailDlg'));
}
function upInit(){
  document.body.insertAdjacentHTML('beforeend',`<dialog id="detailDlg" aria-labelledby="detailTitle"><div class="dlg"><div class="detail-sheet-head"><button type="button" class="detail-drag" tabindex="-1" data-close aria-label="下滑或点击关闭餐厅详情"><span></span></button><button type="button" class="close" data-close>关闭</button></div><div id="detailBody"></div></div></dialog><dialog id="visitDlg" class="visit-sheet" aria-labelledby="visitTitle"><div class="dlg"><div class="detail-sheet-head"><button type="button" class="detail-drag" tabindex="-1" data-close aria-label="下滑或点击关闭用餐记录"><span></span></button><button type="button" class="close" data-close>关闭</button></div><p class="visit-kicker">去过 · 我的评分</p><h2 id="visitTitle"></h2><p class="detail-origin" id="visitMeta"></p><div id="visitBody"></div></div></dialog><dialog id="tripDlg" aria-labelledby="tripTitle"><div class="dlg"><button type="button" class="close" data-close>关闭</button><h2 id="tripTitle"></h2><form id="tripForm" class="upgrade-form"><label>旅行名称<input id="tripName" maxlength="100" required placeholder="例如：2026 欧洲旅行"></label><button class="btn primary" type="submit">保存名称</button></form><div class="row"><button class="btn primary" id="tripRoute" data-trip-route="">排路线</button><button class="btn" id="tripMap">在地图上查看</button><button class="btn danger" id="tripDelete">删除旅行清单</button></div><div id="tripItems" class="trip-content"></div></div></dialog><dialog id="tripPickDlg" aria-labelledby="tripPickTitle"><div class="dlg"><button type="button" class="close" data-close>关闭</button><h2 id="tripPickTitle"></h2><form id="tripPickForm" class="upgrade-form"><div id="tripPickChoices"></div><label>或创建新旅行<input id="tripQuickName" maxlength="100" placeholder="输入旅行名称"></label><button type="submit" class="btn primary">保存到所选旅行</button></form></div></dialog>`);
  $('meStats').insertAdjacentHTML('beforebegin',`<section class="passport-feature" aria-label="我的美食护照"><div id="passportContent"></div></section><section class="travel-section"><div class="section-heading"><h3>旅行美食地图</h3><button class="linkbtn" id="newTrip">新建旅行</button></div><p class="note" id="tripIntro">为下一段旅程，收藏想去的餐厅。</p><div id="tripCards"></div></section>`);
  $('browse').insertAdjacentHTML('afterbegin',`<h2 id="travelMapTitle" class="travel-map-title" hidden>旅行美食地图</h2><div class="journey-tools" id="travelControls" hidden><div class="travel-field"><label for="tripFilter">旅行</label><select id="tripFilter" aria-label="按旅行清单筛选"></select></div><div class="travel-field" id="tripCityField" hidden><label id="tripCityLabel" for="tripCityFilter">城市</label><select id="tripCityFilter" aria-label="按旅行城市筛选"></select></div><button type="button" class="linkbtn" id="newTripFromMap">新建旅行</button></div><div class="journey-banner" id="journeyBanner" hidden><span id="journeyLabel"></span><button class="linkbtn" id="exitJourney">清除</button></div><p class="search-note" id="searchNote" hidden>以下为拼写相近的结果。</p>`);
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
  upBindPassport();
  document.addEventListener('click',e=>{
    const address=e.target.closest('[data-copy-address]');if(address){const r=DB.byU[address.dataset.copyAddress];if(r){const loc=upLocalAddress(r);copyText((loc?loc.text+'\n':'')+r.a).then(()=>toast('已复制地址'),()=>toast('复制失败，请长按地址复制'));}return;}
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
  $('detailDlg').addEventListener('close',()=>{const url=new URL(location.href);url.searchParams.delete('restaurant');history.replaceState(null,'',url);updatePageIdentity();});
  upBindDetailSwipe();upBindDetailSwipe('visitDlg');upBindVisitForms();upInitShare();
  window.addEventListener('popstate',upRestoreDetail);

  upRender();upRestoreDetail();
  fetch('prices.json').then(r=>{if(!r.ok)throw new Error('prices');return r.json();}).then(p=>{
    PRICE_DB={items:{}};for(const [u,items] of Object.entries(p.items||{}))if(DB.byU[u]&&Array.isArray(items))PRICE_DB.items[u]=items.filter(x=>x&&/^https:\/\//.test(x.source)&&/^\d{4}-\d{2}-\d{2}$/.test(x.checked)&&/^[A-Z]{3}$/.test(x.currency)&&Number.isFinite(x.min)&&Number.isFinite(x.max)&&x.min>=0&&x.max>=x.min&&['meal','basis','includes'].every(k=>typeof x[k]==='string'));

    if($('detailDlg').open){const r=DB.byU[$('detailDlg').dataset.u];$('detailBody').querySelector('.price-note').innerHTML=upPrice(r);$('detailBody').querySelector('.detail-prices').hidden=!(PRICE_DB.items[r.u]||[]).length;}

  }).catch(()=>{});
}

/* Original bilingual restaurant summaries, written only from this site's own facts
   (city, cuisine, award, yearly history, Green Star, Black Pearl, price tier, official address).
   No MICHELIN editorial text is copied; the full review is linked instead. */
const MGIntro=(()=>{
  'use strict';
  const ZH_LV=['米其林三星','米其林二星','米其林一星','必比登推介','米其林指南入选餐厅'];
  const EN_LV=['three MICHELIN Stars','two MICHELIN Stars','one MICHELIN Star','a Bib Gourmand','a place in the MICHELIN Guide'];
  const ZH_SHORT=['三星','二星','一星','必比登','入选'],EN_SHORT=['3 Stars','2 Stars','1 Star','Bib Gourmand','Selected'];
  const ZH_MEANS=['按指南的定义，这是“值得专程前往”的级别。','按指南的定义，这是“值得绕道前往”的级别。','按指南的定义，这是“值得停车一尝”的级别。','这一荣誉授予价格相对亲民、品质出色的餐厅。',''];
  const EN_MEANS=['In the Guide’s own terms, that means exceptional cuisine worth a special journey.','In the Guide’s own terms, that means excellent cooking worth a detour.','In the Guide’s own terms, that means high-quality cooking worth a stop.','The distinction marks good-value cooking.',''];
  const ZH_PRICE=['','价位在当地属于亲民一档。','价位在当地属于中等。','价位在当地属于偏高一档。','价位在当地属于最高一档。'];
  const EN_PRICE=['','Prices are at the gentle end for the area.','Prices are moderate for the area.','Prices are on the high side for the area.','Prices are in the top bracket for the area.'];
  const GENERIC=new Set('bakery beef cheese chicken classic contemporary cooking country crab creative curry deli dishes duck dumplings eel farm fish fondue food freshwater fusion gastropub grills home hotpot influences innovative international meats modern noodles organic pizza pork regional rice roast seafood seasonal sharing small specialities steakhouse street traditional vegan vegetarian world congee sushi ramen tempura yakitori izakaya teppanyaki tonkatsu udon soba unagi oden kushiage sukiyaki shabu-shabu onigiri obanzai yoshoku shojin fugu pufferfish raclette crêpe bibimbap bulgogi mandu dim sum'.split(' '));
  const enCuisine=c=>c.replace(/ Cuisine$/,'').split(' ').map(w=>GENERIC.has(w.toLowerCase())?w.toLowerCase():w).join(' ');
  const ZH_NUM=['零','一','两','三','四','五','六'];
  const LOCALE={'Chinese Mainland':'sg/zh_CN','Hong Kong SAR':'hk/zh_HK','Macau SAR':'mo/zh_HK','Taiwan Region':'tw/zh_TW','Japan':'jp/ja'};
  const LOCALE_NAME={'Chinese Mainland':'中文版','Hong Kong SAR':'繁体中文版','Macau SAR':'繁体中文版','Taiwan Region':'繁体中文版','Japan':'日文版'};

  // Yearly record: 2022–2025 from snapshots, current year = present award.
  function record(r,year=2026){
    const list=[...(r.h||'').padEnd(4,'?').slice(0,4)].map((c,i)=>({y:year-4+i,l:/^[0-4]$/.test(c)?+c:null,known:c!=='?'})).concat([{y:year,l:r.l,known:true}]);
    let streak=0;for(let i=list.length-1;i>=0&&list[i].l===r.l;i--)streak++;
    const prev=list[list.length-2],known=list.filter(x=>x.known);
    const first=list.find(x=>x.l!==null);
    return {list,streak,prev:prev.known?prev.l:undefined,firstYear:first?first.y:year,fullyKnown:known.length===list.length};
  }
  function district(r){
    const m=(r.la||'').match(/^(?:〒\S+\s)?(?:\d{3,5}\s)?(.{1,4}?[市都府県縣])(.{1,6}?[区區县縣])/);
    return m?m[2]:'';
  }
  function zh(r,ctx){
    const name=r.zh||r.n,city=ctx.city,country=ctx.country,cu=r.cu||'',rec=record(r),out=[];
    const where=['中国内地','中国香港','中国澳门','中国台湾'].includes(country)?city:(country===city?city:country+city);
    const d=district(r);
    out.push(`${name}${r.zh&&r.zh!==r.n?`（${r.n}）`:''}是位于${where}${d&&!where.includes(d)?d:''}的${cu}餐厅，${r.l===4?'入选米其林指南':'现获'+ZH_LV[r.l]}。`);
    if(ZH_MEANS[r.l])out.push(ZH_MEANS[r.l]);
    if(rec.fullyKnown||rec.streak>=2){
      if(rec.streak>=5&&r.l<=3)out.push(`${rec.list[0].y} 年以来连续${ZH_NUM[rec.streak]}年保持${ZH_SHORT[r.l]}。`);
      else if(rec.streak>=2&&r.l<=3)out.push(`已连续${ZH_NUM[rec.streak]}年获评${ZH_SHORT[r.l]}。`);
      else if(rec.prev!==undefined&&rec.prev!==null&&rec.prev>r.l)out.push(`今年由${ZH_SHORT[rec.prev]}升为${ZH_SHORT[r.l]}。`);
      else if(rec.prev!==undefined&&rec.prev!==null&&rec.prev<r.l)out.push(`去年为${ZH_SHORT[rec.prev]}。`);
      else if(rec.prev===null)out.push(rec.firstYear===rec.list.at(-1).y?'今年首次进入指南名单。':`${rec.firstYear} 年起进入指南名单。`);
    }
    if(r.green)out.push('它还获得米其林绿星，表彰其在可持续美食方面的实践。');
    if(r.bp)out.push(`在本土的黑珍珠餐厅指南中，它获评${'一二三'[r.bp-1]}钻。`);
    if(ZH_PRICE[r.p])out.push(ZH_PRICE[r.p]);
    return out.join('');
  }
  function en(r,ctx){
    const rec=record(r),out=[],cu=ctx.cuisineEn;
    const where=ctx.countryEn.startsWith(ctx.cityEn)?ctx.cityEn:`${ctx.cityEn}, ${ctx.countryEn}`;
    const c=cu?enCuisine(cu):'',an=/^[aeiou]/i.test(c)?'an':'a';
    const kind=!c?'a restaurant':/,| and /.test(c)?`a restaurant serving ${c}`:`${an} ${c} restaurant`;
    out.push(`${r.n} is ${kind} in ${where}, ${r.l===4?'listed in the MICHELIN Guide':'currently holding '+EN_LV[r.l]}.`);
    if(EN_MEANS[r.l])out.push(EN_MEANS[r.l]);
    const nums=['zero','one','two','three','four','five','six'];
    if(rec.fullyKnown||rec.streak>=2){
      if(rec.streak>=2&&r.l<=3)out.push(`It has kept this rating for ${nums[rec.streak]} consecutive years${rec.streak>=5?` since ${rec.list[0].y}`:''}.`);
      else if(rec.prev!=null&&rec.prev>r.l)out.push(`This year it moved up from ${EN_SHORT[rec.prev]} to ${EN_SHORT[r.l]}.`);
      else if(rec.prev!=null&&rec.prev<r.l)out.push(`Last year it held ${EN_SHORT[rec.prev]}.`);
      else if(rec.prev===null)out.push(rec.firstYear===rec.list.at(-1).y?'It joined the Guide this year.':`It has been in the Guide since ${rec.firstYear}.`);
    }
    if(r.green)out.push('It also holds a MICHELIN Green Star for sustainable gastronomy.');
    if(r.bp)out.push(`China’s Black Pearl guide rates it ${r.bp} diamond${r.bp>1?'s':''}.`);
    if(EN_PRICE[r.p])out.push(EN_PRICE[r.p]);
    return out.join(' ');
  }
  function links(r,countryEn){
    const en={href:'https://guide.michelin.com/en/'+r.u,label:'英文版 English'};
    const loc=LOCALE[countryEn];
    return r.la&&loc?[{href:`https://guide.michelin.com/${loc}/${r.u}`,label:LOCALE_NAME[countryEn]},en]:[en];
  }
  const space=t=>t.replace(/([\u3400-\u9fff])(?=[A-Za-zÀ-ÿ])/g,'$1 ').replace(/([A-Za-zÀ-ÿ.)])(?=[\u3400-\u9fff])/g,'$1 ');
  return {zh:(r,c)=>space(zh(r,c)),en,links,record,district};
})();
if(typeof module!=='undefined')module.exports=MGIntro;

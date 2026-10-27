const {test}=require('node:test'),assert=require('node:assert/strict'),I=require('../restaurant-intro'),d=require('../data.json');
const mk=r=>{const t=d.cities[r[3]],c=d.countries[t[1]];return [{n:r[0],zh:r[1],l:r[4],cu:r[5]>=0?d.cuisines[r[5]]:'',p:r[6],u:r[7],h:r[13]||'',green:!!r[12],bp:r[14]||0,la:r[15]||''},{city:t[0],country:c[0],cityEn:t[2],countryEn:c[1],cuisineEn:r[5]>=0?d.cuisines_en[r[5]]:''}];};
test('every restaurant gets a clean bilingual intro built from facts',()=>{
  assert.equal(d.cuisines_en.length,d.cuisines.length);assert(d.cities.every(c=>typeof c[2]==='string'&&c[2]));
  for(const r of d.r){const [o,c]=mk(r);const zh=I.zh(o,c),en=I.en(o,c);
    assert(zh.length>15&&en.length>30);assert(!/undefined|\bnull\b|位于的/.test(zh.split(o.zh||o.n).join('')+en.split(o.n).join('')),o.n);}
});
test('facts drive the wording',()=>{
  const [o,c]=mk(d.r.find(r=>r[0]==='Taian Table'));
  assert.match(I.zh(o,c),/^泰安门（Taian Table）是位于上海长宁区的.+餐厅，现获米其林三星。/);assert.match(I.zh(o,c),/连续五年保持三星/);
  assert.match(I.en(o,c),/three MICHELIN Stars.*five consecutive years since 2022/);
  assert.deepEqual(I.links(o,c.countryEn).map(l=>l.href),['https://guide.michelin.com/sg/zh_CN/'+o.u,'https://guide.michelin.com/en/'+o.u]);
  const up={n:'X',zh:'',l:1,cu:'',p:0,u:'a/restaurant/x',h:'---2'};assert.match(I.zh(up,{city:'巴黎',country:'法国',cityEn:'Paris',countryEn:'France'}),/今年由一星升为二星/);
  const fresh={n:'Y',zh:'',l:4,cu:'',p:0,u:'a/restaurant/y',h:'----'};assert.match(I.en(fresh,{city:'巴黎',country:'法国',cityEn:'Paris',countryEn:'France'}),/joined the Guide this year/);
  assert.equal(I.links({u:'a/restaurant/z',la:''},'France').length,1);
});

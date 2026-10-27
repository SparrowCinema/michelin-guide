const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),city=require('../city-names.js'),data=JSON.parse(fs.readFileSync(path.join(root,'data.json'),'utf8'));
test('all current cities get Chinese labels while indices, originals and editions stay stable',()=>{
  const d=structuredClone(data),before=structuredClone(d);city.apply(d);
  assert.equal(d.cities.length,before.cities.length);assert.deepEqual(d.r,before.r);assert.deepEqual(d.countries,before.countries);
  d.cities.forEach((t,i)=>{assert.match(t[0],/[\u3400-\u9fff]/);assert.notEqual(t[0],'未定译名');assert.deepEqual(t.slice(1),before.cities[i].slice(1));assert(['e','g','r'].includes(city.info(d.countries[t[1]][1],t[2])[1]));});
});
test('city overlays use country and original name, and are idempotent',()=>{
  const d=structuredClone(data);city.apply(d);const a=structuredClone(d);city.apply(d);assert.deepEqual(d,a);
  assert.equal(city.info('Italy','Brusaporto')[0],'布鲁萨波尔托');assert.equal(city.info('France','Brusaporto'),null);
});

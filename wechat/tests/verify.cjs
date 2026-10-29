const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../../'),p=path.join(root,'wechat'),source=JSON.parse(fs.readFileSync(path.join(root,'data.json')));
const rows=Array.from({length:5},(_,i)=>require(path.join(p,`dataset${i}/rows.js`))).flat();
assert.deepEqual(rows,source.r);assert.deepEqual(require('../data/meta'),Object.fromEntries(Object.entries(source).filter(([k])=>k!=='r')));
for(let i=0;i<5;i++)assert.ok(fs.statSync(path.join(p,`dataset${i}/rows.js`)).size<1900000);
let app;const req=s=>require(path.join(p,s));req.async=async s=>req(s);
vm.runInNewContext(fs.readFileSync(path.join(p,'app.js'),'utf8'),{require:req,App:a=>app=a,wx:{showLoading(){},hideLoading(){},showToast(){}},Promise});
(async()=>{const all=await app.ensureData();assert.equal(all.length,source.r.length);assert.equal(new Set(all.map(r=>r.id)).size,all.length);assert.equal(all[0].rating,'三星');assert.ok(all.some(r=>r.city==='北京'));
let page;const storage={};const store={get:(k,d)=>storage[k]||d,set:(k,v)=>storage[k]=v};
vm.runInNewContext(fs.readFileSync(path.join(p,'pages/restaurant/index.js'),'utf8'),{require:()=>store,Page:a=>page=a,getApp:()=>app,wx:{showToast(){}}});
page.setData=function(d){Object.assign(this.data,d)};await page.onLoad({id:encodeURIComponent(all[0].id)});page.onShow();
for(let i=1;i<=10;i++){page.rate({currentTarget:{dataset:{value:i/2}}});page.save();assert.equal(storage.records[all[0].id].score,i/2)}
page.clearRating();page.save();assert.equal(storage.records[all[0].id].score,0);assert.equal(storage.been.length,1);
page.data.score=0;page.onShow();assert.equal(page.data.score,0);console.log(`PASS: ${all.length} rows match source; stable IDs, awards, Beijing, package budgets, all 10 half-star values, clear and persistence.`);
})().catch(e=>{console.error(e);process.exitCode=1});

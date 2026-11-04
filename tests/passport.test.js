const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
function fixture(){
 const a={u:'city/restaurant/a',ci:0,co:0,l:2,n:'A',zh:'甲店'},b={u:'city/restaurant/b',ci:0,co:0,l:3,n:'B',zh:'乙店'},c={u:'city/restaurant/c',ci:0,co:0,l:4,n:'C',zh:'丙店'};
 const root={innerHTML:'',querySelector:()=>null,addEventListener:(name,fn)=>{root[name]=fn;}};
 const ctx=vm.createContext({DB:{rows:[a,b,c],T:[['厦门']],C:[['中国','China']]},FAV:{[a.u]:[2,1],[b.u]:[2,1],[c.u]:[1,1]},LVN:['三星','二星','一星','必比登','入选'],esc:s=>String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;'),$:()=>root,favOf:u=>ctx.FAV[u]?.[0]||0,performance:{now:()=>1000}});
 vm.runInContext(fs.readFileSync(require.resolve('../upgrade.js'),'utf8'),ctx);
 vm.runInContext(`PERSONAL.records={'${a.u}':{visits:[{id:'1',date:'2026-01-01'},{id:'2',date:'2026-02-02'}]},'${b.u}':{visits:[{id:'3',date:'2026-02-02'}]}}`,ctx);
 return {ctx,root,a,b,c,run:s=>vm.runInContext(s,ctx)};
}
test('same-day same-city restaurants earn separate stable stamps, repeat meals stay on their own stamp',()=>{
 const {run}=fixture();assert.equal(run('upPassportEntries(DB.rows.slice(0,2)).length'),2);assert.equal(run('upPassportEntries([DB.rows[0],DB.rows[0]])[0].count'),2);assert.equal(run('upPassportEntries([DB.rows[0]])[0].date'),'2026-02-02');assert(run('upPassportEntries(DB.rows)[0].code!==upPassportEntries(DB.rows)[1].code'));assert(run('upPassportEntries([DB.rows[0]])[0].code===upPassportEntries([DB.rows[0]])[0].code'));
});
test('undated visited restaurant earns a stamp; want-only restaurants do not',()=>{
 const {run,root}=fixture();run('PERSONAL.records={}; PASSPORT.open=true; upPassport(DB.rows.filter(r=>favOf(r.u)===2))');assert.equal((root.innerHTML.match(/data-passport-restaurant=/g)||[]).length,2);assert(root.innerHTML.includes('日期未填写'));assert(!root.innerHTML.includes('data-passport-restaurant="city/restaurant/c"'));assert(root.innerHTML.includes('2 枚餐厅专属章'));assert(root.innerHTML.includes('第一枚专属章'));
});
test('honor filtering, ten per page, city denominator and escaped restaurant labels',()=>{
 const {run,root}=fixture();run('PASSPORT.open=true;PASSPORT.honor="3";upPassport(DB.rows.slice(0,2))');assert.equal((root.innerHTML.match(/data-passport-restaurant=/g)||[]).length,1);assert(root.innerHTML.includes('pp-honor-3'));assert.equal(run('upPassportCities(DB.rows.slice(0,2))[0].total'),3);assert.equal(run('upPassportCities([DB.rows[0],DB.rows[0]])[0].n'),1);
 run('PASSPORT.honor="0";upPassport(DB.rows.slice(0,2))');assert(root.innerHTML.includes('暂无此类签章'));
 run('PASSPORT.honor="all";DB.rows=Array.from({length:11},(_,i)=>({...DB.rows[0],u:"r/restaurant/"+i,n:"<unsafe>",zh:""}));upPassport(DB.rows)');assert.equal((root.innerHTML.match(/data-passport-restaurant=/g)||[]).length,10);assert(!root.innerHTML.includes('<unsafe>'));assert(root.innerHTML.includes('&lt;unsafe>'));run('PASSPORT.sheet=2;upPassport(DB.rows)');assert.equal((root.innerHTML.match(/data-passport-restaurant=/g)||[]).length,1);
});
test('stamp opens its own restaurant without mutating stored data',()=>{
 const {ctx,run,root}=fixture();let opened;ctx.upOpenDetail=u=>{opened=u};const before=run('JSON.stringify(PERSONAL)');run('upBindPassport()');root.click({target:{closest:q=>q==='[data-passport-restaurant]'?{dataset:{passportRestaurant:'city/restaurant/b'}}:null}});assert.equal(opened,'city/restaurant/b');assert.equal(run('JSON.stringify(PERSONAL)'),before);
});

test('logical page plan pairs neighbors, keeps an odd final leaf and clamps after filtering',()=>{
 const {run}=fixture();
 assert.equal(run('upPassportPlan(22,0,true).total'),4);assert.equal(run('upPassportPlan(22,1,true).start'),1);assert.equal(run('upPassportPlan(22,1,false).start'),0);assert.equal(run('upPassportPlan(22,3,false).start'),2);assert.equal(run('upPassportPlan(22,3,false).next'),true);assert.equal(run('upPassportPlan(0,100,true).page'),1);assert.equal(run('upPassportPlan(11,2,false).total'),3);
});

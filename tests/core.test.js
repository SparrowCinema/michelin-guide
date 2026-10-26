const {test}=require('node:test'),assert=require('node:assert/strict'),MG=require('../guide-core');
test('accent, ligature and mixed-language search',()=>{
  const aliases={'哥本哈根':['Copenhagen','København'],'法式':['French']};
  const rows=[{k:MG.index(['Geranium','哥本哈根','法式'],aliases)},{k:MG.index(['Crêpe Œuf','巴黎'],aliases)}];
  assert(MG.matcher('Copenhagen 法式',rows).test(rows[0]));
  assert(MG.matcher('crepe oeuf',rows).test(rows[1]));
  assert(MG.matcher('Geranuium',rows).fuzzy);assert(MG.matcher('Geranuium',rows).test(rows[0]));
  assert(!MG.matcher('randommissingcity',rows).test(rows[0]));
  assert(!MG.matcher('Geranium',rows).fuzzy);
  assert(!MG.near('cat','car'));
});
test('validate and merge personal data without destroying old notes or trip members',()=>{
  const byU={a:{},b:{}};
  const old=MG.personal({trips:[{id:'x',name:'欧洲',items:['a']}],records:{a:{note:'old',rating:5,date:'2026-11-26'}}},byU);
  const incoming=MG.personal({trips:[{id:'x',name:'trip',items:['b','missing','b']}],records:{a:{note:'backup',rating:2},b:{note:'new',rating:4}}},byU);
  const result=MG.mergePersonal(old,incoming);
  assert.deepEqual(result.trips[0].items,['a','b']);assert.equal(result.records.a.note,'old');assert.equal(result.records.b.note,'new');assert.equal(old.trips[0].items.length,1);
  assert.equal(MG.personal({trips:[{id:'bad id',name:'<script>',items:['a']}],records:{missing:{note:'no'}}},byU).records.missing,undefined);
  assert.throws(()=>MG.personal({trips:{}},byU));
});

test('preserve retired restaurant IDs and reject corrupt personal containers',()=>{
  const u='france/paris/restaurant/retired';const parsed=MG.personal({trips:[{id:'retired',name:'旧旅行',items:[u]}],records:{[u]:{note:'保留回忆',rating:4}}},{});
  assert.equal(parsed.trips[0].items[0],u);assert.equal(parsed.records[u].note,'保留回忆');
  assert.throws(()=>MG.personal('corrupt',{}));assert.throws(()=>MG.personal([],{}));
});

test('half-star ratings persist with existing integer scores',()=>{
 const byU={a:{},b:{},c:{},d:{}};const p=MG.personal({records:{a:{rating:3.5},b:{rating:5},c:{rating:.5},d:{rating:3.7}}},byU);
 assert.equal(p.records.a.rating,3.5);assert.equal(p.records.b.rating,5);assert.equal(p.records.c.rating,.5);assert.equal(p.records.d.rating,0);
 const restored=MG.personal(JSON.parse(JSON.stringify(p)),byU);assert.equal(restored.records.a.rating,3.5);
});

test('multiple meals survive validation, JSON backups and merging by stable entry ID',()=>{
 const old=MG.personal({records:{a:{visits:[{id:'first',date:'2025-03-01',rating:3.5,note:'first note'},{id:'second',date:'2025-04-02',rating:5,note:'second note'}]}}},{a:{}});
 assert.equal(old.records.a.rating,5);assert.equal(old.records.a.visits.length,2);
 const incoming=MG.personal({records:{a:{visits:[{id:'first',rating:1,note:'overwrite'},{id:'third',date:'2025-05-03',rating:4.5,note:'third note'},{id:'third',rating:2}]}}},{a:{}});
 const merged=MG.mergePersonal(old,incoming),restored=MG.personal(JSON.parse(JSON.stringify(merged)),{a:{}});
 assert.equal(restored.records.a.visits.length,3);assert.equal(restored.records.a.visits.find(v=>v.id==='first').note,'first note');assert.equal(restored.records.a.visits.find(v=>v.id==='third').rating,4.5);assert.equal(restored.records.a.rating,5);
 const tenth=MG.personal({records:{a:{visits:Array.from({length:10},(_,i)=>({id:'meal-'+i,date:'2025-01-01',rating:i%2?4.5:5,note:'Meal '+i}))}}},{a:{}});assert.equal(tenth.records.a.visits.length,10);
});

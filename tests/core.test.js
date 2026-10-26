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

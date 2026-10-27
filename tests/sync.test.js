const {test}=require('node:test'),assert=require('node:assert/strict');
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};global.crypto=require('node:crypto').webcrypto;
const S=require('../cloud-sync');
const doc=(fav,records={},trips=[])=>({v:1,fav,personal:{version:2,trips,records}});
test('sync codes are random, well-formed and normalise from sloppy input',()=>{
  const a=S.newCode(),b=S.newCode();assert.match(a,/^MG(-[A-Z2-9]{4}){6}$/);assert.notEqual(a,b);
  assert.equal(S.normalize(' mg '+a.slice(3).toLowerCase().replaceAll('-',' ')),a);assert.equal(S.normalize('MG-1234'),'');
});
test('three-way merge keeps both devices’ edits and carries deletions',()=>{
  const base=doc({a:[1,1],b:[2,1],c:[1,1]},{b:{date:'2026-01-01',rating:4,note:'',visits:[{id:'v1',date:'2026-01-01',rating:4,note:''}]}},[{id:'t1',name:'Paris',items:['a'],created:1}]);
  const phone=doc({a:[2,5],b:[2,1]},{b:{date:'2026-02-01',rating:5,note:'',visits:[{id:'v1',date:'2026-01-01',rating:4,note:''},{id:'v2',date:'2026-02-01',rating:5,note:''}]}},[{id:'t1',name:'Paris',items:['a','b'],created:1}]); // c deleted, a → been, new meal
  const laptop=doc({a:[1,1],b:[2,1],c:[1,1],d:[1,9]},{b:{date:'2026-01-01',rating:4,note:'',visits:[{id:'v1',date:'2026-01-01',rating:4,note:'great',photos:['p-x1-aaaa']}]}},[{id:'t1',name:'Paris 2026',items:['a','c'],created:1},{id:'t2',name:'Tokyo',items:[],created:2}]);
  const m=S.merge(base,phone,laptop);
  assert.deepEqual(Object.keys(m.fav).sort(),['a','b','d']);assert.deepEqual(m.fav.a,[2,5]);
  const vs=m.personal.records.b.visits;assert.deepEqual(vs.map(v=>v.id),['v1','v2']);assert.equal(m.personal.records.b.rating,5);
  assert.equal(vs[0].note,'great','only the laptop changed meal v1, so its note and photo are kept');assert.deepEqual(vs[0].photos,['p-x1-aaaa']);
  // a meal edited differently on both devices: this device wins for that meal
  const both=S.merge(base,doc({},{b:{visits:[{id:'v1',date:'2026-01-01',rating:3,note:'phone'}]}}),doc({},{b:{visits:[{id:'v1',date:'2026-01-01',rating:2,note:'laptop'}]}}));assert.equal(both.personal.records.b.visits[0].note,'phone');
  assert.deepEqual(m.personal.trips.map(t=>t.id),['t1','t2']);assert.deepEqual(m.personal.trips[0].items.sort(),['a','b','c']);
  // first connection (no base) is a union, nothing lost
  const u=S.merge(null,doc({x:[1,1]}),doc({y:[2,1]}));assert.deepEqual(Object.keys(u.fav).sort(),['x','y']);
  // unchanged on one side → the other side's edit wins, including deletion
  assert.deepEqual(S.merge(base,base,phone),phone);
});

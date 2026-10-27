const {test}=require('node:test'),assert=require('node:assert/strict'),M=require('../trip-route');
const perm=a=>a.length<=1?[a]:a.flatMap((x,i)=>perm(a.filter((_,j)=>j!==i)).map(p=>[x,...p]));
test('route order matches brute force on small trips and splits into days',()=>{
  let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  for(let t=0;t<25;t++){const q=Array.from({length:7},(_,i)=>({lat:35.6+rnd()*.15,lng:139.6+rnd()*.2,i}));
    const best=Math.min(...perm(q).map(p=>M.pathLen(p)));assert(M.pathLen(M.order(q))<=best*1.02);}
  const pts=Array.from({length:5},(_,i)=>({lat:31.2+i*.01,lng:121.4+i*.01}));
  const days=M.plan(pts,{perDay:2});assert.deepEqual(days.map(d=>d.stops.length),[2,2,1]);
  assert.equal(days[0].legs.length,1);assert(days[0].legs[0].walk);
  const me={lat:31.1,lng:121.3,me:true},withStart=M.plan(pts,{perDay:3,start:me});
  assert(withStart[0].first&&withStart[0].first.road>0);assert.equal(withStart[0].stops[0],pts[0]);
  assert.equal(M.fmtKm(.534),'530 米');assert.equal(M.fmtKm(12.4),'12 公里');assert.equal(M.fmtMin(75),'1 小时15 分');
});

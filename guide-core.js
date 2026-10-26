/* Shared, dependency-free search and personal-data validation. */
(function(root){
  'use strict';
  const norm=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
    .replace(/ß/g,'ss').replace(/æ/g,'ae').replace(/œ/g,'oe').replace(/ø/g,'o').replace(/ł/g,'l')
    .replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  function index(parts,aliases){return norm(parts.flatMap(s=>[s,...((aliases||{})[s]||[])]).join(' '));}
  function near(a,b){
    if(a===b)return true;if(a.length<5||Math.abs(a.length-b.length)>1)return false;
    // One insertion, deletion, substitution, or adjacent transposition; Latin words only.
    if(!/^[a-z]+$/.test(a+b))return false;
    if(a.length===b.length){const d=[];for(let i=0;i<a.length;i++)if(a[i]!==b[i])d.push(i);
      return d.length===1||(d.length===2&&d[1]===d[0]+1&&a[d[0]]===b[d[1]]&&a[d[1]]===b[d[0]]);}
    if(a.length>b.length)[a,b]=[b,a];let i=0,j=0,n=0;
    while(i<a.length&&j<b.length){if(a[i]===b[j]){i++;j++;}else{if(++n>1)return false;j++;}}return true;
  }
  function matcher(query,rows){
    const tokens=norm(query).split(/\s+/).filter(Boolean);
    const exact=r=>tokens.every(t=>r.k.includes(t));
    if(!tokens.length||rows.some(exact))return {test:exact,fuzzy:false};
    const fuzzy=r=>tokens.every(t=>r.k.includes(t)||r.k.split(' ').some(w=>near(t,w)));
    return {test:fuzzy,fuzzy:true};
  }
  function personal(raw,byU){
    const trips=[],records=Object.create(null),ids=new Set();
    const validID=u=>typeof u==='string' && (Object.hasOwn(byU,u)||/^[^\s<>]{1,500}\/restaurant\/[^\s<>]{1,500}$/.test(u));
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid personal data');
    if(raw.trips!==undefined&&(!Array.isArray(raw.trips)||raw.trips.length>300))throw new Error('Invalid trips');
    for(const t of (raw.trips||[]).slice(0,300)){
      if(!t||typeof t.name!=='string'||!t.name.trim()||!Array.isArray(t.items))continue;
      let id=typeof t.id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(t.id)?t.id:'';
      if(!id||ids.has(id))id='trip-'+Date.now().toString(36)+'-'+trips.length;
      ids.add(id);trips.push({id,name:t.name.trim().slice(0,100),items:[...new Set(t.items.filter(u=>validID(u)))],created:Number.isFinite(t.created)?t.created:Date.now()});
    }
    if(raw.records&&typeof raw.records==='object')for(const [u,r] of Object.entries(raw.records)){
      if(!validID(u)||!r||typeof r!=='object')continue;
      const date=typeof r.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date)?r.date:'';
      records[u]={date,rating:[1,2,3,4,5].includes(r.rating)?r.rating:0,note:typeof r.note==='string'?r.note.slice(0,3000):''};
    }
    return {version:2,trips,records};
  }
  function mergePersonal(old,incoming){
    const trips=old.trips.map(t=>({...t,items:t.items.slice()}));
    for(const t of incoming.trips){const prev=trips.find(p=>p.id===t.id);
      if(prev){prev.items=[...new Set([...prev.items,...t.items])];}else trips.push(t);}
    if(trips.length>300)throw new Error('旅行清单超过 300 个，请拆分备份');
    // Existing personal notes win when merging a backup; no silent overwrite.
    return {version:2,trips,records:Object.assign(Object.create(null),incoming.records,old.records)};
  }
  const api={norm,index,near,matcher,personal,mergePersonal};
  if(typeof module!=='undefined')module.exports=api;else root.MG=api;
})(typeof window!=='undefined'?window:globalThis);

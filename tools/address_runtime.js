(()=>{
  const config=__CONFIG__,cache=new WeakMap(),placeCache=new Map(),escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const norm=s=>s.toLowerCase().replace(/\u0307/g,'').replace(/ı/g,'i');
  function words(text,mapping){if(!mapping||!Object.keys(mapping).length)return text;let data=cache.get(mapping);if(!data){const keys=Object.keys(mapping).sort((a,b)=>b.length-a.length),lower=Object.fromEntries(keys.map(k=>[norm(k),mapping[k]]));data={pattern:new RegExp('(?<![A-Za-z])(?:'+keys.map(escape).join('|')+')(?![A-Za-z])','gi'),lower};cache.set(mapping,data);}return text.replace(data.pattern,m=>data.lower[norm(m)]||m);}
  const numbers=s=>{const map=new Map();for(const n of s.match(/\d+/g)||[])map.set(n,(map.get(n)||0)+1);return map;};
  function localize(address,country,city){
    const key=country+'|'+city;if(!placeCache.has(key))placeCache.set(key,Object.fromEntries(Object.entries(config.places).filter(([,value])=>value===country||value===city)));
    let text=words(address,placeCache.get(key));
    if(country.startsWith('中国'))text=text.split(',').map(p=>config.districts[p.trim()]||p.trim()).join(',');
    text=words(text,config.roads[city]);
    text=text.replace(/\b(B\d+)\b/gi,'地下$1层').replace(/\b(\d+(?:-\d+)?)\s*(?:F\b|(?:st|nd|rd|th)?\s+Floor\b)/gi,'$1层')
      .replace(/\b(?:Building|Block)\s*(?:No\.?\s*)?([A-Za-z]?\d+[A-Za-z]?)/gi,'$1号楼').replace(/\bNo\.?\s*(\d+(?:[-/]\d+)*[A-Za-z]?)/gi,'$1号')
      .replace(/\b(?:Shop|Unit|Room|Suite)\s+([A-Za-z]?\d+(?:[-/]\d+)*[A-Za-z]?)/gi,'$1室').replace(/\bLane\s+(\d+)\b/gi,'$1弄');
    text=words(text,config.terms);
    let parts=text.split(',').map(p=>p.trim()).filter(Boolean);if(country.startsWith('中国'))parts.reverse();
    const kinds={rue:'街',avenue:'大道',boulevard:'大道',via:'街',viale:'大道',calle:'街',carrer:'街',chemin:'路',route:'路'};
    parts=parts.map(part=>{const m=part.match(/^(\d+[A-Za-z]?(?:[-/]\d+)*)\s+((rue|avenue|boulevard|via|viale|calle|carrer|chemin|route)\b.+)$/i);if(m)return m[2]+'（'+kinds[m[3].toLowerCase()]+'）'+m[1]+'号';const chinese=part.match(/^(\d+[A-Za-z]?(?:[-/]\d+)*)\s+(.+[\u3400-\u9fff])$/);return chinese?chinese[2]+chinese[1]+'号':part;});
    const result=[...new Set([country,city,...parts])].join(' · '),before=numbers(address),after=numbers(result);
    return [...before].every(([n,count])=>(after.get(n)||0)>=count)?result:country+' · '+city+' · '+address;
  }
  return {localize};
})()

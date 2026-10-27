"""Build on-demand country photo indices, with auditable identity checks (never name alone).
Usage: python tools/build_photos.py --csv /path/to/michelin_all.csv
The source exports MICHELIN page JSON-LD image URLs; images remain on MICHELIN's CDN.
"""
import argparse,csv,hashlib,json,re,math,unicodedata
from pathlib import Path
from urllib.parse import urlsplit,unquote
ROOT=Path(__file__).resolve().parents[1]
SOURCE='https://raw.githubusercontent.com/abobabo91/michelin-map/main/outputs/michelin_all.csv'
IMAGE=re.compile(r'/api/public/content/([a-f0-9]{32}\.(?:jpeg|jpg|png|webp))')
def key(value):
 p=unquote(urlsplit(value).path).strip('/')
 return re.sub(r'^(?:[a-z]{2}/)?[a-z]{2}(?:_[A-Z]{2})?/','',p).lower()
def photo(value):
 u=urlsplit(value);m=IMAGE.fullmatch(u.path)
 return m[1] if u.scheme=='https' and u.hostname=='prod-pics.guide.michelin.com' and m else None

def build(path):
 data=json.loads((ROOT/'data.json').read_text());lookup={};ambiguous=set();source_rows=[];aliases=[]
 with open(path,encoding='utf-8-sig',newline='') as f:
  for row in csv.DictReader(f):
   source_rows.append(row)
   p=photo(row.get('image',''));k=key(row.get('url',''))
   if not p or '/restaurant/' not in k:continue
   if k in lookup and lookup[k]!=p:ambiguous.add(k)
   lookup[k]=p
 for k in ambiguous:lookup.pop(k,None)
 supplement=ROOT/'tools/photo_supplement.json'
 if supplement.exists():
  for u,p in json.loads(supplement.read_text()).get('items',{}).items():
   if re.fullmatch(r'[a-f0-9]{32}\.(?:jpeg|jpg|png|webp)',p):lookup[key(u)]=p
 # Changed city URL segments can be reconciled only with three independent matches.
 def name(s):return re.sub(r'[^\w]','',unicodedata.normalize('NFKD',s).lower())
 by_name={}
 for row in source_rows:by_name.setdefault(name(row['name']),[]).append(row)
 for r in data['r']:
  if key(r[7]) in lookup:continue
  candidates=[]
  for row in by_name.get(name(r[0]),[]):
   image=photo(row.get('image',''))
   if not image or key(row['url']).split('/restaurant/')[-1]!=key(r[7]).split('/restaurant/')[-1]:continue
   try:
    a,b=map(math.radians,[r[10],float(row['lat'])]);dx=math.radians(float(row['lng'])-r[11]);dy=b-a
    distance=6371000*2*math.asin(min(1,math.sqrt(math.sin(dy/2)**2+math.cos(a)*math.cos(b)*math.sin(dx/2)**2)))
   except (TypeError,ValueError):continue
   if distance<=100:candidates.append((row,image,distance))
  if len(candidates)==1:
   row,image,distance=candidates[0];lookup[key(r[7])]=image;aliases.append({'restaurant':r[7],'source_url':row['url'],'distance_m':round(distance,2),'match':'exact name + exact restaurant slug + coordinates within 100m; unique candidate'})
 out=ROOT/'photos';out.mkdir(exist_ok=True);counts=[];missing=[];total=0
 for co,country in enumerate(data['countries']):
  rows=[r for r in data['r'] if data['cities'][r[3]][1]==co];items={}
  for r in rows:
   p=lookup.get(key(r[7]))
   if p:items[r[7]]=p
   else:missing.append(r[7])
  total+=len(items);counts.append({'country':country[1],'matched':len(items),'total':len(rows)})
  (out/f'country-{co}.json').write_text(json.dumps({'country':country[1],'items':items},ensure_ascii=False,separators=(',',':'))+'\n')
 report={'updated':'2026-10-27','source':SOURCE,'source_page':'https://github.com/abobabo91/michelin-map','supplement':'Direct public MICHELIN restaurant gallery links in tools/photo_supplement.json','source_sha256':hashlib.sha256(Path(path).read_bytes()).hexdigest(),'image_origin':'https://prod-pics.guide.michelin.com','matched':total,'total':len(data['r']),'countries':counts,'alias_matches':aliases,'missing':missing,'notice':'Exact MICHELIN restaurant URL matches only. Image rights remain with original owners. Missing is not proof the official page has no photo.'}
 (out/'manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(f'{total} matched of {len(data["r"])}; {len(missing)} without a verified index match')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--csv',required=True);args=p.parse_args();build(args.csv)

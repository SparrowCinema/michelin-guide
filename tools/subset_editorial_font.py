# -*- coding: utf-8 -*-
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools import subset
import json,sys
# Cover all currently shipped interface and restaurant/destination characters.
chars=set(chr(i) for i in range(32,0x250))
for f in [*Path('.').glob('*.js'),Path('index.html')]:chars.update(f.read_text())
def collect(v):
 if isinstance(v,str):chars.update(v)
 elif isinstance(v,list):
  for a in v:collect(a)
 elif isinstance(v,dict):
  for a in v.values():collect(a)
for f in ['data.json','city-names.js']: 
 p=Path(f)
 if f.endswith('.json'):collect(json.loads(p.read_text()))
 else:chars.update(p.read_text())
font=TTFont(sys.argv[1])
covered=set(font.getBestCmap())&set(map(ord,chars))
options=subset.Options();options.flavor='woff2';options.layout_features=['*'];options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*']
subsetter=subset.Subsetter(options=options);subsetter.populate(unicodes=covered);subsetter.subset(font)
# A new family name distinguishes the project subset from its upstream family.
for n in font['name'].names:
 if n.nameID in [1,4,6,16,17]:
  value={1:'Passport Editorial',4:'Passport Editorial',6:'PassportEditorial',16:'Passport Editorial',17:'Regular'}[n.nameID]
  n.string=value.encode(n.getEncoding(),errors='replace')
# Two unicode-range slices: Latin and punctuation (small, preloaded) and CJK (fetched only when such text is drawn).
font.flavor='woff2';font.save('/tmp/passport-editorial-full.woff2')
for name,keep in [('latin',lambda c:c<0x2E80),('cjk',lambda c:c>=0x2E80)]:
 part=TTFont('/tmp/passport-editorial-full.woff2');cps=[c for c in part.getBestCmap() if keep(c)]
 s=subset.Subsetter(options=options);s.populate(unicodes=cps);s.subset(part);part.flavor='woff2';out=Path(f'assets/fonts/passport-editorial-{name}.woff2');part.save(out)
 print(name,'characters',len(cps),'bytes',out.stat().st_size)

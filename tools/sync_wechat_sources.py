"""Keep the native data modules and shared website logic on the same source files."""
import json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1];p=root/'wechat'
for name in ['guide-core.js','city-names.js','restaurant-intro.js','address-localization.js']:
    (p/'utils'/name).write_bytes((root/name).read_bytes())
(p/'utils/search-aliases.js').write_text((root/'search-aliases.js').read_text().replace('window.MG_ALIASES =','module.exports ='))
x=json.loads((root/'data.json').read_text());rows=x.pop('r');photos={}
for f in (root/'photos').glob('country-*.json'):photos.update(json.loads(f.read_text()).get('items',{}))
if len(rows)>20000:raise SystemExit('Add a data subpackage before growing beyond 20,000 rows.')
for i in range(5):
    chunk=rows[i*4000:(i+1)*4000];d=p/f'dataset{i}'
    (d/'rows.js').write_text('module.exports='+json.dumps(chunk,ensure_ascii=False,separators=(',',':'))+';')
    (d/'photos.js').write_text('module.exports='+json.dumps({r[7]:photos[r[7]] for r in chunk if r[7] in photos},separators=(',',':'))+';')
    if sum(f.stat().st_size for f in d.iterdir() if f.is_file())>=1900000:raise SystemExit('Subpackage size budget exceeded')
(p/'data/meta.js').write_text('module.exports='+json.dumps(x,ensure_ascii=False,separators=(',',':'))+';')
(p/'data/prices.js').write_text('module.exports='+(root/'prices.json').read_text()+';')
print(f'Synced {len(rows)} restaurants, website logic and original restaurant photo indexes.')

"""Regenerate the mini-program dataset from the canonical website files."""
import json
from pathlib import Path
root = Path(__file__).resolve().parents[1]
p = root / 'wechat'
x = json.loads((root / 'data.json').read_text())
rows = x.pop('r')
if len(rows) > 20000:
    raise SystemExit('Dataset exceeds current five-part layout; add a subpackage before generating.')
for i in range(5):
    text = 'module.exports=' + json.dumps(rows[i*4000:(i+1)*4000], ensure_ascii=False, separators=(',', ':')) + ';'
    if len(text.encode()) >= 1900000:
        raise SystemExit('Data part exceeds size budget')
    (p / f'dataset{i}/rows.js').write_text(text)
(p / 'data/meta.js').write_text('module.exports=' + json.dumps(x, ensure_ascii=False, separators=(',', ':')) + ';')
(p / 'data/prices.js').write_text('module.exports=' + (root / 'prices.json').read_text() + ';')
print(f'Generated {len(rows)} restaurants, preserving all source fields.')

"""Build a standalone WeChat project ZIP with app.json at the archive root."""
import hashlib,json,zipfile,sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
p=root/'wechat'
out=root/'downloads/dining-passport-wechat.zip'
out.parent.mkdir(exist_ok=True)
config=json.loads((p/'project.config.json').read_text())
assert config['miniprogramRoot']=='./'
app=json.loads((p/'app.json').read_text())
for page in app['pages']:
    for ext in ['.js','.json','.wxml']:
        assert (p/(page+ext)).is_file(),page+ext
files=[f for f in p.rglob('*') if f.is_file() and 'tests' not in f.relative_to(p).parts]
manifest={'version':'2026.10.29.3','restaurants':19888,'files':{str(f.relative_to(p)):hashlib.sha256(f.read_bytes()).hexdigest() for f in files},'verification':'Node logic tests and static package checks; WeChat compilation and device testing pending'}
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for f in files:z.write(f,f.relative_to(p))
    z.writestr('BUILD-MANIFEST.json',json.dumps(manifest,ensure_ascii=False,indent=2))
with zipfile.ZipFile(out) as z:
    assert z.testzip() is None
    assert 'app.json' in z.namelist()
    assert json.loads(z.read('project.config.json'))['miniprogramRoot']=='./'
    for name,digest in manifest['files'].items():assert hashlib.sha256(z.read(name)).hexdigest()==digest
print(json.dumps({'zip':str(out),'bytes':out.stat().st_size,'files':len(files),'sha256':hashlib.sha256(out.read_bytes()).hexdigest()}))

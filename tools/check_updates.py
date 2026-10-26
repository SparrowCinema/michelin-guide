"""Validate the published dataset and review upstream candidates without publishing them.

python tools/check_updates.py --candidate path/to/michelin_my_maps.csv --out update-report.json
Without --candidate, fetch the upstream CSV. --validate-only works offline.
Candidate removals mean absent from that file, NOT closed or officially demoted.
"""
import argparse, csv, datetime, hashlib, io, json, math, pathlib, re, urllib.request
from urllib.parse import unquote, urlsplit

ROOT = pathlib.Path(__file__).resolve().parent.parent
SOURCE = 'https://raw.githubusercontent.com/ngshiheng/michelin-my-maps/main/data/michelin_my_maps.csv'
AWARDS = {'3 Stars': 0, '2 Stars': 1, '1 Star': 2, 'Bib Gourmand': 3, 'Selected Restaurants': 4}

def key(url):
    url = unquote(url.strip())
    return re.sub(r'^https?://guide\.michelin\.com/[a-z]{2}(?:/[a-z]{2}_[A-Z]{2})?/', '', url).lower()

def validate(d):
    datetime.date.fromisoformat(d['updated'])
    assert d['r'] and isinstance(d['r'], list), 'empty dataset'
    ids = set()
    for r in d['r']:
        assert len(r) >= 15, 'incomplete row'
        assert isinstance(r[0], str) and r[0], 'missing restaurant name'
        assert isinstance(r[3], int) and 0 <= r[3] < len(d['cities']), 'invalid city'
        assert isinstance(r[4], int) and 0 <= r[4] <= 4, 'invalid award'
        assert isinstance(r[5], int) and -1 <= r[5] < len(d['cuisines']), 'invalid cuisine'
        assert isinstance(r[6], int) and 0 <= r[6] <= 4, 'invalid price tier'
        assert isinstance(r[7], str) and '/restaurant/' in r[7], 'invalid stable ID'
        assert key(r[7]) not in ids, 'duplicate restaurant ID'
        ids.add(key(r[7]))
        for v,limit in [(r[10],90),(r[11],180)]:
            assert v is None or isinstance(v,(int,float)) and math.isfinite(v) and abs(v)<=limit, 'invalid coordinates'
        assert (r[10] is None) == (r[11] is None), 'partial coordinates'
        assert re.fullmatch('[01234g-]{4}|',r[13]), 'unexpected history range'
    for city in d['cities']:
        assert isinstance(city[1],int) and 0 <= city[1] < len(d['countries']), 'invalid country'
    return {key(r[7]): {'id':r[7], 'name':r[0], 'award':r[4]} for r in d['r']}

def compare(d, text):
    old = validate(d)
    reader = csv.DictReader(io.StringIO(text))
    assert {'Name','Url','Award','Location','Latitude','Longitude'} <= set(reader.fieldnames or []), 'upstream CSV schema changed'
    new, ignored = {}, {}
    for r in reader:
        award = r['Award'].strip()
        if award not in AWARDS:
            ignored[award] = ignored.get(award,0)+1
            continue
        k = key(r['Url'])
        assert k and '/restaurant/' in k, 'invalid upstream ID'
        assert k not in new, 'duplicate upstream ID'
        new[k] = {'id':k,'name':r['Name'],'award':AWARDS[award]}
    assert len(new)>=len(old)*0.7, 'candidate is too small; refusing misleading mass-removal report'
    added = [new[k] for k in new.keys()-old.keys()]
    removed = [old[k] for k in old.keys()-new.keys()]
    changed = [{**new[k],'previous_award':old[k]['award']} for k in new.keys()&old.keys() if old[k]['award']!=new[k]['award']]
    sort = lambda rows: sorted(rows,key=lambda r:r['id'])
    return {'baseline_snapshot':d['updated'],'checked_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
            'candidate_sha256':hashlib.sha256(text.encode()).hexdigest(), 'source':SOURCE,
            'candidate_count':len(new),'ignored_awards':ignored,'added':sort(added),'removed':sort(removed),'award_changes':sort(changed),
            'notice':'Candidate differences only. URL changes, incomplete regional coverage and guide release timing require review. Absence is not proof of closure. Published data has NOT been changed.'}

def main():
    p=argparse.ArgumentParser();p.add_argument('--candidate');p.add_argument('--out',default='update-report.json');p.add_argument('--validate-only',action='store_true');a=p.parse_args()
    d=json.loads((ROOT/'data.json').read_text());validate(d)
    prices=json.loads((ROOT/'prices.json').read_text())
    for u,items in prices['items'].items():
        assert u in {r[7] for r in d['r']}, 'unknown price ID'
        for x in items:
            assert re.fullmatch('[A-Z]{3}',x['currency']) and 0<=x['min']<=x['max'], 'invalid amount'
            assert urlsplit(x['source']).scheme=='https', 'missing HTTPS price source'
            datetime.date.fromisoformat(x['checked'])
            assert all(isinstance(x[k],str) and x[k] for k in ['meal','basis','includes']), 'missing price context'
    if a.validate_only: print(f"Validated {len(d['r'])} restaurants and price provenance"); return
    if a.candidate: text=pathlib.Path(a.candidate).read_text(encoding='utf-8-sig')
    else:
        req=urllib.request.Request(SOURCE,headers={'User-Agent':'michelin-guide-update-check'})
        with urllib.request.urlopen(req,timeout=60) as res:text=res.read().decode('utf-8-sig')
    report=compare(d,text);pathlib.Path(a.out).write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps({k:len(report[k]) for k in ['added','removed','award_changes']}))
if __name__=='__main__': main()

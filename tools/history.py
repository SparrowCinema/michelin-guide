"""Build per-restaurant award history from yearly snapshots of michelin_my_maps.csv.
Usage: python3 tools/history.py current.csv out.json snap2022.csv snap2023.csv ...
Output: {url_path: "codes"} one char per snapshot (oldest first):
0=3 stars 1=2 stars 2=1 star 3=Bib 4=Selected  -=not listed  g=listed, award hidden (green star only)
"""
import csv, sys, json, re, math
from urllib.parse import unquote
csv.field_size_limit(10**8)

def code(a):
    a = a.lower()
    if a.startswith('3'): return '0'
    if a.startswith('2'): return '1'
    if a.startswith('1'): return '2'
    if 'bib' in a: return '3'
    if 'selected' in a: return '4'
    if 'green' in a: return 'g'
    return None

def path(u):
    u = unquote(u.strip())
    return re.sub(r'^https?://guide\.michelin\.com/[a-z]{2}(?:/[a-z]{2}_[A-Z]{2})?/', '', u).lower()

def norm(s): return re.sub(r'[^a-z0-9]', '', s.lower())

def dist(a, b):
    try:
        la1, lo1, la2, lo2 = map(float, (a[0], a[1], b[0], b[1]))
    except ValueError:
        return 1e9
    x = (lo2 - lo1) * math.cos(math.radians((la1 + la2) / 2)); y = la2 - la1
    return math.hypot(x, y) * 111.0

def load(f):
    rows = []
    for r in csv.DictReader(open(f, encoding='utf-8')):
        c = code(r['Award'])
        if c is None: continue
        rows.append((path(r['Url']), norm(r['Name']), (r['Latitude'], r['Longitude']), c))
    byp = {p: c for p, n, ll, c in rows}
    bys = {}
    for p, n, ll, c in rows:
        bys.setdefault(p.rsplit('/', 1)[-1], []).append((ll, c))
        bys.setdefault('n:' + n, []).append((ll, c))
    return byp, bys

cur = list(csv.DictReader(open(sys.argv[1], encoding='utf-8')))
snaps = [load(f) for f in sys.argv[3:]]
out = {}
for r in cur:
    p = path(r['Url']); ll = (r['Latitude'], r['Longitude']); s = ''
    for byp, bys in snaps:
        c = byp.get(p)
        if c is None:
            for key, lim in ((p.rsplit('/', 1)[-1], 1.5), ('n:' + norm(r['Name']), 0.3)):
                for ll2, c2 in bys.get(key, []):
                    if dist(ll, ll2) < lim: c = c2; break
                if c: break
        s += c or '-'
    out[path(r['Url'])] = s
json.dump(out, open(sys.argv[2], 'w'), separators=(',', ':'))

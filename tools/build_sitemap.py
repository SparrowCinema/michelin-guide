# -*- coding: utf-8 -*-
"""Write sitemap.xml: the directory plus a ?restaurant= page for every starred and Bib Gourmand restaurant.

Usage: python3 tools/build_sitemap.py [data.json] [sitemap.xml]
Rerun after updating data.json. Submit https://sparrowcinema.github.io/michelin-guide/sitemap.xml once in
Google Search Console / Bing Webmaster Tools (a project site cannot use the domain's robots.txt).
"""
import json, sys
from urllib.parse import quote
from xml.sax.saxutils import escape

BASE = 'https://sparrowcinema.github.io/michelin-guide/'
src = sys.argv[1] if len(sys.argv) > 1 else 'data.json'
out = sys.argv[2] if len(sys.argv) > 2 else 'sitemap.xml'
d = json.load(open(src, encoding='utf-8'))
day = (d.get('updated') or '')[:10]
rows = [r for r in d['r'] if r[4] <= 3]  # 0–2 stars, 3 Bib Gourmand
rows.sort(key=lambda r: (r[4], r[7]))
lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
def url(loc, prio):
    lines.append(f'<url><loc>{escape(loc)}</loc>' + (f'<lastmod>{day}</lastmod>' if day else '') + f'<priority>{prio}</priority></url>')
url(BASE, '1.0')
for r in rows:
    url(BASE + '?restaurant=' + quote(r[7], safe=''), ('0.8', '0.7', '0.6', '0.5')[r[4]])
lines.append('</urlset>')
open(out, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
print(out, len(rows) + 1, 'urls')

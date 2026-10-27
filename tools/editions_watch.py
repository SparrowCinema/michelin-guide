"""Watch MICHELIN's own ceremony announcements and add newly released guide editions.

python3 tools/editions_watch.py [tools/editions.json] [--articles fixture.json]

Reads guide.michelin.com's public article search (the same search key the site ships to every
browser), looks at "michelin-guide-ceremony" and "news-and-views" articles since the last check,
and for a title like "The MICHELIN Guide Taiwan 2027 ..." records Taiwan 2027 with the article's
publication date as its release date. Save-the-date / countdown articles are ignored. New editions
start unsynced; tools/updates.py marks them synced when the data shows the new selection.
"""
import json, re, sys, datetime, urllib.request, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FUTURE = re.compile(r"save the date|to be (?:revealed|unveiled|announced)|to take place|countdown|date announced|will (?:celebrate|unveil|host)|is coming|announces? (?:its|the) (?:arrival|first)|expands|to host|livestream|live stream|en direct|in diretta|live\b|\bhosts?\b|host city|sede de|accueill|ospit|accolg|begrüß|welcomes? the", re.I)
GUIDE = re.compile(r"MICHELIN|Michelin|ミシュラン|米其林|米芝蓮")

def fetch_articles(since_ms):
    html = urllib.request.urlopen(urllib.request.Request("https://guide.michelin.com/en", headers={"User-Agent": "Mozilla/5.0"}), timeout=60).read().decode("utf8", "ignore")
    key = re.search(r"ALGOLIASEARCH_SEARCH_KEY[^\"']*[\"']([^\"']+)", html).group(1)
    hits = []
    for ix in ("prod-articles-en", "prod-articles-fr", "prod-articles-es", "prod-articles-it", "prod-articles-de", "prod-articles-nl", "prod-articles-ja", "prod-articles-zh_HK", "prod-articles-zh_TW"):
        body = json.dumps({"query": "", "hitsPerPage": 1000, "filters": "category_slug:michelin-guide-ceremony OR category_slug:news-and-views",
                           "numericFilters": [f"published_date>={since_ms}"], "attributesToRetrieve": ["title", "published_date", "url"]}).encode()
        req = urllib.request.Request(f"https://8NVHRD7ONV-dsn.algolia.net/1/indexes/{ix}/query", data=body,
                                     headers={"X-Algolia-Application-Id": "8NVHRD7ONV", "X-Algolia-API-Key": key, "Content-Type": "application/json"})
        try: hits += json.load(urllib.request.urlopen(req, timeout=60)).get("hits", [])
        except Exception as e: print("skip", ix, e, file=sys.stderr)
    return hits

def apply(doc, hits):
    added = []
    for h in sorted(hits, key=lambda h: h["published_date"]):
        title = re.sub(r"\s+", " ", h.get("title", ""))
        m = re.search(r"\b(20[2-3]\d)\b", title)
        if not m or not GUIDE.search(title) or FUTURE.search(title): continue
        year = int(m.group(1)); date = datetime.datetime.utcfromtimestamp(h["published_date"] / 1000 + 8 * 3600).date().isoformat()
        best, blen = None, 0
        for g in doc["guides"]:
            for kw in g.get("keywords", []):
                if re.search(r"(?<![A-Za-z])" + re.escape(kw) + r"(?![A-Za-z])", title, re.I) and len(kw) > blen: best, blen = g, len(kw)
        if not best: continue
        eds = best["editions"]; latest = max([e["year"] for e in eds if e.get("year")] or [0])
        same = next((e for e in eds if e.get("year") == year), None)
        src = "https://guide.michelin.com" + h["url"] if h["url"].startswith("/") else h["url"]
        if same:
            if not same.get("released"): same["released"], same["source"] = date, src; added.append(f"{best['zh']} {year}（补日期 {date}）")
            continue
        if year < latest: continue
        eds.append({"year": year, "released": date, "source": src, "synced": False})
        added.append(f"{best['zh']} {year}（{date} 发布）")
        sched = best.get("scheduled")
        if sched and sched["year"] == year: best.pop("scheduled")
    return added

def main(argv):
    path = argv[0] if argv and not argv[0].startswith("--") else os.path.join(ROOT, "tools", "editions.json")
    doc = json.load(open(path, encoding="utf8"))
    since = datetime.date.fromisoformat(doc.get("checked", "2026-01-01")) - datetime.timedelta(days=10)
    if "--articles" in argv: hits = json.load(open(argv[argv.index("--articles") + 1], encoding="utf8"))
    else: hits = fetch_articles(int(datetime.datetime.combine(since, datetime.time()).timestamp() * 1000))
    added = apply(doc, hits)
    doc["checked"] = datetime.date.today().isoformat()
    open(path, "w", encoding="utf8").write(json.dumps(doc, ensure_ascii=False, indent=1))
    print(json.dumps({"articles": len(hits), "added": added}, ensure_ascii=False))

if __name__ == "__main__": main(sys.argv[1:])

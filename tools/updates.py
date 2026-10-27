"""Record what changed between two builds of data.json, guide by guide, for the homepage banner.

python3 tools/updates.py old_data.json new_data.json updates.json YYYY-MM-DD [--editions tools/editions.json]

updates.json = {"updates": [newest first, at most 12]}, each:
  {"date": run date, "data": data snapshot date, "from": previous snapshot date,
   "guides": [{"id", "added": [[url, name, zh, award]], "removed": [...],
               "up": [[url, name, zh, before, after]], "down": [...]}]}
With --editions, an edition that was announced but not yet in the data is marked synced once
its guide shows real changes (star moves or a wave of additions/removals) after its release date.
"""
import json, sys
from urllib.parse import unquote

def key(u):
    """Stable id: region/city/restaurant/slug, ignoring locale prefixes that upstream sometimes changes."""
    return "/".join(unquote(u).lower().strip("/").split("/")[-4:])

def rows(d):
    eds = d.get("editions") or []
    out = {}
    for r in d["r"]:
        city = d["cities"][r[3]]
        gi = city[3] if len(city) > 3 else None
        out[key(r[7])] = {"u": r[7], "n": r[0], "zh": r[1], "l": r[4], "g": eds[gi][0] if gi is not None and gi < len(eds) else "other"}
    return out

def diff(old, new):
    a, b = rows(old), rows(new)
    by = {}
    def slot(g):
        return by.setdefault(g, {"id": g, "added": [], "removed": [], "up": [], "down": []})
    for k, x in b.items():
        if k not in a: slot(x["g"])["added"].append([x["u"], x["n"], x["zh"], x["l"]])
        elif a[k]["l"] != x["l"]:
            slot(x["g"])["up" if x["l"] < a[k]["l"] else "down"].append([x["u"], x["n"], x["zh"], a[k]["l"], x["l"]])
    for k, x in a.items():
        if k not in b: slot(x["g"])["removed"].append([x["u"], x["n"], x["zh"], x["l"]])
    weight = lambda g: (len(g["up"]) + len(g["down"])) * 10 + len(g["added"]) + len(g["removed"])
    for g in by.values():
        for k in ("added", "removed"): g[k].sort(key=lambda x: (x[3], x[1]))
        for k in ("up", "down"): g[k].sort(key=lambda x: (x[4], x[1]))
    return sorted(by.values(), key=weight, reverse=True)

def significant(g):
    return len(g["up"]) + len(g["down"]) >= 3 or len(g["added"]) + len(g["removed"]) >= 15

def sync_editions(editions_path, guides, data_date, today):
    doc = json.load(open(editions_path, encoding="utf8")); changed = []
    sig = {g["id"] for g in guides if significant(g)}
    for g in doc["guides"]:
        for e in g["editions"]:
            if not e.get("synced") and e.get("released") and e["released"] <= data_date and g["id"] in sig:
                e["synced"] = True; e["synced_on"] = today; changed.append(f'{g["zh"]} {e["year"]}')
    if changed: open(editions_path, "w", encoding="utf8").write(json.dumps(doc, ensure_ascii=False, indent=1))
    return changed

def main(argv):
    old, new, out, today = argv[:4]
    eds = argv[argv.index("--editions") + 1] if "--editions" in argv else None
    a, b = json.load(open(old, encoding="utf8")), json.load(open(new, encoding="utf8"))
    guides = diff(a, b)
    try: hist = json.load(open(out, encoding="utf8"))
    except FileNotFoundError: hist = {"updates": []}
    synced = sync_editions(eds, guides, b.get("updated", today), today) if eds else []
    if guides:
        entry = {"date": today, "data": b.get("updated"), "from": a.get("updated"), "guides": guides}
        if synced: entry["synced"] = synced
        hist["updates"] = [entry] + [u for u in hist["updates"] if u.get("data") != entry["data"]][:11]
        open(out, "w", encoding="utf8").write(json.dumps(hist, ensure_ascii=False, separators=(",", ":")))
    tot = {k: sum(len(g[k]) for g in guides) for k in ("added", "removed", "up", "down")}
    print(json.dumps({"guides": len(guides), **tot, "synced": synced}, ensure_ascii=False))

if __name__ == "__main__": main(sys.argv[1:])

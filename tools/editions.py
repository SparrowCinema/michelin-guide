"""Guide editions: which MICHELIN guide (and which year's edition) each restaurant belongs to.

tools/editions.json lists every guide with its coverage and its editions:
  year      the guide's own year (Spain 2026 was released in November 2025)
  released  official release date, from MICHELIN's announcement (source)
  synced    whether data.json already reflects that edition
"""
import json, os
PATH = os.path.join(os.path.dirname(__file__), "editions.json")

def load(path=PATH):
    return json.load(open(path, encoding="utf8"))

def matcher(doc):
    guides = doc["guides"]
    def match(loc):
        """loc = CSV Location split on commas, e.g. ['Austin', 'TX', 'USA'] -> guide index."""
        ctry, city = loc[-1], loc[0]
        state = loc[1] if len(loc) == 3 else ""
        if ctry in ("Dubai", "Abu Dhabi"): ctry, city = "UAE", loc[-1]
        fallback = None
        for i, g in enumerate(guides):
            for c, lst in g["coverage"]:
                if c != ctry: continue
                if lst is None:
                    if fallback is None: fallback = i
                elif city in lst or state in lst:
                    return i
        return fallback
    return match

def current(g):
    """Latest edition already reflected in the data, and newer ones still waiting."""
    synced = [e for e in g["editions"] if e.get("synced")]
    pending = [e for e in g["editions"] if not e.get("synced")]
    return (synced[-1] if synced else None), pending

def export(doc):
    """Compact list for data.json: [id, zh, en, year, released, source, pending[[year, released, source]], scheduled]."""
    out = []
    for g in doc["guides"]:
        cur, pending = current(g)
        cur = cur or {}
        out.append([g["id"], g["zh"], g["en"], cur.get("year"), cur.get("released"), cur.get("source"),
                    [[p["year"], p["released"], p["source"]] for p in pending],
                    [g["scheduled"]["year"], g["scheduled"]["date"], g["scheduled"]["source"]] if g.get("scheduled") else None])
    return out

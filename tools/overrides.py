"""Regional overrides: a guide's newly published selection taken straight from MICHELIN's site,
used until the upstream CSV catches up.

tools/overrides/<guide>-<year>.json holds every restaurant MICHELIN lists for that guide edition
(name, address, coordinates, cuisine, price band, website, award, Green Star, guide year).
build.py drops upstream rows of that guide and uses these instead. `retire` reports overrides the
upstream CSV now matches (same restaurants, same awards), so the weekly job can delete them.
"""
import json, os, glob, csv, sys
DIR = os.path.join(os.path.dirname(__file__), "overrides")
AWARD = {"THREE_STARS": "3 Stars", "TWO_STARS": "2 Stars", "ONE_STAR": "1 Star", "BIB_GOURMAND": "Bib Gourmand", "selected": "Selected Restaurants", "SELECTED": "Selected Restaurants"}
STATE = {"Texas": "TX", "Georgia": "GA", "Alabama": "AL", "Louisiana": "LA", "Mississippi": "MS", "North Carolina": "NC", "South Carolina": "SC",
         "Tennessee": "TN", "California": "CA", "Florida": "FL", "Colorado": "CO", "New York State": "NY", "New York": "NY", "Illinois": "IL",
         "District of Columbia": "DC", "Massachusetts": "MA", "Pennsylvania": "PA", "Virginia": "VA", "Arizona": "AZ", "Nevada": "NV", "New Mexico": "NM", "Utah": "UT"}
ALIAS = {"Taiwan": "Taiwan Region", "Hong Kong SAR China": "Hong Kong SAR", "Macau": "Macau SAR", "China Mainland": "Chinese Mainland", "United States": "USA"}

def load(d=DIR):
    out = {}
    for p in sorted(glob.glob(os.path.join(d, "*.json"))):
        doc = json.load(open(p, encoding="utf8")); doc["_path"] = p; out[doc["guide"]] = doc
    return out

def key(u):
    return "/".join(u.strip("/").lower().split("/")[-4:])

def location(r):
    city, region, country = r[4], r[5], r[6]
    if country in ("USA", "United States"): return f"{city}, {STATE.get(region, region)}, USA"
    if country == "Dubai" or city == "Dubai": return "Dubai"
    if country == "Abu Dhabi": return "Abu Dhabi"
    return f"{city}, {country}" if city and city != country else country

def to_csv(r):
    n = {"CAT_P01": 1, "CAT_P02": 2, "CAT_P03": 3, "CAT_P04": 4}.get(r[10], 0)
    sym = r[11] if r[11] in ("$", "€") else "$"
    return {"Name": r[1], "Address": ", ".join(x for x in (r[2], r[4], r[3], r[6]) if x), "Location": location(r),
            "Price": sym * n, "Cuisine": r[9], "Longitude": str(r[8]), "Latitude": str(r[7]), "PhoneNumber": r[13],
            "Url": "https://guide.michelin.com/en/" + key(r[0]), "WebsiteUrl": r[12], "Award": AWARD.get(r[14], r[14]),
            "GreenStar": "1" if r[15] else "0", "FacilitiesAndServices": "", "Description": "", "_override": True}

def upstream_loc(x):
    loc = [p.strip() for p in x["Location"].split(",")]
    loc[-1] = ALIAS.get(loc[-1], loc[-1])
    return loc

def apply(rows, match, guides):
    """Yield upstream rows, swapping in every override guide's own rows."""
    ov = load(); ids = {g["id"]: i for i, g in enumerate(guides)}
    active = {ids[g]: doc for g, doc in ov.items() if g in ids}
    for x in rows:
        if match(upstream_loc(x)) not in active: yield x
    for doc in active.values():
        for r in doc["rows"]: yield to_csv(r)

def retire(upstream_csv, match, guides):
    """Overrides the upstream CSV has caught up with (≥98% same restaurants and awards)."""
    csv.field_size_limit(10**8)
    ov = load(); ids = {g["id"]: i for i, g in enumerate(guides)}; up = {}
    for x in csv.DictReader(open(upstream_csv, encoding="utf-8-sig")):
        up[key(x["Url"])] = (match(upstream_loc(x)), x["Award"].strip())
    done = []
    for g, doc in ov.items():
        want = {key(r[0]): AWARD.get(r[14], r[14]) for r in doc["rows"]}
        same = sum(1 for k, a in want.items() if up.get(k) == (ids.get(g), a))
        extra = sum(1 for k, (gi, _) in up.items() if gi == ids.get(g) and k not in want)
        if want and same >= 0.98 * len(want) and extra <= 0.02 * len(want): done.append(doc["_path"])
    return done

if __name__ == "__main__":
    sys.path.insert(0, os.path.dirname(__file__))
    import editions
    doc = editions.load()
    if sys.argv[1:2] == ["retire"]:
        for p in retire(sys.argv[2], editions.matcher(doc), doc["guides"]): print(p)

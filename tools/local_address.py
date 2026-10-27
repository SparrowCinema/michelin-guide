"""Official localized addresses from the MICHELIN Guide zh_CN / zh_HK / zh_TW / ja sites.

tools/official_local_addresses.json rows: [urlPath, street, postcode, city, countrySlug]
(collected from guide.michelin.com's own localized restaurant index, 2026-10-27).
format_rows() returns {urlPath: full local-language address} for data.json row[15].
"""
import json, os

CN_CITY = {"Beijing":"北京市","Shanghai":"上海市","Guangzhou":"广州市","Shenzhen":"深圳市","Chengdu":"成都市",
 "Hangzhou":"杭州市","Nanjing":"南京市","Suzhou":"苏州市","Yangzhou":"扬州市","Changzhou":"常州市","Wenzhou":"温州市",
 "Taizhou":"台州市","Fuzhou":"福州市","Xiamen":"厦门市","Quanzhou":"泉州市","Ningde":"宁德市"}
TW_CITY = {"Taipei":"臺北市","New Taipei":"新北市","Taichung":"臺中市","Tainan":"臺南市","Kaohsiung":"高雄市",
 "Hsinchu City":"新竹市","Hsinchu County":"新竹縣"}
JP_PREF = {"東京":"東京都","京都":"京都府","大阪":"大阪府","奈良":"奈良県"}

def _prefix(head, street):
    alt = head.rstrip("市縣都府県")
    return street if street.startswith(head) or (alt and street.startswith(alt+"市") and head.endswith("市")) else head + street

def format_row(street, postcode, city, slug):
    street = " ".join(street.split())
    if not street: return ""
    if slug == "cn": return _prefix(CN_CITY.get(city, ""), street) if city in CN_CITY else street
    if slug == "hk": return street if street.startswith("香港") else "香港" + street
    if slug == "mo": return street if street.startswith("澳門") else "澳門" + street
    if slug == "tw":
        s = _prefix(TW_CITY[city], street) if city in TW_CITY else street
        return (postcode + " " + s) if postcode else s
    if slug == "jp":
        s = _prefix(JP_PREF[city], street) if city in JP_PREF else street
        return ("〒" + postcode + " " + s) if postcode else s
    return street

def load(path=os.path.join(os.path.dirname(__file__), "official_local_addresses.json")):
    if not os.path.exists(path): return {}
    return {u: format_row(s, p, c, k) for u, s, p, c, k in json.load(open(path, encoding="utf8"))}

if __name__ == "__main__":
    # Patch an existing data.json in place (used when the source CSV isn't at hand).
    import sys
    out = sys.argv[1] if len(sys.argv) > 1 else "data.json"
    d = json.load(open(out, encoding="utf8")); loc = load(); n = 0
    for r in d["r"]:
        del r[15:]; v = loc.get(r[7], "")
        if v: r.append(v); n += 1
    json.dump(d, open(out, "w", encoding="utf8"), ensure_ascii=False, separators=(",", ":"))
    print("local addresses", n)

import json, os, sys, unittest, tempfile, csv
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
import editions, overrides
ROOT = os.path.join(os.path.dirname(__file__), "..")

class Overrides(unittest.TestCase):
    def setUp(self):
        self.doc = editions.load(); self.m = editions.matcher(self.doc); self.ov = overrides.load()
        self.gid = lambda loc: self.doc["guides"][self.m(loc)]["id"]
    def test_every_override_maps_to_its_own_guide_and_carries_no_editorial_text(self):
        self.assertGreaterEqual(len(self.ov), 7)
        for g, doc in self.ov.items():
            ed = next(e for x in self.doc["guides"] if x["id"] == g for e in x["editions"] if e["year"] == doc["year"])
            self.assertTrue(ed.get("synced"), g)
            for r in doc["rows"]:
                row = overrides.to_csv(r)
                self.assertEqual(self.gid(overrides.upstream_loc(row)), g, (g, row["Location"]))
                self.assertEqual(row["Description"], "")
                self.assertTrue(row["Url"].startswith("https://guide.michelin.com/en/"))
    def test_apply_replaces_upstream_rows_of_override_guides_only(self):
        up = [{"Location": "Austin, TX, USA", "Url": "https://x/en/texas/austin/restaurant/old"},
              {"Location": "Tokyo, Japan", "Url": "https://x/en/tokyo-region/tokyo/restaurant/keep"}]
        out = list(overrides.apply(up, self.m, self.doc["guides"]))
        self.assertIn(up[1], out); self.assertNotIn(up[0], out)
        self.assertEqual(len(out), 1 + sum(len(d["rows"]) for d in self.ov.values()))
    def test_retire_only_when_upstream_has_caught_up(self):
        doc = self.ov["dubai"]; rows = [overrides.to_csv(r) for r in doc["rows"]]
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "up.csv")
            def write(rs):
                with open(p, "w", encoding="utf8", newline="") as f:
                    w = csv.DictWriter(f, ["Location", "Url", "Award"]); w.writeheader()
                    for x in rs: w.writerow({k: x[k] for k in ("Location", "Url", "Award")})
            write(rows)
            self.assertIn(doc["_path"], overrides.retire(p, self.m, self.doc["guides"]))
            write(rows[: len(rows) // 2])
            self.assertNotIn(doc["_path"], overrides.retire(p, self.m, self.doc["guides"]))
    def test_published_data_contains_the_new_editions(self):
        d = json.load(open(os.path.join(ROOT, "data.json"), encoding="utf8"))
        en = {c[2] for c in d["cities"]}
        for c in ("Adelaide", "Athens", "Dubai", "Austin", "Vancouver"): self.assertIn(c, en)
        u = json.load(open(os.path.join(ROOT, "updates.json"), encoding="utf8"))
        self.assertEqual(u["updates"][0]["date"], "2026-10-27")

if __name__ == "__main__": unittest.main()

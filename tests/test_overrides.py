import json, os, sys, unittest, tempfile, csv
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
import editions, overrides
ROOT = os.path.join(os.path.dirname(__file__), "..")

ROW = ["/en/texas/austin/restaurant/new-place", "New Place", "1 Main St", "78701", "Austin", "Texas", "USA",
       30.27, -97.74, "Contemporary", "CAT_P03", "$", "https://example.com", "+1 512 000 0000", "ONE_STAR", 0, 2026]

class Overrides(unittest.TestCase):
    """Uses a temporary override folder, so the tests hold whether or not any live override exists."""
    def setUp(self):
        self.doc = editions.load(); self.m = editions.matcher(self.doc)
        self.gid = lambda loc: self.doc["guides"][self.m(loc)]["id"]
        self.tmp = tempfile.TemporaryDirectory(); self.path = os.path.join(self.tmp.name, "texas-2026.json")
        json.dump({"guide": "texas", "year": 2026, "columns": [], "rows": [ROW, ["/en/texas/austin/restaurant/second"] + ["Second"] + ROW[2:]]}, open(self.path, "w"))
        self.fixture = overrides.load(self.tmp.name)
        self._load = overrides.load; overrides.load = lambda d=None: self.fixture
    def tearDown(self):
        overrides.load = self._load; self.tmp.cleanup()
    def test_live_overrides_map_to_their_own_guide_and_carry_no_editorial_text(self):
        for g, doc in self._load().items():
            ed = next(e for x in self.doc["guides"] if x["id"] == g for e in x["editions"] if e["year"] == doc["year"])
            self.assertTrue(ed.get("synced"), g)
            for r in doc["rows"]:
                row = overrides.to_csv(r)
                self.assertEqual(self.gid(overrides.upstream_loc(row)), g, (g, row["Location"]))
                self.assertEqual(row["Description"], "")
                self.assertTrue(row["Url"].startswith("https://guide.michelin.com/en/"))
    def test_fixture_maps_to_its_guide(self):
        self.assertEqual(self.gid(overrides.upstream_loc(overrides.to_csv(ROW))), "texas")
    def test_apply_replaces_upstream_rows_of_override_guides_only(self):
        up = [{"Location": "Austin, TX, USA", "Url": "https://x/en/texas/austin/restaurant/old"},
              {"Location": "Tokyo, Japan", "Url": "https://x/en/tokyo-region/tokyo/restaurant/keep"}]
        out = list(overrides.apply(up, self.m, self.doc["guides"]))
        self.assertIn(up[1], out); self.assertNotIn(up[0], out)
        self.assertEqual(len(out), 1 + 2)
    def test_retire_only_when_upstream_has_caught_up(self):
        rows = [overrides.to_csv(r) for r in self.fixture["texas"]["rows"]]
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "up.csv")
            def write(rs):
                with open(p, "w", encoding="utf8", newline="") as f:
                    w = csv.DictWriter(f, ["Location", "Url", "Award"]); w.writeheader()
                    for x in rs: w.writerow({k: x[k] for k in ("Location", "Url", "Award")})
            write(rows)
            self.assertIn(self.path, overrides.retire(p, self.m, self.doc["guides"]))
            write(rows[:1])
            self.assertNotIn(self.path, overrides.retire(p, self.m, self.doc["guides"]))
    def test_published_data_contains_the_new_editions(self):
        d = json.load(open(os.path.join(ROOT, "data.json"), encoding="utf8"))
        en = {c[2] for c in d["cities"]}
        for c in ("Adelaide", "Athens", "Dubai", "Austin", "Vancouver"): self.assertIn(c, en)
        u = json.load(open(os.path.join(ROOT, "updates.json"), encoding="utf8"))
        self.assertTrue(u["updates"] and u["updates"][0]["date"] >= "2026-11-02")

if __name__ == "__main__": unittest.main()

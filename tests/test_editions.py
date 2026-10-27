import json, os, sys, unittest, copy, datetime
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "tools"))
import editions, editions_watch, updates
ROOT = os.path.join(os.path.dirname(__file__), "..")
ms = lambda d: int(datetime.datetime.fromisoformat(d).timestamp() * 1000)

class Editions(unittest.TestCase):
    def setUp(self):
        self.doc = editions.load()
    def test_every_restaurant_has_a_guide_with_dates_and_sources(self):
        d = json.load(open(os.path.join(ROOT, "data.json"), encoding="utf8"))
        self.assertEqual(len(d["editions"]), len(self.doc["guides"]))
        for c in d["cities"]: self.assertIsInstance(c[3], int, c)
        for g in self.doc["guides"]:
            for e in g["editions"]:
                if e.get("released"):
                    datetime.date.fromisoformat(e["released"]); self.assertTrue(e["source"].startswith("https://guide.michelin.com/"))
        m = editions.matcher(self.doc)
        gid = lambda loc: self.doc["guides"][m(loc)]["id"]
        self.assertEqual(gid(["Austin", "TX", "USA"]), "texas"); self.assertEqual(gid(["Hangzhou", "Chinese Mainland"]), "sjz")
        self.assertEqual(gid(["Montréal", "Canada"]), "quebec"); self.assertEqual(gid(["Toronto", "Canada"]), "toronto"); self.assertEqual(gid(["Dubai"]), "dubai")
    def test_watch_adds_released_editions_and_ignores_save_the_date(self):
        doc = copy.deepcopy(self.doc)
        hits = [{"title": "The MICHELIN Guide Thailand 2027 Selection Is to Take Place on 10 November 2026", "published_date": ms("2026-10-15T10:00:00"), "url": "/x"},
                {"title": "Thailand Shines with New MICHELIN Stars in The MICHELIN Guide Thailand 2027", "published_date": ms("2026-11-10T12:00:00"), "url": "/th/en/a"},
                {"title": "The MICHELIN Guide Taiwan 2025 Unveiled", "published_date": ms("2025-08-19T10:00:00"), "url": "/old"},
                {"title": "Huesca, sede de la Gala de la Guía MICHELIN España 2027", "published_date": ms("2026-05-27T10:00:00"), "url": "/es"},
                {"title": "Best Hotels in Tokyo 2027", "published_date": ms("2026-11-01T10:00:00"), "url": "/hotel"}]
        added = editions_watch.apply(doc, hits)
        th = next(g for g in doc["guides"] if g["id"] == "thailand")
        self.assertEqual(th["editions"][-1], {"year": 2027, "released": "2026-11-10", "source": "https://guide.michelin.com/th/en/a", "synced": False})
        self.assertNotIn("scheduled", th); self.assertEqual(len(added), 1, added)
        tk = next(g for g in doc["guides"] if g["id"] == "tokyo"); self.assertEqual(len(tk["editions"]), 1)
        es = next(g for g in doc["guides"] if g["id"] == "spain"); self.assertEqual([e["year"] for e in es["editions"]], [2026])
    def test_updates_group_by_guide_and_sync_pending_editions(self):
        base = json.load(open(os.path.join(ROOT, "data.json"), encoding="utf8"))
        new = copy.deepcopy(base); gi = [e[0] for e in base["editions"]].index("netherlands")
        nl = [r for r in new["r"] if base["cities"][r[3]][3] == gi][:5]
        for r in nl[:3]: r[4] = max(0, r[4] - 1) if r[4] > 0 else 1
        new["r"] = [r for r in new["r"] if r is not nl[4]]; new["updated"] = "2026-10-20"
        g = updates.diff(base, new)[0]
        self.assertEqual(g["id"], "netherlands"); self.assertEqual(len(g["up"]) + len(g["down"]), 3); self.assertEqual(len(g["removed"]), 1)
        import tempfile, shutil
        tmp = tempfile.mkdtemp(); p = os.path.join(tmp, "e.json"); shutil.copy(editions.PATH, p)
        d = json.load(open(p, encoding="utf8"))   # pretend the Netherlands 2026 list hasn't reached the data yet
        for e in next(x for x in d["guides"] if x["id"] == "netherlands")["editions"]:
            if e["year"] == 2026: e["synced"] = False; e.pop("synced_on", None)
        json.dump(d, open(p, "w", encoding="utf8"), ensure_ascii=False)
        self.assertEqual(updates.sync_editions(p, [g], "2026-10-20", "2026-10-21"), ["荷兰 2026"])
        self.assertEqual(updates.sync_editions(p, [g], "2026-10-01", "2026-10-21"), [])

if __name__ == "__main__": unittest.main()

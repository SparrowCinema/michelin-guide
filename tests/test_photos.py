import unittest,json,re,importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('photo_builder',ROOT/'tools/build_photos.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Photos(unittest.TestCase):
 def test_url_matching_preserves_city_and_restaurant_identity(self):
  self.assertEqual(m.key('https://guide.michelin.com/gb/en/ile-de-france/paris/restaurant/arp%C3%A8ge'),m.key('ile-de-france/paris/restaurant/arpège'))
  self.assertNotEqual(m.key('region/first-city/restaurant/blue'),m.key('region/second-city/restaurant/blue'))
 def test_only_official_cdn_image_ids(self):
  name='a'*32+'.jpeg';self.assertEqual(m.photo('https://prod-pics.guide.michelin.com/api/public/content/'+name+'?format=webp'),name)
  for url in ['https://evil.example/api/public/content/'+name,'http://prod-pics.guide.michelin.com/api/public/content/'+name,'https://prod-pics.guide.michelin.com.evil.example/api/public/content/'+name,'javascript:alert(1)']:self.assertIsNone(m.photo(url))
 def test_every_shard_matches_existing_country_and_exact_ids(self):
  data=json.loads((ROOT/'data.json').read_text());ids={r[7]:data['cities'][r[3]][1] for r in data['r']};count=0;seen=set()
  for co,country in enumerate(data['countries']):
   shard=json.loads((ROOT/f'photos/country-{co}.json').read_text());self.assertEqual(shard['country'],country[1])
   for u,file in shard['items'].items():
    self.assertEqual(ids[u],co);self.assertRegex(file,r'^[a-f0-9]{32}\.(jpeg|jpg|png|webp)$');self.assertNotIn(u,seen);seen.add(u);count+=1
  manifest=json.loads((ROOT/'photos/manifest.json').read_text());self.assertEqual(count,manifest['matched']);self.assertEqual(count+len(manifest['missing']),len(data['r']));self.assertEqual(seen|set(manifest['missing']),set(ids))
if __name__=='__main__':unittest.main()

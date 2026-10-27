import unittest,importlib.util,json,re,collections
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('address_builder',ROOT/'tools/build_address_translations.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Addresses(unittest.TestCase):
 def test_domestic_names_and_units(self):
  text='101-102, Building No. 1, Garden Office, No.161, Lane 465, Zhenning Road, Changning, Shanghai, Chinese Mainland'
  zh=m.localize(text,'中国内地','上海')
  for word in ['中国内地','上海','长宁区','镇宁路','465弄','161号','1号楼','101-102']:self.assertIn(word,zh)
 def test_unknown_names_never_guessed(self):
  zh=m.localize('L406B, 4F, CP Center, 20 Unknown Road, Chaoyang, Beijing, Chinese Mainland','中国内地','北京')
  for word in ['Unknown','CP Center','L406B','4层','朝阳区']:self.assertIn(word,zh)
  self.assertNotIn('潮阳',zh)
 def test_international_street_spelling_and_postcode(self):
  zh=m.localize('84 rue de Varenne, Paris, 75007, France','法国','巴黎')
  for word in ['法国','巴黎','rue de Varenne','84号','75007']:self.assertIn(word,zh)
 def test_every_address_matches_original_and_keeps_numbers(self):
  data=json.loads((ROOT/'data.json').read_text())
  for r in data['r']:
   if not r[9].strip():continue
   city,co=data['cities'][r[3]][:2];item={'zh':m.localize(r[9],data['countries'][co][0],city)};self.assertRegex(item['zh'],r'[\u3400-\u9fff]')
   self.assertLessEqual(collections.Counter(re.findall(r'\d+',r[9])),collections.Counter(re.findall(r'\d+',item['zh'])))
if __name__=='__main__':unittest.main()

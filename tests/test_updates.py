import importlib.util, io, csv, unittest
spec=importlib.util.spec_from_file_location('check_updates','tools/check_updates.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Updates(unittest.TestCase):
 def dataset(self):
  return {'updated':'2026-10-03','countries':[['法国','France','欧洲']],'cities':[['巴黎',0]],'cuisines':['法式'],'r':[['A','',0,0,1,0,2,'france/paris/restaurant/a','','',48,2,0,'1111',0],['B','',0,0,2,0,2,'france/paris/restaurant/b','','',48,2,0,'2222',0]]}
 def csv(self):
  s=io.StringIO();w=csv.writer(s);w.writerow(['Name','Url','Award','Location','Latitude','Longitude']);w.writerow(['A','https://guide.michelin.com/en/france/paris/restaurant/a','3 Stars','Paris, France',48,2]);w.writerow(['C','https://guide.michelin.com/en/france/paris/restaurant/c','1 Star','Paris, France',48,2]);return s.getvalue()
 def test_candidate_differences(self):
  r=m.compare(self.dataset(),self.csv());self.assertEqual(len(r['added']),1);self.assertEqual(len(r['removed']),1);self.assertEqual(r['award_changes'][0]['previous_award'],1)
 def test_duplicate_rejected(self):
  d=self.dataset();d['r'].append(d['r'][0]);self.assertRaises(AssertionError,m.validate,d)
 def test_schema_rejected(self):self.assertRaises(AssertionError,m.compare,self.dataset(),'wrong,columns\n1,2\n')
 def test_coordinate_rejected(self):
  d=self.dataset();d['r'][0][10]=91;self.assertRaises(AssertionError,m.validate,d)

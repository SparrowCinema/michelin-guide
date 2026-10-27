"""Build Chinese city display names without changing restaurant/city identifiers.
GeoNames country/cities500 extracts: https://download.geonames.org/export/dump/ (CC BY 4.0).
Run: PYTHONPATH=/path/to/opencc python tools/build_city_names.py --geonames-dir /path/to/extracts
Unmatched small places get a visibly documented reference transliteration, never an official-name claim.
"""
import argparse,collections,hashlib,itertools,json,math,re,unicodedata,zipfile
from pathlib import Path
from opencc import OpenCC
ROOT=Path(__file__).resolve().parents[1];CC=OpenCC('t2s')
ISO={'Chinese Mainland':'CN','Hong Kong SAR':'HK','Macau SAR':'MO','Taiwan Region':'TW','USA':'US','United Kingdom':'GB','UAE':'AE','Türkiye':'TR','The Philippines':'PH','Principality of Monaco':'MC','Japan':'JP','France':'FR','Italy':'IT','Spain':'ES','Germany':'DE','Belgium':'BE','Netherlands':'NL','Switzerland':'CH','Austria':'AT','Portugal':'PT','Ireland':'IE','Croatia':'HR','Canada':'CA','Poland':'PL','Slovenia':'SI','Mexico':'MX','Hungary':'HU','Denmark':'DK','Czechia':'CZ','Luxembourg':'LU','Malta':'MT','Thailand':'TH','Norway':'NO','Estonia':'EE','New Zealand':'NZ','Lithuania':'LT','Latvia':'LV','Sweden':'SE','Finland':'FI','Andorra':'AD','Malaysia':'MY','Vietnam':'VN','Saudi Arabia':'SA','Brazil':'BR','South Korea':'KR','Argentina':'AR','Iceland':'IS','Serbia':'RS','Liechtenstein':'LI','Singapore':'SG','Greece':'GR','Qatar':'QA'}
def norm(s):
 s=s.replace('œ','oe').replace('æ','ae').replace('ß','ss').replace('ø','o').replace('ł','l').replace('ð','d').replace('þ','th')
 return re.sub('[^a-z0-9]','',unicodedata.normalize('NFKD',re.sub(r'\s*\([A-Z]{2}\)$','',s)).lower())
VOWELS='aeiou';CV={}
for c,line in {'b':'巴 贝 比 博 布','c':'卡 塞 奇 科 库','d':'达 德 迪 多 杜','f':'法 费 菲 福 富','g':'加 杰 吉 戈 古','h':'哈 赫 希 霍 胡','j':'贾 杰 吉 乔 朱','k':'卡 凯 基 科 库','l':'拉 勒 利 洛 卢','m':'马 梅 米 莫 穆','n':'纳 内 尼 诺 努','p':'帕 佩 皮 波 普','r':'拉 雷 里 罗 鲁','s':'萨 塞 西 索 苏','t':'塔 特 蒂 托 图','v':'瓦 韦 维 沃 武','w':'瓦 韦 威 沃 乌','z':'扎 泽 齐 佐 祖'}.items():
 for v,zh in zip(VOWELS,line.split()):CV[c+v]=zh
PART={'br':'布尔','bra':'布拉','bre':'布雷','bri':'布里','bro':'布罗','bru':'布鲁','bl':'布尔','bla':'布拉','ble':'布勒','bli':'布利','blo':'布洛','blu':'布卢','dr':'德尔','dra':'德拉','dre':'德雷','dri':'德里','dro':'德罗','dru':'德鲁','fr':'弗尔','fra':'弗拉','fre':'弗雷','fri':'弗里','fro':'弗罗','fru':'弗鲁','gr':'格尔','gra':'格拉','gre':'格雷','gri':'格里','gro':'格罗','gru':'格鲁','kr':'克尔','kra':'克拉','kre':'克雷','kri':'克里','kro':'克罗','kru':'克鲁','pr':'普尔','pra':'普拉','pre':'普雷','pri':'普里','pro':'普罗','pru':'普鲁','tr':'特尔','tra':'特拉','tre':'特雷','tri':'特里','tro':'特罗','tru':'特鲁','sch':'施','sh':'什','ch':'希','ph':'夫','th':'特','ck':'克','tz':'茨','ts':'茨','qu':'克','qua':'夸','que':'克','qui':'基','gn':'尼','gli':'利','eau':'奥','aux':'奥','ou':'乌','au':'奥','ai':'艾','ay':'艾','ei':'艾','ey':'艾','oi':'瓦','oy':'瓦','ee':'伊','ie':'伊','oe':'厄','ue':'于','oo':'乌','y':'伊','a':'阿','e':'埃','i':'伊','o':'奥','u':'乌','b':'布','c':'克','d':'德','f':'夫','g':'格','h':'赫','j':'日','k':'克','l':'尔','m':'姆','n':'恩','p':'普','q':'克','r':'尔','s':'斯','t':'特','v':'夫','w':'乌','x':'克斯','z':'兹'}
WORDS={'saint':'圣','sainte':'圣','st':'圣','san':'圣','santa':'圣','santo':'圣','sankt':'圣','sint':'圣','sant':'圣','santah':'圣','di':'迪','de':'德','del':'德尔','della':'德拉','delle':'德莱','des':'德','du':'迪','sur':'叙尔','sous':'苏','le':'勒','les':'莱','la':'拉','las':'拉斯','los':'洛斯','el':'埃尔','en':'昂','d':'德','l':'勒','bad':'巴特','am':'阿姆','im':'伊姆','an':'安','der':'德尔','den':'登','van':'范','het':'赫特','aan':'安','on':'安','the':'泽','upon':'阿庞','by':'拜','north':'北','south':'南','east':'东','west':'西','new':'新','old':'老','mount':'芒特','monte':'蒙特','mont':'蒙','castel':'卡斯泰尔','castello':'卡斯泰洛','castelnuovo':'新堡','castellet':'卡斯泰莱','villa':'维拉','porto':'波尔托','port':'波尔','ville':'维尔','village':'维拉日'}
OVERRIDES={'Brunico':'布鲁尼科','Brusaporto':'布鲁萨波尔托','Runate':'鲁纳泰','Megève':'梅杰夫','Cartmel':'卡特梅尔','Gentofte':'根措夫特','Roeselare':'鲁瑟拉勒','Arriondas':'阿里翁达斯','Villaverde de Pontones':'比利亚韦尔德德蓬托内斯','Larrabetzu':'拉拉韦苏',"L’Herbaudière":'莱尔博迪耶尔',"L'Herbaudière":'莱尔博迪耶尔',"Serralunga d'Alba":'阿尔巴塞拉伦加','Rubano':'鲁巴诺','Jongieux':'容日约','Chagny':'沙尼','Lasarte - Oria':'拉萨尔特-奥里亚','Dénia':'德尼亚','Stavanger':'斯塔万格','Aughton':'奥顿','Castel di Sangro':'桑格罗堡','Fürstenau':'菲尔斯特瑙','Bray':'布雷','Senigallia':'塞尼加利亚','Perl':'佩尔','Orta San Giulio':'奥尔塔圣朱利奥','Grassau':'格拉绍','Harderwijk':'哈德尔韦克','Deal':'迪尔','Bath':'巴斯','Nice':'尼斯','Cassis':'卡西','Menton':'芒通','Baiersbronn':'拜尔斯布龙','Deidesheim':'戴德斯海姆','Fontjoncouse':'丰容库斯','Lustenau':'卢斯特瑙','Rust':'鲁斯特','Bra':'布拉','Suesa':'苏埃萨','Irun':'伊伦','Zonza':'宗扎','Cambridge':'剑桥','Leeds':'利兹','York':'约克','Oxford':'牛津','Winchester':'温彻斯特','Canterbury':'坎特伯雷','Limerick':'利默里克','Lucca':'卢卡','Sorrento':'索伦托','Positano':'波西塔诺','Taormina':'陶尔米纳','Ravello':'拉韦洛','Pescara':'佩斯卡拉','Bolzano':'博尔扎诺','Merano':'梅拉诺','Bressanone':'布雷萨诺内','Lecce':'莱切','Rimini':'里米尼','Arezzo':'阿雷佐','Assisi':'阿西西','Tivoli':'蒂沃利','Baveno':'巴韦诺','Weinheim':'魏因海姆','Wismar':'维斯马','Grenchen':'格伦兴','Groningen':'格罗宁根','Zwolle':'兹沃勒','Haarlem':'哈勒姆','Delft':'代尔夫特','Breda':'布雷达','Hannut':'阿尼','Mouscron':'穆斯克龙','Niğde':'尼代','Albufeira':'阿尔布费拉','Cascais':'卡斯凯什','Funchal':'丰沙尔','Coimbra':'科英布拉','Guimarães':'吉马良斯','Évora':'埃武拉','Óbidos':'奥比杜什','Collingwood':'科林伍德','Doraville':'多拉维尔','Chamblee':'钱布利','Scottsdale':'斯科茨代尔','Telluride':'特柳赖德','Duluth':'德卢斯','Salt Lake City':'盐湖城','Santa Fe':'圣菲','Phoenix':'菲尼克斯','Albuquerque':'阿尔伯克基'}
def reference(s,country):
 raw=re.sub(r'\s*\([A-Z]{2}\)$','',s)
 if raw in OVERRIDES:return OVERRIDES[raw]
 out=[];lex=CV|PART
 lex|={'lla':'利亚','lle':'列','lli':'利','llo':'略','llu':'柳','bia':'比亚','cio':'乔','cia':'恰','gia':'贾','gio':'焦','lia':'利亚','lio':'利奥','nia':'尼亚','nio':'尼奥','ria':'里亚','rio':'里奥','tia':'蒂亚','ville':'维尔','burg':'堡','bourg':'堡','berg':'贝格','heim':'海姆','hausen':'豪森','dorf':'多夫','ford':'福德','ton':'顿','mouth':'茅斯','shire':'郡'}
 nasal={}
 for c,line in {'b':'班 本 宾 邦 本','d':'丹 登 丁 唐 敦','f':'凡 芬 芬 丰 丰','g':'甘 根 金 贡 贡','h':'汉 亨 欣 洪 洪','k':'坎 肯 金 孔 昆','c':'坎 岑 辛 孔 昆','l':'兰 伦 林 隆 伦','m':'曼 门 明 蒙 蒙','n':'南 嫩 宁 农 农','p':'潘 彭 平 蓬 蓬','r':'兰 伦 林 龙 伦','s':'桑 森 辛 松 松','t':'坦 滕 廷 通 通','v':'万 文 温 冯 冯'}.items():
  for v,zh in zip(VOWELS,line.split()):nasal[c+v+'n']=zh
 if country in ['Spain','Mexico']:lex=lex|{'ll':'利亚','j':'赫','ce':'塞','ci':'西'}
 if country=='France':lex=lex|{'ch':'沙','ge':'热','gi':'日','eu':'厄'}
 if country in ['Germany','Austria','Switzerland']:lex=lex|{'sch':'施','tsch':'奇','ei':'艾','eu':'欧','sp':'施普','st':'施特','ch':'希','z':'茨','w':'韦'}
 for word in re.findall('[A-Za-zÀ-ž0-9]+',raw):
  n=norm(word)
  if n in WORDS:out.append(WORDS[n]);continue
  if n.isdigit():out.append(n.translate(str.maketrans('0123456789','〇一二三四五六七八九')));continue
  i=0;part=''
  while i<len(n):
   syll=n[i:i+3]
   if syll in nasal and (i+3==len(n) or n[i+3] not in VOWELS):part+=nasal[syll];i+=3;continue
   key=next((n[i:i+k] for k in [6,5,4,3,2,1] if n[i:i+k] in lex),None)
   if key:part+=lex[key];i+=len(key)
   else:i+=1
  out.append(part)
 return '·'.join(filter(None,out)) or '未定译名'
def build(directory):
 d=json.loads((ROOT/'data.json').read_text());idx=collections.defaultdict(dict);sources={};streams=[]
 base=directory/'cities500.txt'
 if base.exists():streams.append(base.open());sources['cities500.txt']=hashlib.sha256(base.read_bytes()).hexdigest()
 for p in sorted(directory.glob('*.zip')):
  z=zipfile.ZipFile(p);fname=p.stem+'.txt'
  if fname in z.namelist():streams.append((x.decode('utf-8') for x in z.open(fname)));sources[p.name]=hashlib.sha256(p.read_bytes()).hexdigest()
 for line in itertools.chain.from_iterable(streams):
  r=line.rstrip('\n').split('\t')
  if len(r)<15 or r[6] not in ['A','P']:continue
  alts=r[3].split(',');zh=[CC.convert(s) for s in alts if re.search('[\u3400-\u9fff]',s) and not re.search('[\u3040-\u30ff\uac00-\ud7af]',s)]
  if not zh:continue
  for n in {norm(x) for x in [r[1],r[2]]+alts}-{''}:idx[(r[8],n)][r[0]]=(float(r[4]),float(r[5]),zh)
 points=collections.defaultdict(list)
 for r in d['r']:
  if r[10] is not None:points[r[3]].append((r[10],r[11]))
 names={};evidence={};counts=collections.Counter()
 for i,t in enumerate(d['cities']):
  country=d['countries'][t[1]][1];original=t[2] or t[0];kind='existing';zh=t[0];proof={}
  if not re.search('[\u3400-\u9fff]',zh):
   pts=points[i];lat=sum(x[0] for x in pts)/len(pts);lng=sum(x[1] for x in pts)/len(pts)
   near=sorted((math.hypot((v[0]-lat)*111,(v[1]-lng)*111*math.cos(math.radians(lat))),gid,v[2]) for gid,v in idx.get((ISO[country],norm(original)),{}).items())
   if near and near[0][0]<25 and (len(near)==1 or near[1][0]-near[0][0]>3 or set(near[0][2])&set(near[1][2])):
    dist,gid,labels=near[0];zh=labels[0];kind='gazetteer';proof={'geonames':gid,'distance_km':round(dist,2)}
   else:zh=reference(original,country);kind='reference'
  names.setdefault(country,{})[original]=[CC.convert(zh),kind[0]];counts[kind]+=1
  evidence.setdefault(country,{})[original]=[CC.convert(zh),kind,proof] if proof else [CC.convert(zh),kind]
 assert sum(counts.values())==len(d['cities']) and all(re.search('[\u3400-\u9fff]',v[0]) for c in names.values() for v in c.values())
 (ROOT/'tools/city_names.json').write_text(json.dumps({'updated':'2026-10-27','license':'GeoNames-derived names: CC BY 4.0. Reference transliterations are not official names.','source':'https://www.geonames.org/','counts':counts,'source_archives':sources,'items':evidence},ensure_ascii=False,separators=(',',':'))+'\n')
 runtime='/* Generated by tools/build_city_names.py. GeoNames: https://www.geonames.org/ (CC BY 4.0); reference transliterations are not official names. */\nconst MGCity=(()=>{const names='+json.dumps(names,ensure_ascii=False,separators=(',',':'))+';\nfunction apply(d){d.cities.forEach(t=>{const raw=t[2]||t[0],v=names[d.countries[t[1]][1]]?.[raw];if(v){t[2]=raw;t[0]=v[0];}});}\nfunction info(country,original){return names[country]?.[original]||null;}\nreturn {apply,info};})();\nif(typeof module!=="undefined")module.exports=MGCity;\n'
 (ROOT/'city-names.js').write_text(runtime);print(dict(counts))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--geonames-dir',type=Path,required=True);build(p.parse_args().geonames_dir)

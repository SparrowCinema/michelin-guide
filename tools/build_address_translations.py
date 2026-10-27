"""Conservative Chinese address localization; never infer unknown street/building names.
Original restaurant addresses and identifiers remain authoritative. No map data is claimed.
Run: python tools/build_address_translations.py
"""
import ast,json,re
from collections import Counter
from functools import lru_cache
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
TREE=ast.parse((ROOT/'tools/build.py').read_text())
CITY=next(ast.literal_eval(n.value) for n in TREE.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='CITY' for t in n.targets))
COUNTRY=next(ast.literal_eval(n.value) for n in TREE.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='COUNTRY' for t in n.targets))
# Only unambiguous, established names; no pinyin-to-Chinese guessing.
NAMES=dict(x.split('=',1) for x in '''Changning=长宁区|Huangpu=黄浦区|Xuhui=徐汇区|Pudong=浦东新区|Jing'an=静安区|Jingan=静安区|Hongkou=虹口区|Putuo=普陀区|Minhang=闵行区|Yangpu=杨浦区|Chaoyang=朝阳区|Haidian=海淀区|Dongcheng=东城区|Xicheng=西城区|Fengtai=丰台区|Shunyi=顺义区|Nanshan=南山区|Futian=福田区|Luohu=罗湖区|Tianhe=天河区|Yuexiu=越秀区|Haizhu=海珠区|Panyu=番禺区|Liwan=荔湾区|Wuhou=武侯区|Jinjiang=锦江区|Qingyang=青羊区|Jinniu=金牛区|Chenghua=成华区|Xuanwu=玄武区|Qinhuai=秦淮区|Jianye=建邺区|Manhattan=曼哈顿|Brooklyn=布鲁克林|Central=中环|Wan Chai=湾仔|Causeway Bay=铜锣湾|Tsim Sha Tsui=尖沙咀|Kowloon=九龙|North Point=北角|Sheung Wan=上环|Happy Valley=跑马地|Mong Kok=旺角|Admiralty=金钟|Repulse Bay=浅水湾'''.split('|'))
# Context-specific road names; unknown names stay in their original spelling.
ROADS={
 '上海':{'Zhenning Road':'镇宁路','Yuanmingyuan Road':'圆明园路','Nanjing West Road':'南京西路','Nanjing East Road':'南京东路','Huaihai Middle Road':'淮海中路','Huaihai Road':'淮海路','Sichuan Middle Road':'四川中路','Zhongshan East 1st Road':'中山东一路（East 1st Road）','Fuxing Middle Road':'复兴中路','Wukang Road':'武康路','Donghu Road':'东湖路','Xinle Road':'新乐路','Fumin Road':'富民路','Anfu Road':'安福路','Yuyuan Road':'愚园路','Hengshan Road':'衡山路','Jianguo West Road':'建国西路','Jianguo Middle Road':'建国中路','Taixing Road':'泰兴路','Shaanxi North Road':'陕西北路','Shaanxi South Road':'陕西南路','Shimen 1st Road':'石门一路（Shimen 1st Road）','Huangpi South Road':'黄陂南路','Maoming South Road':'茂名南路','Xizang Middle Road':'西藏中路','Henan Middle Road':'河南中路','Changle Road':'长乐路','Beijing West Road':'北京西路',"Yan'an Middle Road":'延安中路',"Yan'an West Road":'延安西路','Yongfu Road':'永福路'},
 '北京':{'Xinyuan South Road':'新源南路','Xinyuanli':'新源里','Jianguomen Outer Street':'建国门外大街','Jianguomenwai Street':'建国门外大街','Jianguo Road':'建国路','Jinbao Street':'金宝街','Wangfujing Street':'王府井大街','Gongti North Road':'工体北路','Gongti West Road':'工体西路','Dongzhimen Outer Street':'东直门外大街','Dongzhimenwai Street':'东直门外大街','Jinhe East Road':'金和东路'},
 '香港':{'Chater Road':'遮打道','Queen\'s Road Central':'皇后大道中','Des Voeux Road Central':'德辅道中','Wellington Street':'威灵顿街','Hollywood Road':'荷李活道','Nathan Road':'弥敦道','Canton Road':'广东道','Salisbury Road':'梳士巴利道','Hennessy Road':'轩尼诗道','Lockhart Road':'骆克道','Duddell Street':'都爹利街'},
}
TERMS={'Ground Floor': '地面层', 'Lower Ground Floor': '地下层', 'Basement': '地下层', 'Mezzanine': '夹层', 'Shopping Mall': '购物中心', 'Shopping Centre': '购物中心', 'Shopping Center': '购物中心', 'Garden Office': '花园办公区', 'Building': '大楼', 'Tower': '座', 'Block': '楼栋', 'North': '北', 'South': '南', 'East': '东', 'West': '西', 'Road': '路', 'Street': '街', 'Avenue': '大道', 'Boulevard': '大道', 'Lane': '巷', 'Floor': '层', 'Shop': '商铺', 'Unit': '单元', 'Room': '室', 'Suite': '套间', 'Hotel': '酒店', 'Restaurant': '餐厅', 'National Stadium': '国家体育场', 'Shopping Arcade': '商场', 'Shopping Complex': '商业中心', 'Business Center': '商务中心', 'Business Centre': '商务中心', 'Financial Center': '金融中心', 'Financial Centre': '金融中心', 'Convention Center': '会展中心', 'Convention Centre': '会展中心', 'International': '国际', 'The Peninsula': '半岛', 'Mandarin Oriental': '文华东方', 'Four Seasons': '四季', 'Park Hyatt': '柏悦', 'Grand Hyatt': '君悦', 'Ritz-Carlton': '丽思卡尔顿', 'Waldorf Astoria': '华尔道夫', 'Shangri-La': '香格里拉', 'InterContinental': '洲际', 'Marriott': '万豪', 'Hilton': '希尔顿', 'Conrad': '康莱德', 'Rosewood': '瑰丽'}

@lru_cache(maxsize=32)
def matcher(pairs):
 mapping={k.lower().replace('\u0307','').replace('ı','i'):v for k,v in pairs}
 pattern=re.compile(r'(?<![A-Za-z])(?:'+'|'.join(re.escape(k) for k,v in sorted(pairs,key=lambda p:len(p[0]),reverse=True))+r')(?![A-Za-z])',re.I)
 return pattern,mapping

def words(text,mapping):
 if not mapping:return text
 pattern,lower=matcher(tuple(mapping.items()))
 return pattern.sub(lambda m:lower[m.group().lower().replace('\u0307','').replace('ı','i')],text)

def localize(address,country,city):
 places={**{k:v[0] for k,v in COUNTRY.items()},**CITY}
 text=words(address,{k:v for k,v in places.items() if v in (country,city)})
 if country.startswith('中国'):text=','.join(NAMES.get(p.strip(),p.strip()) for p in text.split(','))
 text=words(text,ROADS.get(city,{}))
 # Keep numeric substrings byte-for-byte; special cases run before generic units.
 text=re.sub(r'\b(B\d+)\b',r'地下\1层',text,flags=re.I)
 text=re.sub(r'\b(\d+(?:-\d+)?)\s*(?:F\b|(?:st|nd|rd|th)?\s+Floor\b)',r'\1层',text,flags=re.I)
 text=re.sub(r'\b(?:Building|Block)\s*(?:No\.?\s*)?([A-Za-z]?\d+[A-Za-z]?)',r'\1号楼',text,flags=re.I)
 text=re.sub(r'\b(?:No\.?\s*)(\d+(?:[-/]\d+)*[A-Za-z]?)',r'\1号',text,flags=re.I)
 text=re.sub(r'\b(?:Shop|Unit|Room|Suite)\s+([A-Za-z]?\d+(?:[-/]\d+)*[A-Za-z]?)',r'\1室',text,flags=re.I)
 text=re.sub(r'\bLane\s+(\d+)\b',r'\1弄',text,flags=re.I)
 # Translate address type words, leaving the actual proper names intact.
 text=words(text,TERMS)
 parts=[p.strip(' ,') for p in text.split(',') if p.strip(' ,')]
 regions=[country,city]
 # Outer-to-inner order in Chinese; source-order remains available verbatim.
 if country.startswith('中国'):parts.reverse()
 street_types={'rue':'街','avenue':'大道','boulevard':'大道','via':'街','viale':'大道','calle':'街','carrer':'街','chemin':'路','route':'路'}
 for i,part in enumerate(parts):
  m=re.fullmatch(r'(\d+[A-Za-z]?(?:[-/]\d+)*)\s+((rue|avenue|boulevard|via|viale|calle|carrer|chemin|route)\b.+)',part,re.I)
  if m:parts[i]=f'{m[2]}（{street_types[m[3].lower()]}）{m[1]}号'
  else:
   m=re.fullmatch(r'(\d+[A-Za-z]?(?:[-/]\d+)*)\s+(.+[\u3400-\u9fff])',part)
   if m:parts[i]=m[2]+m[1]+'号'
 parts=[p for p in parts if p not in regions]
 result=' · '.join(dict.fromkeys(regions+parts))
 # An output that drops/alters any source number is rejected, never silently shipped.
 source_numbers=re.findall(r'\d+',address)
 if not Counter(source_numbers)<=Counter(re.findall(r'\d+',result)):
  result=f'{country} · {city} · {address}'
 return result

def main():
 config={'places':{**{k:v[0] for k,v in COUNTRY.items()},**CITY},'districts':NAMES,'roads':ROADS,'terms':TERMS}
 runtime=(ROOT/'tools/address_runtime.js').read_text()
 output='/* Generated by tools/build_address_translations.py; reference localization, not map data. */\nconst MGAddress = '+runtime.replace('__CONFIG__',json.dumps(config,ensure_ascii=False,separators=(',',':')))+';\nif(typeof module!=="undefined")module.exports=MGAddress;\n'
 (ROOT/'address-localization.js').write_text(output)
 print('Built offline address localizer; unknown proper names remain in source spelling')
if __name__=='__main__':main()

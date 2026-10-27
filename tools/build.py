"""Build data.json for the Michelin directory.

Usage:
  python3 tools/build.py michelin_my_maps.csv tools/cn_mainland_curated.json data.json \
      tools/zh_official_names.json tools/reference_translations.tsv \
      tools/history.json tools/black_pearl_2026.json 2026-10-03

history.json comes from tools/history.py (yearly snapshots of the same CSV);
the last argument is the date of the CSV snapshot, shown on the page.
Row layout: [name, zh, flags, cityIdx, award, cuisineIdx, price, urlPath, website, address,
             lat, lon, greenStar, history, blackPearl, localAddress?]
localAddress (optional) is the MICHELIN Guide's own zh/ja address, see tools/local_address.py.

michelin_my_maps.csv comes from https://github.com/ngshiheng/michelin-my-maps (data/).
"""
import csv, json, collections, sys
from urllib.parse import unquote
SRC = sys.argv[1]; CUR = sys.argv[2]; OUT = sys.argv[3]

COUNTRY = {  # en: (中文, 大洲)
 "Japan":("日本","亚洲"),"Chinese Mainland":("中国内地","亚洲"),"Hong Kong SAR":("中国香港","亚洲"),
 "Macau SAR":("中国澳门","亚洲"),"Taiwan Region":("中国台湾","亚洲"),"Singapore":("新加坡","亚洲"),
 "South Korea":("韩国","亚洲"),"Thailand":("泰国","亚洲"),"Vietnam":("越南","亚洲"),"Malaysia":("马来西亚","亚洲"),
 "The Philippines":("菲律宾","亚洲"),"UAE":("阿联酋","亚洲"),"Saudi Arabia":("沙特阿拉伯","亚洲"),"Qatar":("卡塔尔","亚洲"),
 "France":("法国","欧洲"),"Italy":("意大利","欧洲"),"Spain":("西班牙","欧洲"),"Germany":("德国","欧洲"),
 "United Kingdom":("英国","欧洲"),"Belgium":("比利时","欧洲"),"Switzerland":("瑞士","欧洲"),"Netherlands":("荷兰","欧洲"),
 "Austria":("奥地利","欧洲"),"Portugal":("葡萄牙","欧洲"),"Poland":("波兰","欧洲"),"Türkiye":("土耳其","欧洲"),
 "Ireland":("爱尔兰","欧洲"),"Croatia":("克罗地亚","欧洲"),"Denmark":("丹麦","欧洲"),"Sweden":("瑞典","欧洲"),
 "Czechia":("捷克","欧洲"),"Slovenia":("斯洛文尼亚","欧洲"),"Hungary":("匈牙利","欧洲"),"Norway":("挪威","欧洲"),
 "Malta":("马耳他","欧洲"),"Luxembourg":("卢森堡","欧洲"),"Lithuania":("立陶宛","欧洲"),"Estonia":("爱沙尼亚","欧洲"),
 "Finland":("芬兰","欧洲"),"Greece":("希腊","欧洲"),"Latvia":("拉脱维亚","欧洲"),"Serbia":("塞尔维亚","欧洲"),
 "Principality of Monaco":("摩纳哥","欧洲"),"Iceland":("冰岛","欧洲"),"Andorra":("安道尔","欧洲"),"Liechtenstein":("列支敦士登","欧洲"),
 "USA":("美国","北美洲"),"Canada":("加拿大","北美洲"),"Mexico":("墨西哥","北美洲"),
 "Brazil":("巴西","南美洲"),"Argentina":("阿根廷","南美洲"),"New Zealand":("新西兰","大洋洲"),
}
CITY = {
 "Tokyo":"东京","Kyoto":"京都","Osaka":"大阪","Nara":"奈良","Hokkaido":"北海道","Sapporo":"札幌","Fukuoka":"福冈","Nagoya":"名古屋","Yokohama":"横滨","Kanazawa":"金泽","Kobe":"神户","Hiroshima":"广岛","Nagano":"长野","Toyama":"富山","Ishikawa":"石川","Miyagi":"宫城","Tottori":"鸟取","Shimane":"岛根","Wakayama":"和歌山","Okayama":"冈山","Kumamoto":"熊本","Saga":"佐贺","Shizuoka":"静冈","Hyogo":"兵库","Hakone":"箱根","Kamakura":"镰仓","Karuizawa":"轻井泽",
 "Hong Kong":"香港","Macau":"澳门","Taipei":"台北","Taichung":"台中","Tainan":"台南","Kaohsiung":"高雄","New Taipei":"新北","Hsinchu County":"新竹县","Hsinchu City":"新竹市",
 "Beijing":"北京","Shanghai":"上海","Nanjing":"南京","Yangzhou":"扬州","Changzhou":"常州","Wenzhou":"温州","Taizhou":"台州","Fuzhou":"福州","Xiamen":"厦门","Quanzhou":"泉州","Ningde":"宁德","Hangzhou":"杭州","Suzhou":"苏州","Guangzhou":"广州","Shenzhen":"深圳","Chengdu":"成都",
 "Singapore":"新加坡","Seoul":"首尔","Busan":"釜山","Bangkok":"曼谷","Phuket":"普吉","Chiang Mai":"清迈","Phang Nga":"攀牙","Chon Buri":"春武里","Khon Kaen":"孔敬","Nakhon Ratchasima":"呵叻","Phra Nakhon Si Ayutthaya":"大城",
 "Ho Chi Minh City":"胡志明市","Hanoi":"河内","Da Nang":"岘港","Kuala Lumpur":"吉隆坡","George Town":"槟城乔治市","Cebu":"宿务","Makati - Metro Manila":"马卡蒂（马尼拉）","Taguig - Metro Manila":"达义（马尼拉）",
 "Dubai":"迪拜","Abu Dhabi":"阿布扎比","Doha":"多哈","Riyadh":"利雅得","Jeddah":"吉达","AlUla":"欧拉","Istanbul":"伊斯坦布尔","Izmir":"伊兹密尔","Bodrum":"博德鲁姆",
 "Paris":"巴黎","Lyon":"里昂","Bordeaux":"波尔多","Nice":"尼斯","Marseille":"马赛","Toulouse":"图卢兹","Nantes":"南特","Strasbourg":"斯特拉斯堡","Annecy":"安纳西","Montpellier":"蒙彼利埃","Dijon":"第戎","Lille":"里尔","Biarritz":"比亚里茨","Reims":"兰斯","Cannes":"戛纳","Avignon":"阿维尼翁","Rennes":"雷恩","Courchevel":"高雪维尔","Chamonix-Mont-Blanc":"霞慕尼",
 "London":"伦敦","Edinburgh":"爱丁堡","City of Bristol":"布里斯托","Birmingham":"伯明翰","Brighton and Hove":"布莱顿","Manchester":"曼彻斯特","Glasgow":"格拉斯哥","Bath":"巴斯","Oxford":"牛津","Cambridge":"剑桥","Dublin City":"都柏林","Cork":"科克","Galway":"戈尔韦",
 "Madrid":"马德里","Barcelona":"巴塞罗那","Valencia":"瓦伦西亚","Donostia / San Sebastián":"圣塞巴斯蒂安","Bilbao":"毕尔巴鄂","Seville":"塞维利亚","Malaga":"马拉加","Córdoba":"科尔多瓦","Alacant":"阿利坎特","Santiago de Compostela":"圣地亚哥-德孔波斯特拉","Marbella":"马贝拉","Girona":"赫罗纳","Granada":"格拉纳达",
 "Rome":"罗马","Milan":"米兰","Turin":"都灵","Florence":"佛罗伦萨","Venice":"威尼斯","Naples":"那不勒斯","Verona":"维罗纳","Genoa":"热那亚","Bologna":"博洛尼亚","Modena":"摩德纳","Alba":"阿尔巴","Palermo":"巴勒莫","Bergamo":"贝加莫","Como":"科莫","Parma":"帕尔马",
 "Berlin":"柏林","Munich":"慕尼黑","Hamburg":"汉堡","Cologne":"科隆","Düsseldorf":"杜塞尔多夫","Frankfurt on the Main":"法兰克福","Stuttgart":"斯图加特","Nuremberg":"纽伦堡","Dresden":"德累斯顿","Leipzig":"莱比锡","Baiersbronn":"拜尔斯布龙",
 "Amsterdam":"阿姆斯特丹","Rotterdam":"鹿特丹","The Hague":"海牙","Maastricht":"马斯特里赫特","Utrecht":"乌得勒支","Brussels":"布鲁塞尔","Antwerpen":"安特卫普","Ixelles":"伊克塞勒","Brugge":"布鲁日","Gent":"根特","Luxembourg":"卢森堡",
 "Zurich":"苏黎世","Geneva":"日内瓦","Basel":"巴塞尔","Bern":"伯尔尼","Lausanne":"洛桑","Lucerne":"卢塞恩","Saint Moritz":"圣莫里茨","Zermatt":"采尔马特","Vienna":"维也纳","Salzburg":"萨尔茨堡","Innsbruck":"因斯布鲁克","Graz":"格拉茨",
 "Lisbon":"里斯本","Porto":"波尔图","Warsaw":"华沙","Kraków":"克拉科夫","Wrocław":"弗罗茨瓦夫","Gdańsk":"格但斯克","Poznań":"波兹南","Copenhagen":"哥本哈根","Aarhus":"奥胡斯","Stockholm":"斯德哥尔摩","Gothenburg":"哥德堡","Oslo":"奥斯陆","Bergen":"卑尔根","Helsinki":"赫尔辛基","Reykjavík":"雷克雅未克",
 "Prague":"布拉格","Budapest":"布达佩斯","Ljubljana":"卢布尔雅那","Zagreb":"萨格勒布","Dubrovnik":"杜布罗夫尼克","Split":"斯普利特","Athens":"雅典","Tallinn":"塔林","Riga":"里加","Vilnius":"维尔纽斯","Belgrade":"贝尔格莱德","Valletta":"瓦莱塔","Monaco":"摩纳哥","Vaduz":"瓦杜兹",
 "New York":"纽约","Brooklyn":"布鲁克林（纽约）","Queens":"皇后区（纽约）","Washington":"华盛顿","San Francisco":"旧金山","Los Angeles":"洛杉矶","Chicago":"芝加哥","Miami":"迈阿密","Orlando":"奥兰多","Atlanta":"亚特兰大","Austin":"奥斯汀","Houston":"休斯敦","Dallas":"达拉斯","San Antonio":"圣安东尼奥","Denver":"丹佛","Philadelphia":"费城","New Orleans":"新奥尔良","Boston":"波士顿","Las Vegas":"拉斯维加斯","San Diego":"圣迭戈","Oakland":"奥克兰（加州）","Nashville":"纳什维尔","Tampa":"坦帕","Seattle":"西雅图","Napa":"纳帕","Yountville":"扬特维尔","Healdsburg":"希尔兹堡","Santa Monica":"圣莫尼卡","West Hollywood":"西好莱坞",
 "Toronto":"多伦多","Vancouver":"温哥华","Montréal":"蒙特利尔","Québec":"魁北克城","Cuauhtémoc":"墨西哥城·夸乌特莫克区","Miguel Hidalgo":"墨西哥城·米格尔伊达尔戈区","Oaxaca":"瓦哈卡","Tulum":"图卢姆","Mérida":"梅里达",
 "São Paulo":"圣保罗","Rio de Janeiro":"里约热内卢","Buenos Aires":"布宜诺斯艾利斯","Mendoza":"门多萨","Auckland":"奥克兰（新西兰）","Wellington":"惠灵顿","Christchurch":"基督城","Queenstown":"皇后镇",
}
CUISINE = {
 "Modern Cuisine":"现代菜","Contemporary":"时尚菜","Creative":"创意菜","Traditional Cuisine":"传统菜","Japanese":"日本菜","Italian":"意大利菜","Fish and Seafood":"鱼鲜海鲜","French":"法国菜","Mediterranean Cuisine":"地中海菜","Regional Cuisine":"地方菜","Farm to table":"农场到餐桌","Classic Cuisine":"经典菜","Modern British":"现代英国菜","Mexican":"墨西哥菜","Country cooking":"乡村菜","Street Food":"街头小吃","Modern French":"现代法国菜","Thai":"泰国菜","Cantonese":"粤菜","International":"国际菜","Noodles":"面食","Chinese":"中国菜","Italian Contemporary":"时尚意大利菜","Seasonal Cuisine":"时令菜","American":"美国菜","French Contemporary":"时尚法国菜","Indian":"印度菜","Sushi":"寿司","Fusion":"融合菜","Small eats":"小吃","Meats and Grills":"烤肉","Classic French":"经典法国菜","Innovative":"创新菜","Vietnamese":"越南菜","Asian":"亚洲菜","Taiwanese":"台湾菜","Vegetarian":"素食","Steakhouse":"扒房","Korean":"韩国菜","Spanish":"西班牙菜","Piedmontese":"皮埃蒙特菜","European Contemporary":"时尚欧陆菜","Barbecue":"烧烤","Seafood":"海鲜","Sichuan":"川菜","Traditional British":"传统英国菜","Japanese Contemporary":"时尚日本菜","Turkish":"土耳其菜","Tuscan":"托斯卡纳菜","Middle Eastern":"中东菜","Grills":"烧烤","Californian":"加州菜","Fujian":"闽菜","Creative French":"创意法国菜","Emilian":"艾米利亚菜","Austrian":"奥地利菜","Pizza":"披萨","Zhejiang":"浙江菜","Tempura":"天妇罗","European":"欧陆菜","Ramen":"拉面","Sicilian":"西西里菜","Filipino":"菲律宾菜","Vegan":"纯素","Yakitori":"烧鸟","Greek":"希腊菜","Southern Thai":"泰南菜","Peruvian":"秘鲁菜","Huaiyang":"淮扬菜","Soba":"荞麦面","New Zealand":"新西兰菜","Thai contemporary":"时尚泰国菜","Izakaya":"居酒屋","Malaysian":"马来西亚菜","Dim Sum":"点心","Shanghainese":"上海菜","Chao Zhou":"潮州菜","Campanian":"坎帕尼亚菜","Lebanese":"黎巴嫩菜","Provençal":"普罗旺斯菜","Venetian":"威尼斯菜","Portuguese":"葡萄牙菜","Italian-American":"意式美国菜","British Contemporary":"时尚英国菜","Asian Contemporary":"时尚亚洲菜","Jiangsu Cuisine":"江苏菜","Latin American":"拉丁美洲菜","Taizhou":"台州菜","Jiangzhe":"江浙菜","Alpine":"阿尔卑斯菜","Kaiseki":"怀石料理","Korean Contemporary":"时尚韩国菜","Hunanese":"湘菜","Beijing Cuisine":"京菜","Shandong":"鲁菜","Hang Zhou":"杭州菜","Teppanyaki":"铁板烧","Tonkatsu":"炸猪排","Unagi / Freshwater eel":"鳗鱼","Hot Pot":"火锅","Hotpot":"火锅","Dumplings":"饺子","Peranakan":"娘惹菜","Singaporean":"新加坡菜","Hong Kong Style":"港式","Basque":"巴斯克菜","Catalan":"加泰罗尼亚菜","Bistro":"小酒馆","Classic":"经典菜","Market Cuisine":"市场菜","Scandinavian":"北欧菜","Nordic":"北欧菜","German":"德国菜","Swiss":"瑞士菜","Belgian":"比利时菜","Dutch":"荷兰菜","Irish":"爱尔兰菜","Polish":"波兰菜","Brazilian":"巴西菜","Argentinian":"阿根廷菜","Southern":"美国南方菜","Cajun":"卡津菜","Creole":"克里奥尔菜",
}
CUISINE.update({'Lombardian': '伦巴第菜', 'Ligurian': '利古里亚菜', 'World Cuisine': '世界料理', 'Isan': '伊善菜', 'Chinese Contemporary': '中式创意菜', 'Apulian': '普利亚菜', 'Asian Influences': '亚洲风味', 'Northern Thai': '泰北菜', 'Unagi / Freshwater Eel': '鳗鱼', 'Cuisine from Abruzzo': '阿布鲁佐菜', 'Vietnamese Contemporary': '越南创意菜', 'Organic': '有机菜', 'Hakkanese': '客家菜', 'Thai-Chinese': '泰式中菜', 'Deli': '熟食店', 'Roman': '罗马菜', 'Taiwanese contemporary': '台湾创意菜', 'Spanish Contemporary': '西班牙创意菜', 'Umbrian': '翁布里亚菜', 'South East Asian': '东南亚菜', 'Sharing': '分享菜', 'African': '非洲菜', 'Galician': '加利西亚菜', 'Sardinian': '撒丁岛菜', 'Indonesian': '印度尼西亚菜', 'Saudi Cuisine': '沙特菜', 'Israeli': '以色列菜', 'Ningbo': '宁波菜', 'Naengmyeon': '冷面', 'Alsatian': '阿尔萨斯菜', 'Croatian': '克罗地亚菜', 'Czech': '捷克菜', 'Lyonnaise': '里昂菜', 'Cuisine from Lazio': '拉齐奥菜', 'Ethiopian': '埃塞俄比亚菜', 'Noodles and Congee': '粥面', 'Rice Dishes': '饭类', 'Moroccan': '摩洛哥菜', 'Home Cooking': '家常菜', 'Regional European': '欧洲地方菜', 'Cuisine from the Marches': '马尔凯菜', 'Meats and Seafood': '肉类与海鲜', 'Cuisine from the Aosta Valley': '奥斯塔谷菜', 'Persian': '波斯菜', 'South American': '南美菜', 'Gastropub': '美食酒馆', 'Cuisine from Romagna': '罗马涅菜', 'Dwaeji-gukbap': '猪肉汤饭', 'Yunnanese': '云南菜', 'Hungarian': '匈牙利菜', 'American Contemporary': '美式创意菜', 'Sri Lankan': '斯里兰卡菜', 'Udon': '乌冬面', 'Breton': '布列塔尼菜', 'Caribbean': '加勒比菜', 'Calabrian': '卡拉布里亚菜', 'Gomtang': '牛骨汤', 'Yoshoku': '日式洋食', 'Kushiage': '串炸', 'Tex-Mex': '得州墨西哥菜', 'Colombian': '哥伦比亚菜', 'Cuban': '古巴菜', 'Beef': '牛肉料理', 'Balkan': '巴尔干菜', 'Corsican': '科西嘉菜', 'Cuisine from Basilicata': '巴西利卡塔菜', 'Creative British': '英式创意菜', 'Hui Cuisine': '徽菜', 'Asian and Western': '中西合璧', 'Shun Tak': '顺德菜', 'Congee': '粥品', 'Emirati Cuisine': '阿联酋菜', 'Cuisine from Valtellina': '瓦尔泰利纳菜', 'Swedish': '瑞典菜', 'Mandu': '韩式饺子', 'Mantuan': '曼托瓦菜', 'Kalguksu': '刀切面', 'Central Asian': '中亚菜', 'Burmese': '缅甸菜', 'Memil-guksu': '荞麦面（韩式）', 'Danish': '丹麦菜', 'Smørrebrød': '丹麦开放三明治', 'Eastern European': '东欧菜', 'Bavarian': '巴伐利亚菜', 'Teochew': '潮州菜', 'Cantonese Roast Meats': '粤式烧味', 'Indian Vegetarian': '印度素菜', 'Pork': '猪肉料理', 'Friulian': '弗留利菜', 'Chiu Chow': '潮州菜', 'Oden': '关东煮', 'Japanese Tempura': '天妇罗', 'Shojin': '精进料理', 'Australian Contemporary': '澳式创意菜', 'Dongbei': '东北菜', 'Fugu / Pufferfish': '河豚', 'Norwegian': '挪威菜', 'Gejang': '酱蟹', 'Andalusian': '安达卢西亚菜', 'Italian and Japanese': '意日融合', 'Seolleongtang': '雪浓汤', 'Bakery': '烘焙', 'Savoyard': '萨瓦菜', 'Jamaican': '牙买加菜', 'Milanese': '米兰菜', 'Sukiyaki': '寿喜烧', 'Armenian': '亚美尼亚菜', 'Lao': '老挝菜', 'Samoan Cuisine': '萨摩亚菜', 'Samgyetang': '参鸡汤', 'Venezuelan': '委内瑞拉菜', 'Crêpe': '可丽饼', 'Nepali': '尼泊尔菜', 'Hubei': '湖北菜', 'Afghan': '阿富汗菜', 'South Tyrolean': '南蒂罗尔菜', 'Macanese': '澳门土生葡人菜', 'North African': '北非菜', 'Uzbek': '乌兹别克菜', 'Bulgogi': '韩式烤肉', 'Russian': '俄罗斯菜', 'Japanese Steakhouse': '日式牛排馆', 'Chicken Specialities': '鸡肉料理', 'South African': '南非菜', 'Finnish': '芬兰菜', 'Flemish': '佛兰德菜', 'Crab Specialities': '蟹料理', 'Xinjiang': '新疆菜', 'Bibimbap': '拌饭', 'Doganitang': '牛膝骨汤', 'South Indian': '南印度菜', 'Dubu': '豆腐料理', 'Pakistani': '巴基斯坦菜', 'Onigiri': '饭团', 'Tibetan': '藏菜', 'Xibei': '西北菜', 'Sujebi': '面片汤', 'Scottish': '苏格兰菜', 'Curry': '咖喱', 'Chueotang': '泥鳅汤', 'Cambodian': '柬埔寨菜', 'Polynesian': '波利尼西亚菜', 'Swabian': '施瓦本菜', 'Castilian': '卡斯蒂利亚菜', 'Duck Specialities': '鸭肉料理', 'Cheese, Fondue and Raclette': '奶酪火锅与烤奶酪', 'Asturian': '阿斯图里亚斯菜', 'Burgundian': '勃艮第菜', 'Cuisine from South West France': '法国西南菜', 'English': '英国菜', 'Egyptian': '埃及菜', 'Chilean': '智利菜', 'Obanzai': '京都家常菜', 'Shabu-shabu': '涮涮锅', 'Hainanese': '海南菜'})
LV = {"3 Stars":0,"2 Stars":1,"1 Star":2,"Bib Gourmand":3,"Selected Restaurants":4}
PRICE = {"$":1,"$$":2,"$$$":3,"$$$$":4,"€":1,"€€":2,"€€€":3,"€€€€":4,"¥¥":2,"¥¥¥":3,"฿฿":2}
CNCITY = {"Beijing":"北京","Shanghai":"上海","Nanjing":"南京","Yangzhou":"扬州","Changzhou":"常州","Wenzhou":"温州","Taizhou":"台州","Fuzhou":"福州","Xiamen":"厦门","Quanzhou":"泉州","Ningde":"宁德","Hangzhou":"杭州","Suzhou":"苏州"}

countries=[]; cidx={}
cities=[]; tidx={}
cuis=[]; cuidx={}
def country(en):
    if en not in cidx:
        cidx[en]=len(countries); countries.append([COUNTRY[en][0],en,COUNTRY[en][1]])
    return cidx[en]
def city(name,en_country):
    k=(name,en_country)
    if k not in tidx:
        tidx[k]=len(cities); cities.append([name,country(en_country)])
    return tidx[k]
def cuisine(c):
    if not c: return -1
    k=CUISINE.get(c,c)  # several English labels can share one Chinese name
    if k not in cuidx:
        cuidx[k]=len(cuis); cuis.append(k)
    return cuidx[k]


import re
ZH=json.load(open(sys.argv[4],encoding="utf8"))
pairs=[l.split("\t") for l in open(sys.argv[5],encoding="utf8").read().splitlines()]
need=[p[0] for p in pairs]; trl=[p[1] if len(p)>1 else "" for p in pairs]
TR={n:t for n,t in zip(need,trl) if re.search(r"[\u4e00-\u9fff]",t)}
norm=lambda t: re.sub(r"[\s·‧．・()（）]","",t)
NEW=set()
for c,g,l,sx in json.load(open(CUR,encoding="utf8")):
    for n in sx.split("|"):
        if n.endswith("*"): NEW.add(norm(n[:-1]))
MAN={"Bei Men Niu Xie Geng":"北门牛血羹","Guoping Seafood":"国平海鲜","He Wei Xiao Chao":"何炜小炒","Hui Pu Pai Dang":"回浦排档","Lao Huang Chao Ma Ci":"老黄炒麻糍","Rong Cun (Gucheng Street)":"荣村 (古城街道)","Rong Jia Xiao Chi (Ziyang Street)":"荣家小吃 (紫阳街)","Shen Ji Mai Xia Mian Pi Dian":"沈记麦虾面皮店","Tang A Yi Bian Shi":"汤阿姨扁食","Wang Lu (Pudong)":"望庐 (浦东)","Du Ji Mai Bing":"杜记麦饼","Chanyue Vegetarian":"禅悦素食","Xin Rong Ji (Linhai)":"新荣记 (临海)"}
HIST=json.load(open(sys.argv[6])) if len(sys.argv)>6 else {}
BP=json.load(open(sys.argv[7])) if len(sys.argv)>7 else {}
UPDATED=sys.argv[8] if len(sys.argv)>8 else ""
def coord(v):
    try: return round(float(v),5)
    except ValueError: return None
from local_address import load as load_local
LOCAL=load_local()
rows=[]; unknown=collections.Counter(); stats=collections.Counter()
for x in csv.DictReader(open(SRC,encoding="utf8")):
    loc=[p.strip() for p in x["Location"].split(",")]
    if loc[-1] in ("Dubai","Abu Dhabi"): cname, ctry = loc[-1], "UAE"
    elif loc==["Singapore"]: cname, ctry = "Singapore","Singapore"
    elif loc==["Luxembourg"]: cname, ctry = "Luxembourg","Luxembourg"
    elif loc[-1]=="USA":
        cname = loc[0] + (f" ({loc[1]})" if len(loc)==3 and loc[0] not in CITY else ""); ctry="USA"
    else: cname, ctry = loc[0], loc[-1]
    if ctry not in COUNTRY: unknown[ctry]+=1; continue
    cname = CITY.get(cname, cname)
    url = x["Url"].replace("https://guide.michelin.com/en/","")
    slug = url.rsplit("/restaurant/",1)[-1]
    name=x["Name"]; zh=""; kind=0
    if slug in ZH and ZH[slug]!=name: zh=ZH[slug]; kind=1
    elif name in MAN: zh=MAN[name]; kind=1
    elif name in TR and x["Award"] in ("1 Star","2 Stars","3 Stars"): zh=TR[name]; kind=2
    new = 1 if ctry=="Chinese Mainland" and zh and norm(zh) in NEW else 0
    stats[kind]+=1
    web=x["WebsiteUrl"].strip()
    rows.append([name, zh, kind+(4 if new else 0), city(cname,ctry), LV[x["Award"]], cuisine(x["Cuisine"]), PRICE.get(x["Price"],0), url, web, x["Address"],
                 coord(x["Latitude"]), coord(x["Longitude"]), 1 if x.get("GreenStar","0").strip()=="1" else 0,
                 HIST.get(unquote(url).lower(),""), BP.get(url,0)] + ([LOCAL[url]] if LOCAL.get(url) else []))
json.dump({"updated":UPDATED,"countries":countries,"cities":cities,"cuisines":cuis,"r":rows},open(OUT,"w",encoding="utf8"),ensure_ascii=False,separators=(",",":"))
print("rows",len(rows),"unknown",unknown,"kinds",stats)
print(collections.Counter(r[4] for r in rows))
mc=collections.Counter(r[4] for r in rows if countries[cities[r[3]][1]][1]=="Chinese Mainland"); print("mainland",mc, "new",sum(1 for r in rows if r[2]&4))
print("mainland w/o zh",[r[0] for r in rows if countries[cities[r[3]][1]][1]=="Chinese Mainland" and not r[1]][:40])

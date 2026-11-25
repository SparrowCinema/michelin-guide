/* Original bilingual restaurant summaries, written strictly from this site's own verifiable facts
   (location/neighborhood/venue, cuisine character, city standing, multi-year rating arc, Green Star,
   Black Pearl, price tier, verified menu prices, booking platform, guide edition).
   No MICHELIN editorial text is copied; official reviews are linked instead. */
const MGIntro=(()=>{
  'use strict';
  const ZH_LV=['米其林三星','米其林二星','米其林一星','必比登推介','米其林指南入选餐厅'];
  const EN_LV=['three MICHELIN Stars','two MICHELIN Stars','one MICHELIN Star','a Bib Gourmand','a place in the MICHELIN Guide'];
  const ZH_SHORT=['三星','二星','一星','必比登','入选'],EN_SHORT=['3 Stars','2 Stars','1 Star','Bib Gourmand','Selected'];
  const EN_ADJ=['three-Star','two-Star','one-Star','Bib Gourmand','Selected'];
  const ZH_NUM=['零','一','两','三','四','五','六','七','八'];
  const EN_NUM=['zero','one','two','three','four','five','six','seven','eight'];
  const LOCALE={'Chinese Mainland':'sg/zh_CN','Hong Kong SAR':'hk/zh_HK','Macau SAR':'mo/zh_HK','Taiwan Region':'tw/zh_TW','Japan':'jp/ja'};
  const LOCALE_NAME={'Chinese Mainland':'中文版','Hong Kong SAR':'繁体中文版','Macau SAR':'繁体中文版','Taiwan Region':'繁体中文版','Japan':'日文版'};
  const GENERIC=new Set('bakery beef cheese chicken classic contemporary cooking country crab creative curry deli dishes duck dumplings eel farm fish fondue food freshwater fusion gastropub grills home hotpot influences innovative international meats modern noodles organic pizza pork regional rice roast seafood seasonal sharing small specialities steakhouse street traditional vegan vegetarian world congee sushi ramen tempura yakitori izakaya teppanyaki tonkatsu udon soba unagi oden kushiage sukiyaki shabu-shabu onigiri obanzai yoshoku shojin fugu pufferfish raclette crêpe bibimbap bulgogi mandu dim sum'.split(' '));
  const enCuisine=c=>c.replace(/ Cuisine$/,'').split(' ').map(w=>GENERIC.has(w.toLowerCase())?w.toLowerCase():w).join(' ');

  function hashOf(s){
    let h=2166136261;
    for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619)>>>0;
    return h;
  }
  const pick=(arr,seed)=>arr[seed%arr.length];

  // ---- cuisine-specific factual culinary character (never invents restaurant-specific dishes) ----
  const CUISINE_NOTES={
    '现代菜':['以当代烹饪视角重新梳理时令食材与风味结构。','Approaches seasonal ingredients through a modern culinary lens and structured flavor pairings.'],
    '时尚菜':['注重当代摆盘与轻盈风味表达，菜单常随时令更迭。','Leans into contemporary presentation and lighter flavor profiles that evolve with the seasons.'],
    '创意菜':['跳出单一传统菜系框架，围绕主厨视角组合当季风土与原创技法。','Moves beyond traditional culinary lines, pairing seasonal produce with original chef-driven techniques.'],
    '创新菜':['以实验性技法与非传统食材组合探索新的味觉层次。','Explores new flavor dimensions through inventive techniques and unexpected ingredient pairings.'],
    '传统菜':['扎根本土传统食谱与经典火候，注重时间沉淀下来的家常与经典风味。','Rooted in time-honored recipes and classic cooking methods that highlight traditional flavors.'],
    '经典菜':['坚守经典菜式结构与扎实酱汁火候，呈现规整克制的传统风貌。','Upholds classic culinary structure, disciplined technique and traditional sauces.'],
    '地方菜':['聚焦所在地区的地方物产与传统做法，呈现出鲜明的地域饮食性格。','Showcases regional ingredients and local culinary traditions with a strong sense of place.'],
    '乡村菜':['主打质朴丰盛的乡土料理，保留食材本真滋味与温暖家常感。','Centers on hearty, rustic country cooking grounded in honest local produce.'],
    '时令菜':['顺应四时物候调整菜单，以当季最鲜活的农产与海货为核心。','Builds its menu closely around the calendar, letting peak-season harvests guide each dish.'],
    '农场到餐桌':['强调从产地直达餐桌的当季食材，菜单随农时与周边物产自然流转。','Prioritizes farm-direct sourcing and local harvests, shifting menus naturally with the seasons.'],
    '市场菜':['以每日市集采买的新鲜食材为起点，呈现灵动即兴的时令风味。','Takes its cue from daily market finds for spontaneous, produce-driven seasonal cooking.'],
    '街头小吃':['保留轻松接地气的街头风味气质，主打日常易亲近的地道吃食。','Keeps the approachable spirit of street dining with authentic, everyday local specialties.'],
    '小吃':['以轻巧多样的特色小食见长，适合随性点选、一次尝遍地方风味。','Centers on varied small plates and local snacks suited to casual, mix-and-match tasting.'],
    '粤菜':['以粤式火候、老火靓汤与鲜活海产为脉络，讲究清鲜爽滑与本味呈现。','Centers on Cantonese wok craft, refined broths and live seafood with an emphasis on natural freshness.'],
    '潮州菜':['聚焦潮汕海鲜、卤水与清鲜本味，注重食材原鲜与手工细作。','Highlights Chaoshan seafood, master-stock braises and delicate, ingredient-led flavors.'],
    '台州菜':['以浙东山海时鲜与家烧风味见长，突出东海小海鲜的鲜活本味。','Rooted in Taizhou’s coastal and mountain bounty, showcasing East China Sea seafood and home-style braises.'],
    '淮扬菜':['承袭淮扬菜刀工精细、清鲜平和的传统，讲求炖焖火候与时令江鲜。','Draws on Huaiyang’s meticulous knife work, gentle braises and seasonal river produce.'],
    '川菜':['以川味复合辛香与多样味型见长，在传统技法中呈现鲜明层次。','Anchored in Sichuan’s layered aromatics, spice balances and classic regional techniques.'],
    '湘菜':['主打湖湘风味与鲜辣醇香的火候呈现，注重当季土产与现炒锅气。','Showcases Hunan’s bold aromatics, regional produce and lively wok cooking.'],
    '闽菜':['融合山珍海味与清醇汤底，体现福建饮食注重鲜香与煨炖的传统。','Combines mountain and coastal ingredients with Fujian’s tradition of clear, aromatic broths and braises.'],
    '浙江菜':['以江南时令河鲜、山珍与清爽调味见长，口味清雅细腻。','Reflects Zhejiang’s delicate seasonal cooking built around freshwater catch, bamboo shoots and clean flavors.'],
    '江浙菜':['融汇江南水乡的清鲜风味，讲求时令食材、柔润火候与精致摆盘。','Brings together Jiangnan’s seasonal freshwater and garden produce with gentle, refined seasoning.'],
    '上海菜':['融合本帮浓油赤酱的醇厚与现代海派的细腻，体现沪上餐桌传统。','Blends Shanghai’s rich, glossy braises with refined modern Shanghainese sensibilities.'],
    '杭州菜':['注重西湖与江南时令风物，风格清淡雅致、突出食材原香。','Focuses on Hangzhou’s seasonal lakeside and regional produce in a light, understated style.'],
    '京菜':['延续北方官府与京味传统，兼顾烤炙火候、汤羹底蕴与时令菜式。','Carries forward Beijing’s culinary heritage of roasting, rich stocks and northern seasonal dishes.'],
    '宁波菜':['主打东海咸鲜海味与软糯火候，突出宁式料理鲜醇入味的特点。','Highlights Ningbo’s savory coastal seafood and tender, deeply flavored braises.'],
    '顺德菜':['承袭顺德“粗料精做”的传统，在鱼生、炒制与蒸煮火候上见功力。','Follows Shunde’s refined Cantonese craft, prized for precise steaming, stir-frying and freshwater fish.'],
    '点心':['以手工现制中式点心与茶点见长，讲究皮馅口感与蒸炸火候。','Specializes in handcrafted dim sum where delicate wrappers, fresh fillings and precise steaming shine.'],
    '台湾菜':['融合闽南古早味与宝岛丰饶海陆物产，呈现亲切细致的地方风味。','Pairs Taiwanese heritage recipes with the island’s abundant coastal and mountain ingredients.'],
    '日本菜':['讲究高汤本味、当季物产与细腻刀工，体现日式料理对季节感的重视。','Emphasizes dashi clarity, seasonal produce and precise knife work in the Japanese culinary tradition.'],
    '时尚日本菜':['在日式高汤与时令美学之上融入当代手法，呈现更自由的现代和风。','Builds on Japanese seasonality and dashi foundations with contemporary flair.'],
    '怀石料理':['循四季流转编排多道式料理，注重高汤清鲜、器皿搭配与席间节奏。','Follows the seasonal progression of multi-course kaiseki, uniting dashi craft, tableware and pacing.'],
    '寿司':['以时令鱼鲜与握寿司技艺为核心，讲究舍利温度、醋香与鱼生熟成的平衡。','Centers on seasonal fish and nigiri craft, balancing rice warmth, vinegar seasoning and aging.'],
    '天妇罗':['聚焦现炸天妇罗的轻盈面衣与精准油温，突出当季海产与时蔬的原味。','Dedicated to crisp, feather-light tempura that lets peak-season seafood and vegetables shine.'],
    '烧鸟':['围绕炭火直烤鸡肉各部位的火候掌控，讲究盐烤与酱烤的细致层次。','Focuses on charcoal-grilled skewers of carefully butchered poultry, seasoned with salt or tare.'],
    '拉面':['围绕汤底熬制、面条筋道与配料平衡，呈现专注而凝练的一碗风味。','Centers on deeply developed broths, springy noodles and balanced toppings crafted to order.'],
    '荞麦面':['讲究荞麦粉风味、手打质感与清爽蘸汁，体现日式面食的简约本味。','Celebrates freshly milled buckwheat noodles paired with clean, aromatic dipping broths.'],
    '乌冬面':['突出手打乌冬的弹滑口感与温和昆布柴鱼汤底，日常而耐吃。','Highlights chewy, satisfying udon noodles served in gentle dashi-based broths.'],
    '鳗鱼':['专注于鳗鱼的剖制、蒸烤与秘制酱汁火候，呈现外微酥、内细嫩的质感。','Specializes in charcoal-grilled unagi glazed with seasoned tare for a crisp-yet-tender finish.'],
    '铁板烧':['以席前铁板现烹呈现食材本味，让火候掌控与现场互动成为餐桌主角。','Stages live griddle cooking right at the counter, making heat control and immediacy central to the meal.'],
    '居酒屋':['主打轻松热络的佐酒小菜与时令炭烤，适合边饮边尝多道料理。','Pairs a convivial atmosphere with seasonal small plates and grilled dishes made for sharing over drinks.'],
    '法国菜':['以法式酱汁、扎实火候与风土食材为核心，呈现经典与细腻并存的餐桌风格。','Grounded in French sauce craft, disciplined technique and terroir-driven produce.'],
    '时尚法国菜':['以法餐经典功底为基底，结合更轻盈的酱汁与当代审美表达。','Built on classical French foundations yet expressed through lighter sauces and modern sensibilities.'],
    '现代法国菜':['将传统法式技法与当代轻盈节奏结合，注重风味对比与时令鲜度。','Combines French culinary rigor with lighter contemporary plating and crisp flavor contrasts.'],
    '经典法国菜':['忠实呈现传统法餐的丰腴酱汁、经典配搭与端庄仪式感。','Honors the richness, classical sauces and timeless elegance of traditional French gastronomy.'],
    '创意法国菜':['以法式技艺为起点，融入主厨更具个性与想象力的风味编排。','Uses French technique as a springboard for inventive, strongly personal tasting menus.'],
    '小酒馆':['带有轻松自在的法式小酒馆氛围，菜单直率实在、注重当季好味。','Captures the relaxed warmth of a neighborhood bistro with straightforward, seasonal cooking.'],
    '意大利菜':['围绕优质橄榄油、手工意面与当季农产，突出意式料理明快自然的本味。','Built around quality olive oil, fresh pasta and peak produce that celebrate Italy’s natural flavors.'],
    '时尚意大利菜':['在意大利地域风味的基础上引入当代手法，带来更轻盈精致的呈现。','Reinterprets Italian regional cooking with modern technique and sleeker presentation.'],
    '皮埃蒙特菜':['扎根意大利西北部的山谷风土，善用菌菇、手工面食与慢炖肉类。','Rooted in northwestern Italy’s alpine foothills, famed for handmade pasta, slow braises and local truffles.'],
    '托斯卡纳菜':['体现托斯卡纳质朴明朗的农庄饮食风格，讲究优质肉类、豆蔬与橄榄油。','Reflects Tuscany’s rustic, sun-drenched larder of olive oil, seasonal produce and hearty meats.'],
    '西西里菜':['融合地中海海产、柑橘香草与岛屿多元文化，风味明艳浓郁。','Blends Mediterranean seafood, bright citrus and Sicily’s layered island heritage.'],
    '艾米利亚菜':['传承意大利“美食谷”的手工意面、陈酿芝士与腌肉风味传统。','Draws on Emilia-Romagna’s rich heritage of handmade pasta, aged cheeses and cured meats.'],
    '西班牙菜':['结合伊比利亚丰饶海陆物产与奔放调味，兼顾传统炖烤与当代创意。','Celebrates Iberia’s coastal and inland larder, from traditional roasts to bold modern plates.'],
    '巴斯克菜':['扎根巴斯克山海风土，以炭火直烤海鲜、顶级肉类与鲜明原味著称。','Anchored in Basque culinary culture, renowned for live-fire grilling and superb sea-and-mountain produce.'],
    '加泰罗尼亚菜':['融合地中海渔获与比利牛斯山产，常以“海陆同烹”展现地区特色。','Marries Mediterranean seafood with mountain produce in Catalonia’s signature mar i muntanya tradition.'],
    '现代英国菜':['以不列颠当季农产、野味与海鲜为主角，用当代轻盈手法刷新英式风味。','Puts seasonal British produce, game and coastal seafood at the center of bright modern cooking.'],
    '传统英国菜':['延续英伦传统炖烤、派点与应季食材风貌，气质沉稳亲切。','Stays faithful to comforting British classics, roasts and seasonal island ingredients.'],
    '北欧菜':['强调清冽纯净的地域风土，善用发酵、腌渍与野生浆果草本延续季节风味。','Highlights pure Nordic terroir through foraging, fermentation, curing and pristine seafood.'],
    '地中海菜':['以橄榄油、香草、时蔬与新鲜海产为基调，整体风味明快清爽。','Centered on olive oil, herbs, sun-ripened vegetables and fresh seafood for bright, balanced flavors.'],
    '鱼鲜海鲜':['以每日渔获与海味鲜度为核心，强调精准熟度以衬托海产本味。','Puts daily catches and pristine shellfish front and center, cooked with restraint to preserve natural sweetness.'],
    '海鲜':['聚焦时令海产与贝类风味，围绕鲜度与火候展开菜单。','Revolves around seasonal fish and shellfish prepared to highlight clean oceanic flavors.'],
    '素食':['以时令蔬果、菌菇与谷物为主角，通过丰富技法展现蔬食的层次与满足感。','Puts vegetables, mushrooms and grains at the center of layered, inventive meat-free cooking.'],
    '纯素':['全程采用植物性食材构建风味体系，以当季蔬果与发酵调味呈现轻盈层次。','Builds an entirely plant-based menu using seasonal produce, herbs and fermentations.'],
    '韩国菜':['融合发酵酱香、时令小菜与热汤烤物，展现韩式料理浓郁而平衡的味觉结构。','Brings together fermented pastes, seasonal banchan and deeply savory broths or grilled dishes.'],
    '泰国菜':['善用香茅、南姜、青柠与辣椒调和酸辣甜咸，风味明快立体。','Balances aromatic herbs, citrus, chili and savory depth in lively Thai flavor harmonies.'],
    '越南菜':['以清甜高汤、鲜嫩香草与爽脆配菜见长，整体口味轻盈清新。','Known for fragrant broths, abundant fresh herbs and bright, balanced seasoning.'],
    '印度菜':['通过现磨香料与慢炖烤制呈现丰富辛香层次，展现次大陆多元地域风味。','Layers freshly ground spices, tandoor heat and slow-simmered sauces across regional Indian traditions.'],
    '墨西哥菜':['围绕玉米风味、多样辣椒与当季农产展开，在烟火气与精致调味间取得平衡。','Built on heirloom corn, nuanced chilies and vibrant local produce with bold yet balanced seasoning.'],
    '秘鲁菜':['融合安第斯山产、太平洋海鲜与多元移民风味，酸辣鲜爽极具辨识度。','Fuses Pacific seafood, Andean ingredients and multicultural influences into bright, vibrant dishes.'],
    '娘惹菜':['融汇华南与马来香料传统，以慢火炒制的参巴与复合辛香酱汁见长。','Marries Chinese and Malay culinary traditions through fragrant, slow-cooked spice pastes and rich gravies.'],
    '土耳其菜':['兼具炭火烤肉、香料前菜与地中海橄榄油料理的丰盛气质。','Combines wood-fired grills, vibrant mezze and Anatolian olive-oil dishes.'],
    '中东菜':['善用芝麻酱、石榴、香料与炭火炙烤，呈现出温润浓郁的分享型餐桌风格。','Features smoky grills, fragrant spices, tahini and generous plates made for sharing.'],
    '希腊菜':['以爱琴海海鲜、橄榄油、奶酪与清爽香草为主轴，风味阳光明朗。','Celebrates Aegean seafood, olive oil, herbs and crisp, sun-drenched Greek flavors.'],
    '扒房':['专注优质牛肉熟成与明火炭烤火候，突出肉香与简洁配菜的纯粹搭配。','Dedicated to well-sourced, aged cuts seared over high heat with classic, unfussy accompaniments.'],
    '烧烤':['以炭火或明火炙烤为核心，突出烟熏香气与食材表层焦香。','Centers on live-fire cooking that brings smoky aroma and crisp caramelization to seasonal ingredients.'],
    '烤肉':['主打肉类直火炙烤与精准熟度掌控，风味饱满直接。','Focuses on prime meats grilled over open flames for bold, direct flavor.'],
    '面食':['以手制面条与特色汤头或拌酱为核心，日常耐吃、烟火气十足。','Built around satisfying noodles and signature broths or sauces for focused, everyday comfort.'],
    '披萨':['讲究面团长时间发酵、炉火烘烤与简洁优质配料，外脆内韧。','Focuses on slow-fermented dough, blistered crusts and high-quality toppings baked at high heat.'],
    '烘焙':['专注于面包与西点的发酵、层酥与出炉香气，呈现扎实的手工烘焙水准。','Dedicated to artisanal fermentation, flaky pastries and freshly baked breads.'],
    '美国菜':['融汇北美本土食材与多元文化脉络，风格自由丰盛。','Draws on regional American produce and diverse culinary influences in an expressive, generous style.'],
    '加州菜':['依托加州充沛阳光物产与太平洋渔获，风格清新明快、注重蔬果鲜度。','Celebrates California’s abundant produce and coastal catch with bright, fresh-driven cooking.'],
    '国际菜':['博采多地经典风味与烹饪元素，菜单跨度宽广、适配多样口味。','Draws freely across global culinary traditions for a versatile, wide-ranging menu.'],
    '融合菜':['将不同地域的食材与技法有机结合，在熟悉风味中制造新鲜对比。','Blends ingredients and techniques across culinary cultures to create fresh flavor contrasts.'],
    '亚洲菜':['融汇东亚与东南亚的鲜味基底与香料脉络，呈现出灵活多变的亚洲餐桌风格。','Brings together savory foundations and aromatics from across East and Southeast Asia.'],
    '欧陆菜':['兼收欧洲各地经典技艺与风土食材，整体风格端庄均衡。','Draws on classic European techniques and seasonal ingredients across the continent.'],
    '时尚欧陆菜':['以欧陆烹饪为基底并融入轻盈现代手法，兼具精致感与时令活力。','Updates classic European cooking with lighter textures, modern plating and seasonal focus.'],
    '奥地利菜':['承袭中欧阿尔卑斯与维也纳餐桌传统，兼顾丰腴主菜与经典甜点。','Carries forward Vienna and Alpine traditions of comforting mains and classic pastries.'],
    '德国菜':['结合德式传统风味与当代轻盈表达，注重当地时令农产与肉禽渔获。','Pairs regional German traditions and local harvests with crisp modern execution.'],
    '葡萄牙菜':['围绕大西洋海产、橄榄油与香料脉络，呈现质朴醇厚的伊比利亚大西洋风味。','Centers on Atlantic seafood, olive oil and soulful Portuguese coastal traditions.'],
    '比利时菜':['融合法式酱汁功底与佛兰德斯丰饶物产，口感醇厚细致。','Combines French sauce craft with Flanders’ rich coastal and agricultural larder.'],
    '菲律宾菜':['融合酸鲜醋香、慢炖风味与热带物产，展现群岛独具个性的家常与当代菜式。','Highlights the bright acidity, slow braises and tropical ingredients of Philippine cuisine.'],
    '中国菜':['围绕中式火候、汤底与复合调味展开，呈现多元中餐风貌。','Centers on Chinese wok craft, broths and balanced seasoning across classic traditions.'],
    '美食酒馆':['将轻松自在的酒馆氛围与考究的厨房功底结合，兼顾佐酒与正餐体验。','Pairs a relaxed pub-like atmosphere with serious, produce-driven kitchen craft.']
  };

  // ---- location, neighborhood & venue extraction from r.a / r.la ----
  const HK_AREAS=[
    [/中環|Central\b/i,'中环','Central'],[/尖沙咀|Tsim Sha Tsui/i,'尖沙咀','Tsim Sha Tsui'],
    [/銅鑼灣|Causeway Bay/i,'铜锣湾','Causeway Bay'],[/灣仔|Wan Chai/i,'湾仔','Wan Chai'],
    [/上環|Sheung Wan/i,'上环','Sheung Wan'],[/金鐘|Admiralty/i,'金钟','Admiralty'],
    [/西九龍|West Kowloon/i,'西九龙','West Kowloon'],[/旺角|Mong Kok/i,'旺角','Mong Kok'],
    [/跑馬地|Happy Valley/i,'跑马地','Happy Valley'],[/大坑|Tai Hang/i,'大坑','Tai Hang'],
    [/北角|North Point/i,'北角','North Point'],[/佐敦|Jordan/i,'佐敦','Jordan'],
    [/深水埗|Sham Shui Po/i,'深水埗','Sham Shui Po'],[/鰂魚涌|Quarry Bay/i,'鲗鱼涌','Quarry Bay'],
    [/淺水灣|Repulse Bay/i,'浅水湾','Repulse Bay'],[/九龍城|Kowloon City/i,'九龙城','Kowloon City']
  ];
  const JP_AREAS=[
    [/銀座|Ginza/i,'银座','Ginza'],[/六本木|Roppongi/i,'六本木','Roppongi'],
    [/西麻布|Nishi-?Azabu/i,'西麻布','Nishi-Azabu'],[/麻布十番|Azabu-?Juban/i,'麻布十番','Azabu-Juban'],
    [/南麻布|Minami-?Azabu/i,'南麻布','Minami-Azabu'],[/元麻布|Moto-?Azabu/i,'元麻布','Moto-Azabu'],
    [/南青山|Minami-?Aoyama/i,'南青山','Minami-Aoyama'],[/青山|Aoyama/i,'青山','Aoyama'],
    [/赤坂|Akasaka/i,'赤坂','Akasaka'],[/表参道|Omotesando/i,'表参道','Omotesando'],
    [/神宮前|Jingumae/i,'神宫前','Jingumae'],[/恵比寿|Ebisu/i,'惠比寿','Ebisu'],
    [/神楽坂|Kagurazaka/i,'神乐坂','Kagurazaka'],[/日本橋|Nihonbashi/i,'日本桥','Nihonbashi'],
    [/丸の内|Marunouchi/i,'丸之内','Marunouchi'],[/中目黒|Nakameguro/i,'中目黑','Nakameguro'],
    [/広尾|Hiroo/i,'广尾','Hiroo'],[/代官山|Daikanyama/i,'代官山','Daikanyama'],
    [/白金台|Shirokanedai/i,'白金台','Shirokanedai'],[/白金|Shirokane/i,'白金','Shirokane'],
    [/浅草|Asakusa/i,'浅草','Asakusa'],[/渋谷|Shibuya/i,'涩谷','Shibuya'],
    [/新宿|Shinjuku/i,'新宿','Shinjuku'],[/祇園|Gion/i,'祇园','Gion'],
    [/先斗町|Pontocho/i,'先斗町','Pontocho'],[/嵐山|Arashiyama/i,'岚山','Arashiyama'],
    [/北新地|Kitashinchi/i,'北新地','Kitashinchi'],[/心斎橋|Shinsaibashi/i,'心斋桥','Shinsaibashi'],
    [/難波|Namba/i,'难波','Namba']
  ];
  const LONDON_AREAS=[
    [/\bW1[A-Z0-9]?\b/,'梅费尔/苏豪一带（W1）','Mayfair / Soho (W1)'],
    [/\bSW1[A-Z0-9]?\b/,'贝尔格莱维亚/圣詹姆斯一带（SW1）','Belgravia / St James’s (SW1)'],
    [/\bSW3\b/,'切尔西（SW3）','Chelsea (SW3)'],[/\bSW7\b/,'南肯辛顿（SW7）','South Kensington (SW7)'],
    [/\bWC2[A-Z0-9]?\b/,'考文特花园一带（WC2）','Covent Garden (WC2)'],
    [/\bEC1[A-Z0-9]?\b/,'克勒肯维尔（EC1）','Clerkenwell (EC1)'],
    [/\bSE1\b/,'南岸/博罗一带（SE1）','South Bank / Borough (SE1)'],
    [/\bE[12]\b/,'肖尔迪奇/东伦敦（E1/E2）','Shoreditch / East London'],
    [/\bW11\b/,'诺丁山（W11）','Notting Hill (W11)'],[/\bNW1\b/,'摄政公园/卡姆登一带（NW1）','Regent’s Park / Camden (NW1)']
  ];
  const SG_AREAS=[
    [/Marina Bay/i,'滨海湾','Marina Bay'],[/Orchard/i,'乌节路','Orchard'],
    [/Dempsey/i,'登布西山','Dempsey Hill'],[/Sentosa/i,'圣淘沙','Sentosa'],
    [/Chinatown|Keong Saik|Duxton|Tanjong Pagar/i,'牛车水/丹戎巴葛一带','Chinatown / Tanjong Pagar'],
    [/Clarke Quay|Boat Quay/i,'克拉码头一带','Clarke Quay']
  ];
  const ordinal=n=>{const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);};

  function district(r){
    const m=(r.la||'').match(/^(?:〒\S+\s)?(?:\d{3,5}\s)?(.{1,4}?[市都府県縣])(.{1,6}?[区區县縣])/);
    return m?m[2]:'';
  }
  function areaInfo(r,ctx){
    const a=r.a||'',la=r.la||'',both=la+' '+a,ce=ctx.countryEn||'',cityE=ctx.cityEn||'';
    if(ce==='Hong Kong SAR'){for(const [re,zh,en] of HK_AREAS)if(re.test(both))return {zh,en};}
    if(ce==='Japan'){
      for(const [re,zh,en] of JP_AREAS)if(re.test(both))return {zh,en};
      const d=district(r);if(d)return {zh:d,en:''};
    }
    if(cityE==='Paris'){const m=a.match(/\b750(0[1-9]|1\d|20)\b/);if(m){const n=+m[1];return {zh:`第 ${n} 区`,en:`the ${ordinal(n)} arrondissement`};}}
    if(cityE==='Lyon'){const m=a.match(/\b6900([1-9])\b/);if(m){const n=+m[1];return {zh:`第 ${n} 区`,en:`the ${ordinal(n)} arrondissement`};}}
    if(cityE==='Marseille'){const m=a.match(/\b130(0[1-9]|1[0-6])\b/);if(m){const n=+m[1];return {zh:`第 ${n} 区`,en:`the ${ordinal(n)} arrondissement`};}}
    if(cityE==='London'){for(const [re,zh,en] of LONDON_AREAS)if(re.test(a))return {zh,en};}
    if(cityE==='Singapore'){for(const [re,zh,en] of SG_AREAS)if(re.test(a))return {zh,en};}
    const d=district(r);
    if(d)return {zh:d,en:''};
    return null;
  }
  function venueInfo(r){
    const a=r.a||'',la=r.la||'';
    const zhM=la.match(/([^\s,，、\d号號楼樓层層]{2,14}(?:大酒店|酒店|大飯店|飯店|宾馆|大廈|大厦|廣場|广场))/);
    const enParts=a.split(',').map(s=>s.trim()).filter(Boolean);
    const hotelRe=/\b(Hotel|Four Seasons|Ritz-?Carlton|The Ritz|Mandarin Oriental|Peninsula|Park Hyatt|Grand Hyatt|Waldorf Astoria|Fairmont|Shangri-?La|Rosewood|Bulgari|Aman|St\.?\s*Regis|InterContinental|Sofitel|Conrad|Capella|Raffles|Kempinski|Banyan Tree|Palace Hotel|Marina Bay Sands|Alexandra House|Landmark)\b/i;
    const enHit=enParts.find(p=>hotelRe.test(p)&&p.length<=60&&!/^\d+\s/.test(p));
    if(zhM||enHit){
      const zhName=zhM?zhM[1]:enHit;
      const enName=enHit||'';
      if(zhName&&zhName!==r.n&&zhName!==r.zh)return {zh:zhName,en:enName};
    }
    return null;
  }

  // Yearly record: 4 yearly snapshots + current edition.
  function record(r,year=2026){
    const list=[...(r.h||'').padEnd(4,'?').slice(0,4)].map((c,i)=>({y:year-4+i,l:/^[0-4]$/.test(c)?+c:null,known:c!=='?'})).concat([{y:year,l:r.l,known:true}]);
    let streak=0;for(let i=list.length-1;i>=0&&list[i].l===r.l;i--)streak++;
    const prev=list[list.length-2],known=list.filter(x=>x.known);
    const first=list.find(x=>x.l!==null);
    // Find earliest promotion into the current rating during the tracked window
    let promotedAt=null;
    if(streak>=2&&streak<list.length){
      const before=list[list.length-1-streak];
      if(before&&before.known&&before.l!==null&&before.l>r.l)promotedAt={y:list[list.length-streak].y,from:before.l};
    }
    return {list,streak,prev:prev.known?prev.l:undefined,firstYear:first?first.y:year,firstLevel:first?first.l:r.l,fullyKnown:known.length===list.length,promotedAt,curYear:year};
  }

  function zh(r,ctx){
    const name=r.zh||r.n,city=ctx.city,country=ctx.country,cu=r.cu||'',st=ctx.stats||null;
    const rec=record(r,st?.editionYear||2026),seed=hashOf(r.u||name),out=[];
    const where=['中国内地','中国香港','中国澳门','中国台湾'].includes(country)?city:(country===city?city:country+city);
    const area=areaInfo(r,ctx),d=area&&!where.includes(area.zh)?area.zh:'';
    const venue=venueInfo(r);

    // 1. Opening sentence (concise, grounded, preserves exact location + cuisine + current honor)
    out.push(`${name}${r.zh&&r.zh!==r.n?`（${r.n}）`:''}是位于${where}${d}的${cu}餐厅，${r.l===4?'入选米其林指南':'现获'+ZH_LV[r.l]}。`);

    // 2. Setting / venue + cuisine character (makes every restaurant concretely distinct)
    const cuNote=CUISINE_NOTES[cu]?.[0]||'';
    if(venue&&venue.zh&&!where.includes(venue.zh)){
      const vLine=pick([`餐厅坐落于${venue.zh}内。`,`店址设在${venue.zh}。`],seed);
      out.push(cuNote?vLine.slice(0,-1)+'，'+cuNote.replace(/^以/,'以'):vLine);
    }else if(cuNote){
      out.push(cuNote);
    }

    // 3. Real local standing & rarity from DB stats (when available)
    if(st){
      if(r.l<=2&&st.citySameLevel===1&&st.cityTotal>=2){
        out.push(`它也是${city}目前唯一一家${ZH_LV[r.l]}餐厅。`);
      }else if(r.l<=2&&st.citySameLevel>1&&st.citySameLevel<=15){
        out.push(pick([
          `目前${city}共收录 ${st.citySameLevel} 家${ZH_SHORT[r.l]}餐厅，它位列其中。`,
          `在${city}现有名录中，它属于仅有的 ${st.citySameLevel} 家${ZH_SHORT[r.l]}餐厅之一。`
        ],seed));
      }else if(st.cityTotal===1){
        out.push(`它也是${city}目前唯一入选米其林指南的餐厅。`);
      }else if(cu&&st.citySameCuisine===1&&st.cityTotal>=12){
        out.push(`在${city}收录的 ${st.cityTotal} 家米其林餐厅中，它是唯一一家${cu}代表。`);
      }else if(cu&&st.citySameCuisine>1&&st.citySameCuisine<=4&&st.cityTotal>=40){
        out.push(`在${city} ${st.cityTotal} 家入选餐厅里，同属${cu}的仅有 ${st.citySameCuisine} 家。`);
      }else if(st.nearbyCount>=10){
        out.push(`所处地段美食云集，步行约 500 米范围内还聚集了 ${st.nearbyCount} 家其他米其林入选餐厅。`);
      }
    }

    // 4. Full multi-year rating trajectory
    if(rec.fullyKnown||rec.streak>=2){
      if(rec.streak>=5&&r.l<=3){
        out.push(`${rec.list[0].y} 年以来连续${ZH_NUM[rec.streak]}年保持${ZH_SHORT[r.l]}。`);
      }else if(rec.promotedAt&&r.l<=2){
        out.push(`${rec.promotedAt.y} 年由${ZH_SHORT[rec.promotedAt.from]}晋升${ZH_SHORT[r.l]}后，已连续${ZH_NUM[rec.streak]}年稳定保持该评级。`);
      }else if(rec.streak>=2&&r.l<=3){
        out.push(`已连续${ZH_NUM[rec.streak]}年获评${ZH_SHORT[r.l]}。`);
      }else if(rec.prev!==undefined&&rec.prev!==null&&rec.prev>r.l){
        out.push(`今年由${ZH_SHORT[rec.prev]}升为${ZH_SHORT[r.l]}。`);
      }else if(rec.prev!==undefined&&rec.prev!==null&&rec.prev<r.l){
        out.push(`去年评级为${ZH_SHORT[rec.prev]}。`);
      }else if(rec.prev===null){
        if(rec.firstYear===rec.curYear&&r.l<=2)out.push(`今年首次进入指南名单便直接摘得${ZH_SHORT[r.l]}。`);
        else out.push(rec.firstYear===rec.curYear?'今年首次进入指南名单。':`${rec.firstYear} 年起进入指南名单。`);
      }else if(rec.streak>=5&&r.l===4){
        out.push(`自 ${rec.list[0].y} 年起持续稳定留在米其林指南推荐名单中。`);
      }
    }

    // 5. Additional honors (Green Star, Black Pearl)
    if(r.green){
      if(st&&st.cityGreen===1&&st.cityTotal>=5)out.push(`同时获颁米其林绿星，是${city}目前唯一因可持续餐饮实践获得绿星认可的餐厅。`);
      else out.push('它还同时获得米其林绿星，在可持续食材与环保实践方面受到认可。');
    }
    if(r.bp)out.push(`在本土黑珍珠餐厅指南中同时获评${'一二三'[r.bp-1]}钻，属于双料上榜餐厅。`);

    // 6. Contextual price + verified pricing + online booking cue
    if(st?.priceSummaryZh){
      out.push(st.priceSummaryZh);
    }else if(r.p){
      if(r.l<=2&&r.p<=2)out.push(pick([`在星级餐厅中属于价位较为克制的一档（${'$'.repeat(r.p)}）。`,`定价落在当地 ${'$'.repeat(r.p)} 档位，在星级餐厅里相对亲切。`],seed));
      else if(r.l===3&&r.p===1)out.push(pick(['在当地属于亲民价位（$），兼具性价比与出品水准。','以亲民档位（$）入选必比登推介，适合轻松一试。'],seed));
      else if(r.p===1)out.push(pick(['价位在当地属于亲民一档（$），日常到访门槛较低。','定价亲民（$），适合日常随性前往。'],seed));
      else if(r.p===2)out.push(pick(['价位在当地处于中等区间（$$）。','消费属于当地中档水平（$$）。'],seed));
      else if(r.p===3)out.push(pick(['价位在当地偏高（$$$），更适合正式聚餐或特别安排。','处于当地中高档价位（$$$），适合约饭或特别场合。'],seed));
      else if(r.p===4)out.push(pick(['价位属于当地高端一档（$$$$），多以主厨套餐或正式正餐体验为主。','处于当地最高价位档（$$$$），适合留出完整时间体验主厨菜单。'],seed));
    }
    if(st?.bookingPlatform)out.push(`官网接入 ${st.bookingPlatform}，支持在线查看席位并预约。`);
    return out.join('');
  }

  function enCuLine(note,seed){
    if(!note)return '';
    const lead=pick(['The kitchen ','Its cooking '],seed);
    if(/^(Rooted|Built|Anchored|Grounded|Centered|Dedicated|Focused|Known|Shaped)\b/.test(note))return 'The restaurant is '+note[0].toLowerCase()+note.slice(1);
    return lead+note[0].toLowerCase()+note.slice(1);
  }
  function en(r,ctx){
    const st=ctx.stats||null,rec=record(r,st?.editionYear||2026),seed=hashOf(r.u||r.n),out=[],cu=ctx.cuisineEn||'';
    const where=ctx.countryEn.startsWith(ctx.cityEn)?ctx.cityEn:`${ctx.cityEn}, ${ctx.countryEn}`;
    const area=areaInfo(r,ctx),venue=venueInfo(r);
    const c=cu?enCuisine(cu):'',an=/^[aeiou]/i.test(c)?'an':'a';
    const kind=!c?'a restaurant':/,| and /.test(c)?`a restaurant serving ${c}`:`${an} ${c} restaurant`;
    const areaPhrase=area&&area.en?` in ${area.en}, ${where}`:` in ${where}`;

    // 1. Opening
    out.push(`${r.n} is ${kind}${areaPhrase}, ${r.l===4?'listed in the MICHELIN Guide':'currently holding '+EN_LV[r.l]}.`);

    // 2. Venue + cuisine character
    const cuNote=enCuLine(CUISINE_NOTES[r.cu]?.[1]||'',seed);
    if(venue&&venue.en){
      out.push(`Set within ${venue.en}.${cuNote?' '+cuNote:''}`);
    }else if(cuNote){
      out.push(cuNote);
    }

    // 3. Real local standing
    if(st){
      if(r.l<=2&&st.citySameLevel===1&&st.cityTotal>=2){
        out.push(`It is currently the only ${EN_ADJ[r.l]} restaurant in ${ctx.cityEn}.`);
      }else if(r.l<=2&&st.citySameLevel>1&&st.citySameLevel<=15){
        out.push(pick([
          `It is one of just ${st.citySameLevel} ${EN_ADJ[r.l]} tables in ${ctx.cityEn}.`,
          `Among ${ctx.cityEn}’s current selection, it stands as one of ${st.citySameLevel} ${EN_ADJ[r.l]} restaurants.`
        ],seed));
      }else if(st.cityTotal===1){
        out.push(`It is currently the sole MICHELIN-listed table in ${ctx.cityEn}.`);
      }else if(c&&st.citySameCuisine===1&&st.cityTotal>=12){
        out.push(`Out of ${st.cityTotal} listed spots in ${ctx.cityEn}, it is the only one devoted to ${c}.`);
      }else if(c&&st.citySameCuisine>1&&st.citySameCuisine<=4&&st.cityTotal>=40){
        out.push(`It is one of only ${st.citySameCuisine} ${c} restaurants among ${st.cityTotal} listings in ${ctx.cityEn}.`);
      }else if(st.nearbyCount>=10){
        out.push(`It sits in a dense culinary pocket with ${st.nearbyCount} other MICHELIN-listed tables within a 500 m walk.`);
      }
    }

    // 4. Multi-year rating trajectory
    if(rec.fullyKnown||rec.streak>=2){
      if(rec.streak>=5&&r.l<=3){
        out.push(`It has kept this rating for ${EN_NUM[rec.streak]} consecutive years since ${rec.list[0].y}.`);
      }else if(rec.promotedAt&&r.l<=2){
        out.push(`Promoted from ${EN_SHORT[rec.promotedAt.from]} to ${EN_SHORT[r.l]} in ${rec.promotedAt.y}, it has held this distinction for ${EN_NUM[rec.streak]} consecutive years.`);
      }else if(rec.streak>=2&&r.l<=3){
        out.push(`It has kept this rating for ${EN_NUM[rec.streak]} consecutive years.`);
      }else if(rec.prev!=null&&rec.prev>r.l){
        out.push(`This year it moved up from ${EN_SHORT[rec.prev]} to ${EN_SHORT[r.l]}.`);
      }else if(rec.prev!=null&&rec.prev<r.l){
        out.push(`Last year it held ${EN_SHORT[rec.prev]}.`);
      }else if(rec.prev===null){
        if(rec.firstYear===rec.curYear&&r.l<=2)out.push(`It joined the Guide this year straight with ${EN_LV[r.l]}.`);
        else out.push(rec.firstYear===rec.curYear?'It joined the Guide this year.':`It has been in the Guide since ${rec.firstYear}.`);
      }else if(rec.streak>=5&&r.l===4){
        out.push(`It has remained consistently on the MICHELIN Guide list since ${rec.list[0].y}.`);
      }
    }

    // 5. Additional honors
    if(r.green){
      if(st&&st.cityGreen===1&&st.cityTotal>=5)out.push(`It also holds a MICHELIN Green Star—currently the only one in ${ctx.cityEn} recognized for sustainable gastronomy.`);
      else out.push('It also holds a MICHELIN Green Star for sustainable gastronomy.');
    }
    if(r.bp)out.push(`China’s Black Pearl guide also rates it ${r.bp} diamond${r.bp>1?'s':''}.`);

    // 6. Contextual price + booking
    if(st?.priceSummaryEn){
      out.push(st.priceSummaryEn);
    }else if(r.p){
      if(r.l<=2&&r.p<=2)out.push(pick([`At the ${'$'.repeat(r.p)} tier, it is among the more approachable starred tables in the area.`,`Priced at ${'$'.repeat(r.p)}, it offers a relatively accessible entry into starred dining.`],seed));
      else if(r.l===3&&r.p===1)out.push(pick(['Priced at the gentle $ tier, it offers standout everyday value.','At the accessible $ bracket, it is an easy-going Bib Gourmand pick.'],seed));
      else if(r.p===1)out.push(pick(['Prices sit at the gentle end ($) for the area.','It sits in the most accessible ($) local price tier.'],seed));
      else if(r.p===2)out.push(pick(['Prices are moderate ($$) for the area.','Expect moderate ($$) local pricing.'],seed));
      else if(r.p===3)out.push(pick(['Prices are on the higher side ($$$), suited to a more formal meal.','Positioned in the upper-mid ($$$) tier, it leans toward occasion dining.'],seed));
      else if(r.p===4)out.push(pick(['Prices are in the top bracket ($$$$), typically centered on tasting-menu dining.','Expect top-tier ($$$$) pricing in line with destination fine dining.'],seed));
    }
    if(st?.bookingPlatform)out.push(`Online reservations are handled via ${st.bookingPlatform}.`);
    return out.join(' ');
  }

  function links(r,countryEn,uiLang){
    const enLink={href:'https://guide.michelin.com/en/'+r.u,label:'英文版 English'};
    const loc=LOCALE[countryEn];
    const out=r.la&&loc?[{href:`https://guide.michelin.com/${loc}/${r.u}`,label:LOCALE_NAME[countryEn]},enLink]:[enLink];
    if(uiLang==='fr'&&!out.some(x=>x.href.includes('/fr/fr/')))out.unshift({href:'https://guide.michelin.com/fr/fr/'+r.u,label:'Français'});
    else if(uiLang==='ja'&&!out.some(x=>x.href.includes('/jp/ja/')))out.unshift({href:'https://guide.michelin.com/jp/ja/'+r.u,label:'日本語'});
    return out;
  }
  const space=t=>t.replace(/([\u3400-\u9fff])(?=[A-Za-zÀ-ÿ])/g,'$1 ').replace(/([A-Za-zÀ-ÿ.)])(?=[\u3400-\u9fff])/g,'$1 ');
  return {zh:(r,c)=>space(zh(r,c)),en,links,record,district,areaInfo,venueInfo};
})();
if(typeof module!=='undefined')module.exports=MGIntro;

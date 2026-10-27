/* English interface. The app is written in Chinese; in English mode this layer translates
   what is shown — text, placeholders, labels, toasts, dialogs and the recap canvas — using
   (1) whole-text matches, (2) number templates and (3) longest-match phrase translation.
   A Chinese run is only replaced when it is fully covered, so the user's own words
   (trip names, notes) and official Chinese addresses stay untouched. */
const MGI18n=(()=>{
  'use strict';
  let lang='zh';
  try{const q=new URLSearchParams(location.search).get('lang');const saved=localStorage.getItem('mg-lang');
    lang=q==='en'||q==='zh'?q:saved==='en'||saved==='zh'?saved:(/^zh/i.test(navigator.language||'zh')?'zh':'en');}catch(e){}
  const en=lang==='en';

  // ---- whole-text matches (exact node / attribute text, trimmed) ----
  const FULL={
    '城市中文名参考':'Chinese place names based on','地名资料与参考音译，导航保留原文。':'gazetteer names and reference transliterations; navigation keeps the original name.','旅行':'Trips','护照':'Passport','同步':'Sync','备份':'Backup','设置':'Settings','我的页面直达':'Personal shortcuts','美食护照':'Food passport','签章与我的旅行记录':'Stamps and travel memories','规划旅程，收藏沿途餐厅':'Plan a journey, save tables along the way','餐厅清单':'My restaurants','想去与去过，随时展开查看':'Saved and visited restaurants','手机与电脑，共享一份收藏':'One collection across your devices','备份与恢复':'Backup and restore','导出一份，安心保留':'Keep a copy of your collection','偏好与关于':'Preferences and about','主题、语言与使用帮助':'Theme, language and help','生僻地名采用参考音译，支持中文与原名检索。':'Less common places use reference transliterations; search in Chinese or the original name.',
    '次用餐':'meals','家餐厅':'restaurants','颗米其林星':'MICHELIN Stars','我的平均分':'my average','去过':'Been','想去':'Want to go',
    '次':'meals','天':'days','家':'restaurants','去过的国家和地区':'countries & regions','去过的城市':'cities','到访城市':'cities','去过的餐厅':'restaurants visited',
    '全部':'All','个':'','清单':'List','名录':'Directory','地图':'Map','附近':'Nearby','我的':'Me','筛选':'Filters','关闭':'Close',
    '我的米其林结算':'My MICHELIN Recap','三星':'3 Stars','二星':'2 Stars','一星':'1 Star','必比登':'Bib Gourmand','入选':'Selected',
    '米':'m','公里':'km','分钟':'min','小时':'h','保存':'Save','修改':'Edit','取消':'Cancel','今天':'Today','笔记':'Notes','照片':'Photos',
    '日期未填写':'No date','未填日期':'No date','—':'—','导航':'Directions','最近':'Latest','约':'about','步行':'Walk','车程':'Drive',
    '高德地图':'AMap','谷歌地图':'Google Maps','黑珍珠':'Black Pearl','绿星':'Green Star','译名':'Transl.','新上榜':'New','升星':'Promoted',
    '新摘星':'New star','新晋必比登':'New Bib','官方':'Official','封面':'Cover','晚餐':'Dinner','午餐':'Lunch','早午餐':'Brunch','下午':'Afternoon',
    '米其林全球名录':'MICHELIN Global Directory','长按识别 · 扫码打开':'Scan or long-press to open','MICHELIN GUIDE · 米其林全球名录':'MICHELIN GUIDE · GLOBAL DIRECTORY','扫一扫，找到你的下一家米其林':'Scan to find your next MICHELIN table','全球约 2 万家米其林餐厅 · 中文店名 · 一键导航':'About 20,000 MICHELIN restaurants · maps & directions','标记想去，记下每一餐，也生成一张你的结算长图':'Save places to try, log every meal, and make your own recap','高德地图 AMap ↗':'AMap ↗','复制地址 Copy':'Copy address','英文版 English ↗':'English ↗',
    '米其林指南中文官网地址 · Official Chinese address':'From MICHELIN’s Chinese site','米其林指南繁体中文官网地址 · Official Chinese address':'From MICHELIN’s Chinese site',
    '米其林指南日文官网地址 · Official Japanese address':'From MICHELIN’s Japanese site','中文参考地址 · 未核实专名保留原文 · Reference translation':'Chinese reference translation','米其林名录':'MICHELIN Directory','合计':'Total','大洲':'Continent','国家':'Country',
  };
  // ---- number templates on the whole text ----
  const MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const date=(y,m,d)=>`${MON[+m-1]} ${+d}, ${y}`;
  const PATTERNS=[
    [/^(\d{4}) 年 (\d{1,2}) 月 (\d{1,2}) 日$/,(m,y,mo,d)=>date(y,mo,d)],
    [/^数据更新至 ?(\d{4}) 年 (\d{1,2}) 月 (\d{1,2}) 日$/,(m,y,mo,d)=>'Data as of '+date(y,mo,d)],
    [/^连续(\d+)年(.+)$/,(m,n,l)=>`${tr(l)} · ${n} yrs running`],
    [/^黑珍珠([一二三])钻$/,(m,n)=>{const k='一二三'.indexOf(n)+1;return `Black Pearl ${k} Diamond${k>1?'s':''}`;}],
    [/^第 (\d+) 次用餐$/,(m,n)=>'Meal '+n],[/^修改第 (\d+) 次用餐$/,(m,n)=>'Edit meal '+n],[/^记录第 (\d+) 次用餐$/,(m,n)=>'Log meal '+n],
    [/^第 (\d+) 天$/,(m,n)=>'Day '+n],[/^(\d+) 次$/,(m,n)=>n+(n==='1'?' meal':' meals')],[/^(\d+) 天$/,(m,n)=>n+(n==='1'?' day':' days')],[/^(\d+) 张$/,(m,n)=>n+(n==='1'?' photo':' photos')],
    [/^距你 ([\d.,]+) (米|公里)$/,(m,n,u)=>`${n} ${u==='米'?'m':'km'} away`],
    [/^第 (\d+) 天（约 (.+)）$/,(m,n,k)=>`Day ${n} (about ${tr(k)})`],
    [/^去过 ★([\d.]+)$/,(m,n)=>'Been ★'+n],[/^去过 ✓$/,()=>'Been ✓'],
    [/^([\d.]+) 星$/,(m,n)=>n+(n==='1'?' star':' stars')],
    [/^累计 (\d+) 颗星$/,(m,n)=>`${n} star${n==='1'?'':'s'} in total`],
    [/^(\d+) 小时(?:(\d+) 分)?$/,(m,h,mi)=>`${h} h${mi?' '+mi+' min':''}`],
    [/^([\d.,]+) 米$/,(m,n)=>n+' m'],[/^([\d.,]+) 公里$/,(m,n)=>n+' km'],[/^(\d+) 分钟$/,(m,n)=>n+' min'],
    [/^全球 (\d+) 多个国家和地区、约 (\d+) 万家米其林餐厅：/,(m,a,b)=>`About ${+b*10},000 MICHELIN restaurants in ${a}+ countries and regions — 3, 2 and 1 Star, Bib Gourmand and Selected. Filter by continent, country and city, find places near you on the map, and share any filtered list with friends.`],
    [/^正在载入约 (\d+) 万家餐厅……(?:已下载 ([\d.]+) MB)?$/,(m,a,b)=>`Loading about ${+a*10},000 restaurants…${b?' '+b+' MB':''}`],
    [/^旅行：(.+)$/,(m,a)=>'Trip: '+a],[/^加入旅行 · (.+)$/,(m,a)=>'Add to trip · '+a],
    [/^(.+) · 米其林结算$/,(m,a)=>a+' · MICHELIN recap'],
    [/^(.+) · 米其林全球名录$/,(m,a)=>a+' · MICHELIN Global Directory'],
    [/^(.+?)（(\d+)）$/,(m,a,n)=>{const t=tr(a);return t===a?null:`${t} (${n})`;}],
  ];
  // ---- phrases (longest match wins) ----
  const FRAG={
    // header / directory
    '全球约':'About','万家米其林餐厅的中文名录：三星、二星、一星、必比登、入选，附地图、官网、历年记录和黑珍珠对照。':'0,000 MICHELIN restaurants worldwide — Stars, Bib Gourmand and Selected — with maps, websites, yearly history and Black Pearl cross-references.',
    '万家米其林餐厅：中文店名、地图、官网、历年记录，按大洲、国家、城市筛选。':'0,000 MICHELIN restaurants: Chinese names, maps, websites and yearly history, filtered by continent, country and city.',
    '全球':'','多个国家和地区、约':'+ countries and regions, about','万家米其林餐厅：三星、二星、一星、必比登推介和入选餐厅。可按大洲、国家、城市筛选，在地图上找附近的店，也能把筛选结果发给朋友。':'0,000 MICHELIN restaurants — 3, 2 and 1 Star, Bib Gourmand and Selected. Filter by continent, country and city, find places near you on the map, and share any filtered list with friends.',
    '等级怎么分、怎么评？':'How do the distinctions work?','等级怎么分、怎么评':'How the distinctions work','纠错与反馈':'Corrections & feedback',
    '搜店名、城市或菜系，如：新荣记、东京':'Search a restaurant, city or cuisine, e.g. Sushi, Tokyo','全部等级':'All levels','清除全部':'Clear all','页面':'Pages',
    '复制筛选链接':'Copy filter link','筛选地区与菜系':'Filter region & cuisine','地区':'Region','国家或地区':'Country or region','城市':'City',
    '菜系与价位':'Cuisine & price','菜系':'Cuisine','价位':'Price','全部价位':'All prices','清除全部筛选':'Clear all filters','标签':'Tags',
    '本版新上榜':'New this edition','今年升级':'Promoted this year','也上了黑珍珠':'Also Black Pearl','查看结果':'Show results',
    '上下滑动页面，查看下方餐厅':'Scroll the page to see the restaurants below','移动地图':'Move map','餐厅地图':'Restaurant map',
    '显示全部筛选餐厅':'Show all filtered restaurants','定位到我':'Locate me','查看餐厅':'View restaurants','各大洲统计':'By continent',
    '显示全部':'Show all','地图内的餐厅':'Restaurants on the map','正在载入约':'Loading about','万家餐厅……':'0,000 restaurants…',
    '再显示':'Show','想去和去过的餐厅，保存在这台设备上':'Places you want to go and have been, saved on this device',
    '排序':'Sort','最近标记':'Recently marked','按地区':'By region','按评分':'By rating','清单备份':'Backup','导出清单':'Export',
    '下载备份文件':'Download backup file','导入清单':'Import','从备份文件或文本':'From a file or text',
    '清单只存在当前浏览器里。换手机、清除浏览器数据，或者从浏览器改用“添加到主屏幕”的图标打开（':'Your lists live only in this browser. Before switching phones, clearing browser data, or moving between the browser and the Home Screen icon (on',
    '上两者的存储是分开的）之前，先导出一份。':'they keep separate storage), export a copy first.',
    '外观':'Appearance','主题':'Theme','跟随系统':'System','浅色':'Light','深色':'Dark','关于':'About','添加到手机主屏幕':'Add to Home Screen',
    '像':'Open like an','一样打开':'','项目主页':'Project page','数据更新':'Data updated','年':'','月':'','日':'',
    '餐厅名单、等级、坐标和官网来自米其林指南官网的公开数据，经开源项目':'Restaurant lists, distinctions, coordinates and websites come from public MICHELIN Guide data, compiled by the open-source project',
    '汇总；中国内地、港澳台、新加坡、马来西亚的中文名取自米其林中文官网，其他国家星级餐厅的“译名”是参考译名。“新上榜”“今年升级”是和一年前的名单比出来的，“连续':'. Chinese names for the Chinese mainland, Hong Kong, Macau, Taiwan, Singapore and Malaysia come from MICHELIN’s Chinese site; “Transl.” names elsewhere are reference translations. “New” and “Promoted” compare with the list a year earlier; “',
    '年”根据':' years running” uses lists saved each year from','至':'to','年每年保存的名单统计。黑珍珠对照只做了中国内地。本站与米其林、黑珍珠官方无关。':'. Black Pearl matching covers the Chinese mainland only. This site is not affiliated with MICHELIN or Black Pearl.',
    '数据来源：餐厅名单、等级、地址、坐标和官网来自米其林指南官网的公开数据，经开源项目':'Sources: restaurant lists, distinctions, addresses, coordinates and websites come from public MICHELIN Guide data, compiled by the open-source project',
    '汇总。中国内地、港澳台、新加坡、马来西亚的中文名取自米其林中文官网，是官方名称；其他国家星级餐厅标“译名”的是参考译名，预订和导航请用原名。':'. Chinese names for the Chinese mainland, Hong Kong, Macau, Taiwan, Singapore and Malaysia are official names from MICHELIN’s Chinese site; names marked “Transl.” are reference translations — use the original name to book or navigate.',
    '“新上榜”“今年升级”是和一年前（':'“New” and “Promoted” compare with the list a year earlier (',
    '月）的名单比出来的，中国内地的“新上榜”以米其林发布会公布的名单为准；“连续':'); for the Chinese mainland “New” follows MICHELIN’s announced list. “',
    '年每年保存的名单统计。黑珍珠对照只做了中国内地，详见“等级怎么分、怎么评？”。':'. Black Pearl matching covers the Chinese mainland only — see “How do the distinctions work?”.',
    '“想去”“去过”只保存在你这台设备的这个浏览器里，可在“我的”里导出备份。各国指南发布时间不同，米其林也会随时撤下歇业的店，去之前请在米其林指南':'“Want to go” and “Been” are saved only in this browser on this device; export a backup under “Me”. Guides are released at different times and MICHELIN removes closed restaurants at any time, so check the MICHELIN Guide',
    '核对。本站与米其林、黑珍珠官方无关。':'before you go. This site is not affiliated with MICHELIN or Black Pearl.',
    '主导航':'Main navigation',
    // about dialog
    '米其林的等级怎么分、怎么评':'How MICHELIN distinctions work','五个等级':'Five levels','卓越的烹饪，值得专程前往。':'Exceptional cuisine, worth a special journey.',
    '出色的烹饪，值得绕道前往。':'Excellent cooking, worth a detour.','高水准的烹饪，值得停车一尝。':'High-quality cooking, worth a stop.','必比登推介':'Bib Gourmand',
    '好吃又实惠。价格上限由各地指南按当地消费水平设定，所以东京和杭州的标准不一样。':'Good food at moderate prices. Each guide sets its own price ceiling for local costs, so Tokyo and Hangzhou differ.',
    '评审认为值得推荐的餐厅，烹饪水准好，但没有拿星，也不在必比登里。':'Restaurants the inspectors recommend for good cooking that hold neither a Star nor a Bib Gourmand.',
    '星级只看烹饪水平，跟价格无关；必比登看的是性价比，所以入选和必比登不是“高低档”的关系，而是两个不同的角度。一家贵但不够拿星的店会是“入选”，不会是必比登。':'Stars reflect cooking alone, regardless of price; the Bib Gourmand is about value. So Selected and Bib Gourmand are not “higher” and “lower” — they are different angles. An expensive restaurant that falls short of a Star is Selected, never a Bib Gourmand.',
    '表彰在可持续餐饮上做得突出的餐厅，比如用当地当季食材、减少浪费、照顾环境。它和星级并行，一家店可以同时是一星和绿星。':'Honours restaurants leading in sustainable gastronomy — local seasonal produce, less waste, care for the environment. It sits alongside Stars: a restaurant can hold 1 Star and a Green Star.',
    '怎么评':'How restaurants are judged',
    '米其林评审员是全职员工，匿名用餐、自己付钱。评星看五项标准：食材品质、烹饪技艺与火候、风味的协调、菜品体现的主厨个性，以及整份菜单和不同时间的稳定性。装修、服务和氛围不计入星级。一家店通常要被不同评审员去过多次，才会定下星级，此后每年复评。':'MICHELIN inspectors are full-time employees who dine anonymously and pay their bills. Stars rest on five criteria: quality of ingredients, mastery of technique, harmony of flavours, the chef’s personality in the food, and consistency across the menu and over time. Décor, service and atmosphere do not count toward Stars. A restaurant is usually visited several times by different inspectors before a Star is awarded, and reviewed every year after.',
    '黑珍珠是什么':'What is Black Pearl?','黑珍珠餐厅指南由美团（大众点评）在':'The Black Pearl Restaurant Guide was launched by Meituan (Dianping) in',
    '年推出，分一钻、二钻、三钻，主要覆盖中国内地，也有港澳台和海外城市。评审由厨师、美食作家、餐饮从业者等组成，评价时除了菜品，也会考虑服务、环境和饮食文化。米其林看重匿名评审和菜品本身，黑珍珠更贴近中国餐饮的场景，所以两份名单有重合，也各有对方没收的店。':', rating restaurants with one, two or three diamonds, mainly in the Chinese mainland plus Hong Kong, Macau, Taiwan and some overseas cities. Its panel of chefs, food writers and industry figures weighs service, setting and food culture as well as the dishes. MICHELIN focuses on anonymous inspection and the food itself, Black Pearl is closer to Chinese dining culture, so the lists overlap but each includes places the other does not.',
    '本站标“黑珍珠':'Restaurants tagged “Black Pearl','钻”的，是':'Diamond” here are from the','年黑珍珠名单里能对上米其林的中国内地餐厅，而且必须是同一家分店。二钻、三钻名单是完整的；一钻名单没有公开的完整版，目前只对照了杭州、深圳的完整名单、全国新上榜的店和公开报道里提到的店，所以没标的店也可能是一钻。':' Black Pearl list and match a MICHELIN restaurant in the Chinese mainland at the same branch. The 2- and 3-diamond lists are complete; there is no public complete 1-diamond list, so only Hangzhou and Shenzhen’s full lists, new national entries and press-reported ones are matched — an untagged restaurant may still hold 1 diamond.',
    '这里的标签':'Tags on this site','一年前不在米其林名单上（中国内地以官方发布会名单为准）。':'Not on the MICHELIN list a year earlier (Chinese mainland: per the official announcement).',
    '和一年前相比，从必比登或入选拿到了星，或者星级提高。':'Compared with a year earlier, gained a Star from Bib Gourmand or Selected, or gained more Stars.',
    '连续':'','按每年保存的名单（':'Years in a row at the same level in lists saved each year (','年），连续保持同一等级的年数，三年起标。名单记录可能有遗漏，实际年数可能更长。':'), shown from 3 years. Records may have gaps, so the real run may be longer.',
    // import / install
    '选择之前导出的备份文件，或者把备份内容粘贴到下面。导入的条目会和现有清单合并。':'Choose a backup file you exported earlier, or paste its contents below. Imported entries are merged with your current lists.',
    '或粘贴备份内容':'Or paste backup contents','导入':'Import','复制网址':'Copy link','其他手机和浏览器':'Other phones and browsers',
    '及以后：点地址栏右边的“…”，再点“分享”，往下找到“添加到主屏幕”（看不到就点“查看更多”），然后点“添加”。':'and later: tap “…” to the right of the address bar, then “Share”, scroll to “Add to Home Screen” (tap “View More” if you can’t see it), then tap “Add”.',
    '更早的系统：点屏幕底部中间的“分享”图标（方框加向上箭头），选“添加到主屏幕”。':'Earlier versions: tap the “Share” icon in the middle of the bottom bar (a box with an up arrow) and choose “Add to Home Screen”.',
    '如果底部没有工具栏，先轻点一下屏幕底部或往上滑一下页面，工具栏就会出来。':'If there is no bottom toolbar, tap the bottom of the screen or scroll up a little to show it.',
    '点地址栏右边的“分享”图标，选“添加到主屏幕”。系统太旧不支持时，请改用':'Tap the “Share” icon to the right of the address bar and choose “Add to Home Screen”. If your system is too old, use','打开。':'instead.',
    '微信、':'WeChat,','、微博里打开的':', Weibo and other in-app browsers','这些':'Pages inside these','里的网页不能添加到主屏幕。点右上角“…”，选“在浏览器中打开”（':'apps can’t be added to the Home Screen. Tap “…” at the top right and choose “Open in browser” (on',
    '上叫“在':'it’s “Open in','中打开”），再按上面的步骤。也可以复制网址，粘贴到浏览器里打开。':'”), then follow the steps above. You can also copy the link and paste it into your browser.',
    '安卓 ·':'Android ·','点右上角“':'Tap the “','”菜单，选“安装应用”或“添加到主屏幕”。':'” menu at the top right and choose “Install app” or “Add to Home screen”.',
    '华为、小米、':'Huawei, Xiaomi,','自带浏览器，':'built-in browsers,','浏览器':'Browser','点底部或右上角的菜单（“':'Open the menu at the bottom or top right (“','”或“':'” or “',
    '”），找“添加到桌面”“添加快捷方式”或“发送到桌面”。如果点了没反应，到手机“设置':'”) and look for “Add to desktop”, “Add shortcut” or “Send to desktop”. If nothing happens, go to “Settings','应用':'Apps','这个浏览器':'this browser',
    '权限”里打开“创建桌面快捷方式”。':'Permissions” and allow “Create desktop shortcuts”.','提示：在':'Tip: on',
    '上，从主屏幕图标打开和在浏览器里打开，“想去':', the Home Screen icon and the browser keep separate “Want to go','去过”清单是分开保存的。可以先在“我的”里导出，再到另一边导入。':'Been” lists. Export under “Me”, then import on the other side.',
    '在微信等':'Inside WeChat and other','里无法添加到主屏幕，也可能打不开地图。':'apps you can’t add to the Home Screen, and maps may not open.','怎么办':'What to do',
    '没能保存，浏览器可能禁用了本地存储':'Couldn’t save — the browser may have blocked local storage',
    '国家和地区（':'countries & regions (','先选国家再选城市':'Choose a country first','全部城市（':'All cities (','全部菜系（':'All cuisines (',
    '当前城市':'This city','· 各城市统计':'· by city','· 各国家和地区统计':'· by country & region','没有数据':'No data',
    '一二三':'123','钻':'Diamond','参考译名，非餐厅官方中文名':'Reference translation, not the restaurant’s official Chinese name','距你':'away',
    '加入想去':'Added','当前范围 ·':'In view ·','查看清单':'View list','家 · 按等级排序':'· sorted by level','共':'','地图范围内':'On the map:','家，':'restaurants,',
    '按离你的距离排序':'sorted by distance','按等级排序':'sorted by level','地图标记':'Map pin','地图范围内没有符合条件的餐厅，拖动或缩小地图看看。':'No matching restaurants in this map area — drag or zoom out.',
    '没有符合条件的餐厅。':'No matching restaurants.','没有符合条件的餐厅，换个关键词或放宽筛选试试。':'No matching restaurants. Try another keyword or loosen the filters.',
    '家（还有':'(','家）':'more)','累计':'','颗星':'stars','还没有想去的餐厅。':'No “Want to go” restaurants yet.','在名录或地图里点店名下面的“想去”，就会出现在这里。':'Tap “Want to go” under a restaurant in the directory or on the map and it will appear here.',
    '还没有去过的餐厅。':'No visited restaurants yet.','吃过之后点“去过”打个分，这里会记下来。':'After a meal, tap “Been” and add a rating — it will be recorded here.',
    '这个浏览器不支持定位':'This browser can’t share your location','正在获取你的位置……':'Getting your location…','已找到你的位置':'Found your location',
    '没能获取位置，请在系统设置里允许浏览器定位':'Couldn’t get your location — allow location access for the browser in Settings','完成移动':'Done','拖动移动地图，双指缩放':'Drag to move the map, pinch to zoom',
    '底图：高德（中国境内）':'Base map: AMap (China)','底图：':'Base map:','街道图':'Street Map','你在这里':'You are here','地图组件没能载入，请检查网络后刷新再试。':'The map couldn’t load. Check your connection and refresh.',
    '米其林全球名录 ·':'MICHELIN Global Directory ·','链接已复制，发给朋友打开就是同样的筛选结果':'Link copied — friends will see the same filtered list','没能复制，请直接复制地址栏里的链接':'Couldn’t copy — copy the link from the address bar',
    '地图正在加载，请稍后再试':'The map is still loading, try again in a moment','已加入“想去”，在“我的”里查看':'Added to “Want to go” — see it under “Me”','已标为“去过”':'Marked as “Been”','已取消':'Removed',
    '照片未能读取，本次只导出文字记录':'Couldn’t read photos; exported text records only','米其林清单':'michelin-lists','已导出':'Exported','家和':'restaurants and','张照片':'photos',
    '家，同时复制到了剪贴板':'restaurants and copied to the clipboard','已载入备份文件（':'Backup file loaded (','，含照片），点导入即可':', with photos) — tap Import',
    '记录已导入，但照片未能保存，请检查存储空间':'Records imported, but photos couldn’t be saved — check storage','已导入':'Imported','和':'and','，并合并旅行与笔记':'; trips and notes merged',
    '导入失败：':'Import failed:','请确认备份文件格式和存储权限':'check the backup file format and storage permissions','一键安装':'Install','已从主屏幕打开':'Opened from Home Screen',
    '微信':'WeChat','微博':'Weibo','钉钉':'DingTalk','飞书':'Lark','支付宝':'Alipay','小红书':'Xiaohongshu','抖音':'Douyin','里的网页':'in-app page',
    '点右上角的':'Tap','选':'Choose','在':'Open in','中打开':'','（或“在浏览器中打开”）':'(or “Open in browser”)','在浏览器中打开':'Open in browser',
    '在打开的浏览器里，再点“我的':'In that browser, go to “Me','添加到手机主屏幕”看步骤':'Add to Home Screen” for the steps','如果找不到这个选项：点下面的“复制网址”，打开':'If you can’t find it: tap “Copy link” below, open',
    '手机浏览器':'your phone’s browser','，粘贴到地址栏':'and paste it into the address bar','上的':'·','点地址栏右边的':'Tap to the right of the address bar:','分享':'Share',
    '图标（方框加向上箭头）':'icon (box with an up arrow)','往下找到':'Scroll to','添加到主屏幕':'Add to Home Screen','点':'Tap','添加':'Add','找不到的话，复制网址改用':'If it isn’t there, copy the link and use','打开':'Open',
    '上的第三方浏览器':'· third-party browser','这个浏览器多半不支持添加到主屏幕':'This browser probably can’t add to the Home Screen','点下面的“复制网址”':'Tap “Copy link” below','，粘贴到地址栏打开':'and paste the link',
    '再回到“我的':'Then return to “Me','添加到手机主屏幕”':'Add to Home Screen”','（三个点）':'(three dots)','，看不到就点“查看更多”':'— tap “View More” if you can’t see it','打开“作为网页':'Turn on “Open as Web','打开”（如有），点':'App” (if shown), tap',
    '先轻点屏幕底部，让底部工具栏出现':'Tap the bottom of the screen to show the toolbar','点中间的':'Tap the middle','往下滑，找到':'Scroll down to','点右上角':'Tap at the top right',
    '安卓手机自带或国产浏览器':'Android built-in or Chinese browser','点底部或右上角的':'Tap at the bottom or top right:','菜单':'Menu','找':'Find','添加到桌面':'Add to desktop','添加快捷方式':'Add shortcut','或':'or','发送到桌面':'Send to desktop',
    '点了没反应：到手机“设置':'Nothing happens? Go to “Settings','权限”，打开':'Permissions” and turn on','创建桌面快捷方式':'Create desktop shortcuts','安卓上的':'Android ·','安装应用':'Install app','安装':'Install',
    '电脑浏览器':'Desktop browser','用手机打开这个网址，再按页面提示添加':'Open this link on your phone and follow the prompts','也可以点地址栏右边的“安装”图标，装成电脑上的应用':'can also install it as a desktop app from the “Install” icon in the address bar',
    '你现在用的是：':'You are using:','网址已复制，粘贴到浏览器地址栏打开':'Link copied — paste it into your browser’s address bar','没能复制，请手动复制地址栏里的网址':'Couldn’t copy — copy the link from the address bar',
    '万家餐厅……已下载':'0,000 restaurants… downloaded','数据更新至':'Data as of','数据没能载入，请刷新页面再试。':'Data couldn’t load. Please refresh.',
    // personal data
    '已有旅行存储无法读取，已阻止覆盖。请先导出原始备份再恢复。':'Saved trips couldn’t be read, so nothing was overwritten. Export the raw backup first, then restore.','保存失败，请先导出备份并检查浏览器存储空间':'Save failed — export a backup and check browser storage',
    '不是支持的清单备份':'Not a supported backup','请先导出并恢复原始旅行存储':'Export and restore the original trip storage first','浏览器未能保存，请检查存储空间':'The browser couldn’t save — check storage',
    '最多支持':'Up to','个旅行清单':'trips','旅行清单超过':'More than','个，请拆分备份':'trips — split the backup',
    // passport
    '城市纪念章':'City stamp','下一站，吃点什么？':'Next stop, what’s for dinner?','在餐厅下点“去过”，':'Tap “Been” under a restaurant','为护照盖下第一枚签章。':'to get your first stamp.','去发现餐厅':'Discover restaurants',
    '翻开我的美食护照':'Open my food passport','美食护照':'Food Passport','私人珍藏 · 每一餐都值得记住':'Private collection · every meal worth remembering','护照资料页':'Passport data page','资料页':'DATA PAGE',
    '持有人':'Holder','美食旅行者':'Food traveller','护照类型':'Type','以一餐为起点，':'Starting from a single meal,','收集与世界相遇的证据。':'collect evidence of meeting the world.',
    '已收藏目的地':'Saved destinations','家想去':'to try','尚未留下到访记录':'No visits yet','星级以现有名单为准。':'Distinctions as in the current lists.','签名':'Signature','护照签章页':'Passport stamp page','味觉签章':'TASTE STAMPS',
    '世界的味道，逐页收藏。':'The world’s flavours, page by page.','一座城市，一枚地标；每个到访日期，单独盖章。':'One city, one landmark; each visit date gets its own stamp.','每一枚签章，都记录一次与世界的相遇。':'Every stamp marks a meeting with the world.',
    '真正的旅程，从你喜欢的那一家开始。':'The real journey starts at a place you love.','签章':'Stamps','我的美食护照':'My Food Passport','生成我的米其林结算地图':'Create my MICHELIN recap map','一张长图 · 足迹地图 · 到访清单 · 我的评分':'One long image · footprint map · visit list · my ratings',
    '资料与签章 · 左右滑动翻页':'Data & stamps · swipe to turn pages','合上护照':'Close passport','上一页签章':'Previous stamp page','上一页':'Previous','下一页签章':'Next stamp page','下一页':'Next',
    '已到访':'Visited','家餐厅 ·':'restaurants ·','个国家和地区':'countries & regions','这本护照，等待你的第一枚签章。':'This passport awaits its first stamp.','世界很大，值得一口一口去认识。':'A big world, best discovered one bite at a time.','向左滑动或轻触封面，翻开护照':'Swipe left or tap the cover to open',
    // trips
    '座城市 · 已去':'cities · been to','家不在现有名单中':'not in the current lists','排路线':'Plan route','查看地图':'View map','生成这趟旅行的结算图':'Create this trip’s recap','在旅行地图查看':'See on the trip map:','的':'',
    '创建一份旅行清单，然后在餐厅下方点“加入旅行”。一间餐厅可以放进多份清单。':'Create a trip, then tap “Add to trip” under a restaurant. A restaurant can be in several trips.','全部餐厅':'All restaurants','不限旅行':'any trip','旅行：':'Trip:','星级变化：':'Changes:','全部旅行城市':'All trip cities',
    '· 暂无可定位的餐厅，可先从名录添加':'· no restaurants with a location yet — add some from the directory','新增三星':'New 3 Stars','新增二星':'New 2 Stars','新增一星':'New 1 Star','连续五年三星':'3 Stars, 5 years running','创建旅行清单':'Create a trip',
    '还没有餐厅。在名录中找到感兴趣的餐厅，点“加入旅行”。':'No restaurants yet. Find one in the directory and tap “Add to trip”.','加入旅行 ·':'Add to trip ·','还没有旅行清单，可以在下方创建。':'No trips yet — create one below.','加入旅行':'Add to trip',
    // detail
    '暂无已核实的人均或套餐价格。':'No verified per-person or set-menu prices yet.','米其林的':'MICHELIN’s','符号仅表示当地价位，不能换算为具体金额。请到官网查看最新菜单及预约条件。':'symbols only show the local price level, not an amount. Check the restaurant’s website for current menus and booking terms.',
    '价格会变动，预订前请复核。核实于':'Prices change; check before booking. Verified','价格来源':'Price source','历年评级':'Yearly ratings','依据历年保存的名单整理。':'From lists saved each year.',
    '我的评分':'My rating','我的评分，支持半星':'My rating, half stars allowed','星':'stars','未评分':'Not rated','轻点打分，支持半星（可不打）':'Tap to rate, half stars allowed (optional)','清除评分':'Clear rating',
    '修改第':'Edit meal','次用餐':'','记录第':'Log meal','记录第一次用餐':'Log your first meal','用餐日期':'Date','点了什么、味道怎样、下次想试什么':'What you ordered, how it tasted, what to try next',
    '保存后，这家店会标记为“去过”':'Saving marks this restaurant as “Been”','删除这次':'Delete this meal','保存修改':'Save changes','第':'Meal','平均评分':'avg rating','最近一次':'last visit','＋ 记录一次用餐':'+ Log a meal',
    '删除最后一次用餐后，这家店会取消“去过”。':'Deleting the last meal removes “Been”.','有修改尚未保存':'Unsaved changes','旅行记录暂时无法读取，请先备份':'Trip records can’t be read right now — back up first',
    '保存失败，更改未生效，请检查存储空间':'Save failed, nothing changed — check storage','我的用餐记录':'My meals','记录一次用餐':'Log a meal','评分 · 日期 · 笔记':'rating · date · notes',
    '确认删除这次？':'Delete this meal?','确认删除？将取消“去过”':'Delete? This removes “Been”','已删除，这家店已取消“去过”':'Deleted — no longer marked “Been”','已删除这次用餐，其他记录保留':'Meal deleted, other meals kept',
    '已保存，标记去过 ·':'Saved, marked “Been” ·','已保存，标记去过':'Saved, marked “Been”','已保存':'Saved','简介':'About','阅读米其林官方点评':'Read the official MICHELIN review','简介由本站依据名单信息整理，并非米其林评审原文。':'Summary written by this site from the listing data, not MICHELIN’s review text.',
    '中文版':'Chinese','繁体中文版':'Chinese (Traditional)','日文版':'Japanese','英文版':'English',
    '米其林指南日文官网地址 ·':'MICHELIN Japanese site ·','米其林指南繁体中文官网地址 ·':'MICHELIN Chinese site ·','米其林指南中文官网地址 ·':'MICHELIN Chinese site ·','中文参考地址 · 未核实专名保留原文 ·':'',
    '复制地址':'Copy address','这家餐厅不在现有名单中，请核对链接':'This restaurant isn’t in the current lists — check the link','· 米其林指南配图':'· MICHELIN Guide photo','· 参考译名，非官方中文名':'· reference translation, not an official name',
    '· 米其林全球名录':'· MICHELIN Global Directory','下滑或点击关闭餐厅详情':'Swipe down or tap to close','下滑或点击关闭用餐记录':'Swipe down or tap to close','去过 · 我的评分':'Been · my rating',
    '米其林页面':'MICHELIN page','语言':'','地址':'Address','当地价位':'local price level','官网':'Website','查询预约':'booking','价位':'Price','官网 / 查询预约':'Website / booking','复制餐厅链接':'Copy restaurant link','参考消费':'Prices','只保存在本设备，可在“我的”里导出备份。':'Saved on this device only; export a backup under “Me”.',
    '旅行名称':'Trip name','例如：':'e.g.','欧洲旅行':'Europe trip','保存名称':'Save name','在地图上查看':'View on map','删除旅行清单':'Delete trip','或创建新旅行':'Or create a new trip','输入旅行名称':'Trip name','保存到所选旅行':'Save to selected trips',
    '旅行美食地图':'Trip food maps','＋ 新建旅行':'+ New trip','为下一段旅程，收藏想去的餐厅。':'Save restaurants for your next journey.','旅行':'Trip','按旅行清单筛选':'Filter by trip','按旅行城市筛选':'Filter by trip city','清除':'Clear','以下为拼写相近的结果。':'Showing results with similar spelling.',
    '星级变化':'Changes','新增星级 · 历年记录':'new stars · yearly records','统计说明':'How this is counted','依据':'Based on lists saved in','月与':'and on','保存的名单对比，不等同于各地区官方年度发布名单。“连续五年三星”表示':', not each region’s official annual release. “3 Stars, 5 years running” means all five records from','年五份记录均为三星。':'are 3 Stars.',
    '旅行记录暂时无法读取，原始存储已保留，请先备份':'Trip records can’t be read; the raw storage is kept — back up first','旅行清单已保存':'Trip saved','删除这份旅行清单？餐厅的“想去':'Delete this trip? Restaurants’ “Want to go','去过”和用餐笔记会保留。':'Been” marks and meal notes are kept.',
    '暂无餐厅，可在名录中添加。':'No restaurants yet — add some from the directory.','已更新旅行清单':'Trip updated','已复制地址':'Address copied','复制失败，请长按地址复制':'Copy failed — long-press the address','已复制餐厅链接':'Restaurant link copied','无法复制，请从地址栏复制链接':'Couldn’t copy — use the address bar',
    // recap
    '我的最高分':'My top score','去得最多':'Most visited','星级最高':'Highest rated','最早':'start','至今':'today','个国家和地区 ·':'countries & regions ·','座城市':'cities','我的足迹地图':'My footprint map','座城市 · 圆点里是去过的家数':'cities · number = restaurants visited',
    '家 · 编号对应下方餐厅':'restaurants · numbers match the list below','位置示意图 · 底图暂不可用，点位为真实坐标':'Location sketch · base map unavailable, pins are real coordinates','这些餐厅暂无坐标':'No coordinates for these restaurants','美味瞬间':'Delicious moments','张 · 我拍的':'photos · taken by me',
    '这一路的高光':'Highlights','到访清单':'Visit list','扫码打开米其林名录':'Scan to open the directory','麻雀映画':'Sparrow Cinema','星级以':'Distinctions per the MICHELIN lists of','的米其林名单为准 · 我的评分满分':'· my ratings out of','· 照片为本人拍摄':'· photos by me','· 私人笔记不会出现在图中 · 与米其林官方无关':'· private notes are never included · not affiliated with MICHELIN',
    '无坐标':'no coordinates','地图已加载':'map loaded','底图暂不可用，已用真实坐标画位置示意图':'base map unavailable — drawn from real coordinates','结束日期不能早于开始日期':'The end date can’t be before the start date','家去过的餐厅 · 正在生成结算长图…':'visited restaurants · creating your recap…',
    '这份旅行里还没有去过的餐厅。吃过后点“去过”，就能生成结算图。':'No visited restaurants in this trip yet. Tap “Been” after a meal to create a recap.','这段时间还没有到访记录。先在餐厅里点“去过”，再来生成结算图。':'No visits in this period. Tap “Been” at a restaurant first, then come back.',
    '我的米其林结算长图：足迹地图、统计和到访清单':'My MICHELIN recap: footprint map, stats and visit list','家去过的餐厅':'visited restaurants','家放了我拍的照片':'with my photos','· 一张长图 ·':'· one long image ·','全部到访记录':'All visits','· 米其林结算':'· MICHELIN recap','我的米其林结算地图':'My MICHELIN Recap Map',
    '标题':'Title','范围':'Scope','时间范围':'Time range','自定义':'Custom','放入我拍的用餐照片':'Include my meal photos','照片墙':'photo wall','每家店的缩略图':'a thumbnail per restaurant','开始':'From','结束':'To',
    '只包含你标记“去过”的餐厅，每家都标出星级、必比登或入选。去过多个城市时，地图按城市汇总；只在一个城市时逐家编号。私人笔记不会出现在图中；照片只在你勾选时放入。':'Only restaurants you marked “Been”, each with its Stars, Bib Gourmand or Selected badge. Across several cities the map groups by city; within one city every restaurant is numbered. Private notes are never included; photos only when you tick the box.',
    '把下一餐，':'Put your next meal','写进你的结算。':'into your recap.','在餐厅里点“去过”打个分，':'Tap “Been” at a restaurant and rate it —','这里会生成你的米其林长图。':'your MICHELIN recap appears here.','我的米其林结算长图':'My MICHELIN recap image','长图 · 长按预览也可保存':'long image · or long-press the preview to save','保存长图':'Save image','长图已保存':'Image saved','请点“保存长图”后分享':'Tap “Save image”, then share it',
    '本次更新':'This update','新建旅行':'New trip','结算图':'Recap','各地指南版本':'Guide editions',
    // cloud sync
    '云端同步':'Cloud sync','用一串同步码，在手机和电脑之间同步“想去':'Use one sync code to keep “Want to go','去过”、评分、用餐记录、旅行和照片。不用注册账号。':'Been”, ratings, meals, trips and photos in step between your phone and computer. No account needed.',
    '开启同步':'Turn on sync','我有同步码':'I have a sync code','输入同步码':'Enter sync code','连接':'Connect','输入另一台设备上的同步码。这台设备上已有的记录会和云端合并，不会丢。':'Enter the sync code from your other device. Records already on this device are merged with the cloud, nothing is lost.',
    '同步中…':'Syncing…','同步失败：':'Sync failed:','已同步':'Synced','同步码':'Sync code','隐藏':'Hide','显示':'Show','复制':'Copy',
    '同步码就是钥匙：拿到它的人能看到并修改你的记录；丢了也无法找回。请存进备忘录或密码管理器，在另一台设备点“我有同步码”输入即可。':'The sync code is the key: anyone who has it can see and change your records, and it can’t be recovered if lost. Keep it in your notes or password manager, then tap “I have a sync code” on your other device.',
    '立即同步':'Sync now','在这台设备停止同步':'Stop syncing on this device','停止同步':'Stop syncing','正在上传照片':'Uploading photos','正在下载照片':'Downloading photos','云端有其他设备正在同步，请稍后再试':'Another device is syncing, try again in a moment',
    '刚刚':'just now','分钟前':'min ago','小时前':'h ago','✓ 已开启同步，请保存好同步码':'✓ Sync is on — keep your sync code safe','同步码已复制':'Sync code copied','✓ 已同步，并合并了其他设备的更改':'✓ Synced, with changes from your other devices','✓ 已同步':'✓ Synced',
    '在这台设备停止同步？这台设备上的记录会保留，云端的记录也不会删除；以后输入同步码可以重新连接。':'Stop syncing on this device? Records here stay, the cloud copy is not deleted, and you can reconnect with the sync code later.',
    '已在这台设备停止同步':'Sync stopped on this device','同步码格式不对，请检查':'That doesn’t look like a sync code','✓ 已连接，记录已合并':'✓ Connected, records merged',
    // photos
    '此浏览器不支持保存照片':'This browser can’t store photos','照片保存失败':'Couldn’t save the photo','图片无法处理':'Couldn’t process the image','查看第':'View photo','移除第':'Remove photo','添加照片':'Add photos','照片只存在这台设备上，导出备份时一并带走。':'Photos stay on this device and travel with your backup.',
    '查看照片':'View photo','上一张':'Previous photo','下一张':'Next photo','每次用餐最多':'Up to','张，已添加前':'photos per meal; added the first','张':'','正在处理照片':'Processing photo','照片保存失败，请检查存储空间':'Couldn’t save the photo — check storage',
    // route
    '分钟':'min','小时':'h','分':'min','关闭路线':'Close route','旅行路线 ·':'TRIP ROUTE ·','选择城市':'Choose a city','每天':'Per day','每天少一家':'One fewer per day','每天多一家':'One more per day','跳过去过的':'Skip visited','从我的位置出发':'Start from my location',
    '这个浏览器无法获取位置':'This browser can’t get your location','定位中…':'Locating…','没有拿到位置，仍从第一家出发':'No location — starting from the first restaurant','已复制行程，可直接粘贴':'Itinerary copied','复制失败':'Copy failed','路线示意图':'Route sketch','天':'Day',
    '示意图 · 直线距离':'sketch · straight-line distances','步行':'Walk','车程':'Drive','约':'about','这份清单里还没有能定位的餐厅。':'No restaurants with a location in this trip yet.','这座城市的餐厅都去过了':'You’ve been to every restaurant in this city','。关掉“跳过去过的”可以看到全部。':'. Turn off “Skip visited” to see them all.',
    '总路程（估）':'total (est.)','家 · 约':'stops · about','谷歌地图看全天':'Whole day in Google Maps','复制行程文字':'Copy itinerary','距离按直线':'Distances are straight-line ×','估算，步行按每小时':'; walking at','公里、车程按城市平均车速估算，出发前以导航为准。':'km/h and driving at average city speed — check directions before you go.',
    '已跳过':'Skipped','家去过的餐厅。':'visited restaurants.','美食路线':'food route','天（约':'(about','—— 来自 米其林全球名录':'— from MICHELIN Global Directory',
    // levels, units, misc
    '米其林三星':'three MICHELIN Stars','米其林二星':'two MICHELIN Stars','米其林一星':'one MICHELIN Star','米其林指南入选餐厅':'MICHELIN Guide Selected','亚洲':'Asia','欧洲':'Europe','北美洲':'North America','南美洲':'South America','大洋洲':'Oceania',
    '国家和地区':'countries & regions','家':'restaurants','家餐厅':'restaurants','餐厅':'restaurants','米':'m','公里':'km','个国家':'countries','（':'(','）':')','·':'·','→':'→','，':',','。':'.','：':':','、':',','；':';','？':'?','！':'!','“':'“','”':'”','…':'…','—':'—','／':'/',
    '东方明珠':'Oriental Pearl Tower','天坛':'Temple of Heaven','广州塔':'Canton Tower','平安金融中心':'Ping An Finance Center','中银大厦':'Bank of China Tower','大三巴牌坊':'Ruins of St. Paul’s','雷峰塔':'Leifeng Pagoda','紫峰大厦':'Zifeng Tower','安顺廊桥':'Anshun Bridge',
    '重庆':'Chongqing','洪崖洞':'Hongyadong','西安':'Xi’an','大雁塔':'Giant Wild Goose Pagoda','武汉':'Wuhan','黄鹤楼':'Yellow Crane Tower','北寺塔':'North Temple Pagoda','天津':'Tianjin','天津之眼':'Tianjin Eye','埃菲尔铁塔':'Eiffel Tower','伊丽莎白塔':'Elizabeth Tower',
    '罗马斗兽场':'Colosseum','米兰大教堂':'Milan Cathedral','圣母百花大教堂':'Florence Cathedral','圣马可钟楼':'St Mark’s Campanile','比萨':'Pisa','比萨斜塔':'Leaning Tower of Pisa','圣家堂':'Sagrada Família','阿尔卡拉门':'Puerta de Alcalá','贝伦塔':'Belém Tower',
    '圣斯蒂芬大教堂':'St. Stephen’s Cathedral','查理大桥':'Charles Bridge','勃兰登堡门':'Brandenburg Gate','运河拱桥':'Canal bridge','圆塔':'Round Tower','斯德哥尔摩市政厅':'Stockholm City Hall','东京塔':'Tokyo Tower','东寺五重塔':'Tō-ji Pagoda','大阪城':'Osaka Castle',
    '南山首尔塔':'N Seoul Tower','滨海湾金沙':'Marina Bay Sands','郑王庙':'Wat Arun','双子塔':'Petronas Towers','哈利法塔':'Burj Khalifa','悉尼':'Sydney','悉尼歌剧院':'Sydney Opera House','帝国大厦':'Empire State Building','金门大桥':'Golden Gate Bridge',
    '格里菲斯天文台':'Griffith Observatory','威利斯大厦':'Willis Tower','加拿大国家电视塔':'CN Tower','加拿大广场':'Canada Place','外滩海关大楼':'Custom House, the Bund','上海环球金融中心':'Shanghai World Financial Center','凯旋门':'Arc de Triomphe','巴黎圣母院':'Notre-Dame',
    '伦敦眼':'London Eye','伦敦塔桥':'Tower Bridge','故宫角楼':'Forbidden City corner tower','中央广播电视塔':'CCTV Tower','东京晴空塔':'Tokyo Skytree','浅草寺五重塔':'Sensō-ji Pagoda','尖沙咀钟楼':'Clock Tower, Tsim Sha Tsui','国际金融中心':'IFC','摩天观景轮':'Singapore Flyer',
    '苏丹回教堂':'Sultan Mosque','布鲁克林大桥':'Brooklyn Bridge','克莱斯勒大厦':'Chrysler Building','京都塔':'Kyoto Tower','通天阁':'Tsūtenkaku','万神殿':'Pantheon','巴塞罗那大教堂':'Barcelona Cathedral','科伊特塔':'Coit Tower','悉尼海港大桥':'Sydney Harbour Bridge',
  };
  // ---- engine ----
  const CJK=/[㐀-鿿]/,RUN=/[㐀-鿿　-〿！-～“”‘’…·—→][㐀-鿿　-〿！-～“”‘’…·—→ ]*/g;
  const dict=new Map(Object.entries(FRAG));let maxLen=Math.max(...Object.keys(FRAG).map(k=>k.length));
  const full=new Map(Object.entries(FULL));
  for(const [k,v] of full)if(!dict.has(k)&&!['次','天','个','家','全部','约','—'].includes(k))dict.set(k,v);
  const add=(zh,enName)=>{if(zh&&enName&&CJK.test(zh)&&!dict.has(zh)){dict.set(zh,enName);if(zh.length>maxLen)maxLen=zh.length;}if(zh&&enName&&!full.has(zh))full.set(zh,enName);};
  const glue=(a,b)=>!a?b:!b?a:(/[\w)\]’”.,;:!?%]$/.test(a)&&/^[\w(\[“‘]/.test(b))?a+' '+b:a+b;
  // Longest-match a CJK run; null if any CJK character is left uncovered.
  function phrase(run){
    let out='',i=0;
    while(i<run.length){
      const ch=run[i];if(ch===' '){out+=' ';i++;continue;}
      let hit=null,len=Math.min(maxLen,run.length-i);
      for(;len>0;len--){const k=run.substr(i,len);if(dict.has(k)){hit=dict.get(k);break;}}
      if(hit===null){if(CJK.test(ch))return null;out+=ch;i++;continue;}
      out=glue(out,hit);i+=len;
    }
    return out;
  }
  const cache=new Map();
  function tr(s){
    if(!en||!s||!CJK.test(s))return s;
    if(cache.has(s))return cache.get(s);
    const lead=s.match(/^\s*/)[0],trail=s.match(/\s*$/)[0],t=s.trim();let res=null;
    if(full.has(t))res=full.get(t);
    if(res===null)for(const [re,fn] of PATTERNS){const m=t.match(re);if(m){const v=fn(...m);if(v!=null){res=v;break;}}}
    if(res===null){
      // Split into plain / Chinese segments; leave the whole string alone when any Chinese run is unknown
      // (it is probably the user's own words).
      const segs=[];let last=0,ok=true;t.replace(RUN,(run,at)=>{segs.push(t.slice(last,at));const core=run.trim(),pre=run.match(/^\s*/)[0],post=run.match(/\s*$/)[0];
        const p=phrase(core);if(p===null)ok=false;segs.push(pre,p===null?core:p,post);last=at+run.length;return run;});segs.push(t.slice(last));
      res=ok?segs.reduce((a,b)=>b?glue(a,b):a,'').replace(/ {2,}/g,' ').replace(/ +([,.;:!?)])/g,'$1').replace(/\( +/g,'(').trim():t;}
    const out=res===t?s:lead+res+trail;if(cache.size>20000)cache.clear();cache.set(s,out);return out;
  }
  // ---- DOM ----
  const ATTRS=['placeholder','aria-label','title','alt','aria-valuetext'];
  const skip=el=>!!el?.closest?.('[translate="no"],script,style,textarea,code,svg text,[contenteditable]');
  function node(n){
    if(n.nodeType===3){if(CJK.test(n.data)&&!skip(n.parentElement)){const v=tr(n.data);if(v!==n.data)n.data=v;}return;}
    if(n.nodeType!==1||skip(n))return;
    for(const a of ATTRS){const v=n.getAttribute?.(a);if(v&&CJK.test(v)){const t=tr(v);if(t!==v)n.setAttribute(a,t);}}
    if(n.tagName==='INPUT'&&/^(button|submit)$/.test(n.type)&&CJK.test(n.value))n.value=tr(n.value);
    const w=document.createTreeWalker(n,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT);let c;
    while((c=w.nextNode())){if(c.nodeType===3){if(CJK.test(c.data)&&!skip(c.parentElement)){const v=tr(c.data);if(v!==c.data)c.data=v;}}
      else if(!skip(c))for(const a of ATTRS){const v=c.getAttribute(a);if(v&&CJK.test(v)){const t=tr(v);if(t!==v)c.setAttribute(a,t);}}}
  }
  let running=false;
  function start(){
    if(!en||running)return;running=true;
    document.documentElement.lang='en';document.documentElement.classList.add('lang-en');
    const title=()=>{if(CJK.test(document.title)){const t=tr(document.title);if(t!==document.title)document.title=t;}};
    node(document.body);title();
    new MutationObserver(list=>{for(const m of list){
      if(m.type==='characterData')node(m.target);
      else if(m.type==='attributes')node(m.target);
      else m.addedNodes.forEach(node);}
      title();
    }).observe(document.documentElement,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:ATTRS});
    const conf=window.confirm.bind(window);window.confirm=m=>conf(tr(m));
    // Canvas text (the recap long image): translate everything except the user's own title.
    const P=CanvasRenderingContext2D.prototype,fill=P.fillText,measure=P.measureText;
    const own=t=>{const v=document.getElementById('shareTitle')?.value||'';return v&&v.includes(t);};
    P.fillText=function(t,...a){return fill.call(this,own(String(t))?t:tr(String(t)),...a);};
    P.measureText=function(t){return measure.call(this,own(String(t))?t:tr(String(t)));};
  }
  // Country, city, cuisine and continent names from the dataset.
  function data(d){
    d.countries.forEach(c=>add(c[0],c[1]));d.cities.forEach(c=>add(c[0],c[2]||c[0]));
    (d.cuisines_en||[]).forEach((e,i)=>add(d.cuisines[i],e));
  }
  function set(v){try{localStorage.setItem('mg-lang',v);}catch(e){}const u=new URL(location.href);u.searchParams.delete('lang');location.replace(u.href);}
  if(en){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();}
  return {en,lang,tr,data,set,start,_dict:dict};
})();
if(typeof module!=='undefined')module.exports=MGI18n;

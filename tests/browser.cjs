/* Optional browser regression: npm install --no-save playwright leaflet
   npx playwright install chromium && node tests/browser.cjs
   Browser binaries can also be selected with CHROMIUM_EXECUTABLE. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const base=path.resolve(__dirname,'..');
  const previousCache='mg-v17';
  const cacheName=fs.readFileSync(path.join(base,'sw.js'),'utf8').match(/const CACHE = "([^"]+)"/)[1];
  // A new page must never load an old cached script: index.html asset versions must match sw.js.
  const swText=fs.readFileSync(path.join(base,'sw.js'),'utf8'),assetVer=swText.match(/const ASSET_VER = "([^"]+)"/)[1],indexText=fs.readFileSync(path.join(base,'index.html'),'utf8');
  for(const f of ['upgrade.css','search-aliases.js','guide-core.js','upgrade.js','passport-share.js'])assert(indexText.includes(f+'?v='+assetVer),f+' must be referenced as '+f+'?v='+assetVer);
  assert.equal(cacheName,'mg-v'+assetVer);
  assert(indexText.includes('const ASSET_VER="'+assetVer+'"'),'index.html ASSET_VER');
  assert(fs.readFileSync(path.join(base,'upgrade.js'),'utf8').includes('const UPGRADE_VER="'+assetVer+'"'),'upgrade.js UPGRADE_VER');
  const server=http.createServer((req,res)=>{
    let file=path.resolve(base,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(file===base)file=path.join(base,'index.html');
    if(!file.startsWith(base+path.sep)){res.writeHead(403);return res.end();}
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[path.extname(file)]||'text/plain');
    try{res.end(fs.readFileSync(file));}catch(e){res.writeHead(404);res.end('missing');}
  });
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const url='http://127.0.0.1:'+server.address().port;
  const args=process.env.CHROMIUM_EXECUTABLE?['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']:[];
  const browser=await chromium.launch({headless:true,args,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined});
  try{
    const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2}),page=await context.newPage(),errors=[];
    const cdp=await context.newCDPSession(page);
    async function touchSwipe(x,y,dy){
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
      await page.waitForTimeout(80);
      for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y+dy*i/8}]});await page.waitForTimeout(20);}
      await page.waitForTimeout(150);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }
    page.on('pageerror',e=>errors.push(e.message));
    // Only Leaflet assets/tiles are stubbed, so assertions do not depend on external map services.
    const leaflet=path.dirname(require.resolve(process.env.LEAFLET_MODULE||'leaflet'));
    await page.route(/https:\/\/.*leaflet.*\.(js|css)$/,route=>route.fulfill({path:path.join(leaflet,route.request().url().endsWith('.css')?'leaflet.css':'leaflet.js'),contentType:route.request().url().endsWith('.css')?'text/css':'text/javascript'}));
    await page.route(/https:\/\/.*(autonavi|arcgisonline|tile\.openstreetmap).*$/,route=>route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*'},contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=','base64')}));
    await page.goto(url);await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&upLoaded);
    await page.locator('#tabbar [data-tab="me"]').click();
    assert(await page.locator('.pp-cover').isVisible());
    if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'passport-cover.png')});
    await page.locator('.pp-cover').scrollIntoViewIfNeeded();
    const coverBox=await page.locator('.pp-cover').boundingBox();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:coverBox.x+coverBox.width*.8,y:coverBox.y+coverBox.height/2}]});
    for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:coverBox.x+coverBox.width*(.8-i*.07),y:coverBox.y+coverBox.height/2}]});await page.waitForTimeout(20);}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForFunction(()=>PASSPORT.open);
    assert(await page.locator('.pp-turning-leaf').isVisible());assert(await page.locator('.pp-identity').isVisible());
    await page.waitForFunction(()=>!PASSPORT.busy);assert(await page.locator('.pp-visas').isVisible());assert(await page.locator('.pp-blank-stamp').isVisible());assert.equal(await page.locator('#passportMap').count(),0);
    await page.locator('[data-passport-browse]').click();
    assert(!(await page.locator('#browse').innerText()).includes('快照'));
    assert(!(await page.locator('#browse').innerText()).includes('数据更新'));
    assert(!(await page.locator('#travelControls').isVisible()));
    if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'directory-mobile.png')});
    const u=await page.evaluate(()=>DB.rows.find(r=>r.n==='Arpège').u);
    await page.evaluate(u=>{FAV[u]=[2,1700000000000];saveFav();},u);
    await page.fill('#q','Paris 法式');await page.waitForTimeout(300);assert((await page.locator('.restaurant-title').count())>0);
    await page.fill('#q','Geranuium');await page.waitForTimeout(300);assert.equal(await page.locator('#count').innerText(),'1 家');assert(await page.locator('#searchNote').isVisible());
    await page.fill('#q','');await page.waitForTimeout(300);
    await page.locator('#tabbar [data-tab="me"]').click();assert((await page.locator('#passportContent').innerText()).includes('1 家餐厅'));
    await page.locator('#newTrip').click();await page.fill('#tripName','2026 欧洲旅行');await page.locator('#tripForm button').click();
    await page.locator('#tabbar [data-tab="list"]').click();await page.locator('.restaurant-title').first().click();await page.locator('[data-trip-pick]').first().click();await page.locator('#tripPickChoices input').check();await page.locator('#tripPickForm button').click();
    const trip=await page.evaluate(()=>PERSONAL.trips[0]);assert.equal(trip.items.length,1);await page.locator('#detailDlg .close[data-close]').click();
    await page.locator('.restaurant-title').first().click();assert(new URL(page.url()).searchParams.get('restaurant'));
    assert.equal(await page.locator('#detailTitle').evaluate(el=>getComputedStyle(el).outlineStyle),'none');
    assert(!(await page.locator('#detailBody').innerText()).includes('快照'));
    assert(await page.locator('.detail-record').evaluate(el=>el.open));await page.fill('#visitDate','2026-11-26');await page.locator('[data-rating-star="4"]').click({position:{x:6,y:18}});assert.equal(await page.inputValue('#visitRating'),'3.5');await page.locator('#starRating').press('ArrowRight');assert.equal(await page.inputValue('#visitRating'),'4');await page.locator('#starRating').press('ArrowLeft');await page.fill('#visitNote','旅途笔记 <script>');await page.locator('#visitForm button[type="submit"]').click();
    assert.equal(await page.evaluate(()=>favOf(document.getElementById('detailDlg').dataset.u)),2); // saving the rating marks 去过
    assert(!(await page.locator('#detailDlg').evaluate(d=>d.open)));assert((await page.locator('#toast').innerText()).includes('已保存'));
    await page.locator('.restaurant-title').first().click();assert.equal(await page.inputValue('#visitNote'),'旅途笔记 <script>');
    assert.equal(await page.inputValue('#visitRating'),'3.5');
    const historyHTML=await page.evaluate(()=>upHistory({h:'--g2',l:1}));assert(!/2022|2023|2024|暂无记录/.test(historyHTML));assert(historyHTML.includes('2025')&&historyHTML.includes('2026'));
    // Body scrolling is preserved; the persistent header dismisses from any depth in one short swipe.
    assert(await page.locator('.detail-record').evaluate(el=>el.open));
    await page.evaluate(()=>{const d=document.getElementById('detailDlg'),target=document.getElementById('detailTitle');
      const swipe=()=>{const fire=(type,y)=>{const t=new Touch({identifier:1,target,clientX:100,clientY:y});target.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[t],changedTouches:[t]}));};fire('touchstart',100);fire('touchmove',230);fire('touchend',230);};
      d.scrollTop=150;swipe();if(!d.open)throw new Error('Closed during inner scroll');d.scrollTop=0;swipe();});
    await page.waitForFunction(()=>!document.getElementById('detailDlg').open&&!new URL(location.href).searchParams.has('restaurant'));
    await page.locator('.restaurant-title').first().click();
    const detailURL=page.url();await page.reload();await page.waitForSelector('#detailDlg[open]');assert.equal(await page.inputValue('#visitNote'),'旅途笔记 <script>');assert.equal(page.url(),detailURL);assert.equal(await page.inputValue('#visitRating'),'3.5');
    if(process.env.SCREENSHOT_DIR){await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'detail-mobile.png')});assert(await page.locator('.detail-record').evaluate(el=>el.open));await page.locator('#starRating').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'rating-mobile.png')});}
    await page.locator('#detailDlg .close[data-close]').click();
    // An open restaurant freezes the visual background, including gestures at scroll edges.
    const background=await page.evaluate(()=>{window.scrollTo(0,500);return {y:scrollY,top:document.getElementById('list').getBoundingClientRect().top};});
    await page.evaluate(()=>upOpenDetail(DB.rows[0].u));assert(await page.locator('.detail-record').evaluate(el=>el.open));
    const assertFrozen=async()=>{const state=await page.evaluate(()=>({fixed:getComputedStyle(document.body).position,top:document.getElementById('list').getBoundingClientRect().top}));assert.equal(state.fixed,'fixed');assert(Math.abs(state.top-background.top)<1,'Background must not move behind the modal');};
    await assertFrozen();
    let detailBox=await page.locator('#detailDlg').boundingBox();await touchSwipe(detailBox.x+8,detailBox.y+detailBox.height-65,-180);
    await page.waitForFunction(()=>document.getElementById('detailDlg').scrollTop>30);await assertFrozen();
    await page.evaluate(()=>{const d=document.getElementById('detailDlg');d.scrollTop=d.scrollHeight;});
    await touchSwipe(detailBox.x+8,detailBox.y+detailBox.height-65,-130);await assertFrozen();
    await touchSwipe(3,550,-160);await assertFrozen();assert(await page.locator('#detailDlg').evaluate(d=>d.open));
    // Closing a nested picker must keep the outer restaurant and background lock intact.
    await page.evaluate(()=>upPickTrip(DB.rows[0].u));await page.locator('#tripPickDlg [data-close]').click();
    assert(await page.locator('#detailDlg').evaluate(d=>d.open));await assertFrozen();
    await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
    await page.waitForFunction(y=>scrollY===y,background.y);assert.equal(await page.evaluate(()=>getComputedStyle(document.body).position),'static');
    await page.evaluate(()=>window.scrollTo(0,0));
    // "去过" and the rating are one record: the list button opens the same form, and saving marks the visit.
    await page.locator('#tabbar [data-tab="list"]').click();
    const [quick,noteOnly]=await page.evaluate(()=>[...new Set([...document.querySelectorAll('.fav[data-v="2"]')].map(x=>x.dataset.u))].filter(u=>!favOf(u)&&!PERSONAL.records[u]).slice(0,2));
    const visitBtn=u=>page.locator(`.fav[data-v="2"][data-u="${u}"]`).first();
    await visitBtn(quick).click();assert(await page.locator('#visitDlg').evaluate(d=>d.open));
    assert.equal(await page.inputValue('#qvisitDate'),'');await page.fill('#qvisitDate','2024-06-12');
    await page.locator('#visitDlg [data-rating-star="5"]').click({position:{x:30,y:18}});assert.equal(await page.inputValue('#qvisitRating'),'5');
    await page.locator('#visitDlg button[type="submit"]').click();
    assert(!(await page.locator('#visitDlg').evaluate(d=>d.open)));
    assert.equal(await page.evaluate(u=>favOf(u),quick),2);assert.equal(await page.evaluate(u=>PERSONAL.records[u].rating,quick),5);
    assert.equal(await page.evaluate(u=>PERSONAL.records[u].date,quick),'2024-06-12');
    assert.equal(await visitBtn(quick).innerText(),'去过 ★5');
    // Clearing a score is a draft until Save; reopening after saving must keep zero.
    await visitBtn(quick).click();await page.locator('#visitDlg [data-clear-rating]').click();
    assert((await page.locator('#visitDlg .visit-feedback').innerText()).includes('尚未保存'));
    await page.locator('#visitDlg button[type="submit"]').click();await visitBtn(quick).click();assert.equal(await page.inputValue('#qvisitRating'),'0');
    await page.locator('#visitDlg [data-rating-star="5"]').click({position:{x:30,y:18}});await page.locator('#visitDlg button[type="submit"]').click();
    await visitBtn(quick).click();assert(await page.locator('#visitDlg .visit-status.is-been').isVisible());
    await page.locator('#visitDlg [data-unvisit]').click();
    assert(await page.locator('#visitDlg').evaluate(d=>d.open));assert.equal(await page.inputValue('#qvisitRating'),'0');assert.equal(await page.inputValue('#qvisitDate'),'');await page.locator('#visitDlg button[type="submit"]').click();
    assert.equal(await page.evaluate(u=>favOf(u),quick),0);assert.equal(await page.evaluate(u=>PERSONAL.records[u].rating,quick),0);
    assert.equal(await visitBtn(quick).innerText(),'去过');
    await visitBtn(noteOnly).click();await page.locator('#visitDlg [data-unvisit]').click();await page.fill('#qvisitNote','先存个预约提示');await page.locator('#visitDlg button[type="submit"]').click();
    assert.equal(await page.evaluate(u=>favOf(u),noteOnly),0);assert.equal(await page.evaluate(u=>PERSONAL.records[u].note,noteOnly),'先存个预约提示');
    await visitBtn(quick).click();assert.equal(await page.inputValue('#qvisitRating'),'0');await page.locator('#visitDlg [data-rating-star="5"]').click({position:{x:30,y:18}});await page.locator('#visitDlg button[type="submit"]').click();
    if(process.env.SCREENSHOT_DIR){await visitBtn(quick).click();await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'visit-sheet-mobile.png')});await page.locator('#visitDlg .close[data-close]').click();}
    await page.locator('#tabbar [data-tab="me"]').click();await page.locator('[data-m="2"]').click();await page.locator('#orderScore').click();
    assert.equal(await page.locator('#meList .restaurant-title').first().getAttribute('data-restaurant'),quick); // 5 stars ranks first
    await page.locator('[data-m="1"]').click();assert(await page.locator('#orderScore').isHidden());
    const downloadPromise=page.waitForEvent('download');await page.locator('#exportBtn').click();const download=await downloadPromise;const backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(backup.version,2);assert.equal(backup.personal.trips[0].items.length,1);assert.equal(Object.values(backup.personal.records)[0].rating,3.5);
    await page.evaluate(()=>{PERSONAL={version:2,trips:[],records:{}};upSave(PERSONAL);FAV={};saveFav();});
    await page.locator('#importBtn').click();await page.fill('#impText',JSON.stringify(backup));await page.locator('#impGo').click();assert.equal(await page.evaluate(()=>PERSONAL.trips.length),1);assert.equal(await page.evaluate(u=>favOf(u),u),2);
    await page.locator('#importBtn').click();await page.fill('#impText',JSON.stringify({app:'michelin-guide',version:1,items:[{u,state:'want',at:1}]}));await page.locator('#impGo').click();assert.equal(await page.evaluate(u=>favOf(u),u),2); // v1 must not downgrade been.
    if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'me-mobile.png'),fullPage:true});
    await page.locator('[data-trip-open]').first().click();await page.fill('#tripName','欧洲觅食');await page.locator('#tripForm button').click();assert((await page.locator('#tripCards').innerText()).includes('欧洲觅食'));
    await page.locator('[data-trip-map]').first().click();await page.waitForFunction(()=>MAP.ready&&MAP.layer);assert.equal(await page.evaluate(()=>MAP.layer.getLayers().length),1);
    const boundState=await page.evaluate(()=>{MAP.m.panTo([89,600],{animate:false});MAP.m.panInsideBounds(MAP.m.options.maxBounds,{animate:false});const c=MAP.m.getCenter();return {lat:c.lat,lng:c.lng,min:MAP.m.options.minZoom};});assert(Math.abs(boundState.lat)<85);assert(Math.abs(boundState.lng)<=180);assert.equal(boundState.min,0);await page.locator('#fitMap').click();
    // Real touch events: a single-finger swipe over the map must scroll the document.
    async function swipeMap(){
      await page.locator('#map').scrollIntoViewIfNeeded();
      const box=await page.locator('#map').boundingBox(),x=box.x+box.width*.4,y=Math.min(box.y+box.height-30,700);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
      await page.waitForTimeout(80);
      for(let step=1;step<=8;step++){
        await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-step*20}]});
        await page.waitForTimeout(20);
      }
      await page.waitForTimeout(150); // End without momentum spilling into the next interaction.
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    }
    assert.equal(await page.locator('.restaurant-pin').count(),1);
    assert.equal(await page.locator('#list .map-index').first().innerText(),'1');
    assert(await page.evaluate(()=>L.Browser.retina&&MAP.tiles.options.detectRetina));
    await page.locator('#map').scrollIntoViewIfNeeded();
    let scrollBefore=await page.evaluate(()=>scrollY),centerBefore=await page.evaluate(()=>MAP.m.getCenter());
    await swipeMap();await page.waitForFunction(y=>scrollY>y+40,scrollBefore);
    assert.deepEqual(await page.evaluate(()=>MAP.m.getCenter()),centerBefore);
    await page.locator('#mapInteract').click();assert.equal(await page.locator('#mapInteract').getAttribute('aria-pressed'),'true');
    await page.waitForTimeout(200); // Let the compositor apply the new touch-action before a trusted touch gesture.
    await page.locator('#map').scrollIntoViewIfNeeded();scrollBefore=await page.evaluate(()=>scrollY);centerBefore=await page.evaluate(()=>MAP.m.getCenter());
    await swipeMap();
    await page.waitForFunction(ll=>Math.abs(MAP.m.getCenter().lat-ll.lat)>.00001,centerBefore);
    assert(Math.abs((await page.evaluate(()=>scrollY))-scrollBefore)<10,'Moving the map must not scroll the page');
    await page.locator('#mapListJump').click();assert.equal(await page.locator('#mapInteract').getAttribute('aria-pressed'),'false');
    await page.waitForFunction(()=>{const r=document.getElementById('mapResults').getBoundingClientRect();return r.top>=document.getElementById('controls').getBoundingClientRect().bottom&&r.bottom<innerHeight;});
    await page.locator('#fitMap').click();await page.waitForFunction(()=>MAP.m.getBounds().contains(MAP.layer.getLayers()[0].getLatLng()));
    assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));
    if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'trip-map-mobile.png')});
    // One trip spanning multiple cities includes all members, regardless of visited status.
    const tripFixture=await page.evaluate(()=>{const t=PERSONAL.trips[0],first=DB.byU[t.items[0]],other=DB.rows.find(r=>r.ci!==first.ci);t.items.push(other.u);FAV[first.u]=[2,Date.now()];saveFav();upSave(PERSONAL);render();return {id:t.id,firstCity:first.ci,otherCity:other.ci};});
    await page.selectOption('#tripCityFilter',String(tripFixture.otherCity));
    await page.waitForFunction(ci=>S.ci===String(ci)&&MAP.layer.getLayers().length===1,tripFixture.otherCity);
    assert(await page.evaluate(ci=>filtered().every(r=>r.ci===ci),tripFixture.otherCity));
    await page.selectOption('#tripCityFilter','');await page.waitForFunction(()=>MAP.layer.getLayers().length===2);
    await page.locator('#tabbar [data-tab="me"]').click();assert.equal(await page.locator('[data-trip-city-map]').count(),2);
    await page.locator('[data-trip-open]').first().click();assert.equal(await page.locator('#tripItems .city').count(),2);await page.locator('#tripDlg [data-close]').click();
    await page.locator('[data-trip-city-map]').last().click();await page.waitForFunction(()=>MAP.ready&&MAP.layer.getLayers().length===1);assert(await page.locator('#travelMapTitle').isVisible());
    await page.waitForFunction(()=>filtered().filter(r=>r.lat!=null).every(r=>MAP.m.getBounds().contains(MAP.amap?[r.glat,r.glng]:[r.lat,r.lng])));
    if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'travel-city-map.png')});
    // Footprint map exports show only restaurants I have visited; planned trip members never appear on the card.
    const favBeforeMapShare=await page.evaluate(()=>JSON.stringify(FAV));
    await page.locator('[data-share-map]').click();await page.waitForFunction(()=>!!PASSPORT_SHARE.file);
    assert.equal(await page.evaluate(()=>PASSPORT_SHARE.kind),'map');assert.equal(await page.evaluate(()=>PASSPORT_SHARE.rows.length),1);
    assert(await page.evaluate(()=>PASSPORT_SHARE.rows.every(r=>favOf(r.u)===2)));
    assert((await page.locator('#shareStatus').innerText()).includes('地图已加载'));
    let png=await page.evaluate(async()=>Array.from(new Uint8Array(await PASSPORT_SHARE.file.arrayBuffer())));let mapPNG=Buffer.from(png);assert.equal(mapPNG.readUInt32BE(16),1080);assert.equal(mapPNG.readUInt32BE(20),1440);
    await page.locator('#passportShareDlg [data-close]').click();
    await page.evaluate(u=>{FAV[u]=[2,Date.now()];saveFav();render();},await page.evaluate(()=>PERSONAL.trips[0].items[1]));
    await page.locator('[data-share-map]').click();await page.waitForFunction(()=>!!PASSPORT_SHARE.file);assert.equal(await page.evaluate(()=>PASSPORT_SHARE.rows.length),2);
    png=await page.evaluate(async()=>Array.from(new Uint8Array(await PASSPORT_SHARE.file.arrayBuffer())));mapPNG=Buffer.from(png);assert.equal(mapPNG.readUInt32BE(20),1680);
    if(process.env.SCREENSHOT_DIR)fs.writeFileSync(path.join(process.env.SCREENSHOT_DIR,'travel-map-card.png'),mapPNG);
    await page.locator('#shareSettings>summary').click();await page.selectOption('#shareCity',String(tripFixture.otherCity));await page.waitForFunction(()=>!!PASSPORT_SHARE.file);assert.equal(await page.evaluate(()=>PASSPORT_SHARE.rows.length),1);
    await page.locator('#passportShareDlg [data-close]').click();
    const mapLongFixture=await page.evaluate(()=>{const t=PERSONAL.trips[0],items=t.items.slice(),third=DB.rows.find(r=>!items.includes(r.u));t.items.push(third.u);FAV[third.u]=[2,Date.now()];saveFav();const names=t.items.map(u=>({u,zh:DB.byU[u].zh}));names.forEach(x=>DB.byU[x.u].zh='Restaurant Maison de la Gastronomie — 旅途中值得多次到访的餐厅与旅行纪念');return {items,names};});
    await page.locator('[data-share-map]').click();await page.waitForFunction(()=>!!PASSPORT_SHARE.file);await page.locator('#shareSettings>summary').click();await page.fill('#shareTitle','从上海到世界各地的美食旅行记录与难忘相遇珍藏册');await page.waitForFunction(()=>!!PASSPORT_SHARE.file);
    png=await page.evaluate(async()=>Array.from(new Uint8Array(await PASSPORT_SHARE.file.arrayBuffer())));mapPNG=Buffer.from(png);assert.equal(mapPNG.readUInt32BE(20),1920);if(process.env.SCREENSHOT_DIR)fs.writeFileSync(path.join(process.env.SCREENSHOT_DIR,'travel-map-card-long-text.png'),mapPNG);
    await page.locator('#passportShareDlg [data-close]').click();await page.evaluate(saved=>{PERSONAL.trips[0].items=saved.items;saved.names.forEach(x=>{if(x.zh===undefined)delete DB.byU[x.u].zh;else DB.byU[x.u].zh=x.zh;});},mapLongFixture);
    // A failed basemap still produces a clearly labelled geographic schematic, never a broken PNG.
    await page.evaluate(()=>PASSPORT_SHARE.tiles.forEach((v,k)=>PASSPORT_SHARE.tiles.set(k,Promise.resolve(null))));
    await page.locator('[data-share-map]').click();await page.waitForFunction(()=>!!PASSPORT_SHARE.file);assert((await page.locator('#shareStatus').innerText()).includes('位置示意图'));
    if(process.env.SCREENSHOT_DIR){png=await page.evaluate(async()=>Array.from(new Uint8Array(await PASSPORT_SHARE.file.arrayBuffer())));fs.writeFileSync(path.join(process.env.SCREENSHOT_DIR,'travel-map-fallback.png'),Buffer.from(png));}
    await page.locator('#passportShareDlg [data-close]').click();
    await page.evaluate(()=>PASSPORT_SHARE.tiles.clear());
    await page.evaluate(saved=>{FAV=JSON.parse(saved);saveFav();render();},favBeforeMapShare);
    await page.evaluate(id=>{PERSONAL.trips[0].items=PERSONAL.trips[0].items.slice(0,1);upSave(PERSONAL);upApplyTrip(id);render();},tripFixture.id);
    await page.locator('#tabbar [data-tab="list"]').click();await page.locator('#exitJourney').click();
    assert.equal(await page.locator('#budgetPanel').count(),0);await page.evaluate(()=>{S.budget=300;S.currency='EUR';render();});assert.equal(await page.locator('#count').innerText(),'19,721 家');assert(!page.url().includes('budget='));
    await page.evaluate(()=>{S.budget=0;S.change='streak';render();});assert(await page.locator('#annualCard').evaluate(el=>el.open));assert(await page.evaluate(()=>filtered().every(r=>r.h==='0000'&&r.l===0)));
    await page.evaluate(()=>{S.change='';render();});
    await page.setViewportSize({width:1280,height:900});await page.locator('#tabsTop [data-tab="me"]').click();
    assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));
    if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'me-desktop.png'),fullPage:true});
    // Exercise a full passport with multiple stamp pages, including narrow and dark layouts.
    const savedFavourites=await page.evaluate(()=>JSON.stringify(FAV));
    await page.evaluate(()=>{const seen=new Set();for(const r of DB.rows){if(!seen.has(r.co)){seen.add(r.co);FAV[r.u]=[2,Date.now()];}if(seen.size===9)break;}PASSPORT.open=true;PASSPORT.sheet=0;render();});
    assert(await page.locator('.pp-identity').isVisible());assert(await page.locator('.pp-visas').isVisible());
    assert.equal(await page.locator('.pp-stamp').count(),4);
    if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'passport-spread.png'),fullPage:true});
    await page.setViewportSize({width:320,height:800});await page.waitForFunction(()=>!PASSPORT.busy);await page.locator('[data-passport-next]').click();await page.waitForFunction(()=>!PASSPORT.busy);assert.equal(await page.locator('.pp-stamp').count(),4);
    await page.locator('.pp-book').scrollIntoViewIfNeeded();const spreadBox=await page.locator('.pp-book').boundingBox();
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:spreadBox.x+spreadBox.width*.85,y:spreadBox.y+spreadBox.height*.5}]});
    for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:spreadBox.x+spreadBox.width*.85-i*10,y:spreadBox.y+spreadBox.height*.5}]});await page.waitForTimeout(20);}
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForFunction(()=>PASSPORT.sheet===2);
    assert(await page.locator('.pp-turning-leaf').isVisible());if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'passport-page-turn.png')});await page.waitForFunction(()=>!PASSPORT.busy);assert(await page.locator('[data-passport-next]').isDisabled());assert(await page.locator('.pp-stamp').count()>=1);
    assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));
    await page.waitForFunction(()=>!PASSPORT.busy);await page.locator('[data-passport-prev]').click();await page.waitForFunction(()=>!PASSPORT.busy);assert.equal(await page.locator('.pp-stamp').count(),4);
    if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'passport-stamps-mobile.png')});
    await page.evaluate(()=>applyTheme('dark'));
    if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'passport-dark.png')});
    assert.equal(await page.locator('[data-passport-country],#passportMap').count(),0);
    assert.equal(await page.locator('button.pp-stamp').count(),0);
    await page.evaluate(saved=>{FAV=JSON.parse(saved);saveFav();S.v='me';applyTheme('light');render();},savedFavourites);
    await page.locator('[data-passport-close]').click();assert(await page.locator('.pp-cover').isVisible());
    // One short pull on the sticky header dismisses a long, scrolled restaurant sheet.
    await page.evaluate(()=>upOpenDetail(DB.rows[0].u));assert(await page.locator('.detail-record').evaluate(el=>el.open));
    await page.evaluate(()=>{const d=document.getElementById('detailDlg');d.scrollTop=d.scrollHeight;const target=d.querySelector('.detail-drag');const fire=(type,y)=>{const t=new Touch({identifier:2,target,clientX:120,clientY:y});target.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:type==='touchend'?[]:[t],changedTouches:[t]}));};fire('touchstart',90);fire('touchmove',128);fire('touchend',128);});
    await page.waitForFunction(()=>!document.getElementById('detailDlg').open);
    // A failed second storage write rolls back both record and visited status.
    const rollback=await page.evaluate(()=>{const u=DB.rows[0].u,old=localStorage.getItem('mg-personal'),fav=localStorage.getItem('mg-fav'),set=Storage.prototype.setItem;let failed=false;Storage.prototype.setItem=function(k,v){if(k==='mg-fav'&&!failed){failed=true;throw new Error('quota');}return set.call(this,k,v);};const ok=upSaveVisit(u,{date:'2020-01-01',rating:1,note:'must roll back'},true);Storage.prototype.setItem=set;return {ok,same:old===localStorage.getItem('mg-personal')&&fav===localStorage.getItem('mg-fav')};});assert.deepEqual(rollback,{ok:false,same:true});
    // Default-open sections and independent repeated meals: append, edit, delete, reload.
    const repeatSaved=await page.evaluate(()=>({fav:JSON.stringify(FAV),personal:JSON.stringify(PERSONAL)}));
    const repeatU=await page.evaluate(()=>DB.rows[0].u);await page.evaluate(u=>upOpenDetail(u),repeatU);
    assert(await page.locator('.detail-record').evaluate(el=>el.open));
    if(await page.locator('.detail-history').count())assert(await page.locator('.detail-history').evaluate(el=>el.open));
    const initialMeals=await page.evaluate(u=>upVisits(u).length,repeatU);
    await page.locator('#detailDlg [data-add-visit]').click();assert.equal(await page.inputValue('#visitDate'),'');assert.equal(await page.inputValue('#visitRating'),'0');
    await page.fill('#visitDate','2024-02-03');await page.fill('#visitNote','second meal survives');await page.locator('#starRating').press('End');await page.locator('#visitForm button[type=submit]').click();
    await page.evaluate(u=>upOpenDetail(u),repeatU);assert.equal(await page.locator('#detailDlg .visit-entry').count(),initialMeals+1);
    await page.locator('#detailDlg [data-add-visit]').click();await page.fill('#visitDate','2024-05-06');await page.fill('#visitNote','third meal survives');await page.locator('#starRating').press('End');await page.locator('#starRating').press('ArrowLeft');await page.locator('#visitForm button[type=submit]').click();
    await page.reload();await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&upLoaded);await page.evaluate(u=>upOpenDetail(u),repeatU);
    assert.equal(await page.locator('#detailDlg .visit-entry').count(),initialMeals+2);
    await page.locator('#detailDlg [data-edit-visit]').nth(initialMeals).click();assert.equal(await page.inputValue('#visitNote'),'second meal survives');await page.fill('#visitNote','second meal edited');await page.locator('#visitForm button[type=submit]').click();
    assert.equal(await page.evaluate(u=>upVisits(u).at(-1).note,repeatU),'third meal survives');
    await page.evaluate(u=>upOpenDetail(u),repeatU);await page.locator('#detailDlg [data-delete-visit]').nth(initialMeals).click();assert.equal(await page.locator('#detailDlg .visit-entry').count(),initialMeals+1);assert.equal(await page.evaluate(u=>upVisits(u).at(-1).note,repeatU),'third meal survives');
    for(let i=0;i<8;i++)await page.evaluate(u=>upSaveVisit(u,{date:'2024-06-01',rating:4,note:'repeat'},true,'new'),repeatU);
    assert.equal(await page.evaluate(u=>upVisits(u).length,repeatU),initialMeals+9);
    await page.locator('#detailDlg .close[data-close]').click();
    await page.evaluate(()=>{upOpenShare('');document.getElementById('shareFrom').value='2024-05-01';document.getElementById('shareTo').value='2024-05-31';upRenderShare();});await page.waitForFunction(()=>!!PASSPORT_SHARE.file);
    assert(await page.evaluate(u=>PASSPORT_SHARE.rows.some(r=>r.u===u),repeatU));assert.equal(await page.evaluate(u=>upShareRecord(DB.byU[u]).date,repeatU),'2024-05-06');assert.equal(await page.evaluate(u=>upShareRecord(DB.byU[u]).rating,repeatU),4.5);
    await page.locator('#passportShareDlg [data-close]').click();await page.evaluate(saved=>{FAV=JSON.parse(saved.fav);PERSONAL=JSON.parse(saved.personal);saveFav();upSave(PERSONAL);S.v='me';render();},repeatSaved);
    // Generated share cards use all real visits, paginate, export PNG, and scope to a trip.
    const shareSaved=await page.evaluate(()=>({fav:JSON.stringify(FAV),personal:JSON.stringify(PERSONAL)}));
    await page.evaluate(()=>{const rs=DB.rows.slice(0,7);FAV=Object.create(null);PERSONAL.records=Object.create(null);rs.forEach((r,i)=>{FAV[r.u]=[2,Date.now()-i];PERSONAL.records[r.u]={date:'2025-06-'+String(i+1).padStart(2,'0'),rating:i===0?3.5:4,note:'PRIVATE_NOTE_NEVER_ON_CARD'};});upSave(PERSONAL);saveFav();render();});
    await page.locator('[data-passport-share]').click();await page.waitForFunction(()=>!!PASSPORT_SHARE.file);
    await page.waitForFunction(()=>document.getElementById('sharePreview').complete&&document.getElementById('sharePreview').naturalWidth>0);
    const previewBox=await page.locator('#sharePreview').boundingBox(),saveBox=await page.locator('#passportShareDlg .share-actions').boundingBox();assert(previewBox.y>=0&&previewBox.y+previewBox.height<=saveBox.y,'Default mobile preview must show the complete exported card above Save');
    if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'share-mobile-default.png')});
    assert.equal(await page.locator('#sharePage').innerText(),'1 / 2');assert((await page.locator('#shareStatus').innerText()).includes('7 家'));assert(/地图已加载|位置示意图/.test(await page.locator('#shareStatus').innerText()));
    await page.locator('#shareSettings>summary').click();await page.fill('#shareTitle','我的味觉旅行');await page.waitForFunction(()=>!!PASSPORT_SHARE.file);
    if(process.env.SCREENSHOT_DIR){await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'share-mobile.png'),fullPage:true});const card=await page.locator('#sharePreview').getAttribute('src');const png=await page.evaluate(async src=>Array.from(new Uint8Array(await (await fetch(src)).arrayBuffer())),card);fs.writeFileSync(path.join(process.env.SCREENSHOT_DIR,'share-card.png'),Buffer.from(png));}
    const shareDownloadPromise=page.waitForEvent('download');await page.locator('#saveShare').click();const shareDownload=await shareDownloadPromise,sharePNG=fs.readFileSync(await shareDownload.path());assert.equal(sharePNG.readUInt32BE(16),1080);assert.equal(sharePNG.readUInt32BE(20),2052); // passport card now carries the footprint map
    const longOriginal=await page.evaluate(()=>{const rows=PASSPORT_SHARE.rows.slice(0,4);const original=rows.map(r=>({u:r.u,zh:r.zh}));rows.forEach(r=>r.zh='Restaurant Maison de la Gastronomie — 世界各地旅行途中反复到访的餐厅长名称');return original;});
    await page.fill('#shareTitle','从上海到世界各地的美食旅行记录与难忘相遇珍藏册');await page.waitForFunction(()=>!!PASSPORT_SHARE.file);
    if(process.env.SCREENSHOT_DIR){const png=await page.evaluate(async()=>Array.from(new Uint8Array(await PASSPORT_SHARE.file.arrayBuffer())));fs.writeFileSync(path.join(process.env.SCREENSHOT_DIR,'share-card-long-text.png'),Buffer.from(png));}
    await page.evaluate(original=>original.forEach(x=>{if(x.zh===undefined)delete DB.byU[x.u].zh;else DB.byU[x.u].zh=x.zh;}),longOriginal);
    await page.locator('#shareNext').click();await page.waitForFunction(()=>!!PASSPORT_SHARE.file);assert.equal(await page.locator('#sharePage').innerText(),'2 / 2');
    await page.locator('#shareDateOptions>summary').click();await page.fill('#shareFrom','2030-01-01');await page.locator('#shareFrom').dispatchEvent('change');
    assert(await page.locator('#saveShare').isDisabled());assert(await page.locator('#sharePreview').isHidden());assert(await page.locator('#shareEmpty').isVisible());
    await page.fill('#shareFrom','');await page.locator('#shareFrom').dispatchEvent('change');await page.waitForFunction(()=>!!PASSPORT_SHARE.file);
    await page.setViewportSize({width:1280,height:900});if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'share-desktop.png'),fullPage:true});assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));
    await page.locator('#passportShareDlg [data-close]').click();
    await page.evaluate(saved=>{FAV=JSON.parse(saved.fav);PERSONAL=JSON.parse(saved.personal);saveFav();upSave(PERSONAL);render();},shareSaved);
    await page.locator('[data-share-trip]').first().click();await page.waitForFunction(()=>!!PASSPORT_SHARE.file);assert.equal(await page.evaluate(()=>PASSPORT_SHARE.rows.length),1);await page.locator('#passportShareDlg [data-close]').click();
    // Desktop wheel scrolling over the map also reaches the list without changing zoom.
    await page.setViewportSize({width:1280,height:900});
    await page.locator('#tabsTop [data-tab="list"]').click();
    const desktopBackground=await page.evaluate(()=>{window.scrollTo(0,600);return {y:scrollY,top:document.getElementById('list').getBoundingClientRect().top};});
    await page.evaluate(()=>upOpenDetail(DB.rows[0].u));assert(await page.locator('.detail-record').evaluate(el=>el.open));
    detailBox=await page.locator('#detailDlg').boundingBox();await page.mouse.move(detailBox.x+10,detailBox.y+detailBox.height/2);await page.mouse.wheel(0,700);
    await page.waitForFunction(()=>document.getElementById('detailDlg').scrollTop>30);
    assert(Math.abs((await page.locator('#list').boundingBox()).y-desktopBackground.top)<1);
    await page.locator('#detailDlg .close[data-close]').click();await page.waitForFunction(y=>scrollY===y,desktopBackground.y);
    assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('modal-scroll-locked')),false);
    await page.locator('#tabsTop [data-tab="map"]').click();await page.waitForFunction(()=>MAP.ready);
    await page.locator('#map').scrollIntoViewIfNeeded();
    const desktopMap=await page.locator('#map').boundingBox(),zoomBefore=await page.evaluate(()=>MAP.m.getZoom());scrollBefore=await page.evaluate(()=>scrollY);
    await page.mouse.move(desktopMap.x+desktopMap.width/2,desktopMap.y+desktopMap.height/2);await page.mouse.wheel(0,350);
    await page.waitForFunction(y=>scrollY>y+40,scrollBefore);assert.equal(await page.evaluate(()=>MAP.m.getZoom()),zoomBefore);
    await page.setViewportSize({width:320,height:800});assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));
    if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'map-narrow.png'),fullPage:true});
    await page.evaluate(()=>applyTheme('dark'));if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'map-dark.png'),fullPage:true});
    await page.evaluate(()=>applyTheme('light'));await page.locator('#tabbar [data-tab="me"]').click();
    // Upgrade a seeded v16 cache, keeping the existing data and all personal storage.
    const oldStore=await page.evaluate(()=>localStorage.getItem('mg-personal'));
    await page.evaluate(async previous=>{const c=await caches.open(previous);const req=new Request(new URL('data.json?v='+DATA_VER,location.href));await c.put(req,await fetch(req));await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;},previousCache);
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await page.waitForFunction(async previous=>!(await caches.keys()).includes(previous),previousCache);
    assert.equal(await page.evaluate(()=>localStorage.getItem('mg-personal')),oldStore);
    assert(await page.evaluate(async name=>!!await (await caches.open(name)).match(new URL('data.json?v='+DATA_VER,location.href).href),cacheName));
    await context.setOffline(true);await page.reload();await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&upLoaded);assert.equal(await page.evaluate(()=>DB.rows.length),19721);assert.equal(await page.evaluate(()=>PERSONAL.trips[0].name),'欧洲觅食');
    await page.locator('[data-passport-share]').click();await page.waitForFunction(()=>!!PASSPORT_SHARE.file);assert(await page.locator('#sharePreview').isVisible());
    await context.setOffline(false);assert.deepEqual(errors,[]);await context.close();
    console.log('PASS: share cards map only my visited restaurants (passport + footprint map, trip/city scope), touch-open passport, simultaneous mobile spread, animated touch page-turn, repeated meals append/edit/delete/reload/backup, bounded world map, map+dossier PNG/long text/fallback/city/planned members, measured share PNG/pagination/historical visit dates/offline export, draft clearing/custom dates/auto-close/storage rollback, sticky-header short swipe, compact directory, touch scroll over passive map, explicit map panning, list jump, desktop wheel scrolling, numbered pins, retina tiles, title focus, narrow/dark layouts, existing search/trips/ratings/backup regression and v16→current offline migration; no browser errors.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});

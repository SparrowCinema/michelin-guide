/* Optional browser regression: npm install --no-save playwright leaflet
   npx playwright install chromium && node tests/browser.cjs
   Browser binaries can also be selected with CHROMIUM_EXECUTABLE. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const base=path.resolve(__dirname,'..');
  const previousCache='mg-v8';
  const cacheName=fs.readFileSync(path.join(base,'sw.js'),'utf8').match(/const CACHE = "([^"]+)"/)[1];
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
    const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    // Only Leaflet assets/tiles are stubbed, so assertions do not depend on external map services.
    const leaflet=path.dirname(require.resolve(process.env.LEAFLET_MODULE||'leaflet'));
    await page.route(/https:\/\/.*leaflet.*\.(js|css)$/,route=>route.fulfill({path:path.join(leaflet,route.request().url().endsWith('.css')?'leaflet.css':'leaflet.js'),contentType:route.request().url().endsWith('.css')?'text/css':'text/javascript'}));
    await page.route(/https:\/\/.*(autonavi|arcgisonline|tile\.openstreetmap).*$/,route=>route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=','base64')}));
    await page.goto(url);await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&upLoaded);
    await page.locator('#tabbar [data-tab="me"]').click();
    assert(await page.locator('.pp-cover').isVisible());
    if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'passport-cover.png')});
    await page.locator('[data-passport-open]').click();assert(await page.locator('.pp-identity').isVisible());
    await page.locator('[data-passport-tab="stamps"]').click();assert(await page.locator('.pp-blank-stamp').isVisible());assert.equal(await page.locator('#passportMap').count(),0);
    await page.locator('[data-passport-browse]').click();
    const u=await page.evaluate(()=>DB.rows.find(r=>r.n==='Arpège').u);
    await page.evaluate(u=>{FAV[u]=[2,1700000000000];saveFav();},u);
    await page.fill('#q','Paris 法式');await page.waitForTimeout(300);assert((await page.locator('.restaurant-title').count())>0);
    await page.fill('#q','Geranuium');await page.waitForTimeout(300);assert.equal(await page.locator('#count').innerText(),'1 家');assert(await page.locator('#searchNote').isVisible());
    await page.fill('#q','');await page.waitForTimeout(300);
    await page.locator('#tabbar [data-tab="me"]').click();assert((await page.locator('#passportContent').innerText()).includes('1 家餐厅'));
    await page.locator('#newTrip').click();await page.fill('#tripName','2026 欧洲旅行');await page.locator('#tripForm button').click();
    await page.locator('#tabbar [data-tab="list"]').click();await page.locator('[data-trip-pick]').first().click();await page.locator('#tripPickChoices input').check();await page.locator('#tripPickForm button').click();
    const trip=await page.evaluate(()=>PERSONAL.trips[0]);assert.equal(trip.items.length,1);
    await page.locator('.restaurant-title').first().click();assert(new URL(page.url()).searchParams.get('restaurant'));
    await page.fill('#visitDate','2026-11-26');await page.selectOption('#visitRating','5');await page.fill('#visitNote','旅途笔记 <script>');await page.locator('#visitForm button').click();await page.locator('#detailDlg [data-close]').click();
    await page.locator('.restaurant-title').first().click();assert.equal(await page.inputValue('#visitNote'),'旅途笔记 <script>');
    const detailURL=page.url();await page.reload();await page.waitForSelector('#detailDlg[open]');assert.equal(await page.inputValue('#visitNote'),'旅途笔记 <script>');assert.equal(page.url(),detailURL);
    if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'detail-mobile.png')});
    await page.locator('#detailDlg [data-close]').click();
    await page.locator('#tabbar [data-tab="me"]').click();
    const downloadPromise=page.waitForEvent('download');await page.locator('#exportBtn').click();const download=await downloadPromise;const backup=JSON.parse(fs.readFileSync(await download.path(),'utf8'));assert.equal(backup.version,2);assert.equal(backup.personal.trips[0].items.length,1);
    await page.evaluate(()=>{PERSONAL={version:2,trips:[],records:{}};upSave(PERSONAL);FAV={};saveFav();});
    await page.locator('#importBtn').click();await page.fill('#impText',JSON.stringify(backup));await page.locator('#impGo').click();assert.equal(await page.evaluate(()=>PERSONAL.trips.length),1);assert.equal(await page.evaluate(u=>favOf(u),u),2);
    await page.locator('#importBtn').click();await page.fill('#impText',JSON.stringify({app:'michelin-guide',version:1,items:[{u,state:'want',at:1}]}));await page.locator('#impGo').click();assert.equal(await page.evaluate(u=>favOf(u),u),2); // v1 must not downgrade been.
    if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'me-mobile.png'),fullPage:true});
    await page.locator('[data-trip-open]').first().click();await page.fill('#tripName','欧洲觅食');await page.locator('#tripForm button').click();assert((await page.locator('#tripCards').innerText()).includes('欧洲觅食'));
    await page.locator('[data-trip-map]').first().click();await page.waitForFunction(()=>MAP.ready&&MAP.layer);assert.equal(await page.evaluate(()=>MAP.layer.getLayers().length),1);
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
    await page.evaluate(id=>{PERSONAL.trips[0].items=PERSONAL.trips[0].items.slice(0,1);upSave(PERSONAL);upApplyTrip(id);render();},tripFixture.id);
    await page.locator('#tabbar [data-tab="list"]').click();await page.locator('#exitJourney').click();
    await page.evaluate(()=>{S.budget=300;S.currency='EUR';render();});await page.waitForTimeout(200);assert.equal(await page.locator('#count').innerText(),'1 家');
    await page.evaluate(()=>{S.budget=0;S.change='streak';render();});assert(await page.evaluate(()=>filtered().every(r=>r.h==='0000'&&r.l===0)));
    await page.evaluate(()=>{S.change='';render();});
    await page.setViewportSize({width:1280,height:900});await page.locator('#tabsTop [data-tab="me"]').click();
    assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));
    if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'me-desktop.png'),fullPage:true});
    // Exercise a full passport with multiple stamp pages, including narrow and dark layouts.
    const savedFavourites=await page.evaluate(()=>JSON.stringify(FAV));
    await page.evaluate(()=>{const seen=new Set();for(const r of DB.rows){if(!seen.has(r.co)){seen.add(r.co);FAV[r.u]=[2,Date.now()];}if(seen.size===9)break;}PASSPORT.open=true;PASSPORT.tab='stamps';PASSPORT.sheet=0;render();});
    assert(await page.locator('.pp-identity').isVisible());assert(await page.locator('.pp-visas').isVisible());
    assert.equal(await page.locator('.pp-stamp').count(),4);
    if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'passport-spread.png'),fullPage:true});
    await page.setViewportSize({width:320,height:800});await page.locator('[data-passport-next]').click();assert.equal(await page.locator('.pp-stamp').count(),4);
    await page.locator('[data-passport-next]').click();assert(await page.locator('[data-passport-next]').isDisabled());assert(await page.locator('.pp-stamp').count()>=1);
    assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)));
    await page.locator('[data-passport-prev]').click();assert.equal(await page.locator('.pp-stamp').count(),4);
    if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'passport-stamps-mobile.png')});
    await page.evaluate(()=>applyTheme('dark'));
    if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'passport-dark.png')});
    assert.equal(await page.locator('[data-passport-country],#passportMap').count(),0);
    assert.equal(await page.locator('button.pp-stamp').count(),0);
    await page.evaluate(saved=>{FAV=JSON.parse(saved);saveFav();S.v='me';applyTheme('light');render();},savedFavourites);
    await page.locator('[data-passport-close]').click();assert(await page.locator('.pp-cover').isVisible());
    // Upgrade a seeded v8 cache, keeping the existing data and all personal storage.
    const oldStore=await page.evaluate(()=>localStorage.getItem('mg-personal'));
    await page.evaluate(async previous=>{const c=await caches.open(previous);const req=new Request(new URL('data.json?v='+DATA_VER,location.href));await c.put(req,await fetch(req));await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;},previousCache);
    await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await page.waitForFunction(async previous=>!(await caches.keys()).includes(previous),previousCache);
    assert.equal(await page.evaluate(()=>localStorage.getItem('mg-personal')),oldStore);
    assert(await page.evaluate(async name=>!!await (await caches.open(name)).match(new URL('data.json?v='+DATA_VER,location.href).href),cacheName));
    await context.setOffline(true);await page.reload();await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&upLoaded);assert.equal(await page.evaluate(()=>DB.rows.length),19721);assert.equal(await page.evaluate(()=>PERSONAL.trips[0].name),'欧洲觅食');
    await context.setOffline(false);assert.deepEqual(errors,[]);await context.close();
    console.log('PASS: mobile/desktop, search, trips, detail deep link, notes, v1/v2 backup, map markers, budget, snapshot filtering, passport cover/spread/pagination/empty state, v8→current offline migration; no browser errors.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});

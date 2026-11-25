// End-to-end verification of global i18n, performance, map clustering/split-view,
// active filters, sorting, search autocomplete, route customization, and sync QR/privacy.
const assert=require('node:assert/strict'),http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {chromium}=require('playwright');

(async()=>{
  const base=path.resolve(__dirname,'..');
  const swText=fs.readFileSync(path.join(base,'sw.js'),'utf8');
  const ver=swText.match(/const ASSET_VER = "([^"]+)"/)[1];
  const cssText=fs.readFileSync(path.join(base,'upgrade.css'),'utf8');
  const htmlText=fs.readFileSync(path.join(base,'index.html'),'utf8');
  // Font preload and @font-face must share the exact same asset version (no duplicate 1.2 MB download).
  assert(htmlText.includes('passport-editorial.woff2?v='+ver),'index.html preload font version mismatch');
  assert(cssText.includes('passport-editorial.woff2?v='+ver),'upgrade.css @font-face version mismatch');

  const server=http.createServer((req,res)=>{
    let p=path.resolve(base,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(p===base)p=path.join(base,'index.html');
    if(!p.startsWith(base+path.sep)){res.writeHead(403);return res.end();}
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'})[path.extname(p)]||'text/plain');
    try{res.end(fs.readFileSync(p));}catch(e){res.writeHead(404);res.end('');}
  });
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
  const url='http://127.0.0.1:'+server.address().port,shots=process.env.SCREENSHOT_DIR;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});

  try{
    const leaflet=path.dirname(require.resolve(process.env.LEAFLET_MODULE||'leaflet'));
    const stubRoutes=async ctx=>{
      await ctx.route(/^https:\/\/(?!127\.0\.0\.1|dclxhxxjktegyiwafmsv).*/,r=>r.fulfill({status:404,body:''}));
      await ctx.route(/https:\/\/.*(autonavi|arcgisonline|tile\.openstreetmap).*$/,r=>r.fulfill({status:200,headers:{'Access-Control-Allow-Origin':'*'},contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1sAAAAASUVORK5CYII=','base64')}));
      await ctx.route(/https:\/\/.*leaflet.*\.(js|css)$/,r=>r.fulfill({path:path.join(leaflet,r.request().url().endsWith('.css')?'leaflet.css':'leaflet.js')}));
    };

    // ---- 1. Desktop zh UX: autocomplete, active filters, sort, saved filters, map clustering + split-view ----
    const ctx=await browser.newContext({locale:'zh-CN',viewport:{width:1280,height:900}});
    await stubRoutes(ctx);
    const page=await ctx.newPage(),errors=[];
    page.on('pageerror',e=>errors.push('zh: '+e.message));
    const fontReqs=[];
    page.on('request',req=>{if(req.url().includes('passport-editorial.woff2'))fontReqs.push(req.url());});

    await page.goto(url+'/?lang=zh');
    await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&document.getElementById('mePassport'));
    assert.equal(new Set(fontReqs).size<=1,true,'editorial font should not be requested with two different versions: '+fontReqs.join(', '));

    // Search autocomplete
    await page.locator('#q').click();
    await page.locator('#q').type('Paris');
    await page.waitForSelector('#searchSuggest:not([hidden]) .sg-item');
    assert((await page.locator('#searchSuggest .sg-item').count())>=3,'autocomplete should list matching suggestions');
    await page.locator('#searchSuggest [data-sg-city]').first().click();
    await page.waitForFunction(()=>!document.getElementById('activeFilters').hidden);
    assert((await page.locator('#activeFilters .af-pill').count())>=2,'active filter chips should show country & city');
    if(shots)await page.screenshot({path:path.join(shots,'zh-desktop-filtered.png')});

    // Directory sort
    await page.selectOption('#dirSort','level');
    await page.waitForFunction(()=>S.so==='level');
    assert.equal(await page.locator('#list .lv').first().innerText(),'★★★');
    await page.selectOption('#dirSort','region');

    // Remove one active filter pill
    await page.locator('#activeFilters [data-rm-filter="ci"]').click();
    await page.waitForFunction(()=>S.ci==='');
    assert.equal(await page.locator('#activeFilters .af-pill').count(),1);
    await page.locator('#activeFilters [data-rm-filter="co"]').click();
    assert(await page.locator('#activeFilters').isHidden());

    // Saved status filter
    await page.evaluate(()=>{const [a,b]=DB.rows;FAV[a.u]=[1,Date.now()];FAV[b.u]=[2,Date.now()];saveFav();render();});
    await page.locator('#filterBtn').click();
    await page.locator('#savedFlags [data-sv="want"]').click();
    await page.locator('#doneSheet').click();
    assert.equal(await page.locator('#list .restaurant-title').count(),1);
    await page.locator('#activeFilters [data-rm-filter="sv"]').click();

    // Desktop Map split-view + Marker Clustering + List->Map locate
    await page.locator('#tabbar [data-tab="map"]').click();
    await page.waitForFunction(()=>MAP.ready&&MAP.layer);
    assert.equal(await page.locator('#browseStage').evaluate(el=>getComputedStyle(el).display),'grid','desktop map tab should use 2-column split view');
    assert((await page.locator('.map-cluster').count())>0,'overview map with >80 points should render clusters');
    if(shots)await page.screenshot({path:path.join(shots,'zh-desktop-map-split.png')});
    await page.locator('[data-map-focus]').first().click();
    await page.waitForFunction(()=>!!document.querySelector('.leaflet-popup-content'));

    // Detail: booking platform detection + hours link + Apple Maps on Mainland China
    const bookingU=await page.evaluate(()=>DB.rows.find(r=>/tablecheck\.com|resy\.com|opentable\.|exploretock\.com/i.test(r.w||''))?.u);
    if(bookingU){
      await page.evaluate(u=>upOpenDetail(u),bookingU);
      await page.waitForSelector('#detailDlg[open]');
      assert((await page.locator('#detailDlg .detail-actions').innerText()).includes('预约'),'booking platform should be detected');
      await page.evaluate(()=>closeAppDialog(document.getElementById('detailDlg')));
    }
    const mlU=await page.evaluate(()=>DB.rows.find(r=>r.ml)?.u);
    await page.evaluate(u=>upOpenDetail(u),mlU);
    assert((await page.locator('#detailDlg .address-tools').innerText()).includes('Apple 地图'));
    await page.evaluate(()=>closeAppDialog(document.getElementById('detailDlg')));

    // Me page: inline summary + 4-language selector + interactive route editing
    await page.locator('#tabbar [data-tab="me"]').click();
    assert(await page.locator('#meSummary').isVisible(),'Me page header should display inline personal summary');
    await page.locator('#meSettings>summary').click();
    assert.equal(await page.locator('#langSeg button').count(),4,'language selector should offer 4 locales');
    if(shots)await page.screenshot({path:path.join(shots,'zh-desktop-me.png')});

    // Interactive route editing (reorder + slot cycle + reset)
    const tripId=await page.evaluate(()=>{
      const tk=DB.rows.filter(r=>DB.T[r.ci][2]==='Tokyo'&&r.lat!=null&&r.l<=2).slice(0,3);
      const t=upNewTrip('Tokyo Edit');
      upSave({...PERSONAL,trips:PERSONAL.trips.map(x=>x.id===t.id?{...x,items:tk.map(r=>r.u)}:x)});
      render();return t.id;
    });
    await page.locator('#meTrips>summary').click();
    await page.locator(`[data-trip-route="${tripId}"]`).first().click();
    await page.waitForSelector('#routeDlg[open] .route-stop');
    const firstBefore=await page.locator('.route-stop .route-name b').first().innerText();
    await page.locator('.route-mv[data-route-move="1"]').first().click();
    const firstAfter=await page.locator('.route-stop .route-name b').first().innerText();
    assert.notEqual(firstBefore,firstAfter,'moving first stop down should reorder the itinerary');
    assert(await page.locator('[data-route-reset]').isVisible(),'reset optimal order button should appear');
    await page.locator('[data-route-slot]').first().click();
    await page.locator('[data-route-reset]').click();
    assert.equal(await page.locator('.route-stop .route-name b').first().innerText(),firstBefore);
    await page.evaluate(()=>closeAppDialog(document.getElementById('routeDlg')));

    // Sync QR pairing + privacy notice + cloud delete
    const cloudDb=new Map();
    const kOf=code=>crypto.createHash('sha256').update(code).digest('hex');
    await ctx.route(/^https:\/\/dclxhxxjktegyiwafmsv\.supabase\.co\/rest\/v1\/rpc\/(\w+)$/,async route=>{
      const fn=route.request().url().split('/').pop(),body=route.request().postDataJSON();
      if(fn==='mg_pull'){const r=cloudDb.get(kOf(body.code));return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(r?{rev:r.rev,data:r.data,photos:[]}:{rev:0,data:null})});}
      if(fn==='mg_push'){const k=kOf(body.code),r=cloudDb.get(k)||{rev:0};cloudDb.set(k,{rev:r.rev+1,data:body.data});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,rev:r.rev+1})});}
      if(fn==='mg_delete'){cloudDb.delete(kOf(body.code));return route.fulfill({status:200,contentType:'application/json',body:'true'});}
      return route.fulfill({status:200,contentType:'application/json',body:'true'});
    });
    await page.locator('#meSync>summary').click();
    assert(await page.locator('.sync-privacy').isVisible(),'privacy disclosure should be present');
    await page.locator('[data-sync="start"]').click();
    await page.waitForFunction(()=>MGSync._status().state==='ok');
    await page.locator('[data-sync="qr"]').click();
    assert(await page.locator('.sync-qr-svg').isVisible(),'QR pairing SVG should render');
    assert.equal(cloudDb.size,1);
    await page.locator('[data-sync="wipe"]').click();
    assert(await page.locator('[data-sync="wipe"].is-armed').isVisible(),'cloud delete requires two taps');
    await page.locator('[data-sync="wipe"]').click();
    await page.waitForFunction(()=>MGSync.state()===null);
    assert.equal(cloudDb.size,0,'cloud record should be deleted');
    await ctx.close();

    // ---- 2. Mobile Nearby location denied fallback ----
    const denyCtx=await browser.newContext({locale:'zh-CN',viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    await stubRoutes(denyCtx);
    const denyPage=await denyCtx.newPage();
    denyPage.on('pageerror',e=>errors.push('near: '+e.message));
    await denyPage.addInitScript(()=>{navigator.geolocation.getCurrentPosition=(ok,err)=>err({code:1,message:'denied'});});
    await denyPage.goto(url+'/?lang=zh');
    await denyPage.waitForFunction(()=>typeof DB!=='undefined'&&DB);
    await denyPage.locator('#tabbar [data-tab="near"]').click();
    await denyPage.waitForSelector('.near-fallback');
    assert(await denyPage.locator('#retryNear').isVisible());
    assert(await denyPage.locator('#browseNearRegion').isVisible());
    await denyCtx.close();

    // ---- 3. International checks (en / ja / fr) ----
    const enCtx=await browser.newContext({locale:'en-US',viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    await stubRoutes(enCtx);
    const enPage=await enCtx.newPage();
    enPage.on('pageerror',e=>errors.push('en: '+e.message));
    await enPage.goto(url+'/?lang=en');
    await enPage.waitForFunction(()=>typeof DB!=='undefined'&&DB&&document.getElementById('meInstall'));

    // China should NOT be pinned first in Asia in English mode (Japan has more restaurants)
    const firstAsia=await enPage.evaluate(()=>DB.C.filter(c=>c[2]==='亚洲').sort((a,b)=>DB.crank[DB.C.indexOf(a)]-DB.crank[DB.C.indexOf(b)])[0][1]);
    assert.equal(firstAsia,'Japan','English mode should rank Asian countries by restaurant count rather than pinning China');
    // Black Pearl filter hidden outside China in English mode
    await enPage.locator('#filterBtn').click();
    assert(await enPage.locator('#flags [data-f="bp"]').isHidden(),'Black Pearl filter should be hidden in English mode outside China');
    await enPage.keyboard.press('Escape');
    // Share URL preserves ?lang=en and uses English country/cuisine names
    const shared=await enPage.evaluate(()=>{S.co=String(DB.coByName['France']);S.cu=DB.cuByEn['French']||DB.cuisines[0];return shareURL();});
    assert(shared.includes('?lang=en'),'shareURL should preserve ?lang=en');
    assert(shared.includes('co=France'),'shareURL should use English country name in English mode');
    // Google Maps links use hl=en (never zh-CN)
    const frU=await enPage.evaluate(()=>DB.rows.find(r=>DB.C[r.co][1]==='France')?.u);
    await enPage.evaluate(u=>upOpenDetail(u),frU);
    const gHref=await enPage.locator('#detailDlg a[href*="google.com/maps"]').first().getAttribute('href');
    assert(gHref.includes('hl=en')&&!gHref.includes('hl=zh-CN'),'Google Maps should use hl=en in English mode: '+gHref);
    await enPage.evaluate(()=>closeAppDialog(document.getElementById('detailDlg')));
    // WeChat install guide hidden in English non-WeChat UA
    await enPage.locator('#tabbar [data-tab="me"]').click();
    await enPage.locator('#meInstall>summary').click();
    assert(!(await enPage.locator('#meInstall').innerText()).includes('WeChat · Floating'));
    if(shots)await enPage.screenshot({path:path.join(shots,'en-mobile-me.png')});

    // Japanese & French smoke check
    for(const [code,expected] of [['ja','ミシュラン'],['fr','MICHELIN']]){
      await enPage.goto(url+'/?lang='+code);
      await enPage.waitForFunction(()=>typeof DB!=='undefined'&&DB);
      assert.equal(await enPage.evaluate(()=>document.documentElement.lang),code);
      assert((await enPage.locator('#intro h1').innerText()).includes(expected),code+' heading should localize');
    }

    // Overflow check across 320..1600
    await enPage.goto(url+'/?lang=en');
    await enPage.waitForFunction(()=>typeof DB!=='undefined'&&DB);
    for(const width of [320,390,744,1024,1280,1600]){
      await enPage.setViewportSize({width,height:900});
      await enPage.waitForTimeout(80);
      assert(await enPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow at width '+width);
    }
    await enCtx.close();

    assert.deepEqual(errors,[]);
    console.log('PASS: global-ux — font version parity, autocomplete, active filter chips, directory sort, saved filters, desktop map split-view & clustering, list->map locate, booking/hours/Apple Maps, nearby fallback, route reorder/slot/reset, sync QR/privacy/cloud-delete, en/ja/fr i18n, 320–1600 zero overflow.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e.stack||e);process.exit(1);});

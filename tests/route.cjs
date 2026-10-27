// Trip route planner end-to-end. Run: node tests/route.cjs (needs playwright).
const assert=require('node:assert/strict'),http=require('http'),fs=require('fs'),path=require('path');const {chromium}=require('playwright');
(async()=>{
  const base=path.resolve(__dirname,'..');
  const server=http.createServer((req,res)=>{let file=path.resolve(base,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===base)file=path.join(base,'index.html');
    if(!file.startsWith(base+path.sep)){res.writeHead(403);return res.end();}
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'text/plain');
    try{res.end(fs.readFileSync(file));}catch(e){res.writeHead(404);res.end('missing');}});
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port,shots=process.env.SCREENSHOT_DIR;
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({locale:'zh-CN',viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2,permissions:['geolocation','clipboard-read','clipboard-write'],geolocation:{latitude:31.2304,longitude:121.4737}});
    const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route(/^https:\/\/(?!127\.0\.0\.1).*/,r=>r.fulfill({status:404,body:''}));
    await page.goto(url+'/#v=me');await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&DB.rows.length>1000&&typeof MGRouteUI!=='undefined');
    const trip=await page.evaluate(()=>{
      const sh=DB.rows.filter(r=>DB.T[r.ci][0]==='上海'&&r.lat!=null&&r.l<=2).slice(0,7),tk=DB.rows.filter(r=>DB.T[r.ci][0]==='东京'&&r.lat!=null).slice(0,3);
      const t=upNewTrip('上海东京吃吃吃');upSave({...PERSONAL,trips:PERSONAL.trips.map(x=>x.id===t.id?{...x,items:[...sh,...tk].map(r=>r.u)}:x)});
      FAV[sh[0].u]=[2,Date.now()];saveFav();render();return {id:t.id,first:sh[0].u};});
    await page.locator(`[data-trip-route="${trip.id}"]`).first().click();
    await page.waitForSelector('#routeDlg[open] .route-day');
    assert.equal(await page.locator('#routeCities button').count(),2);
    assert.equal(await page.locator('#routeCities [aria-selected="true"]').innerText().then(t=>t.startsWith('上海')),true);
    // 6 unvisited Shanghai stops, 2 per day → 3 days; the visited one is skipped.
    assert.equal(await page.locator('.route-day').count(),3);assert.equal(await page.locator('.route-stop').count(),6);
    assert.equal(await page.locator('.route-leg').count(),3);assert((await page.locator('.route-foot p').innerText()).includes('已跳过 1 家'));
    assert(await page.locator('.route-leg a[href^="https://uri.amap.com/navigation"]').count()===3);
    assert((await page.locator('.route-stop small').first().innerText()).startsWith('午餐'));
    if(shots)await page.screenshot({path:path.join(shots,'route.png'),fullPage:false});
    if(shots)await page.locator('#routeDlg .dlg').screenshot({path:path.join(shots,'route-full.png')});
    await page.locator('[data-per="1"]').click();assert.equal(await page.locator('.route-day').count(),2);
    await page.locator('#routeSkip').uncheck();assert.equal(await page.locator('.route-stop').count(),7);
    await page.locator('#routeHere').click();await page.waitForSelector('#routeHere[aria-pressed="true"]');assert.equal(await page.locator('.route-leg').count(),5); // 7 stops in 3+3+1 → 4 inner legs + 1 from my position
    const text=await page.evaluate(()=>MGRouteUI.text());assert(text.includes('第 1 天')&&text.includes('上海东京吃吃吃'));
    await page.locator('#routeCities button').nth(1).click();assert.equal(await page.locator('.route-stop').count(),3);
    assert(await page.locator('.route-leg a[href^="https://www.google.com/maps/dir/"]').count()>=2);assert(await page.locator('.route-day header a').count()>=1);
    if(shots)await page.locator('#routeDlg .dlg').screenshot({path:path.join(shots,'route-tokyo.png')});
    await page.locator('.route-name').first().click();await page.waitForFunction(()=>document.getElementById('detailDlg').open);
    await page.evaluate(()=>{closeAppDialog(document.getElementById('detailDlg'));closeAppDialog(document.getElementById('routeDlg'));});
    // From the trip dialog too.
    await page.locator(`[data-trip-open="${trip.id}"]`).click();await page.locator('#tripRoute').click();await page.waitForSelector('#routeDlg[open] .route-day');
    await page.evaluate(()=>applyTheme('dark'));if(shots)await page.locator('#routeDlg .dlg').screenshot({path:path.join(shots,'route-dark.png')});
    await page.setViewportSize({width:320,height:700});assert(!(await page.evaluate(()=>document.getElementById('routeDlg').scrollWidth>document.getElementById('routeDlg').clientWidth+1)));
    assert.deepEqual(errors,[]);
    console.log('PASS: route planner — city tabs, skip visited, per-day split with meal slots, legs with AMap/Google navigation, my-position start, copy text, city switch, open detail, from trip dialog, dark/narrow; no browser errors.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});

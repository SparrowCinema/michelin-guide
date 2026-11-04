const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const base=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{let p=path.resolve(base,'.'+new URL(req.url,'http://localhost').pathname);if(p===base)p=path.join(base,'index.html');if(!p.startsWith(base+path.sep)){res.writeHead(403);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(p)]||'text/plain');try{res.end(fs.readFileSync(p));}catch(e){res.writeHead(404);res.end('');}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});

 try{
 const context=await browser.newContext({locale:'zh-CN',viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const leaflet=path.dirname(require.resolve('leaflet'))+'/';await page.route(/https:\/\/.*leaflet.*\.(js|css)$/,r=>r.fulfill({path:leaflet+(r.request().url().endsWith('.css')?'leaflet.css':'leaflet.js')}));await page.route(/^https:\/\/(?!127\.0\.0\.1).*/,r=>r.fulfill({status:404,body:''}));
 await page.goto(url+'/?lang=zh#v=me');await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&typeof upPassport==='function'&&document.getElementById('mePassport'));
 const fixture=await page.evaluate(()=>{
   const ci=DB.T.findIndex(t=>t[2]==='Xiamen'),rows=DB.rows.filter(r=>r.ci===ci),chosen=[rows.find(r=>r.l===2),rows.find(r=>r.l===3),rows.find(r=>r.l===4),rows.filter(r=>r.l===3)[1],rows.filter(r=>r.l===3)[2]],wanted=rows.find(r=>!chosen.includes(r));
   FAV=Object.create(null);PERSONAL={version:2,trips:[],records:Object.create(null)};
   chosen.forEach((r,i)=>{FAV[r.u]=[2,1];if(i!==2)PERSONAL.records[r.u]={visits:[{id:'meal-'+i,date:'2026-11-04',rating:4,note:'Keep this note'}]};});
   PERSONAL.records[chosen[0].u].visits.push({id:'repeat',date:'2026-11-03',rating:4.5,note:'Earlier visit'});FAV[wanted.u]=[1,1];PERSONAL=MG.personal(PERSONAL,DB.byU);saveFav();upSave(PERSONAL);PASSPORT.open=true;PASSPORT.sheet=0;S.v='me';render();document.getElementById('mePassport').open=true;
   return {ids:chosen.map(r=>r.u),wanted:wanted.u,records:JSON.stringify(PERSONAL),city:ci,total:rows.length};
 });
 assert.equal(await page.locator('.pp-restaurant-stamp').evaluateAll(es=>new Set(es.map(e=>getComputedStyle(e).color)).size),2);
 assert.equal(await page.locator('[data-passport-restaurant]').count(),4);assert((await page.locator('.pp-growth-head').innerText()).includes('5 枚'));assert.equal(await page.locator('.pp-growth progress').getAttribute('value'),'5');assert.equal(await page.locator('.pp-growth progress').getAttribute('max'),String(fixture.total));
 await page.locator('[data-passport-next]').click();await page.waitForFunction(()=>!PASSPORT.busy);assert.equal(await page.locator('[data-passport-restaurant]').count(),1);assert((await page.locator('.pp-stamp-date').innerText()).includes('日期未填写'));
 await page.locator('[data-passport-honor="2"]').click();assert.equal(await page.locator('[data-passport-restaurant]').count(),1);assert.equal(await page.locator('.pp-stamp-count').innerText(),'2 次用餐 · 点击查看');
 await page.locator('[data-passport-restaurant]').click();assert(await page.locator('#detailDlg').isVisible());assert.equal(await page.locator('#detailDlg').getAttribute('data-u'),fixture.ids[0]);assert.equal(await page.locator('#detailDlg .visit-entry').count(),2);await page.evaluate(()=>closeAppDialog(document.getElementById('detailDlg')));
 await page.locator('[data-passport-honor="0"]').click();assert(await page.locator('.pp-filter-empty').isVisible());await page.locator('[data-passport-honor="all"]').click();
 for(const width of [320,390,1280]){
 await page.setViewportSize({width,height:900});await page.waitForTimeout(80);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert(await page.locator('.pp-visas').evaluate(el=>el.scrollHeight<=el.clientHeight));assert(await page.locator('.pp-identity').evaluate(el=>el.scrollHeight<=el.clientHeight));
 if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'restaurant-stamps-'+width+'.png'),fullPage:true});
 }
 await page.evaluate(()=>applyTheme('dark'));if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'restaurant-stamps-dark.png'),fullPage:true});
 assert.equal(await page.evaluate(()=>JSON.stringify(PERSONAL)),fixture.records);
 await page.reload();await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&document.getElementById('mePassport'));assert.equal(await page.evaluate(()=>JSON.stringify(PERSONAL)),fixture.records);
 await page.goto(url+'/?lang=en#v=me');await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&document.getElementById('mePassport'));await page.evaluate(()=>{document.getElementById('mePassport').open=true;PASSPORT.open=true;upPassport(DB.rows.filter(r=>favOf(r.u)===2))});await page.waitForTimeout(150);assert((await page.locator('.pp-growth-head').innerText()).includes('Passport growth'));assert(!(await page.locator('.pp-growth').innerText()).match(/[\u3400-\u9fff]/));
 await page.evaluate(()=>goTab('list'));await page.locator('#q').fill('Hokklo');await page.waitForFunction(()=>document.querySelector('#list').textContent.includes('Hokklo'));await page.evaluate(()=>goTab('map'));assert(await page.locator('#mapbox').isVisible());
 // Upgrade an old shell cache without touching personal data; then reopen offline.
 await page.evaluate(async()=>{const old=await caches.open('mg-v46');const request=new Request(new URL('data.json?v='+DATA_VER,location.href));await old.put(request,await fetch(request));await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;});
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await page.waitForFunction(async()=>!(await caches.keys()).includes('mg-v46'));
 assert(await page.evaluate(async()=>!!await (await caches.open('mg-v47')).match(new URL('data.json?v='+DATA_VER,location.href).href)));
 await context.setOffline(true);await page.reload();await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&upLoaded);assert.equal(await page.evaluate(()=>JSON.stringify(PERSONAL)),fixture.records);
 assert.deepEqual(errors,[]);console.log('PASS restaurant-owned stamps: same-day distinct shops, undated, repeats/detail, four/page, honors/empty, city progress, milestones, persistence, 320/390/1280 unclipped layouts, dark, English, search/map; no browser errors');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});

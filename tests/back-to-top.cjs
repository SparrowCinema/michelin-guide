const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const base=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{let p=path.resolve(base,'.'+new URL(req.url,'http://localhost').pathname);if(p===base)p=path.join(base,'index.html');if(!p.startsWith(base+path.sep)){res.writeHead(403);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(p)]||'text/plain');try{res.end(fs.readFileSync(p));}catch(e){res.writeHead(404);res.end('');}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});



 try{
 const ctx=await browser.newContext({locale:'zh-CN',viewport:{width:390,height:844},hasTouch:true,isMobile:true,permissions:['geolocation'],geolocation:{latitude:31.2304,longitude:121.4737}}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const leaflet=path.dirname(require.resolve('leaflet'))+'/';await page.route(/https:\/\/.*leaflet.*\.(js|css)$/,r=>r.fulfill({path:leaflet+(r.request().url().endsWith('.css')?'leaflet.css':'leaflet.js')}));await page.route(/^https:\/\/(?!127\.0\.0\.1).*/,r=>r.fulfill({status:404,body:''}));
 await page.goto(url+'/?lang=zh');await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&document.getElementById('mePassport'));
 const original=await page.evaluate(()=>{FAV[DB.rows[0].u]=[1,1];saveFav();return{fav:JSON.stringify(FAV),personal:JSON.stringify(PERSONAL)}});
 const button=page.locator('#backToTop');assert(await button.isHidden());
 async function down(){await page.evaluate(()=>scrollTo({top:650,behavior:'instant'}));await page.waitForFunction(()=>!document.getElementById('backToTop').hidden);}
 for(const tab of ['list','map','near','me']){
 await page.locator('#tabbar [data-tab="'+tab+'"]').click();await page.waitForFunction(t=>document.body.dataset.tab===t,tab);
 if(tab==='me'){await page.locator('#mePassport>summary').click();await page.locator('[data-passport-tab="growth"]').first().click();}
 await down();const before=await page.evaluate(()=>JSON.stringify([S.v,S.near,S.q,S.l,S.co,S.ci]));const b=await button.boundingBox(),bar=await page.locator('#tabbar').boundingBox();assert(b.width>=44&&b.height>=44);assert(b.y+b.height<=bar.y-8);await button.click();await page.waitForFunction(()=>scrollY<1);assert(await button.isHidden());assert.equal(await page.evaluate(()=>JSON.stringify([S.v,S.near,S.q,S.l,S.co,S.ci])),before);assert(await page.evaluate(()=>document.activeElement.matches('#intro h1,.mehead h2')));
 }
 await page.locator('#tabbar [data-tab="list"]').click();await down();await page.locator('#filterBtn').click();await page.waitForFunction(()=>document.getElementById('backToTop').hidden);await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('backToTop').hidden);
 await page.evaluate(()=>upOpenDetail(DB.rows[0].u));await page.waitForFunction(()=>document.getElementById('backToTop').hidden);await page.evaluate(()=>closeAppDialog(document.getElementById('detailDlg')));await page.waitForFunction(()=>!document.getElementById('backToTop').hidden);
 for(const width of [320,390,744,1133,1600]){await page.setViewportSize({width,height:900});await down();const b=await button.boundingBox(),bar=await page.locator('#tabbar').boundingBox();assert(b.x>=0&&b.x+b.width<=width);assert(b.y+b.height<=bar.y-8);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.emulateMedia({reducedMotion:'reduce'});await button.focus();await page.keyboard.press('Enter');await page.waitForFunction(()=>scrollY===0);await page.waitForFunction(()=>document.getElementById('backToTop').hidden);assert(await button.isHidden());
 assert.equal(await page.evaluate(()=>JSON.stringify(FAV)),original.fav);assert.equal(await page.evaluate(()=>JSON.stringify(PERSONAL)),original.personal);
 await page.goto(url+'/?lang=en');await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&upLoaded);await down();assert.equal(await button.getAttribute('aria-label'),'Back to top');assert.equal(await button.getAttribute('title'),'Back to top');
 await page.evaluate(async()=>{const old=await caches.open('mg-v61'),request=new Request(new URL('data.json?v='+DATA_VER,location.href));await old.put(request,await fetch(request));await navigator.serviceWorker.register('sw.js');await navigator.serviceWorker.ready;});await page.waitForFunction(()=>!!navigator.serviceWorker.controller);await page.waitForFunction(async()=>!(await caches.keys()).includes('mg-v61'));assert(await page.evaluate(async()=>!!await(await caches.open('mg-v62')).match(new URL('back-to-top.js?v=62',location.href).href)));
 await ctx.setOffline(true);await page.reload();await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&upLoaded);await down();await button.click();await page.waitForFunction(()=>scrollY===0);assert.equal(await page.evaluate(()=>JSON.stringify(FAV)),original.fav);assert.deepEqual(errors,[]);console.log('PASS shared back-to-top in Directory/Map/Nearby/Me; threshold, smooth/keyboard/reduced motion, heading focus, modal/filter hiding, 320–1600 safe placement, English, offline cache upgrade, unchanged state/data, no page errors');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});

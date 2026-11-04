const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const base=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{let p=path.resolve(base,'.'+new URL(req.url,'http://localhost').pathname);if(p===base)p=path.join(base,'index.html');if(!p.startsWith(base+path.sep)){res.writeHead(403);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(p)]||'text/plain');try{res.end(fs.readFileSync(p));}catch(e){res.writeHead(404);res.end('');}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});


 try{
 const context=await browser.newContext({locale:'zh-CN',viewport:{width:390,height:844},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const leaflet=path.dirname(require.resolve('leaflet'))+'/';await page.route(/https:\/\/.*leaflet.*\.(js|css)$/,r=>r.fulfill({path:leaflet+(r.request().url().endsWith('.css')?'leaflet.css':'leaflet.js')}));await page.route(/^https:\/\/(?!127\.0\.0\.1).*/,r=>r.fulfill({status:404,body:''}));
 await page.goto(url+'/?lang=zh#v=me');await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&document.getElementById('mePassport'));await page.evaluate(()=>document.getElementById('mePassport').open=true);assert.equal(await page.locator('#pageBrand').innerText(),'美食护照');assert.equal(await page.title(),'美食护照');assert.equal(await page.locator('.mehead h2').innerText(),'美食护照');
 for(const [width,height] of [[320,800],[390,844],[744,1133],[890,626],[1024,768],[1133,744],[1280,900]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(120);await page.evaluate(()=>document.getElementById('mePassport').open=true);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await page.locator('.pp-cover-atlas').isVisible());await page.evaluate(()=>document.fonts.ready);assert.equal(await page.locator('.pp-cover-name').evaluate(e=>e.scrollWidth<=e.clientWidth),true);
  const box=await page.locator('.pp-cover-atlas').boundingBox();assert(box.width>=210);assert(box.height>=425);
  if(width<=1199)assert(await page.locator('#tabbar').isVisible());
  if(width>=900){assert(await page.locator('.pp-cover-companion').isVisible());assert(await page.locator('.wrap').evaluate(e=>e.clientWidth>860));}
  if(process.env.SCREENSHOT_DIR&&[390,1133].includes(width))await page.locator('.pp-cover-stage').screenshot({style:'.tabbar{visibility:hidden!important}',path:path.join(process.env.SCREENSHOT_DIR,'new-cover-'+width+'.png')});
 }
 await page.setViewportSize({width:1133,height:744});await page.locator('.pp-cover-atlas').click();await page.waitForFunction(()=>!PASSPORT.busy);assert(await page.locator('.pp-book').isVisible());assert(await page.locator('.pp-book').evaluate(e=>e.getBoundingClientRect().width>=830));
 const original=await page.evaluate(()=>JSON.stringify(PERSONAL));
 for(const [width,height] of [[390,844],[890,626],[1133,744]]){await page.setViewportSize({width,height});await page.waitForTimeout(120);assert(await page.locator('.pp-book').isVisible());assert(await page.evaluate(()=>PASSPORT.open&&S.v==='me'));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.evaluate(()=>{goTab('list');document.getElementById('q').value='Hokklo';S.q='Hokklo';reset();render();});
 assert.equal(await page.locator('#pageBrand').innerText(),'米其林全球名录');assert.equal(await page.title(),'米其林全球名录');
 for(const width of [390,1133,744]){await page.setViewportSize({width,height:744});await page.waitForTimeout(120);assert.equal(await page.locator('#q').inputValue(),'Hokklo');assert((await page.locator('#list').innerText()).includes('Hokklo'));}
 await page.setViewportSize({width:1133,height:744});await page.evaluate(()=>goTab('map'));assert(await page.locator('#mapbox').isVisible());await page.evaluate(()=>{goTab('me');document.getElementById('mePassport').open=true;});await page.locator('[data-passport-close]').click();
 await page.evaluate(()=>applyTheme('dark'));assert(await page.locator('.pp-cover-atlas').isVisible());if(process.env.SCREENSHOT_DIR)await page.locator('.pp-cover-stage').screenshot({style:'.tabbar{visibility:hidden!important}',path:path.join(process.env.SCREENSHOT_DIR,'new-cover-dark.png')});
 assert.equal(await page.evaluate(()=>JSON.stringify(PERSONAL)),original);
 assert.equal(await page.evaluate(()=>document.fonts.check('400 42px \"Passport Calligraphy\"','美食护照')),true);
 await page.goto(url+'/?lang=en#v=me');await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&document.getElementById('mePassport'));await page.evaluate(()=>document.getElementById('mePassport').open=true);await page.waitForTimeout(100);assert.equal(await page.locator('#pageBrand').innerText(),'Food passport');assert.equal(await page.title(),'Food passport');assert(!(await page.locator('.pp-cover-companion').innerText()).match(/[\u3400-\u9fff]/));
 assert.deepEqual(errors,[]);console.log('PASS original culinary cover, 320/390/744/890/1024/1133/1280 layouts, expanded touch navigation, full-width book, folding/rotation state, search/map, dark/English, unchanged personal data');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});

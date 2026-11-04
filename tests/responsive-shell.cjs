const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const base=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{let p=path.resolve(base,'.'+new URL(req.url,'http://localhost').pathname);if(p===base)p=path.join(base,'index.html');if(!p.startsWith(base+path.sep)){res.writeHead(403);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(p)]||'text/plain');try{res.end(fs.readFileSync(p));}catch(e){res.writeHead(404);res.end('');}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});



 try{
 const layouts=new Map();
 for(const touch of [false,true]){
 const context=await browser.newContext({locale:'zh-CN',viewport:{width:1280,height:900},hasTouch:touch,isMobile:touch}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const leaflet=path.dirname(require.resolve('leaflet'))+'/';await page.route(/https:\/\/.*leaflet.*\.(js|css)$/,r=>r.fulfill({path:leaflet+(r.request().url().endsWith('.css')?'leaflet.css':'leaflet.js')}));await page.route(/^https:\/\/(?!127\.0\.0\.1).*/,r=>r.fulfill({status:404,body:''}));
 await page.goto(url+'/?lang=zh');await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&document.getElementById('mePassport'));
 await page.locator('#q').fill('Hokklo');await page.waitForFunction(()=>document.getElementById('list').textContent.includes('Hokklo'));
 for(const width of [320,390,700,744,890,900,1133,1280,1600]){
  await page.setViewportSize({width,height:900});await page.waitForTimeout(100);
  assert(await page.locator('#tabbar').isVisible());assert(await page.locator('#tabsTop').isHidden());assert(await page.locator('#viewRow').isHidden());assert(await page.locator('#filterBtn').isVisible());assert(await page.locator('#panel').isHidden());
  assert.equal(await page.locator('#q').inputValue(),'Hokklo');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const shape=await page.evaluate(()=>({tabs:getComputedStyle(document.getElementById('tabbar')).display,panel:getComputedStyle(document.getElementById('panel')).position,cols:getComputedStyle(document.querySelector('#list .rl')).gridTemplateColumns,wrap:Math.round(document.querySelector('.wrap').getBoundingClientRect().width)}));
  if(!touch)layouts.set(width,shape);else assert.deepEqual(shape,layouts.get(width));
  await page.locator('#filterBtn').click();await page.waitForFunction(()=>document.body.classList.contains('sheet'));await page.waitForTimeout(280);const box=await page.locator('#panel').boundingBox();assert(box.width<=Math.min(width,720)+1);assert(box.x>=-1);assert(box.x+box.width<=width+1);await page.keyboard.press('Escape');assert(await page.locator('#panel').isHidden());
  await page.locator('#tabbar [data-tab="me"]').click();assert(await page.locator('#intro').isHidden());assert(await page.locator('#controls').isHidden());assert.equal(await page.locator('#pageBrand').innerText(),'美食护照');await page.locator('#tabbar [data-tab="list"]').click();
 }
 await page.setViewportSize({width:1280,height:900});await page.locator('#tabbar [data-tab="map"]').click();assert(await page.locator('#mapbox').isVisible());await page.locator('#tabbar [data-tab="me"]').click();await page.locator('#mePassport>summary').click();assert(await page.locator('.pp-cover-atlas').isVisible());
 for(const width of [390,1280,744]){await page.setViewportSize({width,height:900});await page.waitForTimeout(100);assert(await page.evaluate(()=>S.v==='me'));assert(await page.locator('#tabbar [aria-current="page"]').getAttribute('data-tab')==='me');}
 assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS identical mouse/touch shell at 320/390/700/744/890/900/1133/1280/1600; persistent bottom navigation; width-only columns; centered filters/Escape; preserved search/page; map/passport; no overflow or page errors');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});

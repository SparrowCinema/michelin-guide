const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const base=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{let p=path.resolve(base,'.'+new URL(req.url,'http://localhost').pathname);if(p===base)p=path.join(base,'index.html');if(!p.startsWith(base+path.sep)){res.writeHead(403);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(p)]||'text/plain');try{res.end(fs.readFileSync(p));}catch(e){res.writeHead(404);res.end('');}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const context=await browser.newContext({locale:'zh-CN',viewport:{width:390,height:844},isMobile:true,hasTouch:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const leaflet=path.dirname(require.resolve(process.env.LEAFLET_MODULE||'leaflet'))+'/';await page.route(/https:\/\/.*leaflet.*\.(js|css)$/,r=>r.fulfill({path:leaflet+(r.request().url().endsWith('.css')?'leaflet.css':'leaflet.js')}));await page.route(/^https:\/\/(?!127\.0\.0\.1).*/,r=>r.fulfill({status:404,body:''}));
  await page.goto(url+'/?lang=zh');await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&document.getElementById('meJumps'));
  const target=await page.evaluate(()=>DB.rows.find(r=>DB.T[r.ci][2]==='Brusaporto').u);
  for(const q of ['Brusaporto','布鲁萨波尔托']){await page.locator('#q').fill(q);await page.waitForFunction(u=>document.querySelector('#list [data-restaurant="'+u+'"]'),target);assert(await page.locator('#list').innerText().then(x=>x.includes('布鲁萨波尔托')));}
  const saved=await page.evaluate(()=>{const rows=DB.rows.slice(0,55);rows.forEach((r,i)=>FAV[r.u]=[i<40?1:2,Date.now()-i]);saveFav();return JSON.stringify(FAV);});
  await page.locator('#tabbar [data-tab="me"]').click();assert.equal(await page.locator('#meJumps button').count(),7);assert.equal(await page.locator('#meCollection').getAttribute('open'),null);
  await page.locator('[data-me-mode="1"]').click();assert(await page.locator('#meCollection').getAttribute('open')!==null);assert.equal(await page.locator('#meList li').count(),12);await page.locator('#meMore').click();assert.equal(await page.locator('#meList li').count(),36);
  await page.locator('[data-me-mode="2"]').click();assert.equal(await page.locator('#meList li').count(),12);await page.locator('#meMore').click();assert.equal(await page.locator('#meList li').count(),15);assert(await page.locator('#meMore').isHidden());
  await page.locator('#meCollection>summary').click();assert(await page.locator('#meList').isHidden());
  for(const id of ['meTrips','meSync','meBackup','meSettings']){await page.locator('[data-me-jump="'+id+'"]').click();assert(await page.locator('#'+id).getAttribute('open')!==null);}
  await page.locator('[data-me-jump="mePassport"]').click();if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'my-mobile.png')});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:320,height:800});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.setViewportSize({width:1280,height:900});await page.locator('#tabbar [data-tab="me"]').count();await page.evaluate(()=>scrollTo(0,0));if(process.env.SCREENSHOT_DIR)await page.screenshot({path:path.join(process.env.SCREENSHOT_DIR,'my-desktop.png')});
  await page.reload();await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&document.getElementById('meJumps'));assert.equal(await page.evaluate(()=>JSON.stringify(FAV)),saved);
  const co=await page.evaluate(()=>DB.C.findIndex(c=>c[1]==='Italy'));await page.goto(url+'/?lang=zh#co='+encodeURIComponent('意大利')+'&ci=Brusaporto');await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&S.ci!=='');assert.equal(await page.evaluate(()=>DB.T[S.ci][0]),'布鲁萨波尔托');
  await page.goto(url+'/?lang=en');await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&document.getElementById('meJumps'));await page.locator('[data-tab="me"]').first().click();await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>DB.T.find(t=>t[2]==='Reims')[0]),'Reims');assert(!(await page.locator('#meJumps').innerText()).match(/[\u3400-\u9fff]/));
  await page.locator('[data-me-jump="meSettings"]').click();assert(!(await page.locator('#meSettings>summary').innerText()).match(/[\u3400-\u9fff]/));assert.deepEqual(errors,[]);
  console.log('PASS city Chinese/original search, old city links, all dashboard jumps, collapsed/paged lists, saved data, English UI, 320/390/1280 layouts');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});

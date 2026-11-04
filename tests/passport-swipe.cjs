const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const base=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{let p=path.resolve(base,'.'+new URL(req.url,'http://localhost').pathname);if(p===base)p=path.join(base,'index.html');if(!p.startsWith(base+path.sep)){res.writeHead(403);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(p)]||'text/plain');try{res.end(fs.readFileSync(p));}catch(e){res.writeHead(404);res.end('');}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});



 try{
 const context=await browser.newContext({locale:'zh-CN',viewport:{width:390,height:844},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const leaflet=path.dirname(require.resolve('leaflet'))+'/';await page.route(/https:\/\/.*leaflet.*\.(js|css)$/,r=>r.fulfill({path:leaflet+(r.request().url().endsWith('.css')?'leaflet.css':'leaflet.js')}));await page.route(/^https:\/\/(?!127\.0\.0\.1).*/,r=>r.fulfill({status:404,body:''}));
 await page.goto(url+'/?lang=zh#v=me');await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&document.getElementById('mePassport'));await page.evaluate(()=>{DB.rows.slice(0,22).forEach(r=>FAV[r.u]=[2,1]);S.v='me';render();document.getElementById('mePassport').open=true});
 const cdp=await context.newCDPSession(page);
 async function position(selector){await page.locator(selector).evaluate(e=>scrollTo(0,e.getBoundingClientRect().top+scrollY-120));await page.waitForTimeout(100);return page.locator(selector).boundingBox()}
 async function drag(x,y,dx,dy,lock){const before=await page.evaluate(()=>scrollY);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=10;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+dx*i/10,y:y+dy*i/10}]});await page.waitForTimeout(20);if(lock)assert(Math.abs(await page.evaluate(()=>scrollY)-before)<=1,'horizontal motion changed page scroll');}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(120);return before}
 let box=await position('.pp-cover');await drag(box.x+box.width*.75,box.y+box.height*.42,-125,65,true);await page.waitForFunction(()=>PASSPORT.open&&!PASSPORT.busy);
 box=await position('.pp-book');let before=await drag(box.x+box.width*.8,box.y+180,-135,75,true);await page.waitForFunction(()=>PASSPORT.sheet===1&&!PASSPORT.busy);assert(Math.abs(await page.evaluate(()=>scrollY)-before)<=1);assert(await page.locator('#detailDlg').isHidden());
 // Swipes starting on a real stamp also lock, without opening its detail.
 const stamp=page.locator('.pp-restaurant-stamp').nth(2);await position('.pp-book');box=await stamp.boundingBox();before=await drag(box.x+box.width/2,box.y+box.height/2,-100,50,true);await page.waitForFunction(()=>PASSPORT.sheet===2&&!PASSPORT.busy);assert(Math.abs(await page.evaluate(()=>scrollY)-before)<=1);assert(await page.locator('#detailDlg').isHidden());
 // A vertical pass over the book scrolls the page, never the passport.
 box=await position('.pp-book');before=await drag(box.x+box.width/2,box.y+200,7,-145,false);await page.waitForTimeout(180);assert(await page.evaluate(()=>scrollY)>before+45);assert.equal(await page.evaluate(()=>PASSPORT.sheet),2);
 // At either edge a horizontal gesture still cannot leak into vertical scroll.
 await page.evaluate(()=>{PASSPORT.sheet=3;upPassport(DB.rows.filter(r=>favOf(r.u)===2))});box=await position('.pp-book');before=await drag(box.x+box.width*.8,box.y+180,-120,60,true);await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>PASSPORT.sheet),3);assert(Math.abs(await page.evaluate(()=>scrollY)-before)<=1);
 await page.waitForTimeout(450);await page.locator('.pp-restaurant-stamp').first().tap();assert(await page.locator('#detailDlg').isVisible());await page.evaluate(()=>closeAppDialog(document.getElementById('detailDlg')));
 await page.setViewportSize({width:744,height:1133});await page.waitForTimeout(120);await page.evaluate(()=>{PASSPORT.sheet=0;upPassport(DB.rows.filter(r=>favOf(r.u)===2))});box=await position('.pp-book');before=await drag(box.x+box.width*.8,box.y+180,-150,70,true);await page.waitForFunction(()=>PASSPORT.sheet===2&&!PASSPORT.busy);assert(Math.abs(await page.evaluate(()=>scrollY)-before)<=1);
 assert(await page.locator('.pp-book').evaluate(e=>getComputedStyle(e.closest('.pp-spread-stage')).touchAction.includes('pinch-zoom')));assert.deepEqual(errors,[]);console.log('PASS native touch: diagonal horizontal cover/page/stamp swipes keep scrollY fixed; vertical book gesture scrolls without flipping; end-boundary lock; tap still opens detail; tablet spread; no page errors');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});

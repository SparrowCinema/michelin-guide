const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
(async()=>{
 const base=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{let p=path.resolve(base,'.'+new URL(req.url,'http://localhost').pathname);if(p===base)p=path.join(base,'index.html');if(!p.startsWith(base+path.sep)){res.writeHead(403);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(p)]||'text/plain');try{res.end(fs.readFileSync(p));}catch(e){res.writeHead(404);res.end('');}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});



 try{
 const context=await browser.newContext({locale:'zh-CN',viewport:{width:1133,height:900},hasTouch:true,isMobile:true}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const leaflet=path.dirname(require.resolve('leaflet'))+'/';await page.route(/https:\/\/.*leaflet.*\.(js|css)$/,r=>r.fulfill({path:leaflet+(r.request().url().endsWith('.css')?'leaflet.css':'leaflet.js')}));await page.route(/^https:\/\/(?!127\.0\.0\.1).*/,r=>r.fulfill({status:404,body:''}));
 await page.goto(url+'/?lang=zh#v=me');await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&document.getElementById('mePassport'));await page.evaluate(()=>document.getElementById('mePassport').open=true);
 async function setup(n){return page.evaluate(n=>{const first=DB.rows.find(r=>DB.T[r.ci][2]==='Hangzhou'&&r.l===3)||DB.rows.find(r=>r.l===3),all=[...new Map([first,...new Map(DB.rows.map(r=>[r.ci,r])).values(),...DB.rows].map(r=>[r.u,r])).values()];FAV=Object.create(null);PERSONAL={version:2,trips:[],records:Object.create(null)};all.slice(0,n).forEach(r=>FAV[r.u]=[2,1]);PASSPORT.open=false;render();document.getElementById('mePassport').open=true;return JSON.stringify(PERSONAL)},n)}
 for(const n of [0,1,5,100]){
 const original=await setup(n);assert.equal(await page.locator('.pp-milestones li').count(),9);assert.equal(await page.locator('.pp-next-meter').getAttribute('aria-valuenow'),String(n));assert.equal(await page.locator('.pp-next-meter').getAttribute('aria-valuemax'),String(n===0?1:n===1?5:n===5?10:100));
 if(n===0){assert(await page.locator('.pp-journey-empty button').isVisible());await page.locator('.pp-journey-empty button').click();assert.equal(await page.evaluate(()=>S.v),'list');await page.evaluate(()=>{goTab('me');document.getElementById('mePassport').open=true})}
 if(n===1){await page.locator('.pp-next-action').click();assert.equal(await page.evaluate(()=>S.v),'list');await page.evaluate(()=>{goTab('me');document.getElementById('mePassport').open=true;});assert.equal(await page.locator('.pp-milestones .is-earned').count(),2);assert.equal(await page.locator('.pp-destination progress').getAttribute('value'),'1')}
 for(const width of [320,390,744,1133,1600]){await page.setViewportSize({width,height:900});await page.waitForTimeout(60);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await page.locator('.pp-journey').evaluate(e=>e.scrollWidth<=e.clientWidth));if(process.env.SCREENSHOT_DIR&&[0,1,100].includes(n)&&[390,1133].includes(width))await page.locator('.pp-journey').screenshot({style:'.page-language-bar,.tabbar{visibility:hidden!important}',path:path.join(process.env.SCREENSHOT_DIR,'growth-'+n+'-'+width+'.png')});}
 if(n===100){assert(await page.locator('.pp-more-cities').isVisible());const visible=await page.locator('.pp-destination:visible').count();assert.equal(visible,3);await page.locator('.pp-more-cities summary').click();assert(await page.locator('.pp-destination:visible').count()>visible)}
 assert.equal(await page.evaluate(()=>JSON.stringify(PERSONAL)),original);
 }
 await setup(1);await page.setViewportSize({width:390,height:900});await page.evaluate(()=>applyTheme('dark'));await page.waitForTimeout(180);if(process.env.SCREENSHOT_DIR)await page.locator('.pp-journey').screenshot({style:'.page-language-bar,.tabbar{visibility:hidden!important}',path:path.join(process.env.SCREENSHOT_DIR,'growth-dark.png')});
 await page.locator('.pp-journey-rules summary').click();assert((await page.locator('.pp-journey-rules p').innerText()).includes('仅“想去”不盖章'));
 await page.goto(url+'/?lang=en#v=me');await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&document.getElementById('mePassport'));await setup(1);await page.waitForTimeout(150);assert(!(await page.locator('.pp-journey').innerText()).match(/[\u3400-\u9fff]/));assert((await page.locator('.pp-growth-head').innerText()).includes('Passport growth'));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('PASS growth 0/1/5/100 restaurants, next goal boundaries, earned badges, 320/390/744/1133/1600 layouts, city expansion, empty-state browse, rules, dark/English, no stored-data mutation or page errors');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});

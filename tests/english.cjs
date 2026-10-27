// English interface: crawl every screen with ?lang=en and fail on leftover Chinese outside user/official content.
const assert=require('node:assert/strict'),http=require('http'),fs=require('fs'),path=require('path');const {chromium}=require('playwright');
(async()=>{
  const base=path.resolve(__dirname,'..');
  const server=http.createServer((req,res)=>{let file=path.resolve(base,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===base)file=path.join(base,'index.html');
    if(!file.startsWith(base+path.sep)){res.writeHead(403);return res.end();}
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'text/plain');
    try{res.end(fs.readFileSync(file));}catch(e){res.writeHead(404);res.end('missing');}});
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port,shots=process.env.SCREENSHOT_DIR;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const T=m=>process.env.TRACE&&console.error('> '+m);const left=new Map();
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2,permissions:['geolocation'],geolocation:{latitude:48.86,longitude:2.35}});
    const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const leaflet=path.dirname(require.resolve(process.env.LEAFLET_MODULE||'leaflet'));
    await page.route(/https:\/\/.*leaflet.*\.(js|css)$/,r=>r.fulfill({path:path.join(leaflet,r.request().url().endsWith('.css')?'leaflet.css':'leaflet.js')}));
    await page.route(/^https:\/\/(?!127\.0\.0\.1).*/,r=>r.fulfill({status:404,body:''}));
    T('goto');await page.goto(url+'/?lang=en#v=list');T('loaded');await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&DB.rows.length>1000&&document.querySelectorAll('#list *').length>5,null,{timeout:30000});
    const sweep=async label=>{if(process.env.TRACE)console.error('· '+label);await page.waitForTimeout(250);const found=await page.evaluate(()=>{const out=[],CJK=/[㐀-鿿]/,skip=el=>el.closest('[translate="no"],script,style,textarea,[hidden]');
      const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())){if(CJK.test(n.data)&&!skip(n.parentElement)){const st=getComputedStyle(n.parentElement);if(st.display!=='none'&&st.visibility!=='hidden'&&n.parentElement.getClientRects().length)out.push(n.data.trim().slice(0,90));}}
      document.querySelectorAll('[placeholder],[aria-label],[title],[alt]').forEach(el=>{if(skip(el))return;for(const a of ['placeholder','aria-label','title','alt']){const v=el.getAttribute(a);if(v&&CJK.test(v))out.push('@'+a+': '+v.slice(0,80));}});
      if(CJK.test(document.title))out.push('title: '+document.title);return out;});
      for(const f of found){if(!left.has(f))left.set(f,label);}};
    const seed=await page.evaluate(()=>{const sh=DB.rows.filter(r=>r.ml&&r.lat!=null&&r.l<=2).slice(0,4),pa=DB.rows.filter(r=>DB.C[r.co][1]==='France'&&r.lat!=null).slice(0,3);
      const t=upNewTrip('Paris 2026');upSave({...PERSONAL,trips:PERSONAL.trips.map(x=>x.id===t.id?{...x,items:[...sh,...pa].map(r=>r.u)}:x)});
      sh.slice(0,2).forEach((r,i)=>{FAV[r.u]=[2,Date.now()];PERSONAL.records[r.u]={date:'2026-05-0'+(i+1),rating:4.5,note:'很好吃',visits:[{id:'v'+i,date:'2026-05-0'+(i+1),rating:4.5,note:'很好吃'}]};});
      FAV[pa[0].u]=[1,Date.now()];saveFav();upSave(PERSONAL);render();return {trip:t.id,detail:sh[0].u,paris:pa[0].u};});
    assert.equal(await page.evaluate(()=>document.documentElement.lang),'en');
    await sweep('list');if(shots)await page.screenshot({path:path.join(shots,'en-list.png')});
    T('filters');await page.evaluate(()=>document.getElementById('filterBtn')?.click());await sweep('filters');await page.keyboard.press('Escape');
    await page.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>closeAppDialog(d));});
    for(const tab of ['map','near','me']){await page.locator(`#tabbar [data-tab="${tab}"]`).click();await page.waitForTimeout(600);if(tab==='me')await page.evaluate(()=>document.querySelectorAll('#mePage>.me-fold').forEach(d=>d.open=true));await sweep(tab);}
    if(shots)await page.screenshot({path:path.join(shots,'en-me.png'),fullPage:true});
    await page.locator('#tabbar [data-tab="me"]').click();
    await page.evaluate(()=>document.querySelectorAll('#mePage>.me-fold').forEach(d=>d.open=true));
    for(const sel of ['.openAbout','#installBtn','#importBtn']){await page.evaluate(s=>[...document.querySelectorAll(s)].find(e=>e.offsetParent)?.click()??document.querySelector(s).click(),sel);await page.waitForTimeout(300);await sweep(sel);await page.evaluate(()=>{document.querySelectorAll('dialog[open]').forEach(d=>closeAppDialog(d));});}
    await page.evaluate(u=>upOpenDetail(u),seed.detail);await page.waitForSelector('#detailDlg[open] .detail-intro');await sweep('detail');
    if(shots)await page.locator('#detailDlg .dlg').screenshot({path:path.join(shots,'en-detail.png')});
    await page.locator('#detailDlg [data-edit-visit]').first().click();await sweep('meal editor');await page.locator('#detailDlg [data-cancel-edit]').click();
    await page.locator('#detailDlg [data-add-visit]').click();await sweep('meal new');
    await page.evaluate(()=>closeAppDialog(document.getElementById('detailDlg')));
    await page.evaluate(u=>upOpenDetail(u),seed.paris);await page.waitForSelector('#detailDlg[open] .detail-intro');await sweep('detail paris');await page.evaluate(()=>closeAppDialog(document.getElementById('detailDlg')));
    await page.evaluate(u=>upOpenVisit(u),seed.detail);await sweep('visit sheet');await page.evaluate(()=>closeAppDialog(document.getElementById('visitDlg')));
    await page.locator(`[data-trip-open="${seed.trip}"]`).click();await sweep('trip');await page.evaluate(()=>closeAppDialog(document.getElementById('tripDlg')));
    await page.evaluate(u=>upPickTrip(u),seed.detail);await sweep('trip pick');await page.evaluate(()=>closeAppDialog(document.getElementById('tripPickDlg')));
    await page.locator(`[data-trip-route="${seed.trip}"]`).first().click();await page.waitForSelector('#routeDlg[open] .route-day');await sweep('route');
    if(shots)await page.locator('#routeDlg .dlg').screenshot({path:path.join(shots,'en-route.png')});
    await page.locator('#routeCities button').nth(1).click();await sweep('route 2');await page.evaluate(()=>closeAppDialog(document.getElementById('routeDlg')));
    await page.evaluate(()=>{document.querySelector('[data-passport-open]')?.click();});await page.waitForTimeout(500);await sweep('passport');
    await page.evaluate(()=>upOpenShare(''));await page.waitForFunction(()=>!!PASSPORT_SHARE.file,null,{timeout:30000});await sweep('recap');
    if(shots)fs.writeFileSync(path.join(shots,'en-recap.png'),Buffer.from(await page.evaluate(async()=>[...new Uint8Array(await PASSPORT_SHARE.file.arrayBuffer())])));
    await page.evaluate(()=>closeAppDialog(document.getElementById('passportShareDlg')));
    await page.locator('#tabbar [data-tab="list"]').click();await page.evaluate(()=>{S.q='东京';render();});await sweep('search');
    // toasts
    for(const fn of ['()=>toast("已复制地址")','()=>toast("链接已复制，发给朋友打开就是同样的筛选结果")']){await page.evaluate(`(${fn})()`);await sweep('toast');}
    for(const [k,v] of left)console.log(`LEFT [${v}] ${k}`);
    // switching back to Chinese
    await page.locator('#tabbar [data-tab="me"]').click();await page.locator('[data-me-jump="meSettings"]').click();await page.locator('#langSeg [data-lang="zh"]').click();await page.waitForLoadState('load');await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&DB.rows.length>1000);
    assert.equal(await page.evaluate(()=>document.documentElement.lang),'zh-CN');assert.equal(await page.evaluate(()=>localStorage.getItem('mg-lang')),'zh');
    assert.deepEqual(errors,[]);assert.equal(left.size,0,left.size+' untranslated strings');
    console.log('PASS: English interface — list, filters, map, nearby, me, about, install, import, detail (intro/address/meal log), visit sheet, trips, route, passport, recap canvas, search, toasts; switch back to Chinese.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e.message||e);process.exit(1);});

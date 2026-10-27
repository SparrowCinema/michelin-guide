// Meal photos end-to-end: add, compress, save, view, remove + cleanup, reload, backup export/import.
// Run: node tests/photos.cjs   (needs playwright; LEAFLET_MODULE like tests/browser.cjs)
const assert=require('node:assert/strict'),http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
(async()=>{
  const base=path.resolve(__dirname,'..');
  const server=http.createServer((req,res)=>{
    let file=path.resolve(base,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===base)file=path.join(base,'index.html');
    if(!file.startsWith(base+path.sep)){res.writeHead(403);return res.end();}
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp'})[path.extname(file)]||'text/plain');
    try{res.end(fs.readFileSync(file));}catch(e){res.writeHead(404);res.end('missing');}
  });
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});const shots=process.env.SCREENSHOT_DIR;
  let page;try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2,acceptDownloads:true});page=await ctx.newPage();const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const leaflet=path.dirname(require.resolve(process.env.LEAFLET_MODULE||'leaflet'));
    await page.route(/https:\/\/.*leaflet.*\.(js|css)$/,r=>r.fulfill({path:path.join(leaflet,r.request().url().endsWith('.css')?'leaflet.css':'leaflet.js')}));
    await page.route(/https:\/\/(?!127\.0\.0\.1).*$/,r=>r.fulfill({status:404,body:''}));
    await page.goto(url+'/#v=list');await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&DB.rows.length>1000&&typeof MP!=='undefined');
    // Big landscape photo (3000×2000) → stored at ≤1600px; small ones for the grid.
    const keysWhen=(pg,test,arg)=>pg.evaluate(async([src,arg])=>{const f=eval(src);for(let i=0;i<100;i++){const k=await MP._keys();if(f(k,arg))return k;await new Promise(r=>setTimeout(r,100));}throw new Error('photo store did not settle: '+(await MP._keys()).length);},[test.toString(),arg]);
    const make=(w,h,hue)=>page.evaluate(([w,h,hue])=>{const c=document.createElement('canvas');c.width=w;c.height=h;const g=c.getContext('2d');const gr=g.createLinearGradient(0,0,w,h);gr.addColorStop(0,`hsl(${hue} 60% 55%)`);gr.addColorStop(1,`hsl(${hue+40} 70% 30%)`);g.fillStyle=gr;g.fillRect(0,0,w,h);g.fillStyle='rgba(255,255,255,.85)';g.beginPath();g.arc(w/2,h/2,Math.min(w,h)/4,0,7);g.fill();return c.toDataURL('image/png').split(',')[1];},[w,h,hue]).then(b=>Buffer.from(b,'base64'));
    const files=[{name:'a.png',mimeType:'image/png',buffer:await make(3000,2000,10)},{name:'b.png',mimeType:'image/png',buffer:await make(800,1000,140)},{name:'c.png',mimeType:'image/png',buffer:await make(900,900,220)},{name:'d.png',mimeType:'image/png',buffer:await make(700,900,300)}];
    const u=await page.evaluate(()=>{const r=DB.rows.find(r=>r.l===3&&r.ml);upOpenDetail(r.u);return r.u;});
    await page.waitForSelector('#detailDlg .mp-edit');
    await page.locator('#detailDlg [data-photo-input]').setInputFiles(files);
    await page.waitForFunction(()=>document.querySelectorAll('#detailDlg .mp-edit [data-photo-tile]').length===4&&!document.querySelector('#detailDlg .is-pending'));
    assert.equal(await page.locator('#detailDlg [data-photo-count]').innerText(),'4');
    assert.equal(await page.locator('#detailDlg .mp-cover').count(),1);
    const big=await page.evaluate(async()=>{const id=document.querySelector('#detailDlg [data-photo-tile]').dataset.photoTile,r=await MP._get(id);return {w:r.w,h:r.h,type:r.full.type,thumb:r.thumb.size<r.full.size};});
    assert.deepEqual(big,{w:1600,h:1067,type:'image/jpeg',thumb:true});
    await page.waitForFunction(()=>document.querySelectorAll('#detailDlg .mp-edit .mp-tile.is-loaded').length===4);
    if(shots)await page.locator('#detailDlg .meal-editor').screenshot({path:path.join(shots,'photo-editor.png')});
    await page.locator('#detailDlg [data-rating-star="5"]').click({position:{x:20,y:10}});
    await page.fill('#visitDate','2026-10-20');await page.fill('#visitNote','松茸土瓶蒸很惊艳');
    await page.locator('#detailDlg .visit-form button[type=submit]').click();
    await page.waitForSelector('#detailDlg .mp-strip');
    assert.equal(await page.locator('#detailDlg .mp-strip .mp-tile').count(),3);assert.equal(await page.locator('#detailDlg .mp-more').innerText(),'+1');
    assert.equal(await page.evaluate(u=>PERSONAL.records[u].visits[0].photos.length,u),4);
    assert.equal(await page.evaluate(u=>JSON.parse(localStorage.getItem('mg-personal')).records[u].visits[0].photos.length,u),4);
    await page.waitForFunction(()=>document.querySelectorAll('#detailDlg .mp-strip .mp-tile.is-loaded').length===3);
    if(shots)await page.locator('#detailDlg .meal-log').screenshot({path:path.join(shots,'photo-card.png')});
    // Viewer: open the third, swipe through, wrap around, close.
    await page.locator('#detailDlg .mp-strip [data-photo-open="2"]').click();
    await page.waitForFunction(()=>document.getElementById('photoDlg')?.open&&document.getElementById('photoBig').src.startsWith('blob:'));
    assert.equal(await page.locator('#photoCount').innerText(),'3 / 4');assert((await page.locator('#photoCaption').innerText()).includes('2026.10.20'));
    await page.locator('#photoDlg .mp-next').click();assert.equal(await page.locator('#photoCount').innerText(),'4 / 4');
    await page.locator('#photoDlg .mp-next').click();assert.equal(await page.locator('#photoCount').innerText(),'1 / 4');
    await page.waitForFunction(()=>!document.getElementById('photoBig').classList.contains('is-loading'));
    if(shots)await page.screenshot({path:path.join(shots,'photo-viewer.png')});
    await page.locator('#photoDlg [data-photo-close]').click();assert(!(await page.evaluate(()=>document.getElementById('photoDlg').open)));
    assert(await page.evaluate(()=>document.getElementById('detailDlg').open));
    // Edit: remove one → after save the orphan is deleted from IndexedDB.
    await page.locator('#detailDlg [data-edit-visit]').first().click();
    const removed=await page.locator('#detailDlg .mp-edit [data-photo-tile]').nth(1).getAttribute('data-photo-tile');
    await page.locator('#detailDlg .mp-edit [data-photo-remove]').nth(1).click();
    assert.equal(await page.locator('#detailDlg [data-photo-count]').innerText(),'3');
    await page.locator('#detailDlg .visit-form button[type=submit]').click();
    await keysWhen(page,(k,id)=>!k.includes(id)&&k.length===3,removed);
    assert.equal(await page.evaluate(async()=>(await MP._keys()).length),3);
    // Unsaved picks are cleaned up on cancel.
    await page.locator('#detailDlg [data-add-visit]').click();await page.locator('#detailDlg .meal-new [data-photo-input]').setInputFiles([files[3]]);
    await page.waitForFunction(()=>document.querySelectorAll('#detailDlg .meal-new [data-photo-tile]').length===1);
    assert.equal(await page.evaluate(async()=>(await MP._keys()).length),4);
    await page.locator('#detailDlg .meal-new [data-cancel-edit]').click();await keysWhen(page,k=>k.length===3);
    // Reload keeps everything.
    await page.reload();await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&DB.rows.length>1000);await page.evaluate(u=>upOpenDetail(u),u);
    await page.waitForFunction(()=>document.querySelectorAll('#detailDlg .mp-strip .mp-tile.is-loaded').length===3);
    // Backup with photos → import into a fresh browser profile.
    await page.evaluate(()=>closeAppDialog(document.getElementById('detailDlg')));await page.evaluate(()=>showTab?showTab('me'):0).catch(()=>{});
    const [dl]=await Promise.all([page.waitForEvent('download'),page.evaluate(()=>document.getElementById('exportBtn').click())]);
    const backup=JSON.parse(fs.readFileSync(await dl.path(),'utf8'));
    assert.equal(Object.keys(backup.photos).length,3);assert(Object.values(backup.photos).every(p=>p.data.startsWith('data:image/jpeg;base64,')));
    const ctx2=await browser.newContext({viewport:{width:390,height:844}}),p2=await ctx2.newPage();p2.on('pageerror',e=>errors.push(e.message));
    await p2.route(/https:\/\/(?!127\.0\.0\.1).*$/,r=>r.fulfill({status:404,body:''}));
    await p2.goto(url+'/#v=list');await p2.waitForFunction(()=>typeof DB!=='undefined'&&DB&&DB.rows.length>1000&&typeof MP!=='undefined');
    const tmp=path.join(require('os').tmpdir(),'mg-photo-backup.json');fs.writeFileSync(tmp,JSON.stringify({...backup,pad:'x'.repeat(500000)})); // big file path: kept out of the textarea
    await p2.evaluate(()=>document.getElementById('importBtn').click());await p2.locator('#impFile').setInputFiles(tmp);
    await p2.waitForFunction(()=>document.getElementById('impText').placeholder.includes('MB')&&!document.getElementById('impText').value);
    await p2.evaluate(()=>document.getElementById('impGo').click());
    await keysWhen(p2,k=>k.length===3);
    await p2.evaluate(u=>upOpenDetail(u),u);await p2.waitForFunction(()=>document.querySelectorAll('#detailDlg .mp-strip .mp-tile.is-loaded').length===3);
    // Dark mode look.
    await page.evaluate(u=>{applyTheme('dark');upOpenDetail(u);},u);await page.waitForFunction(()=>document.querySelectorAll('#detailDlg .mp-strip .mp-tile.is-loaded').length===3);
    if(shots)await page.locator('#detailDlg .meal-log').screenshot({path:path.join(shots,'photo-card-dark.png')});
    assert.deepEqual(errors,[]);
    console.log('PASS: meal photos — add/compress (≤1600px JPEG + thumb), 9-cap counter, cover tag, save into visit, card strip +N, viewer swipe/wrap/close, remove + IndexedDB cleanup, cancel cleanup, reload, backup export/import with photos; no browser errors.');
  }catch(e){if(shots)await page?.screenshot?.({path:path.join(shots,"fail.png")}).catch(()=>{});throw e;}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});

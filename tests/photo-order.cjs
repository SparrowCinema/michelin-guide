// Meal photo ordering & unsaved-change guard: drag to reorder (mouse + touch long-press), set cover in the viewer,
// keyboard reorder, remove + undo, EXIF date prefill, and asking before an edited sheet closes.
// Run: node tests/photo-order.cjs   (needs playwright; LEAFLET_MODULE like tests/browser.cjs)
const assert=require('node:assert/strict'),http=require('http'),fs=require('fs'),path=require('path');
const {chromium}=require('playwright');
(async()=>{
  const base=path.resolve(__dirname,'..');
  const server=http.createServer((req,res)=>{
    let file=path.resolve(base,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===base)file=path.join(base,'index.html');
    if(!file.startsWith(base+path.sep)&&file!==base){res.writeHead(403);return res.end();}
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[path.extname(file)]||'text/plain');
    try{res.end(fs.readFileSync(file));}catch(e){res.writeHead(404);res.end('missing');}
  });
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});const shots=process.env.SCREENSHOT_DIR;const errors=[];
  try{
    for(const mobile of [false,true]){
      const ctx=await browser.newContext({locale:'zh-CN',viewport:mobile?{width:390,height:844}:{width:1280,height:900},hasTouch:mobile,isMobile:mobile});
      const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
      await page.route(/https:\/\/(?!127\.0\.0\.1).*$/,r=>r.fulfill({status:404,body:''}));
      await page.goto(url+'/#v=list');await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&DB.rows.length>1000&&typeof MP!=='undefined');
      const make=hue=>page.evaluate(h=>{const c=document.createElement('canvas');c.width=600;c.height=450;const g=c.getContext('2d');g.fillStyle=`hsl(${h} 60% 50%)`;g.fillRect(0,0,600,450);return c.toDataURL('image/png').split(',')[1];},hue).then(b=>Buffer.from(b,'base64'));
      // A JPEG with an EXIF DateTimeOriginal of 2025-03-14.
      const exifJpeg=await page.evaluate(async()=>{const c=document.createElement('canvas');c.width=400;c.height=300;c.getContext('2d').fillRect(0,0,400,300);
        const jpg=new Uint8Array(await (await new Promise(r=>c.toBlob(r,'image/jpeg'))).arrayBuffer());
        const dt=[...'2025:03:14 19:30:00'].map(ch=>ch.charCodeAt(0)).concat(0);// 20 bytes
        // TIFF (little endian): IFD0 with ExifIFD pointer → Exif IFD with DateTimeOriginal
        const t=[0x49,0x49,0x2a,0,8,0,0,0, 1,0, 0x69,0x87,4,0,1,0,0,0,26,0,0,0, 0,0,0,0, 1,0, 0x03,0x90,2,0,20,0,0,0,44,0,0,0, 0,0,0,0].concat(dt);
        const body=[0x45,0x78,0x69,0x66,0,0].concat(t),len=body.length+2,app1=[0xff,0xe1,len>>8,len&255].concat(body);
        return [...jpg.slice(0,2),...app1,...jpg.slice(2)];}).then(a=>Buffer.from(a));
      const files=[];for(let i=0;i<4;i++)files.push({name:i+'.png',mimeType:'image/png',buffer:await make(i*80)});
      const u=await page.evaluate(()=>{const r=DB.rows.find(r=>r.l===3&&r.ml);upOpenDetail(r.u);return r.u;});
      await page.waitForSelector('#detailDlg .mp-edit');
      // Detail sheets carry structured data and a canonical URL for search engines; platform links are present.
      const seo=await page.evaluate(()=>({ld:JSON.parse(document.getElementById('restaurantLd')?.textContent||'{}'),canon:document.querySelector('link[rel=canonical]').href}));
      assert.equal(seo.ld['@type'],'Restaurant');assert(seo.ld.award.includes('MICHELIN'));assert(seo.canon.includes('restaurant='));
      assert(await page.locator('#detailDlg .detail-platforms a').count()>=1);
      await page.locator('#detailDlg [data-photo-input]').setInputFiles([{name:'e.jpg',mimeType:'image/jpeg',buffer:exifJpeg},...files]);
      await page.waitForFunction(()=>document.querySelectorAll('#detailDlg .mp-edit .mp-tile.is-loaded').length===5);
      assert.equal(await page.inputValue('#visitDate'),'2025-03-14','EXIF date fills the empty meal date');
      assert(await page.locator('#detailDlg .mp-date-note').isVisible());
      const order=()=>page.evaluate(()=>MP.editIDs(document.querySelector('#detailDlg .mp-edit')));
      const start=await order();
      // Drag the third photo onto the first.
      await page.locator('#detailDlg [data-photo-tile]').nth(2).scrollIntoViewIfNeeded();
      const box=async i=>page.locator('#detailDlg [data-photo-tile]').nth(i).boundingBox();
      const from=await box(2),to=await box(0);
      if(mobile){
        const cdp=await ctx.newCDPSession(page);const pt=(x,y)=>[{x,y,id:1}];
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:pt(from.x+from.width/2,from.y+from.height/2)});await page.waitForTimeout(420);
        for(let k=1;k<=8;k++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:pt(from.x+from.width/2+(to.x-from.x)*k/8,from.y+from.height/2+(to.y-from.y)*k/8)});
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
      }else{
        await page.mouse.move(from.x+from.width/2,from.y+from.height/2);await page.mouse.down();await page.mouse.move(to.x+to.width/2,to.y+to.height/2,{steps:8});await page.mouse.up();
      }
      await page.waitForTimeout(300);
      let now=await order();assert.equal(now[0],start[2],'dragged photo becomes the cover');assert.equal(now.length,5);
      assert.equal(await page.locator('#detailDlg [data-photo-tile]').first().locator('.mp-cover').count(),1);
      assert(!(await page.evaluate(()=>document.getElementById('photoDlg')?.open)),'a drag does not open the viewer');
      if(!mobile){
        // Keyboard: Alt+→ moves the focused cover back one place.
        await page.locator('#detailDlg [data-photo-tile] .mp-open').first().focus();await page.keyboard.press('Alt+ArrowRight');
        now=await order();assert.equal(now[1],start[2]);
        await page.keyboard.press('Alt+ArrowLeft');now=await order();assert.equal(now[0],start[2]);
      }
      // Viewer: open the last photo, set it as cover.
      await page.locator('#detailDlg [data-photo-tile] .mp-open').nth(4).click();
      await page.waitForFunction(()=>document.getElementById('photoDlg')?.open);
      assert(await page.locator('#photoDlg .mp-tools').isVisible());
      const last=(await order())[4];await page.locator('#photoDlg [data-photo-act="cover"]').click();
      assert.equal((await order())[0],last);assert.equal(await page.locator('#photoCount').innerText(),'1 / 5');
      assert(await page.locator('#photoDlg [data-photo-act="cover"]').isDisabled());
      if(shots)await page.screenshot({path:path.join(shots,`photo-viewer-tools-${mobile?'mobile':'desktop'}.png`)});
      await page.locator('#photoDlg [data-photo-close]').click();
      // Remove + undo keeps the place.
      const second=(await order())[1];await page.locator('#detailDlg .mp-edit [data-photo-remove]').nth(1).click();
      assert.equal((await order()).length,4);assert.equal(await page.locator('#detailDlg [data-photo-count]').innerText(),'4');
      await page.locator('#detailDlg [data-photo-undo]').click();
      assert.equal((await order())[1],second);assert.equal((await order()).length,5);
      await page.waitForFunction(()=>document.querySelectorAll('#detailDlg .mp-edit .mp-tile.is-loaded').length===5);
      if(shots)await page.locator('#detailDlg .meal-editor').screenshot({path:path.join(shots,`photo-editor-${mobile?'mobile':'desktop'}.png`)});
      // Closing with unsaved changes asks first; "继续编辑" keeps everything.
      await page.keyboard.press('Escape');await page.waitForTimeout(150);
      assert(await page.evaluate(()=>document.getElementById('discardDlg')?.open),'Esc asks before discarding');
      if(shots)await page.screenshot({path:path.join(shots,`discard-${mobile?'mobile':'desktop'}.png`)});
      await page.locator('#discardDlg [data-keep]').click();
      assert(await page.evaluate(()=>document.getElementById('detailDlg').open));assert.equal((await order()).length,5);
      await page.locator('#detailDlg .detail-sheet-head .close').click();await page.waitForTimeout(150);
      assert(await page.evaluate(()=>document.getElementById('discardDlg').open),'close button asks too');
      await page.locator('#discardDlg [data-keep]').click();
      // Save keeps the chosen order; then closing no longer asks.
      const saved=await order();await page.locator('#detailDlg .visit-form button[type=submit]').click();await page.waitForSelector('#detailDlg .mp-strip');
      assert.deepEqual(await page.evaluate(u=>PERSONAL.records[u].visits[0].photos,u),saved);
      await page.locator('#detailDlg .detail-sheet-head .close').click();await page.waitForTimeout(150);
      assert(!(await page.evaluate(()=>document.getElementById('detailDlg').open)),'saved sheet closes without asking');
      assert(!(await page.evaluate(()=>!!document.getElementById('restaurantLd'))),'structured data is removed with the sheet');
      // Discarding a new meal's photos cleans them out of storage.
      await page.evaluate(u=>upOpenDetail(u),u);await page.locator('#detailDlg [data-add-visit]').click();
      await page.locator('#detailDlg .meal-new [data-photo-input]').setInputFiles([files[0]]);
      await page.waitForFunction(()=>document.querySelectorAll('#detailDlg .meal-new [data-photo-tile]').length===1);
      assert.equal(await page.evaluate(async()=>(await MP._keys()).length),6);
      await page.keyboard.press('Escape');await page.locator('#discardDlg [data-discard]').click();
      await page.waitForFunction(()=>!document.getElementById('detailDlg').open);
      await page.waitForFunction(async()=>(await MP._keys()).length===5,null,{timeout:5000});
      // HEIC that the browser cannot decode gets a readable message.
      const msg=await page.evaluate(async()=>{try{await MP.add(new File([new Uint8Array(16)],'a.heic',{type:'image/heic'}),'x');return '';}catch(e){return e.message;}});
      assert(msg.includes('HEIC'),msg);
      await ctx.close();
    }
    assert.deepEqual(errors,[]);
    console.log('photo-order: ok');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});

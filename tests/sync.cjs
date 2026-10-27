// Cloud sync end-to-end: two browser profiles ("phone" and "laptop") sync through an in-memory
// stand-in for the Supabase RPCs (same contract as the SQL functions). Run: node tests/sync.cjs
const assert=require('node:assert/strict'),http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');const {chromium}=require('playwright');
(async()=>{
  const base=path.resolve(__dirname,'..');
  const server=http.createServer((req,res)=>{let file=path.resolve(base,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===base)file=path.join(base,'index.html');
    if(!file.startsWith(base+path.sep)){res.writeHead(403);return res.end();}
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'text/plain');
    try{res.end(fs.readFileSync(file));}catch(e){res.writeHead(404);res.end('missing');}});
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port,shots=process.env.SCREENSHOT_DIR;
  // ---- stand-in for public.mg_* ----
  const db=new Map(),photos=new Map();let calls=0;
  const key=code=>{if(typeof code!=='string'||code.length<20||!/^[A-Z0-9-]+$/.test(code))throw new Error('invalid sync code');return crypto.createHash('sha256').update(code).digest('hex');};
  const rpc={mg_pull:({code})=>{const k=key(code),r=db.get(k);return r?{rev:r.rev,data:r.data,photos:[...(photos.get(k)||new Map()).keys()]}:{rev:0,data:null};},
    mg_push:({code,data,base_rev})=>{const k=key(code),r=db.get(k)||{rev:0};if(r.rev!==base_rev)return {ok:false,rev:r.rev};db.set(k,{rev:r.rev+1,data});return {ok:true,rev:r.rev+1};},
    mg_photo_put:({code,photo_id,data})=>{const k=key(code);assert(db.has(k));assert(/^data:image\/jpeg;base64,/.test(data));if(!photos.has(k))photos.set(k,new Map());photos.get(k).set(photo_id,data);return true;},
    mg_photo_get:({code,ids})=>{const m=photos.get(key(code))||new Map();return Object.fromEntries(ids.slice(0,20).filter(i=>m.has(i)).map(i=>[i,m.get(i)]));},
    mg_photo_delete:({code,ids})=>{const m=photos.get(key(code))||new Map();let n=0;for(const i of ids)if(m.delete(i))n++;return n;}};
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});const errors=[];
  async function device(name){
    const ctx=await browser.newContext({locale:'zh-CN',viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2,permissions:['clipboard-read','clipboard-write']});
    await ctx.route(/^https:\/\/dclxhxxjktegyiwafmsv\.supabase\.co\/rest\/v1\/rpc\/(\w+)$/,async route=>{calls++;const fn=route.request().url().split('/').pop();
      assert.equal(route.request().headers().apikey,'sb_publishable_2K9O3h8nn2I_I-cIAdks8A_QZ98xwZ2');
      try{route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(rpc[fn](route.request().postDataJSON()))});}catch(e){route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:e.message})});}});
    await ctx.route(/^https:\/\/(?!127\.0\.0\.1|dclxhxxjktegyiwafmsv).*/,r=>r.fulfill({status:404,body:''}));
    const page=await ctx.newPage();page.on('pageerror',e=>errors.push(name+': '+e.message));
    await page.goto(url+'/#v=me');await page.waitForFunction(()=>typeof DB!=='undefined'&&DB&&DB.rows.length>1000&&document.getElementById('syncCard'));return page;
  }
  const settle=p=>p.waitForFunction(()=>MGSync._status().state!=='busy'&&MGSync.state()?.at>0,null,{timeout:20000});
  try{
    const phone=await device('phone'),laptop=await device('laptop');
    const rows=await phone.evaluate(()=>DB.rows.filter(r=>r.ml&&r.l<=2).slice(0,4).map(r=>r.u));
    // phone: some records + a photo, then turn on sync
    const png=Buffer.from(await phone.evaluate(()=>{const c=document.createElement('canvas');c.width=640;c.height=480;const g=c.getContext('2d');g.fillStyle='#c33';g.fillRect(0,0,640,480);return c.toDataURL('image/png').split(',')[1];}),'base64');
    await phone.evaluate(u=>{FAV[u[0]]=[1,Date.now()];FAV[u[1]]=[1,Date.now()];saveFav();upOpenDetail(u[2]);},rows);
    await phone.locator('#detailDlg [data-photo-input]').setInputFiles([{name:'a.png',mimeType:'image/png',buffer:png}]);
    await phone.waitForFunction(()=>document.querySelectorAll('#detailDlg .mp-edit [data-photo-tile]').length===1);
    await phone.fill('#visitDate','2026-10-01');await phone.locator('#detailDlg .visit-form button[type=submit]').click();
    await phone.evaluate(()=>closeAppDialog(document.getElementById('detailDlg')));
    await phone.locator('#tabbar [data-tab="me"]').click();await phone.locator('[data-me-jump="meSync"]').click();await phone.locator('[data-sync="start"]').click();await settle(phone);
    const code=await phone.evaluate(()=>MGSync.state().code);assert.match(code,/^MG(-[A-Z2-9]{4}){6}$/);
    assert.equal(await phone.locator('#syncCard code').innerText(),code,'new code shown in full');
    assert.equal([...photos.values()][0].size,1,'photo uploaded');
    if(shots)await phone.locator('#syncCard').screenshot({path:path.join(shots,'sync-on.png')});
    // laptop: its own record, then join with the code → union
    await laptop.evaluate(u=>{FAV[u[3]]=[1,Date.now()];saveFav();},rows);
    await laptop.locator('#tabbar [data-tab="me"]').click();await laptop.locator('[data-me-jump="meSync"]').click();await laptop.locator('[data-sync="join"]').click();
    if(shots)await laptop.locator('#syncCard').screenshot({path:path.join(shots,'sync-join.png')});
    await laptop.fill('#syncInput',code.toLowerCase().replaceAll('-',' '));await laptop.locator('#syncJoin button').click();await settle(laptop);
    const lap=await laptop.evaluate(u=>({fav:u.map(x=>FAV[x]?.[0]||0),visits:upVisits(u[2]).length,photo:upVisits(u[2])[0]?.photos?.length||0}),rows);
    assert.deepEqual(lap.fav,[1,1,2,1]);assert.equal(lap.visits,1);assert.equal(lap.photo,1);
    await laptop.waitForFunction(async()=>(await MP._keys()).length===1,null,{timeout:10000}).catch(async()=>{assert.equal(await laptop.evaluate(async()=>(await MP._keys()).length),1,'photo downloaded');});
    // concurrent edits: phone removes a want + adds a meal; laptop renames nothing but adds a trip; both sync
    await phone.evaluate(u=>{delete FAV[u[0]];saveFav();},rows);
    await laptop.evaluate(u=>{const t=upNewTrip('东京');upSave({...PERSONAL,trips:PERSONAL.trips.map(x=>x.id===t.id?{...x,items:[u[1]]}:x)});},rows);
    await phone.evaluate(()=>MGSync.sync());await laptop.evaluate(()=>MGSync.sync());await phone.evaluate(()=>MGSync.sync());
    const p=await phone.evaluate(u=>({gone:!FAV[u[0]],trips:PERSONAL.trips.map(t=>t.name),fourth:FAV[u[3]]?.[0]}),rows),l=await laptop.evaluate(u=>({gone:!FAV[u[0]],trips:PERSONAL.trips.map(t=>t.name)}),rows);
    assert.deepEqual(p,{gone:true,trips:['东京'],fourth:1});assert.deepEqual(l,{gone:true,trips:['东京']});
    // automatic: a change on the phone reaches the cloud without pressing anything
    const before=[...db.values()][0].rev;await phone.evaluate(u=>{FAV[u[1]]=[2,Date.now()];saveFav();},rows);
    await new Promise(r=>setTimeout(r,7000));assert([...db.values()][0].rev>before,'auto-sync pushed the change');
    // bad code
    await laptop.evaluate(()=>{localStorage.removeItem('mg-sync');});await laptop.reload();await laptop.waitForFunction(()=>document.getElementById('syncCard'));
    await laptop.locator('#tabbar [data-tab="me"]').click();await laptop.locator('[data-me-jump="meSync"]').click();await laptop.locator('[data-sync="join"]').click();await laptop.fill('#syncInput','MG-1234');await laptop.locator('#syncJoin button').click();
    assert((await laptop.locator('#toast').innerText()).includes('同步码格式不对'));
    // stop syncing keeps local data
    await phone.evaluate(()=>{window.confirm=()=>true;});await phone.locator('[data-sync="stop"]').click();assert.equal(await phone.evaluate(()=>MGSync.state()),null);
    assert.equal(await phone.evaluate(u=>FAV[u[1]]?.[0],rows),2);
    if(shots)await phone.locator('#syncCard').screenshot({path:path.join(shots,'sync-off.png')});
    assert.deepEqual(errors,[]);
    console.log(`PASS: cloud sync — start with new code, photo upload, join on second device (sloppy code input), union of records + photo download, concurrent edits incl. deletion, auto-push of changes, bad code, stop keeps data; ${calls} API calls; no browser errors.`);
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});

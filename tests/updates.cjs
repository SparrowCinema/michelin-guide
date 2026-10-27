// "本次更新" banner, guide-edition line and the editions dialog. Run: node tests/updates.cjs
const assert=require('node:assert/strict'),http=require('http'),fs=require('fs'),path=require('path');const {chromium}=require('playwright');
(async()=>{
  const base=path.resolve(__dirname,'..');
  const server=http.createServer((req,res)=>{let file=path.resolve(base,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(file===base)file=path.join(base,'index.html');
    if(!file.startsWith(base+path.sep)){res.writeHead(403);return res.end();}
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp'})[path.extname(file)]||'text/plain');
    try{res.end(fs.readFileSync(file));}catch(e){res.writeHead(404);res.end('missing');}});
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    const page=await (await browser.newContext({locale:'zh-CN',viewport:{width:390,height:844}})).newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route(/^https:\/\/(?!127\.0\.0\.1).*/,r=>r.fulfill({status:404,body:''}));
    await page.goto(url+'/#v=list');await page.waitForSelector('#updateBanner:not([hidden]) .ub-stats');
    const upd=JSON.parse(fs.readFileSync(path.join(base,'updates.json'),'utf8')).updates[0];
    const added=upd.guides.reduce((t,g)=>t+g.added.length,0);
    assert((await page.locator('.ub-stats').innerText()).includes(String(added)));
    assert((await page.locator('#updateBanner h2').innerText()).includes(upd.data.slice(0,4)));
    await page.locator('.ub-more-wrap:not(.ub-pending)>summary').click();assert.equal(await page.locator('.ub-guide').count(),upd.guides.length);
    await page.locator('.ub-guide').first().locator('summary').click();await page.locator('.ub-guide').first().locator('button.ub-r').first().click();
    await page.waitForSelector('#detailDlg[open] .detail-guide');assert.match(await page.locator('.detail-guide').innerText(),/米其林指南 .+ 20\d\d/);
    await page.evaluate(()=>closeAppDialog(document.getElementById('detailDlg')));
    // pending edition is explained on the restaurant page
    const nl=await page.evaluate(()=>{const r=DB.rows.find(r=>DB.T[r.ci][2]==='Zurich');upOpenDetail(r.u);return document.querySelector('.detail-guide').innerText;});
    assert(nl.includes('瑞士 2025')&&nl.includes('2026 新版已于'));await page.evaluate(()=>closeAppDialog(document.getElementById('detailDlg')));
    await page.locator('[data-ub="guides"]').click();await page.waitForSelector('#guidesDlg[open]');
    assert.equal(await page.locator('.guides-table tbody tr').count(),await page.evaluate(()=>DB.E.length));
    assert(!(await page.evaluate(()=>{const d=document.getElementById('guidesDlg');return d.scrollWidth>d.clientWidth+1;})),'editions table fits a phone');
    await page.evaluate(()=>closeAppDialog(document.getElementById('guidesDlg')));
    await page.locator('.ub-close').click();assert(await page.locator('.ub-bar').isVisible());
    await page.reload();await page.waitForSelector('.ub-bar');await page.locator('.ub-bar').click();assert(await page.locator('.ub-stats').isVisible());
    assert.deepEqual(errors,[]);
    console.log('PASS: update banner — totals, per-guide changes, open restaurant, guide edition line incl. pending edition, editions dialog fits, collapse/remember/reopen; no browser errors.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1);});

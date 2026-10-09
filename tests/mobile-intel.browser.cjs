/* Run with a locally installed Chromium: CHROMIUM_PATH=/usr/bin/chromium node tests/mobile-intel.browser.cjs */
const {chromium,devices}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}try{res.setHeader('Content-Type',file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'application/json');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 try{
 for(const scenario of ['local-leaflet','missing-leaflet','situation-startup-failure','data-startup-failure']){
  const context=await browser.newContext({...devices['Pixel 7'],serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.origin!==origin)return route.abort();
   if(scenario==='missing-leaflet'&&url.pathname==='/vendor/leaflet/leaflet.js')return route.abort();
   if(scenario==='situation-startup-failure'&&url.pathname==='/situation-ui.js')return route.fulfill({contentType:'application/javascript',body:'throw new Error("injected situation startup failure")'});
   if(scenario==='data-startup-failure'&&url.pathname==='/index.html')return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'index.html'),'utf8').replace('<script>\nconst D=', '<script>\nthrow new Error("injected data startup failure");\nconst D=')});
   return route.continue();
  });
  await page.goto(origin+'/index.html');
  const panel=page.locator('#mobileIntelPanel'),open=page.locator('#mobileIntel'),close=page.locator('#mobileIntelClose');
  assert(!await panel.isVisible());
  for(let i=0;i<2;i++){
   await open.tap();await panel.waitFor({state:'visible'});assert.equal(await open.getAttribute('aria-expanded'),'true');
   const box=await close.boundingBox();assert(box&&box.y>=0&&box.y+box.height<=page.viewportSize().height,'Close is visible in mobile viewport');
   await close.tap();await panel.waitFor({state:'hidden'});assert.equal(await open.getAttribute('aria-expanded'),'false');
  }
  await open.tap();await page.keyboard.press('Escape');await panel.waitFor({state:'hidden'});
  // The independent Layers controller must also survive the same startup errors.
  await page.locator('#layersToggle').tap();assert(!await page.locator('#layersPanel').evaluate(el=>el.classList.contains('collapsed')));await page.locator('#layersClose').tap();assert(await page.locator('#layersPanel').evaluate(el=>el.classList.contains('collapsed')));
  const expected=scenario==='missing-leaflet'?'L is not defined':scenario==='situation-startup-failure'?'injected situation startup failure':'injected data startup failure';
  if(scenario==='local-leaflet'){assert.equal(await page.evaluate(()=>L.version),'1.9.4');assert(await page.locator('#map').evaluate(el=>el.classList.contains('leaflet-container')));assert.deepEqual(errors,[])}else assert(errors.some(e=>e.includes(expected)),JSON.stringify(errors));
  console.log('Pixel 7: '+scenario+' — open, Close, Escape and Layers passed');
  await context.close();
 }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());

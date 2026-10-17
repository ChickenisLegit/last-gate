// PUPPETEER=<path to puppeteer-core's esm entry, or package name> CHROME=<chrome.exe> BASE=http://127.0.0.1:4173 node scripts/recovery-smoke.mjs
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
const spec = process.env.PUPPETEER ?? 'puppeteer-core';
const { default: puppeteer } = await import(fs.existsSync(spec) ? pathToFileURL(spec).href : spec);
const BASE = process.env.BASE ?? 'http://127.0.0.1:4173';
const browser = await puppeteer.launch({executablePath:process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--no-sandbox','--disable-background-timer-throttling','--disable-renderer-backgrounding','--autoplay-policy=no-user-gesture-required']});
const page=await browser.newPage();await page.setViewport({width:1440,height:810});const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto(`${BASE}/?phase6=wake`,{waitUntil:'networkidle0'});await page.waitForFunction(()=>window.__lastGateWorld?.baymax,{timeout:60000});
await new Promise(r=>setTimeout(r,6000));await page.screenshot({path:'artifacts/claude-recovery/wake.png'});
console.log('WAKE',await page.evaluate(()=>({stage:window.__lastGateP6.store.getState().stage,buttons:[...document.querySelectorAll('button')].map(x=>x.textContent)})));
for (const stage of ['limited','escape','gate','faceoff','drop','carry','bloom','home','boot','end']){
 await page.evaluate(s=>window.__lastGateP6.go(s),stage);await new Promise(r=>setTimeout(r,stage==='home'?9000:2500));await page.screenshot({path:`artifacts/claude-recovery/${stage}.png`});console.log(stage,await page.evaluate(()=>({stage:window.__lastGateP6.store.getState().stage,meshes:window.__lastGateWorld.gl.info.render.calls,body:document.body.innerText.slice(-200)})));
}
fs.writeFileSync('artifacts/claude-recovery/smoke-errors.json',JSON.stringify(errors,null,2));console.log('ERRORS',errors);await browser.close();



import { chromium } from 'file:///C:/Users/dmdbu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/dmdbu/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe'});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1});
const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
await page.goto('http://127.0.0.1:4174/#final/EXIT_VECTOR',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__LATTICE_FINAL);await page.evaluate(()=>window.__LATTICE_FINAL.pause(true));await page.waitForTimeout(1000);
for(let i=0;i<4;i++){
 const start=await page.evaluate(i=>window.__LATTICE_FINAL.endpoints()[i],i),end=await page.evaluate(()=>window.__LATTICE_FINAL.target());
 await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:5});await page.mouse.up();await page.waitForTimeout(400);
 console.log('aligned',i,await page.evaluate(()=>window.__LATTICE_FINAL.status().aligned));
}
await mkdir('validation/final',{recursive:true});
for(const [stage,time,name] of [['MAX_ATTACK',1,'01-quiet'],['MAX_ATTACK',19,'02-charge'],['MAX_ATTACK',20.15,'03-impact'],['VECTOR_CAPTURE',8.6,'04-captured'],['PORTAL_RECONSTRUCTION',15,'05-portal'],['FINAL_ESCAPE',7,'06-conflict'],['FINAL_ESCAPE',12,'07-sacrifice'],['FINAL_ESCAPE',19,'08-near-catch'],['HOME',8,'09-home'],['EPILOGUE',3,'10-unknown'],['EPILOGUE',8,'11-lost'],['FINAL_BLACK',3,'12-black']]){
 await page.evaluate(([stage,time])=>window.__LATTICE_FINAL.enter(stage,time),[stage,time]);await page.waitForTimeout(600);await page.screenshot({path:`validation/final/${name}.png`});console.log(name,await page.evaluate(()=>window.__LATTICE_FINAL.status()));
}
console.log('errors',errors);await writeFile('validation/final/errors.json',JSON.stringify(errors,null,2));await browser.close();

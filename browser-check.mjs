import {chromium} from 'file:///C:/Users/dmdbu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/dmdbu/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe'});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}, reducedMotion:'reduce'});page.setDefaultTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base = process.env.CHECK_URL ?? 'http://127.0.0.1:4173';
 await page.goto(`${base}/?phase2=null#final/EXIT_VECTOR`);
 await page.waitForFunction(()=>window.__lattice && window.__lattice.getState().phase!=='loading',{},{timeout:60000});
 if(await page.locator('.experience').count()!==1) throw Error('Old route bypassed opening');
 await page.evaluate(()=>window.__lattice.setState({chapter:'THE_FRACTURE',phase:'handoff',subtitle:''}));
 await page.waitForFunction(()=>window.__latticePhaseII,{},{timeout:60000});
 await page.evaluate(()=>{const d=window.__latticePhaseII.director;for(let i=0;i<170;i++)d.step(.05);if(d.getSnapshot().stage!=='afterimage')throw Error('Afterimage missing');d.act();for(let i=0;i<70;i++)d.step(.05);});
 await page.getByRole('button',{name:/FOLLOW THE TRACE/}).click();
 await page.getByRole('button',{name:'Approach Baymax',exact:true}).waitFor({timeout:60000});
 await page.evaluate(()=>window.recoveryCanvas=document.querySelector('canvas'));
 await page.getByRole('button',{name:'Approach Baymax',exact:true}).click();
 await page.getByRole('button',{name:'Chest access',exact:true}).click();
 await page.getByText('The combat chip is still inside.',{exact:false}).waitFor();
 await page.getByRole('textbox').fill('Check the chip before proceeding.');
 await page.getByRole('button',{name:'Return to street view'}).click();
 await page.getByRole('button',{name:'Approach Baymax',exact:true}).click();
 if(await page.getByRole('textbox').inputValue()!=='Check the chip before proceeding.')throw Error('Notes lost');
 if(!await page.evaluate(()=>window.recoveryCanvas===document.querySelector('canvas')))throw Error('Viewport remounted');
 await page.getByRole('button',{name:'Overview',exact:true}).click();
 if (await page.locator('.recovery-arrival').evaluate(node => getComputedStyle(node).opacity) !== '0') throw Error('Arrival cover blocks reduced-motion viewport');
 if (process.env.CHECK_SCREENSHOT) {
   await page.waitForTimeout(2500);
   await page.screenshot({path:process.env.CHECK_SCREENSHOT});
 }
 if(errors.length)throw Error(JSON.stringify(errors));
 console.log(JSON.stringify({opening:true,oldRoutesIgnored:true,handoff:true,afterimage:true,recovery:true,sameCanvas:true,notesPersist:true,browserErrors:errors}));
} finally {await browser.close();}

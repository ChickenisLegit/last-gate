import {chromium} from 'file:///C:/Users/dmdbu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/dmdbu/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe'});
try{
 const p=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'});p.setDefaultTimeout(90000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const base=process.env.CHECK_URL??'http://127.0.0.1:4173';
 await p.goto(`${base}/?phase2=null#final/EXIT_VECTOR`);
 await p.waitForFunction(()=>window.__lattice?.getState().phase!=='loading'&&window.__lattice?.getState().phase,{},{timeout:90000});
 if(await p.locator('.experience').count()!==1)throw Error('Retired route bypasses opening');
 await p.evaluate(()=>window.__lattice.setState({chapter:'THE_FRACTURE',phase:'handoff',subtitle:''}));
 await p.getByRole('button',{name:'Approach Baymax',exact:true}).waitFor({timeout:90000});
 if(await p.getByText(/FOCUS ON THE STILL LINE/).count())throw Error('Line scan remains');
 await p.waitForFunction(()=>window.__baymaxInspection?.model);
 const original=await p.evaluate(()=>{window.testCanvas=document.querySelector('canvas');return window.__baymaxInspection.model.uuid;});
 await p.getByRole('button',{name:'Approach Baymax',exact:true}).click();
 await p.getByRole('heading',{name:/Baymax recovery/}).waitFor();
 await p.getByRole('textbox',{name:'Field notes'}).fill('Healthcare socket must be inspected.');
 await p.getByRole('button',{name:'Street view ↗'}).click();await p.getByRole('button',{name:'Approach Baymax',exact:true}).click();
 if(await p.getByRole('textbox',{name:'Field notes'}).inputValue()!=='Healthcare socket must be inspected.')throw Error('Notes lost');
 const stats=await p.evaluate(()=>({sameCanvas:window.testCanvas===document.querySelector('canvas'),sameModel:window.__baymaxInspection.model.uuid,city:window.__baymaxInspection.scene.getObjectByName('PortalDimension')?.name}));
 if(!stats.sameCanvas||stats.sameModel!==original||stats.city)throw Error('Workspace retains city or reloads model');
 if(await p.locator('.recovery-arrival').evaluate(n=>getComputedStyle(n).opacity)!=='0')throw Error('Arrival cover remains');
 if(errors.length)throw Error(JSON.stringify(errors));console.log(JSON.stringify({opening:true,directRecovery:true,noScan:true,sameModel:true,sameCanvas:true,cityUnloaded:true,notesPersist:true,errors}));
}finally{await browser.close();}

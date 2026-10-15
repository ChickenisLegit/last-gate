import {chromium} from 'file:///C:/Users/dmdbu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core/index.mjs';
const browser=await chromium.launch({headless:true,executablePath:'C:/Users/dmdbu/AppData/Local/ms-playwright/chromium_headless_shell-1234/chrome-headless-shell-win64/chrome-headless-shell.exe'});
try{
 const p=await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'reduce'});p.setDefaultTimeout(60000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const base=process.env.CHECK_URL??'http://127.0.0.1:4173';
 await p.goto(`${base}/?recovery=diagnostics`);
 await p.waitForFunction(()=>window.__baymaxInspection?.model);
 await p.waitForTimeout(1000);
 const point=await p.evaluate(()=>{const d=window.__baymaxInspection;const head=d.model.getObjectByName('dormant-head');const v=d.camera.position.clone().set(0,0,0);head.getWorldPosition(v);v.project(d.camera);return {x:v.x,y:v.y};});
 const viewport=await p.locator('canvas').boundingBox();await p.mouse.click(viewport.x+(point.x*.5+.5)*viewport.width,viewport.y+(-point.y*.5+.5)*viewport.height);
 await p.getByRole('navigation').getByRole('button',{name:new RegExp('^Sensor / targeting')}).getAttribute('aria-pressed').then(value=>{if(value!=='true')throw Error('Physical region selection failed');});
 console.log('loaded',await p.evaluate(()=>({drawCalls:window.__baymaxInspection.gl.info.render.calls,sceneChildren:window.__baymaxInspection.scene.children.map(x=>x.name||x.type)})));
 const select=async(name)=>p.getByRole('navigation').getByRole('button',{name:new RegExp('^'+name)}).click();
 await select('Program core');await p.getByRole('button',{name:'Open program bay',exact:true}).click();await p.getByText('NOT PRESENT',{exact:true}).waitFor();

 await select('Power distribution');await p.getByRole('button',{name:'Read test points',exact:true}).click();await p.getByRole('button',{name:/B · auxiliary/}).click();
 if(await p.getByRole('checkbox').isChecked())throw Error('Bypass implicitly isolated');
 await p.getByRole('checkbox').check();await p.getByRole('button',{name:/B · auxiliary/}).click();
 if(!await p.evaluate(()=>{const m=window.__baymaxInspection.model;const bus=m.getObjectByName('power-bypass').material.color,chip=m.getObjectByName('combat-program-chip').material.color;return bus.g>bus.r&&chip.r>chip.g;}))throw Error('Power feedback changed the combat chip or did not update bus');
 await select('Left thruster');await p.getByRole('button',{name:'Read test points',exact:true}).click();
 const range=async(name,value)=>{const input=p.getByRole('slider',{name,exact:true});await input.fill(String(value));await input.dispatchEvent('change');};
 await range('Connector insertion',100);await p.getByText('KEY BLOCKED',{exact:true}).waitFor();
 await range('Connector rotation',90);await range('Connector insertion',100);await p.getByText('SEATED',{exact:true}).waitFor();
 if(!await p.evaluate(()=>{const plug=window.__baymaxInspection.model.getObjectByName('left-control-plug');return Math.abs(plug.rotation.z-Math.PI/2)<.01&&Math.abs(plug.position.z+.97)<.01;}))throw Error('3D plug did not rotate and seat');
 await select('Arm / actuator');await p.getByRole('button',{name:'Read test points',exact:true}).click();await p.getByRole('button',{name:'Store neutral position'}).click();await p.getByText(/outside tolerance/).waitFor();await range('Encoder angle',12);await p.getByRole('button',{name:'Store neutral position'}).click();
 for(const name of ['Right thruster','Motor control','Armour connections','Sensor / targeting']){await select(name);await p.getByRole('button',{name:'Read test points',exact:true}).click();}
 await p.getByText('ASSESSMENT COMPLETE',{exact:true}).waitFor();
 await select('Program core');await p.getByRole('button',{name:'isolate',exact:true}).click();

 const before=await p.evaluate(()=>window.__baymaxInspection.camera.position.toArray());
 const box=await p.locator('canvas').boundingBox();await p.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await p.mouse.down();await p.mouse.move(box.x+box.width*.7,box.y+box.height*.55,{steps:6});await p.mouse.up();await p.mouse.wheel(0,-180);
 const after=await p.evaluate(()=>window.__baymaxInspection.camera.position.toArray());if(JSON.stringify(before)===JSON.stringify(after))throw Error('Orbit/zoom inactive');
 const idle=await p.evaluate(()=>window.__baymaxInspection.gl.info.render.frame);await p.waitForTimeout(500);const idle2=await p.evaluate(()=>window.__baymaxInspection.gl.info.render.frame);if(idle2-idle>3)throw Error('Idle viewport continuously renders');
 if(process.env.CHECK_SCREENSHOT)await p.screenshot({path:process.env.CHECK_SCREENSHOT});
 if(errors.length)throw Error(JSON.stringify(errors));console.log(JSON.stringify({repairs:true,absentChip:true,completion:true,orbitZoom:true,idleFrames:idle2-idle,errors}));
}finally{await browser.close();}

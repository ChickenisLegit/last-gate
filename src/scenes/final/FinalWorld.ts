import * as T from 'three';
import { FinalRuntime } from './FinalRuntime';
import { FinalBaymax } from './FinalBaymax';
import { FinalPortal } from './FinalPortal';
import { box, ellipsoid, line, mesh, seeded, v, disposeTree, labelTexture } from './geometry';
import { clamp, ease } from './sequence';

const BOT_COUNT=720, VECTOR_SAMPLES=80;
type Path={group:T.Group;curve:T.CatmullRomCurve3;body:T.Mesh;original:Float32Array;handle:T.Mesh;label:T.Sprite;points:T.Vector3[]};

/** All final-phase transforms run in this one controller. No per-bot React work. */
export class FinalWorld {
 readonly root=new T.Group(); readonly baymax=new FinalBaymax(); readonly portal=new FinalPortal();
 readonly vectors:Path[]=[]; readonly swarm:T.InstancedMesh;
 private chamber=new T.Group();private vectorGroup=new T.Group();private anchors:T.Group[]=[];
 private slabs:{mesh:T.Mesh;origin:T.Vector3;rotation:T.Euler}[]=[];
 private dummy=new T.Object3D();private target=v();private scratch=v();private seeds:Float32Array;
 private botMaterial:T.MeshStandardMaterial;private anchorLight:T.MeshBasicMaterial;
 private beam:T.Mesh;private pressure:T.Mesh;private trace:T.Mesh;private shield:T.Mesh;
 private redLight=new T.PointLight('#e94439',0,65,1.5);private portalLight=new T.PointLight('#b8f8ff',0,42,1.4);
 private ambient=new T.HemisphereLight('#b1d4e1','#16171b',.4);private sun=new T.DirectionalLight('#ffe4bc',2.7);
 private voidColor=new T.Color('#050a10');private homeColor=new T.Color('#b5cbd1');private fog=new T.FogExp2('#0b1924',.015);
 private ray=new T.Raycaster();private plane=new T.Plane(v(0,0,1),24);private grab=v();private hit=v();private ndc=new T.Vector2();
 private point:T.Mesh;private redPoint:T.Mesh;private initialPos=v();private look=v();
 white=0;distortion=0;selected=0;private lastStage='';
 constructor(readonly runtime:FinalRuntime,readonly scene:T.Scene,readonly camera:T.PerspectiveCamera){
  this.root.name='LAST GATE / final phase';scene.add(this.root);scene.fog=this.fog;scene.background=this.voidColor;
  this.root.add(this.chamber,this.vectorGroup,this.baymax.group,this.portal.group,this.portal.home.group,this.redLight,this.portalLight,this.ambient,this.sun);
  this.sun.position.set(-16,38,12);this.portalLight.position.set(0,4,-21);
  this.anchorLight=new T.MeshBasicMaterial({color:'#a8efff',transparent:true,opacity:.8});
  this.createChamber();this.createVectors();
  this.botMaterial=new T.MeshStandardMaterial({color:'#5e8490',metalness:.78,roughness:.32,emissive:'#60b8d5',emissiveIntensity:.32});
  this.swarm=new T.InstancedMesh(new T.BoxGeometry(.065,.04,.13),this.botMaterial,BOT_COUNT);this.swarm.instanceMatrix.setUsage(T.DynamicDrawUsage);this.swarm.frustumCulled=false;this.root.add(this.swarm);
  const rand=seeded(221);this.seeds=new Float32Array(BOT_COUNT*4);for(let i=0;i<this.seeds.length;i++)this.seeds[i]=rand();
  this.beam=mesh(this.root,new T.CylinderGeometry(.12,.38,15,12,1,true),new T.MeshBasicMaterial({color:'#ffe4c6',transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false}),0,3,-29);this.beam.rotation.x=Math.PI/2;
  this.pressure=mesh(this.root,new T.SphereGeometry(1,32,16),new T.MeshBasicMaterial({color:'#a7e5fa',wireframe:true,transparent:true,opacity:0,depthWrite:false}),0,3,-22);
  this.trace=mesh(this.root,new T.TubeGeometry(new T.CatmullRomCurve3([v(0,3,-43),v(0,3,-24),v(0,12,-8),v(12,22,5)]),100,.025,5,false),new T.MeshBasicMaterial({color:'#d5faff',transparent:true,opacity:0,depthWrite:false}));
  this.shield=mesh(this.root,new T.SphereGeometry(3,24,14,0,Math.PI*1.25,0,Math.PI*.78),new T.MeshBasicMaterial({color:'#9cdfe9',wireframe:true,transparent:true,opacity:0,side:T.DoubleSide,depthWrite:false}),0,2,4);this.shield.rotation.y=-Math.PI*.6;
  this.point=mesh(this.vectorGroup,new T.SphereGeometry(.055,12,8),new T.MeshBasicMaterial({color:'#c4f9ff'}),0,3.5,-24);
  this.redPoint=mesh(this.root,new T.SphereGeometry(.09,12,8),new T.MeshBasicMaterial({color:'#ff3e36',fog:false}),8,18,-100);
  // Stencil aperture writes before the home diorama; clear depth only, retain its mask.
  const sky=this.portal.home.group.children[0];sky.renderOrder=11;sky.onBeforeRender=renderer=>renderer.clearDepth();
 }
 private createChamber(){
  const floor=new T.MeshStandardMaterial({color:'#18232c',metalness:.5,roughness:.34});
  const walls=new T.MeshStandardMaterial({color:'#15212b',metalness:.28,roughness:.72});
  const edge=new T.MeshBasicMaterial({color:'#243e4a'});
  // A broken architectural basin, framed by immense quiet planes.
  for(let i=0;i<7;i++){
   const slab=box(this.chamber,floor,(i%2===0?-.15:.15),-.4,-5-i*9,16,.65,8.8);this.slabs.push({mesh:slab,origin:slab.position.clone(),rotation:slab.rotation.clone()});
   for(const side of [-1,1])box(this.chamber,edge,side*7.95,-.03,-5-i*9,.025,.015,7.8);
  }
  const r=seeded(13);
  for(let i=0;i<16;i++){
   const side=i%2?-1:1,z=-8-Math.floor(i/2)*11;
   const p=box(this.chamber,walls,side*(17+r()*9),5+r()*12,z,4+r()*5,15+r()*20,2+r()*5);
   p.rotation.z=side*(.02+r()*.08);this.slabs.push({mesh:p,origin:p.position.clone(),rotation:p.rotation.clone()});
   line(this.chamber,[v(side*16,-1,z),v(side*16,15,z),v(side*20,22,z-3)],'#233b47',.45);
  }
  box(this.chamber,walls,0,31,-54,70,1.2,4);
  const ceramic=new T.MeshStandardMaterial({color:'#2f414c',metalness:.7,roughness:.3});
  for(const [x,z] of [[-6,-19],[6,-19],[0,-31]]){
   const anchor=new T.Group();anchor.position.set(x,0,z);this.anchors.push(anchor);this.chamber.add(anchor);
   box(anchor,ceramic,0,.11,0,1.2,.22,1.2);
   for(const s of [-1,1]){const arm=box(anchor,ceramic,s*.29,1.3,0,.12,2.55,.25);arm.rotation.z=-s*.15;}
   box(anchor,this.anchorLight,0,1.5,.15,.032,1.8,.025);
   const brace=line(anchor,[v(-.48,.25,.3),v(0,2.7,.3),v(.48,.25,.3)],'#9ee5f5',.7);brace.name='deployed lattice anchor';
   const sprite=new T.Sprite(new T.SpriteMaterial({map:labelTexture(`LATTICE // 0${this.anchors.length}`),transparent:true,opacity:.55,depthWrite:false}));sprite.position.set(0,3.5,0);sprite.scale.set(2.5,.625,1);anchor.add(sprite);
  }
  // Local fragments react to pressure. There is no world-wide deformation simulation.
  for(let i=0;i<14;i++){
   const p=box(this.chamber,floor,(r()-.5)*18,.2+r()*1.3,-15-r()*23,.3+r()*.8,.1+r()*.2,.4+r());
   this.slabs.push({mesh:p,origin:p.position.clone(),rotation:p.rotation.clone()});
  }
 }
 private createVectors(){
  const start=[v(-18,9,-35),v(17,2,-14),v(-14,-2,-10),v(2,21,-48)];
  const mid=[v(-9,10,-17),v(10,10,-33),v(-8,3,-34),v(-6,13,-30)];
  for(let i=0;i<4;i++){
   const group=new T.Group();this.vectorGroup.add(group);
   const points=[start[i],mid[i],v(0,3.5,-24)];const curve=new T.CatmullRomCurve3(points);
   const mat=new T.MeshBasicMaterial({color:i===3?'#d2f9ff':'#72aeba',transparent:true,opacity:.75,depthWrite:false,stencilWrite:true,stencilRef:1,stencilFunc:T.NotEqualStencilFunc});
   const geo=new T.TubeGeometry(curve,VECTOR_SAMPLES,i===3?.032:.019,5,false),body=mesh(group,geo,mat);
   const original=new Float32Array(geo.attributes.position.array);
   const handle=mesh(group,new T.IcosahedronGeometry(.28,1),new T.MeshBasicMaterial({color:'#d9faff',wireframe:true}),0,3.5,-24);handle.userData.vector=i;
   const sprite=new T.Sprite(new T.SpriteMaterial({map:labelTexture(`VECTOR 0${i+1}`),transparent:true,opacity:.65,depthWrite:false}));sprite.position.copy(curve.getPoint(.52));sprite.position.y+=.65;sprite.scale.set(3,.75,1);group.add(sprite);
   this.vectors.push({group,curve,body,original,handle,label:sprite,points});
  }
 }
 update(dt:number){
  const r=this.runtime,s=r.stage,t=r.time,attack=s==='MAX_ATTACK',escape=s==='FINAL_ESCAPE',home=s==='HOME'||s==='EPILOGUE',black=s==='FINAL_BLACK';
  const charge=attack?ease((t-13)/7):0,blast=attack?clamp(1-(t-20)/2.3):0,impact=attack&&t>=20?blast:0;
  const capture=s==='VECTOR_CAPTURE';
  this.chamber.visible=!home&&!black;this.baymax.update(s,t);this.portal.update(s,t,r.aligned.filter(Boolean).length);this.redPoint.visible=s==='EPILOGUE'&&t>=2&&t<7;
  this.swarm.visible=!home&&!black;this.vectorGroup.visible=!home&&!black&&(s!=='MAX_ATTACK'||t>25);
  this.redLight.intensity=attack?4+charge*35:escape?t>3?12+ease((t-14)/5)*80:0:0;
  this.redLight.position.copy(this.baymax.group.position);this.redLight.position.y+=2;
  this.portalLight.intensity=s==='PORTAL_RECONSTRUCTION'?ease(t/15)*28:escape?28:0;
  this.ambient.intensity=home?.9:s==='PORTAL_RECONSTRUCTION'||escape?.55:.34;
  this.sun.intensity=home?2.7:this.portal.home.group.visible?2.2:1.35;
  this.fog.density=home||black?0:attack?.012+charge*.003:escape?.012:s==='EXIT_VECTOR'?.022:.017;
  this.scene.background=home?this.homeColor:black?new T.Color(0):this.voidColor;
  this.anchorLight.opacity=attack?clamp(.75-charge*.3+Math.sin(t*25)*impact*.4):.55;
  this.anchors.forEach((a,i)=>{a.rotation.z=impact*Math.sin(t*39+i)*.14;a.position.y=impact*.15;});
  for(let i=0;i<this.slabs.length;i++){
   const p=this.slabs[i],m=p.mesh;m.position.copy(p.origin);m.rotation.copy(p.rotation);
   if(attack){m.position.y+=charge*.08*Math.sin(i*3)+impact*Math.sin(i*2)*2.4;m.position.x+=impact*p.origin.x*.08;m.scale.set(1,1+impact*.6,1);m.rotation.z+=impact*Math.sin(i)*.1;}
   else{m.scale.set(1,1,1);if(s==='EXIT_VECTOR'||s==='PORTAL_RECONSTRUCTION')m.position.y-=ease(t/12)*3;if(escape){const fail=ease((t-13-i*.12)/8);m.position.x+=Math.sign(p.origin.x||1)*fail*(8+i*.6);m.position.y-=fail*(5+i*.7);m.rotation.z+=fail*Math.sin(i)*.4;}}
  }
  const beamMat=this.beam.material as T.MeshBasicMaterial;this.beam.visible=attack&&t>=20&&t<20.7;beamMat.opacity=clamp(1-(t-20)/.7);this.beam.scale.setScalar(1+impact*.7);
  this.pressure.visible=impact>0;this.pressure.scale.set(1+(1-impact)*25,.5+(1-impact)*12,1+(1-impact)*15);(this.pressure.material as T.MeshBasicMaterial).opacity=impact*.16;
  this.trace.visible=capture||attack&&t>=25;(this.trace.material as T.MeshBasicMaterial).opacity=capture?.65:ease((t-25)/3)*.65;
  if(capture)this.trace.geometry.setDrawRange(0,Math.floor(clamp((t+3)/6)*this.trace.geometry.index!.count));
  const conflict=escape&&t>=5&&t<10;const shieldWeight=conflict?.5+Math.sin((t-5)*2.2)*.45:escape&&t<10?1:0;
  this.shield.visible=escape&&t<11;this.shield.position.z=this.camera.position.z-1.5;(this.shield.material as T.MeshBasicMaterial).opacity=(escape?1-ease((t-10)/1.2):0)*(.025+shieldWeight*.065);
  this.updateVectors();
  if(this.swarm.visible)this.updateSwarm(impact,charge,shieldWeight);
  this.updateCamera();
  this.distortion=r.reduced?0:impact*.055+(escape?ease((t-20.3)/1.8)*.065:0);
  this.white=escape?ease((t-21.6)/1.1):s==='HOME'?1-ease(t/3.8):0;
  if(s!==this.lastStage){this.lastStage=s;this.root.visible=!black;}
 }
 private updateVectors(){
  const r=this.runtime,s=r.stage,t=r.time;
  this.point.visible=s==='EXIT_VECTOR';this.point.scale.setScalar(r.aligned.every(Boolean)?1.2:.6);
  for(let i=0;i<4;i++){
   const path=this.vectors[i],offset=r.offsets[i];
   path.group.visible=s!=='MAX_ATTACK'&&s!=='VECTOR_CAPTURE'||i===3;
   path.handle.visible=s==='EXIT_VECTOR'&&!r.aligned[i];path.handle.position.set(offset[0],3.5+offset[1],-24);
   path.handle.rotation.y=t*.2;path.handle.scale.setScalar(r.dragging===i?1.3:1);
   path.label.visible=s==='EXIT_VECTOR';path.label.material.opacity=r.aligned[i]?.35:.7;
   const positions=path.body.geometry.attributes.position as T.BufferAttribute;
   const collapse=s==='FINAL_ESCAPE'?ease((t-13-i*1.7)/2):0;
   const ox=s==='EXIT_VECTOR'?offset[0]:0,oy=s==='EXIT_VECTOR'?offset[1]:0;
   for(let j=0;j<positions.count;j++){
    const w=Math.pow(Math.floor(j/6)/VECTOR_SAMPLES,3),k=j*3;
    positions.setXYZ(j,path.original[k]+ox*w,path.original[k+1]+oy*w-collapse*Math.sin(j*.01)*5,path.original[k+2]-collapse*w*10);
   }
   positions.needsUpdate=true;
   (path.body.material as T.MeshBasicMaterial).opacity=(s==='MAX_ATTACK'?ease((t-25)/4):s==='VECTOR_CAPTURE'?1:s==='EXIT_VECTOR'?ease(t/3):1)*(1-collapse)*(r.aligned[i]||i===3?.92:.48);
  }
 }
 private updateSwarm(impact:number,charge:number,shieldWeight:number){
  const r=this.runtime,s=r.stage,t=r.time;
  const attack=s==='MAX_ATTACK',escape=s==='FINAL_ESCAPE';
  this.botMaterial.emissiveIntensity=s==='EXIT_VECTOR'?.55:escape?.85:.32;
  for(let i=0;i<BOT_COUNT;i++){
   const k=i*4,a=this.seeds[k],b=this.seeds[k+1],c=this.seeds[k+2],d=this.seeds[k+3],angle=a*Math.PI*2;
   if(attack&&i<270){
    // Microbot Hiro silhouette: head, torso, shoulders, two arms and legs.
    const part=i%10;let x=0,y=0,z=-22;
    if(part<2){const q=b*Math.PI*2;x=Math.cos(q)*.3*Math.sin(c*Math.PI);y=2.55+Math.cos(c*Math.PI)*.35;z+=Math.sin(q)*.24;}
    else if(part<6){x=(b-.5)*.63;y=1.2+c*1.15;z+=(d-.5)*.35;}
    else if(part<8){x=(part===6?-1:1)*(.45+b*.08);y=1.05+c*1.2;z+=(d-.5)*.24;}
    else{x=(part===8?-1:1)*.19+(b-.5)*.14;y=c*1.2;z+=(d-.5)*.2;}
    const tighten=1-ease((t-8)/4)*.7;x+=(a-.5)*.3*tighten;y+=Math.sin(t*.8+i)*.04*tighten;
    const scatter=t>=20?ease((t-20)/1.4):0;
    this.target.set(x+(a-.5)*scatter*12,y+(b*4-2)*scatter,z+(c-.5)*scatter*9);this.target.y=Math.max(.07,this.target.y-scatter*(t-20)*.3);
   }else if(attack){
    const index=i%3,anchor=this.anchors[index];const radius=.28+charge*.1+impact*(1+b*4);
    this.target.set(anchor.position.x+Math.cos(angle+t*.25)*radius,.3+b*2.3+charge*.18+impact*c*2,anchor.position.z+Math.sin(angle+t*.25)*radius);
   }else if(s==='VECTOR_CAPTURE'){
    const u=(a+t*.065)%1;this.vectors[3].curve.getPoint(u,this.target);this.target.x+=Math.sin(angle)*.14;this.target.y+=Math.cos(angle)*.14;
   }else if(s==='EXIT_VECTOR'||s==='PORTAL_RECONSTRUCTION'){
    const p=this.vectors[i%4],u=(a+t*.035)%1;p.curve.getPoint(u,this.target);const offset=r.offsets[i%4];
    if(s==='EXIT_VECTOR'){this.target.x+=offset[0]*u*u*u;this.target.y+=offset[1]*u*u*u;}
    const feed=s==='PORTAL_RECONSTRUCTION'?ease((t-2)/12):0;
    this.portalBoundary(a,b,this.scratch);this.target.lerp(this.scratch,feed);this.target.y+=Math.sin(t+i)*.04;
   }else if(escape){
    const shield=i<Math.floor(360*shieldWeight)&&t<10;
    const phi=b*Math.PI*.75;this.target.set(Math.cos(angle)*Math.sin(phi)*2.5,2+Math.cos(phi)*2.2,4+Math.sin(angle)*Math.sin(phi)*2.5);
    if(!shield&&t<10)this.portalBoundary(a,b,this.target);
    if(t>=10){const stream=ease((t-10-a*2)/3);this.portalBoundary(a,b,this.scratch);this.target.lerp(this.scratch,stream);}
   }
   this.dummy.position.copy(this.target);this.dummy.rotation.set(a*6+t*.1,b*6,c*6);this.dummy.scale.setScalar((i%7===0?1.6:1)*(s==='MAX_ATTACK'&&i<270?1.25:1));this.dummy.updateMatrix();this.swarm.setMatrixAt(i,this.dummy.matrix);
  }
  this.swarm.instanceMatrix.needsUpdate=true;
 }
 private portalBoundary(a:number,b:number,out:T.Vector3){
  const angle=a*Math.PI*2,radius=1+Math.sin(angle*3)*.06;out.set(Math.cos(angle)*2.9*radius,3.5+Math.sin(angle)*3.7*radius,-24+(b-.5)*.65);
 }
 private updateCamera(){
  const r=this.runtime,s=r.stage,t=r.time;let fov=48;
  this.initialPos.set(0,2.2,7);this.look.set(0,2.8,-29);
  if(s==='MAX_ATTACK'){
   const impact=t>=20?clamp(1-(t-20)/1.2):0;
   this.initialPos.z-=ease(t/29)*.55;this.initialPos.y+=r.reduced?0:Math.sin(t*34)*impact*.045;
   this.look.x+=r.reduced?0:Math.sin(t*29)*impact*.1;fov+=ease((t-13)/7)*-2+impact*6;
  }else if(s==='VECTOR_CAPTURE'){this.initialPos.set(.3*ease(t/12),2.2,6.45);this.look.set(0,6,-26);}
  else if(s==='EXIT_VECTOR'){this.initialPos.set(.3,3,4);this.look.set(0,4,-24);fov=53;}
  else if(s==='PORTAL_RECONSTRUCTION'){const p=ease(t/18);this.initialPos.set(.3*(1-p),3,4-p*3);this.look.set(0,3.5,-24);fov=53-p*5;}
  else if(s==='FINAL_ESCAPE'){
   const run=ease((t-13)/9),lean=r.reduced?0:Math.sin((t-13)*9)*.028*clamp((t-13)/2)*(1-ease((t-20)/2));
   this.initialPos.set(lean,3+Math.sin(ease((t-19.5)/2.8)*Math.PI)*1.1,1-run*29);
   this.look.set(0,3.3,-39);fov=48+ease((t-13)/5)*7;
   // A single overhead near-catch sweeps into Hiro's peripheral vision.
   if(t>=16){const reach=ease((t-16)/3.4),pass=ease((t-19.5)/1.4);this.baymax.group.position.set(-2.8+reach*1.5,4.6,this.initialPos.z+3-reach*4-pass*2);this.baymax.group.rotation.set(.85+reach*.3,Math.PI,0);this.baymax.left.rotation.x=-1.8;}
  }else if(s==='HOME'||s==='EPILOGUE'){this.initialPos.set(0,2.3,-27);this.look.set(0,8,-102);fov=48;}
  this.camera.position.copy(this.initialPos);this.camera.lookAt(this.look);this.camera.fov=fov;this.camera.updateProjectionMatrix();
 }
 private pointerPosition(x:number,y:number,rect:DOMRect){this.ndc.set((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);this.ray.setFromCamera(this.ndc,this.camera);return this.ray.ray.intersectPlane(this.plane,this.hit);}
 pointerDown(x:number,y:number,rect:DOMRect){
  if(this.runtime.stage!=='EXIT_VECTOR')return false;this.pointerPosition(x,y,rect);
  const hits=this.ray.intersectObjects(this.vectors.map(p=>p.handle).filter(h=>h.visible));
  let index=hits[0]?.object.userData.vector as number|undefined;
  if(index===undefined){let nearest=.65;this.vectors.forEach((p,i)=>{if(this.runtime.aligned[i])return;const d=this.hit.distanceTo(p.handle.position);if(d<nearest){nearest=d;index=i;}});}
  if(index===undefined)return false;this.runtime.dragging=index;this.selected=index;this.grab.copy(this.hit).sub(this.vectors[index].handle.position);return true;
 }
 pointerMove(x:number,y:number,rect:DOMRect){
  const i=this.runtime.dragging;if(i<0||!this.pointerPosition(x,y,rect))return;
  const ox=clamp(this.hit.x-this.grab.x,-3,3),oy=clamp(this.hit.y-this.grab.y-3.5,-2,2);
  this.runtime.offsets[i]=[ox,oy];if(Math.hypot(ox,oy)<.34){this.runtime.align(i);this.runtime.dragging=-1;}
 }
 pointerUp(){this.runtime.dragging=-1;}
 keyboard(key:string){
  if(this.runtime.stage!=='EXIT_VECTOR')return;
  if(key==='Tab'){this.selected=(this.selected+1)%4;return;}
  const i=this.runtime.aligned[this.selected]?this.runtime.aligned.findIndex(x=>!x):this.selected;if(i<0)return;this.selected=i;
  const o=this.runtime.offsets[i];if(key==='ArrowLeft')o[0]-=.18;if(key==='ArrowRight')o[0]+=.18;if(key==='ArrowUp')o[1]+=.18;if(key==='ArrowDown')o[1]-=.18;
  if(Math.hypot(...o)<.4)this.runtime.align(i);
 }
 screenPoints(width:number,height:number){return this.vectors.map((p,i)=>{const point=p.handle.position.clone().project(this.camera);return {index:i,x:(point.x+1)*width/2,y:(1-point.y)*height/2,aligned:this.runtime.aligned[i]};});}
 targetScreen(width:number,height:number){const p=this.portal.center.clone().project(this.camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2};}
 dispose(){this.scene.fog=null;disposeTree(this.root);}
}

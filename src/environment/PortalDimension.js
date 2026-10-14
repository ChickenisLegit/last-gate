import * as THREE from 'three';
import {createGeometryKit} from '../systems/GeometryKit.js';
export function createPortalDimension(mobile=false){
const scene=new THREE.Group();scene.name='PortalDimension';
const {mesh,box,cylinderBetween,materials,random,rand}=createGeometryKit(scene);
// A single fractured street, with layered stone edges and exposed reinforcing steel.
const groundCanvas=document.createElement('canvas');groundCanvas.width=groundCanvas.height=512;
const gx=groundCanvas.getContext('2d');gx.fillStyle='#727c76';gx.fillRect(0,0,512,512);
for(let i=0;i<27000;i++){const c=Math.floor(rand(75,145));gx.fillStyle=`rgba(${c},${c+5},${c},${rand(.05,.22)})`;gx.fillRect(rand(0,512),rand(0,512),rand(1,3),rand(1,3));}
gx.strokeStyle='#434e49';gx.lineWidth=1;
for(let i=0;i<13;i++){gx.beginPath();let x=rand(0,512),y=rand(0,512);gx.moveTo(x,y);for(let j=0;j<5;j++){x+=rand(-55,55);y+=rand(10,50);gx.lineTo(x,y);}gx.stroke();}
const groundTexture=new THREE.CanvasTexture(groundCanvas);groundTexture.wrapS=groundTexture.wrapT=THREE.RepeatWrapping;groundTexture.repeat.set(3,12);groundTexture.colorSpace=THREE.SRGBColorSpace;
const groundMat=new THREE.MeshStandardMaterial({map:groundTexture,color:'#9d9b95',roughness:.97});
box(10.8,.7,40,groundMat,0,-.5,-8);
box(10.5,1.2,39,materials.edge,.1,-1.3,-8.1);
for(let i=0;i<22;i++){
  const side=i%2===0?-1:1,z=rand(-26,11),x=side*rand(4.6,6.8);
  const rubble=mesh(new THREE.DodecahedronGeometry(rand(.3,1.1),0),materials.concrete,x,rand(-.9,.1),z);rubble.scale.set(rand(.8,2),rand(.2,.65),rand(.6,1.6));rubble.rotation.set(rand(0,3),rand(0,3),rand(0,3));
}
// Faded lane markings and wet-looking seams give the floor a human scale.
const roadPaint=new THREE.MeshStandardMaterial({color:'#b3b29a',roughness:1,transparent:true,opacity:.3});
for(let i=0;i<10;i++)box(.1,.012,1.6,roadPaint,-.7,-.14,10-i*3.8);
for(let i=0;i<9;i++)box(10.5,.015,.025,materials.dark,0,-.13,10-i*4.7);
for(let i=0;i<13;i++){
  const x=rand(-4.8,4.8),z=rand(-23,9),r=rand(.05,.2);
  const stone=mesh(new THREE.DodecahedronGeometry(r),materials.edge,x,-.08,z);stone.rotation.set(random()*3,random()*3,random()*3);
}
// Broken parapets frame the path rather than hiding the companion.
for(const side of [-1,1]){
  for(let i=0;i<7;i++){
    const z=8-i*5.2;
    if((side===1&&i===4)||(side===-1&&i===2))continue;
    box(.52,.85,rand(2,4),materials.concrete,side*5.1,.22,z);
    box(.64,.13,rand(2,4),groundMat,side*5.1,.72,z);
  }
  for(let i=0;i<6;i++)cylinderBetween(new THREE.Vector3(side*5.5,-.7,-25+i*.3),new THREE.Vector3(side*rand(6,8),rand(-.4,1),-25+i*.3),.025,materials.metal);
}

const floating=[];
const windowLight=new THREE.MeshStandardMaterial({color:'#6a7972',emissive:'#53685e',emissiveIntensity:.15,roughness:.8});
function building(x,y,z,w,h,d,tilt=0){
  const g=new THREE.Group();scene.add(g);g.position.set(x,y,z);g.rotation.z=tilt;
  const facade=new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(.46,.055,rand(.15,.28)),roughness:.94});
  box(w,h,d,facade,0,h/2,0,g);
  const sill=materials.metal;
  for(let fy=1;fy<h-.8;fy+=1.5){
    box(w+.12,.06,d+.12,materials.dark,0,fy,0,g);
    for(let fx=-w/2+.5;fx<w/2-.2;fx+=1.1){
      const lit=random()>.9;
      box(.48,.77,.025,lit?windowLight:materials.dark,fx,fy+.55,d/2+.02,g);
      box(.54,.04,.08,sill,fx,fy+.14,d/2+.035,g);
    }
  }
  box(w+.2,.2,d+.2,materials.edge,0,h,0,g);
  if(random()>.4){box(.3,2.2,.3,materials.metal,0,h+1,0,g);}
  return g;
}
building(-15,-4,-21,6,22,6,-.16);
building(-22,1,-41,8,30,8,.22);
building(18,-7,-29,7,26,7,-.2);
building(27,8,-56,9,33,7,.19);
building(-35,6,-69,8,27,8,-.31);
building(9,-13,-53,6,15,7,.1);
building(-7,-9,-68,5,17,5,-.07);
for(let i=0;i<12;i++)building(rand(-65,65),rand(-30,18),rand(-130,-80),rand(4,9),rand(12,30),rand(4,9),rand(-.8,.8));
// A recognisable fragment of a San Fransokyo street sign.
const signGroup=new THREE.Group();scene.add(signGroup);signGroup.position.set(-4.9,0,-6);
cylinderBetween(new THREE.Vector3(0,0,0),new THREE.Vector3(.3,4.6,0),.07,materials.metal,signGroup);
const signCanvas=document.createElement('canvas');signCanvas.width=512;signCanvas.height=256;
const sc=signCanvas.getContext('2d');sc.fillStyle='#203b3c';sc.fillRect(0,0,512,256);sc.strokeStyle='#b4c8ba';sc.lineWidth=5;sc.strokeRect(12,12,488,232);sc.fillStyle='#d3deca';sc.font='25px sans-serif';sc.textAlign='center';sc.fillText('SAN FRANSOKYO',256,82);sc.font='bold 65px sans-serif';sc.fillText('NORTH',256,158);sc.font='27px sans-serif';sc.fillText('↗   14TH STREET',256,212);
const signTex=new THREE.CanvasTexture(signCanvas);signTex.colorSpace=THREE.SRGBColorSpace;
const sign=box(2.3,1.15,.07,new THREE.MeshStandardMaterial({map:signTex,roughness:.75}),.35,3.6,.03,signGroup);sign.rotation.z=-.08;
// A broken suspension cable and hanging bridge ribs.
for(let side of [-1,1]){
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(side*7,13,8),new THREE.Vector3(side*6.3,6,-5),new THREE.Vector3(side*6.1,6,-19),new THREE.Vector3(side*7.5,15,-34)]);
  mesh(new THREE.TubeGeometry(curve,45,.035,6,false),materials.metal);
  for(let i=0;i<7;i++){
    const pt=curve.getPoint(.12+i*.1);cylinderBetween(pt,new THREE.Vector3(side*5.6,.5,pt.z),.018,materials.metal);
  }
}
// Drifting chunks visibly retain traces of the city.
const debris=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),materials.concrete,46);
scene.add(debris);debris.castShadow=true;
for(let i=0;i<46;i++){
  const g=new THREE.Object3D(),side=random()>.5?1:-1;
  g.position.set(side*rand(8,42),rand(-13,23),rand(-78,0));
  const s=rand(.35,2.6);g.scale.set(s*rand(1,3),s*.5,s*rand(1,2));
  g.rotation.set(rand(-.6,.6),rand(-1,1),rand(-.7,.7));
  g.updateMatrix();debris.setMatrixAt(i,g.matrix);
  floating.push({obj:g,y:g.position.y,speed:rand(.15,.35),phase:rand(0,6.3),amp:rand(.1,.5)});
}

const chip=new THREE.Group();scene.add(chip);chip.position.set(4.17,.04,-10.95);chip.rotation.set(-Math.PI/2,0,-.4);
box(.23,.32,.045,materials.red,0,0,0,chip);
box(.14,.18,.008,new THREE.MeshStandardMaterial({color:'#3a1a18',metalness:.5,roughness:.4}),0,0,.026,chip);
for(let i=0;i<4;i++)box(.023,.055,.025,new THREE.MeshStandardMaterial({color:'#cda46a',metalness:.8,roughness:.35}),-.08+i*.053,-.18,0,chip);
const chipLight=new THREE.PointLight('#e25938',.8,2);chipLight.position.set(4.2,.3,-10.9);scene.add(chipLight);
// A ruined wall gives the body a grounded resting place.
box(4.2,1.6,.65,materials.concrete,3.05,.65,-13.05).rotation.z=.04;
box(1.4,2.6,.7,materials.concrete,4.8,1.05,-13.1).rotation.z=-.15;

// The sky is a pale, folded rupture rather than a conventional outer-space backdrop.
function softTexture(){
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');
  const g=ctx.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'rgba(225,242,229,.8)');g.addColorStop(.2,'rgba(180,211,200,.25)');g.addColorStop(1,'rgba(130,180,170,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);return new THREE.CanvasTexture(c);
}
const mistTexture=softTexture();
const skyMaterial=new THREE.ShaderMaterial({
  uniforms:{uTime:{value:0}},depthWrite:false,
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`
    varying vec2 vUv; uniform float uTime;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
    float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
    float fbm(vec2 p){float n=0.;float a=.5;for(int i=0;i<5;i++){n+=noise(p)*a;p=p*2.05+vec2(3.1,7.2);a*=.5;}return n;}
    void main(){
      vec2 p=(vUv-vec2(.54,.61))*vec2(1.35,1.);float r=length(p);float a=atan(p.y,p.x);
      vec2 flow=vec2(a*1.3+r*9.,r*12.-uTime*.008);float n=fbm(flow);
      float ring=exp(-pow((r-.32)*12.,2.));float clouds=fbm(vUv*7.+vec2(uTime*.003,0.));
      float light=ring*(.26+n*.7)*smoothstep(-.7,.7,p.y+.25)+clouds*.1;
      vec3 col=mix(vec3(.07,.11,.12),vec3(.67,.73,.67),clamp(light,0.,.8));
      col+=vec3(.17,.22,.2)*exp(-r*r*13.)*.4;
      gl_FragColor=vec4(col,1.);
    }`
});
mesh(new THREE.PlaneGeometry(230,150),skyMaterial,0,30,-158).castShadow=false;
// Low mist passes across the broken roadway; a quiet glow separates the shell from the void.
for(let i=0;i<8;i++){
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:mistTexture,color:'#c4cfbf',transparent:true,opacity:.14,depthWrite:false,blending:THREE.AdditiveBlending}));
  s.position.set(rand(-10,10),rand(.2,1.7),-16-i*4);s.scale.set(rand(13,21),rand(1.8,3.6),1);scene.add(s);
}
const backGlow=new THREE.Sprite(new THREE.SpriteMaterial({map:mistTexture,color:'#d0d8c2',transparent:true,opacity:.28,depthWrite:false,blending:THREE.AdditiveBlending}));backGlow.position.set(2.7,4,-18);backGlow.scale.set(17,15,1);scene.add(backGlow);
for(let i=0;i<25;i++){
  const m=new THREE.SpriteMaterial({map:mistTexture,color:i%3===0?'#9aa99c':'#9dc8c3',transparent:true,opacity:rand(.06,.2),depthWrite:false,blending:THREE.AdditiveBlending});
  const s=new THREE.Sprite(m);s.position.set(rand(-70,70),rand(-5,35),rand(-150,-55));s.scale.set(rand(25,70),rand(10,40),1);scene.add(s);
}
const riftGroup=new THREE.Group();scene.add(riftGroup);riftGroup.position.set(6,27,-106);riftGroup.rotation.z=-.45;
for(let i=0;i<18;i++){
  const curve=new THREE.EllipseCurve(0,0,rand(25,42),rand(9,14),rand(-.2,.1),rand(3.8,5.8),false,0);
  const pts=curve.getPoints(140).map(v=>new THREE.Vector3(v.x,v.y,rand(-.1,.1)));
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),new THREE.LineBasicMaterial({color:i%3===0?'#c9ded0':'#7fa8a5',transparent:true,opacity:rand(.12,.4)}));line.position.y=rand(-2,2);riftGroup.add(line);
}
const dustCount=mobile?650:1400,dustPositions=new Float32Array(dustCount*3);
for(let i=0;i<dustCount;i++){dustPositions[i*3]=rand(-50,50);dustPositions[i*3+1]=rand(-12,30);dustPositions[i*3+2]=rand(-95,15);}
const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));
const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:'#bdd5c6',map:mistTexture,size:.09,transparent:true,opacity:.7,depthWrite:false,blending:THREE.AdditiveBlending}));scene.add(dust);
// Distinct fragments crossing the void give the scene depth and scale.
for(let i=0;i<7;i++){
  const lineGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(rand(-40,40),rand(0,28),-65),new THREE.Vector3(rand(-30,30),rand(10,38),-95)]);
  scene.add(new THREE.Line(lineGeo,new THREE.LineBasicMaterial({color:'#9fbeb2',transparent:true,opacity:.13})));
}
scene.add(new THREE.HemisphereLight('#dbe2de','#172125',1.5));
const key=new THREE.DirectionalLight('#dfebd7',3.6);key.position.set(-12,22,-18);key.castShadow=!mobile;key.shadow.mapSize.set(2048,2048);key.shadow.camera.left=-14;key.shadow.camera.right=14;key.shadow.camera.top=18;key.shadow.camera.bottom=-18;key.shadow.normalBias=.04;key.shadow.bias=-.0002;scene.add(key);scene.add(key.target);key.target.position.set(0,0,-10);
const rim=new THREE.DirectionalLight('#98c6c6',2.2);rim.position.set(12,8,-30);scene.add(rim);
const front=new THREE.PointLight('#e2d9c9',4,25,1.8);front.position.set(-2,5,-4);scene.add(front);
const companionLight=new THREE.PointLight('#e0dfce',3,10,1.5);companionLight.position.set(3,5,-8);scene.add(companionLight);

// Collapse repeated static windows and details into GPU instances.
const animatedRoots=new Set(floating.map(f=>f.obj));
scene.updateMatrixWorld(true);
const instanceGroups=new Map();
scene.traverse(obj=>{
  if(!obj.isMesh||obj.isInstancedMesh||obj.material.transparent||obj.material.isShaderMaterial)return;
  let parent=obj;while(parent){if(animatedRoots.has(parent))return;parent=parent.parent;}
  const key=`${obj.geometry.uuid}/${obj.material.uuid}`;
  if(!instanceGroups.has(key))instanceGroups.set(key,[]);instanceGroups.get(key).push(obj);
});
for(const objects of instanceGroups.values()){
  if(objects.length<3)continue;
  const instanced=new THREE.InstancedMesh(objects[0].geometry,objects[0].material,objects.length);
  objects.forEach((obj,i)=>{instanced.setMatrixAt(i,obj.matrixWorld);obj.parent.remove(obj);});
  instanced.castShadow=true;instanced.receiveShadow=true;instanced.instanceMatrix.needsUpdate=true;scene.add(instanced);
}


return {group:scene,chip,update(t,dt,reduced){
 if(!reduced){floating.forEach((f,i)=>{f.obj.position.y=f.y+Math.sin(t*f.speed+f.phase)*f.amp;f.obj.rotation.y+=dt*.006;f.obj.updateMatrix();debris.setMatrixAt(i,f.obj.matrix);});debris.instanceMatrix.needsUpdate=true;dust.rotation.y=t*.001;riftGroup.rotation.z=-.45+Math.sin(t*.04)*.015;skyMaterial.uniforms.uTime.value=t;}
 chipLight.intensity=.65+(reduced?0:Math.sin(t*1.1)*.12);
}};
}


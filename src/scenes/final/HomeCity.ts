import * as T from 'three';
import { box, mesh, line, seeded, v } from './geometry';

/** The home glimpse and landing use the same small diorama, clipped by the exit stencil. */
export class HomeCity {
 readonly group=new T.Group(); private materials:T.Material[]=[];private tram=new T.Group(); private birdLine:T.Line;
 constructor(){
  this.group.position.z=-24;this.group.name='San Fransokyo / stable home';
  const material=(color:string,roughness=.8)=>{const m=new T.MeshStandardMaterial({color,roughness,fog:false});this.materials.push(m);return m;};
  const ivory=material('#c5baa3'),stone=material('#9eaaac'),blue=material('#6d8791'),dark=material('#283b48'),roof=material('#4c565a'),warm=material('#b47d5c'),paint=material('#d5c599');
  const skyMat=new T.MeshBasicMaterial({color:'#b5cbd1',fog:false});this.materials.push(skyMat);box(this.group,skyMat,0,36,-112,260,130,1);
  const ground=material('#6d7776');box(this.group,ground,0,-.3,-45,180,.5,140);
  box(this.group,material('#565f60'),0,-.025,-43,14,.08,100);
  for(const side of [-1,1]){box(this.group,ivory,side*7.2,.1,-40,1.15,.27,92);for(let j=0;j<16;j++)box(this.group,paint,side*.3,.025,-j*5.8,.09,.012,2.6);}
  for(let i=0;i<8;i++)box(this.group,paint,0,.03,-6-i*.46,8,.014,.2);
  for(const side of [-1,1])box(this.group,dark,side*1.05,.03,-40,.045,.016,90);
  const random=seeded(81);const windowGeo=new T.BoxGeometry(.62,1,.035);const windowMat=material('#54727c',.32);const windows=new T.InstancedMesh(windowGeo,windowMat,460);const dummy=new T.Object3D();let n=0;
  for(const side of [-1,1])for(let i=0;i<9;i++){
   const h=5+random()*12,w=5+random()*2,x=side*(10+random()*1.4),z=-7-i*8;
   const facade=[ivory,stone,blue,warm][i%4];box(this.group,facade,x,h/2,z,w,h,6.5);
   box(this.group,roof,x,h+.16,z,w+.35,.3,6.8);
   for(let y=1.8;y<h-.6;y+=2.1){box(this.group,stone,x,y-.45,z+3.3,w+.12,.07,.14);for(let k=-1;k<=1;k++){dummy.position.set(x+k*w*.27,y,z+3.28);dummy.scale.set(1,1,1);dummy.updateMatrix();windows.setMatrixAt(n++,dummy.matrix);}}
   if(i<4){box(this.group,dark,x,1.2,z+3.36,w*.75,1.7,.08);const awning=box(this.group,i%2?roof:warm,x,2.35,z+3.9,w+.4,.14,1.3);awning.rotation.x=.15;}
   if(i%3===0){const top=mesh(this.group,new T.ConeGeometry(w*.82,1.25,4),roof,x,h+.65,z);top.rotation.y=Math.PI/4;top.scale.z=1.15;}
  }
  windows.count=n;this.group.add(windows);
  // Layered skyline and hills, all obeying normal gravity.
  const hill=material('#779390');for(let i=0;i<7;i++){const m=mesh(this.group,new T.SphereGeometry(1,16,8),hill,-75+i*25,-5,-103);m.scale.set(30,16+random()*7,12);}
  for(let i=0;i<17;i++){const h=8+random()*24;box(this.group,i%2?stone:blue,-66+i*8,h/2,-88,4+random()*3,h,5);}
  // The red suspension/torii bridge identifies San Fransokyo across the bay.
  const vermilion=material('#a35143');const bridge=new T.Group();bridge.position.set(0,0,-75);this.group.add(bridge);
  box(bridge,stone,0,7.2,0,99,.65,5);
  for(const x of [-29,29]){for(const side of [-1,1])box(bridge,vermilion,x+side*2.2,14,0,.85,27,1);box(bridge,vermilion,x,26.8,0,8.2,.75,1.5);const beam=box(bridge,vermilion,x,28,0,11,.6,2);beam.rotation.z=x<0?-.02:.02;}
  const cableMat=new T.LineBasicMaterial({color:'#8c5b51',fog:false});this.materials.push(cableMat);
  for(const side of [-1,1]){const pts=[];for(let j=0;j<=80;j++){const x=-48+j*1.2;const y=8.6+18*Math.pow(Math.min(1,Math.abs(x)/29),2);pts.push(v(x,y,side*1.8));}const cable=new T.Line(new T.BufferGeometry().setFromPoints(pts),cableMat);bridge.add(cable);for(let j=0;j<23;j++){const x=-43+j*4,y=8.6+18*Math.pow(Math.min(1,Math.abs(x)/29),2);const wire=new T.Line(new T.BufferGeometry().setFromPoints([v(x,7.5,side*1.8),v(x,y,side*1.8)]),cableMat);bridge.add(wire);}}
  // Street furniture, overhead cable and one quiet tram.
  for(const side of [-1,1])for(let i=0;i<5;i++){const z=-9-i*14;box(this.group,dark,side*7.5,3.5,z,.12,7,.12);box(this.group,dark,side*6.8,6.9,z,1.5,.1,.1);box(this.group,ivory,side*6.2,6.8,z,.5,.12,.35);}
  for(const x of [-1.1,1.1]){const m=line(this.group,[v(x,7,0),v(x,6.4,-35),v(x,7,-80)],'#3c4d55');this.materials.push(m.material);}
  this.tram.position.set(-1,0,-43);this.group.add(this.tram);box(this.tram,warm,0,1.35,0,2.2,2.3,5);box(this.tram,ivory,0,2.6,0,2.35,.26,5.2);box(this.tram,dark,0,1.9,2.52,1.8,.9,.03);box(this.tram,paint,0,.75,2.54,1.8,.09,.025);
  const signCanvas=document.createElement('canvas');signCanvas.width=512;signCanvas.height=128;const c=signCanvas.getContext('2d')!;c.fillStyle='#425959';c.fillRect(0,0,512,128);c.fillStyle='#e3dfc6';c.font='22px sans-serif';c.textAlign='center';c.fillText('SAN FRANSOKYO',256,49);c.font='16px sans-serif';c.fillText('サンフランソウキョウ  /  NORTH DISTRICT',256,85);const tex=new T.CanvasTexture(signCanvas);tex.colorSpace=T.SRGBColorSpace;const signMat=new T.MeshBasicMaterial({map:tex,fog:false});this.materials.push(signMat);box(this.group,dark,-7.7,2.6,-8,.08,5.2,.08);box(this.group,signMat,-7.7,4.3,-7.9,3.5,.87,.07);
  const leaves=material('#8c9c83');for(const side of [-1,1])for(let i=0;i<4;i++){const x=side*7.8,z=-18-i*17;box(this.group,warm,x,1.7,z,.18,3.4,.18);const crown=mesh(this.group,new T.IcosahedronGeometry(1,1),leaves,x,4,z);crown.scale.set(1.8,2,1.6);}
  const birdMat=new T.LineBasicMaterial({color:'#667d82',fog:false});this.materials.push(birdMat);this.birdLine=new T.Line(new T.BufferGeometry().setFromPoints([v(-1,0,0),v(0,-.2,0),v(1,0,0)]),birdMat);this.birdLine.position.set(-8,18,-45);this.group.add(this.birdLine);
  this.group.traverse(o=>{o.renderOrder=12;});
 }
 update(full:boolean,t:number){this.group.visible=true;for(const m of this.materials){m.stencilWrite=!full;m.stencilRef=1;m.stencilFunc=full?T.AlwaysStencilFunc:T.EqualStencilFunc;m.stencilZPass=T.KeepStencilOp;m.stencilFail=T.KeepStencilOp;m.stencilZFail=T.KeepStencilOp;}this.tram.position.z=-43-t*.2;this.birdLine.position.x=-8+t*.55;}
}

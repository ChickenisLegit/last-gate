import * as T from 'three';
import { box, mesh, v } from './geometry';
import { ease } from './sequence';
import type { FinalStage } from './entry';
import { HomeCity } from './HomeCity';

export class FinalPortal {
 readonly group=new T.Group();readonly home=new HomeCity();readonly center=v(0,3.5,-24);private aperture=new T.Group();private edge:T.LineLoop;private light:T.Mesh;private peel:T.Mesh[]=[];
 constructor(){
  this.group.name='Exit vector / reconstructed seam';this.aperture.position.copy(this.center);this.group.add(this.aperture);
  const points=[v(-.5,-3.5),v(-2.5,-2.6),v(-2.9,-.2),v(-2.45,2.5),v(-.7,4),v(1.3,3.7),v(2.6,1.7),v(2.9,-1.1),v(1.8,-3.2)];
  const shape=new T.Shape(points.map(p=>new T.Vector2(p.x,p.y)));const geom=new T.ShapeGeometry(shape);
  const maskMat=new T.MeshBasicMaterial({colorWrite:false,depthWrite:false,depthTest:false,side:T.DoubleSide,stencilWrite:true,stencilRef:1,stencilFunc:T.AlwaysStencilFunc,stencilZPass:T.ReplaceStencilOp});
  const mask=mesh(this.aperture,geom,maskMat);mask.renderOrder=10;
  this.edge=new T.LineLoop(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color:'#c9faff',transparent:true,opacity:.85,depthTest:false}));this.edge.renderOrder=14;this.aperture.add(this.edge);
  const lightMat=new T.MeshBasicMaterial({color:'#eefaff',transparent:true,opacity:1,depthTest:false,depthWrite:false,side:T.DoubleSide});this.light=mesh(this.aperture,geom.clone(),lightMat);this.light.renderOrder=13;
  const dark=new T.MeshStandardMaterial({color:'#162b3b',metalness:.5,roughness:.4});
  for(const side of [-1,1])for(let i=0;i<3;i++){const p=box(this.aperture,dark,side*(2.9+i*.13),-.8+i*1.7,.06,.14,2.1,.65);p.rotation.z=side*(.1+i*.08);this.peel.push(p);}
  const dot=mesh(this.group,new T.SphereGeometry(.035,12,8),new T.MeshBasicMaterial({color:'#edffff'}),...this.center.toArray() as [number,number,number]);dot.name='home coordinate';
 }
 update(stage:FinalStage,t:number,aligned:number){
  const reconstruction=stage==='PORTAL_RECONSTRUCTION',escape=stage==='FINAL_ESCAPE',full=stage==='HOME'||stage==='EPILOGUE';
  this.group.visible=reconstruction||escape||(stage==='EXIT_VECTOR'&&aligned===4);this.home.group.visible=reconstruction&&t>5||escape||full;
  if(full){this.home.update(true,t);return;}if(!this.group.visible)return;
  const growth=reconstruction?ease((t-3)/10):escape?1:0;
  const split=escape&&t>5&&t<10?Math.sin((t-5)*2.2)*.13:0;
  this.aperture.scale.set(Math.max(.002,growth*(1-split)),Math.max(.002,ease((reconstruction?t-1:20)/9)),1);
  this.aperture.visible=growth>.001;
  (this.light.material as T.MeshBasicMaterial).opacity=reconstruction?1-ease((t-7)/5):0;
  (this.edge.material as T.LineBasicMaterial).opacity=.8+(escape?Math.sin(t*19)*.15:0);
  this.peel.forEach((p,i)=>{p.rotation.y=(i<3?-1:1)*growth*.65;});
  if(this.home.group.visible)this.home.update(false,0);
 }
}

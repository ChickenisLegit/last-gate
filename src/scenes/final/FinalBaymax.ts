import * as T from 'three';
import { box, ellipsoid, mesh } from './geometry';
import { ease, clamp } from './sequence';
import type { FinalStage } from './entry';

/** A separate articulated flight rig; the dormant opening shell stays untouched. */
export class FinalBaymax {
 readonly group=new T.Group(); readonly left=new T.Group(); readonly right=new T.Group(); private head=new T.Group();
 private red:T.MeshStandardMaterial;private eyes:T.MeshBasicMaterial;private jets:T.Mesh[]=[];
 constructor(){
  this.group.name='Baymax / maximum attack flight rig';
  const skin=new T.MeshPhysicalMaterial({color:'#eee8dc',roughness:.48,sheen:.4,sheenColor:new T.Color('#e6d4ba')});
  this.red=new T.MeshStandardMaterial({color:'#8e1934',roughness:.29,metalness:.48,emissive:'#9e1025',emissiveIntensity:.04});
  const seam=new T.MeshStandardMaterial({color:'#211f28',roughness:.65});this.eyes=new T.MeshBasicMaterial({color:'#ff654d'});
  ellipsoid(this.group,skin,0,1.9,0,1.05,1.3,.72);
  ellipsoid(this.group,this.red,0,2.28,.42,.86,.77,.42);
  ellipsoid(this.group,this.red,0,1.4,.2,.88,.48,.63);
  this.head.position.set(0,3.25,.12);this.group.add(this.head);
  ellipsoid(this.head,skin,0,0,0,.63,.39,.39);
  for(const side of [-1,1])ellipsoid(this.head,this.eyes,side*.21,0,.365,.049,.049,.022);
  box(this.head,this.eyes,0,0,.375,.42,.017,.012);
  for(const side of [-1,1]){
   const arm=side<0?this.left:this.right;arm.position.set(side*.95,2.65,0);this.group.add(arm);
   ellipsoid(arm,this.red,0,0,0,.47,.49,.49);ellipsoid(arm,skin,side*.17,-.56,.03,.35,.68,.35);
   ellipsoid(arm,this.red,side*.22,-1.08,.14,.4,.48,.43);ellipsoid(arm,skin,side*.22,-1.48,.23,.32,.25,.33);
   for(let i=0;i<3;i++)ellipsoid(arm,skin,side*.22+(i-1)*.16,-1.6,.35,.075,.14,.12);
   ellipsoid(this.group,skin,side*.5,.57,.04,.42,.73,.44);ellipsoid(this.group,this.red,side*.5,.22,.19,.44,.36,.57);
   const wing=box(this.group,this.red,side*1.1,2.4,-.48,1.6,.12,.68);wing.rotation.z=side*.28;
   ellipsoid(this.group,this.red,side*.4,2.25,-.64,.35,.6,.28);
   const jet=mesh(this.group,new T.ConeGeometry(.16,.9,12),new T.MeshBasicMaterial({color:'#ff7850',transparent:true,opacity:.75,depthWrite:false}),side*.4,1.57,-.65);jet.rotation.x=Math.PI;this.jets.push(jet);
  }
  this.group.traverse(o=>{if(o instanceof T.Mesh)o.castShadow=true;});
 }
 update(stage:FinalStage,t:number){
  const attacking=stage==='MAX_ATTACK', escaping=stage==='FINAL_ESCAPE';this.group.visible=attacking||escaping;
  if(!this.group.visible)return;
  const approach=ease(t/12),charge=attacking?ease((t-12)/7):0;
  this.group.position.set(.15,attacking?1.4+charge*.8:1.2,attacking?T.MathUtils.lerp(-63,-34,approach):T.MathUtils.lerp(10,-11,ease((t-2)/16)));
  this.group.rotation.set(-charge*.14,escaping?Math.PI:0,0);
  this.left.rotation.x=-charge*1.48;this.right.rotation.x=-charge*1.48;this.left.rotation.z=-.13-charge*.12;this.right.rotation.z=.13+charge*.12;
  this.head.rotation.x=-.05+charge*.04;this.red.emissiveIntensity=.04+charge*.55;
  const afterImpact=attacking&&t>=20;if(afterImpact){const recoil=ease((t-20)/2);this.group.position.y=2.2-recoil*1.4;this.group.position.z=-34-recoil*4;this.left.rotation.x=-1.48*(1-recoil);this.right.rotation.x=this.left.rotation.x;this.red.emissiveIntensity=.03;}
  if(escaping){this.group.position.x=-1.2;this.left.rotation.x=-ease((t-15)/3)*1.55;this.right.rotation.x=-.2;this.group.position.y=1.3;}
  for(const j of this.jets){j.scale.y=attacking? .25+charge*2:clamp((t-2)/3)*1.5;j.visible=!afterImpact;}
 }
}

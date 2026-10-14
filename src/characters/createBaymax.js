import * as THREE from 'three';
import {createGeometryKit} from '../systems/GeometryKit.js';
export function createBaymax(){
const scene=new THREE.Group();
const {mesh,box,ellipsoid,materials}=createGeometryKit(scene);
const baymax=new THREE.Group();baymax.name='BaymaxDormantShell';
const torsoPoints=[new THREE.Vector2(0,.22),new THREE.Vector2(.55,.24),new THREE.Vector2(.9,.43),new THREE.Vector2(1.1,.75),new THREE.Vector2(1.16,1.08),new THREE.Vector2(1.1,1.42),new THREE.Vector2(.98,1.8),new THREE.Vector2(.82,2.15),new THREE.Vector2(.66,2.48),new THREE.Vector2(.43,2.66),new THREE.Vector2(0,2.7)];
const torsoCurve=new THREE.SplineCurve(torsoPoints);
const torso=mesh(new THREE.LatheGeometry(torsoCurve.getPoints(60),64),materials.white,0,0,.08,baymax);torso.scale.z=.73;
const head=new THREE.Group();baymax.add(head);head.position.set(0,2.98,.23);head.rotation.x=.24;head.rotation.z=-.12;
ellipsoid(.77,.49,.49,materials.white,0,0,0,head);
const eyeMat=new THREE.MeshBasicMaterial({color:'#172022'});
ellipsoid(.065,.065,.025,eyeMat,-.23,.015,.49,head);
ellipsoid(.065,.065,.025,eyeMat,.23,.015,.49,head);
box(.46,.022,.016,eyeMat,0,.015,.502,head);
// Chest seam and circular access port.
const port=mesh(new THREE.TorusGeometry(.145,.014,8,40),materials.seam,.42,2.05,.638,baymax);port.rotation.y=.15;
mesh(new THREE.CircleGeometry(.132,32),materials.white,.42,2.05,.643,baymax);
for(let side of [-1,1]){
  ellipsoid(.45,.56,.46,materials.armor,side*.93,2.3,-.03,baymax).rotation.z=side*.25;
  ellipsoid(.38,.73,.38,materials.white,side*1.12,1.7,.08,baymax).rotation.z=side*.12;
  ellipsoid(.39,.54,.42,materials.white,side*1.23,.82,.3,baymax).rotation.x=-.16;
  ellipsoid(.35,.24,.38,materials.white,side*1.25,.35,.48,baymax);
  for(let finger=0;finger<3;finger++)ellipsoid(.09,.11,.17,materials.white,side*1.25+(finger-1)*.17,.29,.76,baymax);
  const leg=ellipsoid(.49,.49,.83,materials.white,side*.57,.48,.76,baymax);leg.rotation.y=side*.2;
  ellipsoid(.43,.35,.61,materials.armor,side*.71,.26,1.42,baymax);
  box(.53,.07,.62,materials.dark,side*.71,.04,1.5,baymax);
}
// A few armor scratches, and a dormant back thruster.
box(.025,.29,.012,materials.seam,-.99,2.35,.373,baymax).rotation.z=-.4;
box(.016,.19,.012,materials.seam,1.06,2.27,.365,baymax).rotation.z=.3;
ellipsoid(.48,.66,.26,materials.armor,0,2.1,-.61,baymax);

return baymax;
}


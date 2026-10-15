import { Box3, Color, Group, Mesh, MeshStandardMaterial, TorusGeometry, CylinderGeometry, Vector3, type Material, type Object3D } from 'three';
import { assets } from '../systems/AssetManager';
import { SceneKit } from '../phase2/SceneKit';
import { createChestAccess } from '../characters/ChestAccess.js';
import { disposeObject } from '../performance/Disposal';
import type { SystemId, ViewMode } from './diagnostics';
export type Assembly = Awaited<ReturnType<typeof createInspectionModel>>;
export async function createInspectionModel() {
 const model=await assets.cloneBaymax();
 model.name='Baymax / diagnostic assembly';
 const kit=new SceneKit('Medical service modules');
 const privateMaterials:Material[]=[];
 const surfaces:{mesh:Mesh;region:SystemId;color:Color;opacity:number}[]=[];
 const meshes:Mesh[]=[];model.traverse(n=>{if(n instanceof Mesh)meshes.push(n);});
 const belongsToHead=(o:Object3D)=>{let p:Object3D|null=o;while(p){if(p.name==='dormant-head')return true;p=p.parent;}return false;};
 for(const mesh of meshes){
   const p=mesh.position;
   let region:SystemId=belongsToHead(mesh)?'sensor':p.z>1.1||p.y<.6?'motor':Math.abs(p.x)>1?'arm':Math.abs(p.x)>.8?'armour':mesh.name.startsWith('access')||mesh.parent?.name==='baymax-access'?'core':'power';
   mesh.userData.region=region;
   if(p.z<-.4 && !Array.isArray(mesh.material) && mesh.material.name==='armor')mesh.visible=false;
   const original=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
   const material=original.clone() as MeshStandardMaterial;
   // Independent materials keep diagnostics from changing the cinematic asset.
   mesh.material=material;privateMaterials.push(material);
   surfaces.push({mesh,region,color:material.color?.clone()??new Color('#eeeade'),opacity:material.opacity});
 }
 for(const side of [-1,1]){
   const hip=new Group();hip.position.set(side*.53,.55,.28);model.add(hip);model.updateMatrixWorld(true);
   for(const mesh of meshes){const p=mesh.position,sx=side*p.x;const thigh=Math.abs(sx-.57)<.06&&Math.abs(p.y-.48)<.06;const foot=Math.abs(sx-.71)<.06&&(Math.abs(p.y-.26)<.06||Math.abs(p.y-.04)<.06)&&p.z>1.2;if(thigh||foot){mesh.userData.region='motor';hip.attach(mesh);}}
   hip.rotation.x=1.45;
 }
 model.add(kit.root);
 const medical=kit.standard('#dce3df',.65,.12), graphite=kit.standard('#334248',.75,.18), signal=kit.standard('#547c7b',.55,.25), red=kit.standard('#a6372c',.55,.16);
 const mark=(object:Object3D,id:SystemId)=>{object.traverse(n=>{n.userData.region=id;});return object;};
 const internals=new Group();kit.root.add(internals);
 const tray=new Group();internals.add(tray);tray.position.set(0,2,.22);mark(tray,'core');
 mark(kit.box({p:[0,0,0],s:[.83,.57,.14]},medical,tray),'core');
 // Empty healthcare socket and occupied combat socket are distinct physical bays.
 for(const x of [-.23,.23]){
   mark(kit.box({p:[x,0,.085],s:[.31,.36,.035]},graphite,tray),'core');
   for(const y of [-.16,.16])mark(kit.box({p:[x,y,.11],s:[.28,.025,.025]},signal,tray),'core');
 }
 mark(kit.box({p:[.23,0,.12],s:[.19,.27,.045]},red,tray),'core').name='combat-program-chip';
 mark(kit.box({p:[-.23,-.1,.11],s:[.2,.025,.02]},medical,tray),'core');
 mark(kit.box({p:[0,2.97,.12],s:[.48,.15,.18]},graphite,internals),'sensor');
 for(const x of [-.17,.17])mark(kit.mesh(kit.ownGeometry(new TorusGeometry(.055,.012,6,16)),signal,{p:[x,2.98,.24]} ,internals),'sensor');
 const power=mark(kit.box({p:[0,1.25,.12],s:[.62,.73,.48]},medical,internals),'power');
 mark(kit.box({p:[0,1.25,.38],s:[.37,.5,.04]},graphite,internals),'power');
 const bypass=mark(kit.box({p:[.4,1.45,.2],s:[.06,.75,.07]},red,internals),'power') as Mesh;
 for(const x of [-1.12,1.12])mark(kit.mesh(kit.ownGeometry(new CylinderGeometry(.13,.13,.65,20)),graphite,{p:[x,1.65,.15]},internals),'arm');
 mark(kit.box({p:[0,.55,.2],s:[.7,.22,.26]},graphite,internals),'motor');
 bypass.name='power-bypass';
 bypass.material=kit.ownMaterial((bypass.material as MeshStandardMaterial).clone());
 const pods:Mesh[]=[];
 for(const [x,id] of [[-.62,'left'],[.62,'right']] as const){
   const pod=mark(kit.box({p:[x,1.65,-.73],s:[.44,.85,.36]},medical),'left');pod.userData.region=id;
   mark(pod,id);
   const nozzle=mark(kit.mesh(kit.ownGeometry(new TorusGeometry(.14,.035,8,24)),graphite,{p:[x,1.4,-.94]}),id) as Mesh;
   nozzle.material=kit.ownMaterial((nozzle.material as MeshStandardMaterial).clone());
   pods.push(nozzle);
   mark(kit.box({p:[x,1.85,-.94],s:[.16,.045,.035]},id==='left'?red:signal),id);
 }
 const plug=mark(kit.box({p:[-.62,1.85,-1.2],s:[.19,.07,.08]},medical),'left') as Mesh;
 plug.name='left-control-plug';
 const skin=new MeshStandardMaterial({color:'#eeeade',roughness:.7});
 const chest=createChestAccess(skin);chest.root.position.set(.42,2.05,.68);chest.root.rotation.y=.15;
 model.add(chest.root);mark(chest.root,'core');
 const services:{mesh:Mesh;color:Color}[]=[];
 kit.root.traverse(n=>{if(n instanceof Mesh){const mat=kit.ownMaterial((n.material as MeshStandardMaterial).clone());n.material=mat;services.push({mesh:n,color:mat.color.clone()});}});
 const limb=meshes.find(m=>m.userData.region==='arm'&&m.position.x<0);
 const originalArmRotation=limb?.rotation.z??0;
 let currentMode:ViewMode='exterior';
 function update(mode:ViewMode,selected:SystemId|null,opened:boolean,powerStable:boolean,thrusterFixed:boolean,actuatorFixed:boolean,neutral:number,connectorAngle:number,connectorDepth:number){
   currentMode=mode;
   for(const item of surfaces){
     const {mesh,region}=item,mat=mesh.material as MeshStandardMaterial;
     const selectedRegion=selected===region;
     const internal=mode==='internal';const envelope=(mat.name==='inflatable'||mesh.name==='inflatable-body')&&region!=='sensor';const subdued=mode==='isolate'&&(!selectedRegion||envelope);
     mat.transparent=internal||subdued;mat.opacity=internal?.12:subdued?(selectedRegion?.16:.06):1;mat.depthWrite=!(internal||subdued);mat.needsUpdate=true;
     if(mat.color)mat.color.copy(item.color).lerp(new Color('#8eaaa6'),selectedRegion?.25:0);
     if(mat.emissive){mat.emissive.set(selectedRegion?'#387b73':'#000000');mat.emissiveIntensity=selectedRegion?.18:0;}
     // The original closed access disk is replaced by the existing articulated medical bay.
     if(mesh.name==='access-panel'||mesh.name==='access-ring')mesh.visible=!opened;
   }
   for(const {mesh,color} of services){const mat=mesh.material as MeshStandardMaterial;const active=mesh.userData.region===selected;const faded=mode==='isolate'&&!active;mat.transparent=faded;mat.opacity=faded?.08:1;mat.depthWrite=!faded;mat.color.copy(color);mat.emissive.set(active?'#3b7b6e':'#000000');mat.emissiveIntensity=active?.2:0;mat.needsUpdate=true;}
   internals.visible=mode!=='exterior';
   internals.traverse(n=>{if(n instanceof Mesh)n.visible=mode!=='isolate'||n.userData.region===selected;});
   chest.root.visible=opened&&(mode!=='isolate'||selected==='core');chest.update({t:0,open:opened?4.6:0,align:0,seated:1,seal:opened?0:1,red:1});
   (bypass.material as MeshStandardMaterial).color.set(powerStable?'#4b887c':'#a6372c');
   pods.forEach((pod,i)=>{(pod.material as MeshStandardMaterial).color.set(i===0&&thrusterFixed?'#5b978b':'#334248');pod.position.z=i===0&&thrusterFixed?-.98:-.94;});
   if(limb)limb.rotation.z=originalArmRotation+neutral*Math.PI/180*.2;
   plug.rotation.z=connectorAngle*Math.PI/180;plug.position.z=-1.2+connectorDepth*.0023;
   (plug.material as MeshStandardMaterial).color.set(thrusterFixed?'#4b887c':'#c6cdc6');
   power.userData.stable=powerStable;
 }
 return {model,update,get mode(){return currentMode;},ground(){model.updateMatrixWorld(true);const bounds=new Box3();model.traverseVisible(n=>{if(n instanceof Mesh)bounds.union(new Box3().setFromObject(n,true));});const center=bounds.getCenter(new Vector3());model.position.set(-center.x,-.12-bounds.min.y,-4-center.z);},dispose(){privateMaterials.forEach(m=>m.dispose());disposeObject(chest.root);skin.dispose();kit.dispose();}};
}

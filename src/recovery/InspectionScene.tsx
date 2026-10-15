import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Color, Euler, Quaternion, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createPortalDimension } from '../environment/PortalDimension.js';
import { SceneKit } from '../phase2/SceneKit';
import { reducedMotion } from '../config/experience';
import { createInspectionModel, type Assembly } from './InspectionModel';
import { SYSTEMS, useDiagnostics } from './diagnostics';
function City(){
 const world=useMemo(()=>createPortalDimension(),[]);
 const kit=useMemo(()=>{const k=new SceneKit('Harbour service road');k.label('SAN FRANSOKYO / HARBOUR\nSERVICE ROAD / 通行止',{p:[-4,3,-9],r:[0,.2,-.15]},4);k.box({p:[3.9,.8,-15],s:[2.5,2.1,6],r:[.05,-.24,-.2]},k.concrete);for(let i=0;i<4;i++)k.box({p:[2.55,1.2,-13-i*1.2],s:[.05,.65,.8]},k.dim);k.box({p:[-2,.3,-12],s:[6,.25,.3],r:[0,.3,-.07]},k.metal);return k;},[]);
 const invalidate=useThree(s=>s.invalidate);
 useEffect(()=>()=>{world.dispose();kit.dispose();},[world,kit]);
 useFrame(({clock},dt)=>{if(!reducedMotion){world.update(clock.elapsedTime,Math.min(dt,.05),false);invalidate();}});
 return <><group position={[0,0,7]}><primitive object={world.group}/></group><primitive object={kit.root}/></>;
}
export function InspectionScene({workspace,viewReset,onReady,onError}:{workspace:boolean;viewReset:number;onReady:()=>void;onError:()=>void}){
 const {camera,gl,invalidate,scene}=useThree();
 const d=useDiagnostics();const [assembly,setAssembly]=useState<Assembly|null>(null);
 const controls=useRef<OrbitControls|null>(null);
 const moving=useRef(false),cameraGoal=useMemo(()=>new Vector3(),[]),lookGoal=useMemo(()=>new Vector3(),[]);
 const modelGoal=useMemo(()=>new Vector3(),[]),rotationGoal=useMemo(()=>new Quaternion(),[]);
 const entryPosition=useRef(new Vector3()),entryRotation=useRef(new Quaternion());
 useEffect(()=>{let live=true;let owned:Assembly|null=null;createInspectionModel().then(a=>{if(!live){a.dispose();return;}owned=a;a.model.rotation.order='YXZ';a.model.rotation.set(-Math.PI/2,-.35,-.08);a.ground();entryPosition.current.copy(a.model.position);entryRotation.current.copy(a.model.quaternion);setAssembly(a);onReady();invalidate();}).catch(()=>{if(live)onError();});return()=>{live=false;owned?.dispose();};},[onReady,onError,invalidate]);
 useEffect(()=>{
  if(!workspace)return;
  const c=new OrbitControls(camera,gl.domElement);c.enablePan=false;c.minDistance=1.8;c.maxDistance=11;c.enableDamping=false;c.target.set(0,.5,0);controls.current=c;
  const change=()=>invalidate(),start=()=>{moving.current=false;invalidate();};c.addEventListener('change',change);c.addEventListener('start',start);
  return()=>{c.removeEventListener('change',change);c.removeEventListener('start',start);c.dispose();controls.current=null;};
 },[workspace,camera,gl,invalidate]);
 useEffect(()=>{
  if(!assembly)return;
  assembly.update(d.mode,d.selected,d.bayOpen,d.route==='bypass',d.thrusterFixed,d.actuatorFixed,d.neutral,d.connectorAngle,d.connectorDepth);invalidate();
 },[assembly,d.mode,d.selected,d.bayOpen,d.route,d.thrusterFixed,d.actuatorFixed,d.neutral,d.connectorAngle,d.connectorDepth,invalidate]);
 useEffect(()=>{
  if(!assembly)return;
  scene.background=new Color(workspace?'#cad1d0':'#101c31');
  if(workspace){
   modelGoal.set(0,-1.1,0);rotationGoal.setFromEuler(new Euler(0,0,0));
   const item=SYSTEMS.find(s=>s.id===d.selected);
   if(item){lookGoal.set(item.position[0],item.position[1],item.position[2]).add(modelGoal);const back=d.selected==='left'||d.selected==='right';cameraGoal.copy(lookGoal).add(new Vector3(back?-2.6:2.3,1.3,back?-3.8:4.2));}
   else{lookGoal.set(0,.5,0);cameraGoal.set(4.8,2.7,6.7);}
  }else{modelGoal.copy(entryPosition.current);rotationGoal.copy(entryRotation.current);cameraGoal.set(1.2,2.7,8);lookGoal.set(0,.8,-4);}
  moving.current=true;invalidate();
 },[workspace,assembly,d.selected,viewReset,scene,invalidate,cameraGoal,lookGoal,modelGoal,rotationGoal]);
 useFrame((_,delta)=>{
  if(!assembly)return;
  const poseActive=assembly.model.position.distanceTo(modelGoal)>.008||assembly.model.quaternion.angleTo(rotationGoal)>.008;
  if(!moving.current&&!poseActive)return;
  const alpha=reducedMotion?1:1-Math.exp(-Math.min(delta,.05)*5);
  assembly.model.position.lerp(modelGoal,alpha);assembly.model.quaternion.slerp(rotationGoal,alpha);
  if(moving.current){camera.position.lerp(cameraGoal,alpha);
  if(controls.current){controls.current.target.lerp(lookGoal,alpha);controls.current.update();}else camera.lookAt(lookGoal);}
  const settled=camera.position.distanceTo(cameraGoal)<.008&&assembly.model.position.distanceTo(modelGoal)<.008&&assembly.model.quaternion.angleTo(rotationGoal)<.008;
  if(settled)moving.current=false;else if(moving.current||poseActive)invalidate();
 });
 useEffect(()=>{if(!import.meta.env.DEV)return;const debug={model:assembly?.model,scene,camera,gl};(window as Window & {__baymaxInspection?:unknown}).__baymaxInspection=debug;return()=>{delete (window as Window & {__baymaxInspection?:unknown}).__baymaxInspection;};},[assembly,scene,camera,gl]);
 const down=useRef<[number,number]>([0,0]);
 const pick=(e:ThreeEvent<MouseEvent>)=>{if(!workspace||Math.hypot(e.clientX-down.current[0],e.clientY-down.current[1])>5)return;e.stopPropagation();const id=e.object.userData.region;if(SYSTEMS.some(s=>s.id===id))d.select(id);};
 return <>
  {!workspace&&<><fogExp2 attach="fog" args={['#253e59',.023]}/><City/></>}
  {workspace&&<gridHelper args={[20,20,'#a8b4b1','#bac3c0']} position={[0,-2.05,0]}/>}
  <hemisphereLight args={['#f6f6ed','#6a7479',workspace?2.7:2]}/>
  <directionalLight position={[-3,8,5]} intensity={workspace?2.2:1.5} color="#e2eff2"/>
  <directionalLight position={[4,3,-5]} intensity={workspace?1.5:.3} color="#b6ccc8"/>
  {assembly&&<primitive object={assembly.model} dispose={null} onPointerDown={(e:ThreeEvent<PointerEvent>)=>{down.current=[e.clientX,e.clientY];}} onClick={pick}/>}
 </>;
}

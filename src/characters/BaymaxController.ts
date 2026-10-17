import { Box3, Euler, type Material, AdditiveBlending, CanvasTexture, Color, ConeGeometry, Group, MathUtils, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, Object3D, PointLight, Quaternion, RepeatWrapping, ShaderMaterial, Sprite, SpriteMaterial, Vector3 } from 'three';
import { BAYMAX_POSITION } from '../config/experience';
import type { Phase } from '../state/SceneStateManager';
import type { SequenceDirector } from '../systems/SequenceDirector';
import { createChestAccess } from './ChestAccess.js';
import { createArmouredBaymax, mountArmour, type ArmouredBaymax } from './ArmouredBaymax';

/** After the combat chip takes over: plated. It assembles during 'corrupting' (tracker P1-01). */
const ARMOURED:Phase[]=['threat','ignition','chase','fracture','pulled','handoff'];

const ease=(t:number)=>MathUtils.smoothstep(t,0,1);
const span=(t:number,a:number,b:number)=>MathUtils.smoothstep(t,a,b);
/** A single smooth pulse between a and b (0 → 1 → 0). */
const bump=(t:number,a:number,b:number)=>Math.sin(Math.PI*MathUtils.clamp((t-a)/(b-a),0,1));
/** A sharp jolt at a, decaying (the combat program loading in hits). */
const jolt=(t:number,a:number,decay=7)=>t<a?0:Math.exp(-(t-a)*decay)*Math.sin((t-a)*38);
/** Shortest signed difference between two angles, so turns never go the long way round. */
const wrap=(a:number)=>Math.atan2(Math.sin(a),Math.cos(a));
const HEAD_YAW=1.05,HEAD_PITCH_UP=.45,HEAD_PITCH_DOWN=.6;
const UP=new Vector3(0,1,0),DOWN=new Vector3(0,-1,0);
const DORMANT_HEAD={x:.24,y:0,z:-.12};
type Pose={pos:Vector3;yaw:number;pitch:number;roll:number;head:Vector3;look:number;arm:number;aim:Vector3;thrust:number;inflate:number;stand:number};
/** Standing straightens the legs under him; the body rises by this much to keep the feet grounded. */
const STAND_LIFT=.89,LEG_SWING=1.45;

function glowTexture(){
  const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d')!;
  const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.25,'rgba(255,255,255,.5)');g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.fillRect(0,0,64,64);return new CanvasTexture(c);
}

/**
 * Baymax stays Baymax: every motion is damped, weighted and slow to start. What changes is
 * intent. Corruption is carried by eyes, armour, chest light and posture, never by twitching.
 */
export class BaymaxController {
  readonly chest:ReturnType<typeof createChestAccess>;
  private head:Object3D|null=null;
  private eyes:Mesh[]=[];private eyeGlow:Sprite[]=[];
  private armR=new Group();private armL=new Group();private legR=new Group();private legL=new Group();
  private armor:MeshPhysicalMaterial;private skin:MeshPhysicalMaterial;
  private redLight=new PointLight('#ff2a1c',0,7,1.6);
  private thruster=new Group();private flame:ShaderMaterial;private thrusterGlow:Sprite;
  private hand=new Object3D();private charge:Sprite;
  private pose:Pose;private target:Pose;
  private phase:Phase='loading';private phaseTime=0;private beat:string|null=null;
  // Motion memory for the flight layer (bank, trailing legs) and squash/stretch impulses.
  private prevPos=new Vector3();private prevYaw=0;private bank=0;private stretch=0;private moved=false;
  private tmp=new Vector3();private tmp2=new Vector3();private q=new Quaternion();private q2=new Quaternion();
  private eyeColor=new Color();private lastBeatTime=0;
  private hole={uHoleCenter:{value:new Vector3()},uHoleNormal:{value:new Vector3(0,0,1)},uHoleRadius:{value:.196},uHoleOpen:{value:0}};
  // The armoured suit (tracker PW-03), loaded in the background and mounted on the shell.
  private suit?: ArmouredBaymax;private suitLoading=false;private suitBaseY=0;private wasCovered=false;private white?:Mesh[];private suitStandY=0;private box=new Box3();private eul=new Euler();
  private qs=[new Quaternion(),new Quaternion(),new Quaternion(),new Quaternion(),new Quaternion()];
  constructor(public readonly shell: Group) {
    shell.position.set(...BAYMAX_POSITION);
    shell.rotation.order='YXZ';shell.rotation.y=-.18;
    shell.name='Baymax';
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#bbbbbb';ctx.fillRect(0,0,128,128);
    for(let y=0;y<128;y+=4)for(let x=0;x<128;x+=4){const v=178+Math.sin(x*.31+y*.2)*5;ctx.fillStyle=`rgb(${v},${v},${v})`;ctx.fillRect(x,y,4,4);}
    const roughness=new CanvasTexture(canvas);roughness.wrapS=roughness.wrapT=RepeatWrapping;roughness.repeat.set(3,3);
    this.skin=new MeshPhysicalMaterial({name:'inflatable',color:'#eee8dc',roughness:.79,roughnessMap:roughness,metalness:0,sheen:.38,sheenColor:new Color('#ead8c3'),sheenRoughness:.9,clearcoat:.02,envMapIntensity:.45});
    this.armor=new MeshPhysicalMaterial({name:'armor',color:'#8c1531',roughness:.3,metalness:.48,clearcoat:.28,clearcoatRoughness:.36,envMapIntensity:.65,emissive:'#ff1d12',emissiveIntensity:0});
    const meshes:Mesh[]=[];
    shell.traverse(object=>{
      if(object.name==='dormant-head')this.head=object;
      if(object instanceof Mesh&&!Array.isArray(object.material)){
        meshes.push(object);
        if(object.material.name==='inflatable')object.material=this.skin;
        else if(object.material.name==='armor')object.material=this.armor;
        // GLTFLoader de-duplicates names (dormant-eye, dormant-eye_1).
        if(object.name.startsWith('dormant-eye'))this.eyes.push(object);
        // The baked access port is replaced by the articulated bay below.
        if(object.name==='access-panel'||object.name==='access-ring')object.visible=false;
      }
    });
    // Eyes bypass tone mapping so corruption reads as a clean crimson, not a blown-out orange.
    this.eyes.forEach(eye=>{const m=(eye.material as MeshBasicMaterial).clone();m.toneMapped=false;eye.material=m;});
    if(this.head)this.head.rotation.order='YXZ';
    // Arms hinge at the shoulder: upper arm, forearm, hand and fingers are separate shapes.
    for(const [side,pivot] of [[1,this.armR],[-1,this.armL]] as const){
      pivot.position.set(side*1.02,2.26,.02);shell.add(pivot);
      for(const m of meshes){
        const p=m.position,sx=side*p.x;
        const upper=Math.abs(sx-1.12)<.06&&Math.abs(p.y-1.7)<.06,fore=Math.abs(sx-1.23)<.06&&Math.abs(p.y-.82)<.06;
        const hand=Math.abs(sx-1.25)<.06&&Math.abs(p.y-.35)<.06,finger=sx>1.0&&sx<1.5&&Math.abs(p.y-.29)<.03&&p.z>.7;
        if(upper||fore||hand||finger)pivot.attach(m);
      }
    }
    // Legs hinge at the hip: thigh, armoured foot and sole. Seated, they point forward; standing
    // and in flight they swing down under him, so he can rise and fly rather than float seated.
    for(const [side,pivot] of [[1,this.legR],[-1,this.legL]] as const){
      pivot.position.set(side*.53,.55,.28);shell.add(pivot);
      for(const m of meshes){
        const p=m.position,sx=side*p.x;
        const thigh=Math.abs(sx-.57)<.06&&Math.abs(p.y-.48)<.06&&Math.abs(p.z-.76)<.08;
        const foot=Math.abs(sx-.71)<.06&&(Math.abs(p.y-.26)<.06||Math.abs(p.y-.04)<.06)&&p.z>1.2;
        if(thigh||foot)pivot.attach(m);
      }
    }
    this.hand.position.set(.23,-1.95,.62);this.armR.add(this.hand);
    const glow=glowTexture();
    // Medical access bay, seated on the surface normal of the chest curve.
    // The iris leaves keep an unpatched copy of the skin; only the body is cut open.
    this.chest=createChestAccess(this.skin.clone());
    this.skin.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,this.hole);
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vHoleWorld;')
        .replace('#include <project_vertex>','#include <project_vertex>\nvHoleWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vHoleWorld;uniform vec3 uHoleCenter;uniform vec3 uHoleNormal;uniform float uHoleRadius;uniform float uHoleOpen;')
        .replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(uHoleOpen>.5){vec3 hd=vHoleWorld-uHoleCenter;float along=dot(hd,uHoleNormal);if(length(hd-along*uHoleNormal)<uHoleRadius&&along>-.35&&along<.1)discard;}');
    };
    this.skin.customProgramCacheKey=()=>'baymax-skin-hole';
    this.chest.root.position.set(.42,2.05,.642);
    this.chest.root.quaternion.setFromUnitVectors(new Vector3(0,0,1),new Vector3(.4,.34,1).normalize());
    shell.add(this.chest.root);
    if(this.head){
      for(const eye of this.eyes){
        const s=new Sprite(new SpriteMaterial({map:glow,color:'#9fe4ff',transparent:true,opacity:0,depthWrite:false,blending:AdditiveBlending}));
        s.position.copy(eye.position).add(new Vector3(0,0,.03));s.scale.setScalar(.2);this.head.add(s);this.eyeGlow.push(s);
      }
    }
    this.redLight.position.set(.1,2.9,1.2);shell.add(this.redLight);
    // Back thruster: a short, hot cone and a soft bloom source; dormant until ignition.
    this.flame=new ShaderMaterial({transparent:true,depthWrite:false,blending:AdditiveBlending,uniforms:{uPower:{value:0},uTime:{value:0}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:'varying vec2 vUv;uniform float uPower;uniform float uTime;void main(){float core=pow(1.-vUv.y,2.2);float flicker=.86+.14*sin(uTime*47.+vUv.y*20.);vec3 c=mix(vec3(1.,.28,.16),vec3(1.,.86,.78),core*core);gl_FragColor=vec4(c*core*flicker*uPower*1.6,core*uPower);}'});
    const cone=new Mesh(new ConeGeometry(.2,1.3,20,1,true),this.flame);cone.rotation.x=Math.PI/2;cone.position.z=-.65;this.thruster.add(cone);
    this.thrusterGlow=new Sprite(new SpriteMaterial({map:glow,color:'#ff6a4a',transparent:true,opacity:0,depthWrite:false,blending:AdditiveBlending}));
    this.thrusterGlow.scale.setScalar(1.3);this.thruster.add(this.thrusterGlow);
    // Angled down and back so the jet lifts him as well as driving him forward.
    this.thruster.position.set(0,1.95,-.82);this.thruster.rotation.x=-.75;shell.add(this.thruster);
    this.charge=new Sprite(new SpriteMaterial({map:glow,color:'#ff6b55',transparent:true,opacity:0,depthWrite:false,blending:AdditiveBlending}));
    this.charge.scale.setScalar(.01);this.hand.add(this.charge);
    const rest=():Pose=>({pos:new Vector3(...BAYMAX_POSITION),yaw:-.18,pitch:0,roll:0,head:new Vector3(DORMANT_HEAD.x,DORMANT_HEAD.y,DORMANT_HEAD.z),look:0,arm:0,aim:new Vector3(),thrust:0,inflate:0,stand:0});
    this.pose=rest();this.target=rest();
  }

  /** The dock in world space, for the chip and camera. */
  dockWorld(){return this.chest.dockWorld();}
  dockQuaternion(out:Quaternion){return this.chest.dock.getWorldQuaternion(out);}
  chestFrame(position:Vector3,normal:Vector3){
    this.chest.root.getWorldPosition(position);
    normal.set(0,0,1).applyQuaternion(this.chest.root.getWorldQuaternion(this.q2)).normalize();
  }

  update(time:number,dt:number,reduced:boolean,phase:Phase,seq:SequenceDirector,camera:Vector3){
    if(phase!==this.phase){this.phase=phase;this.phaseTime=0;}
    this.phaseTime+=dt*seq.slowmo;
    const t=this.phaseTime,T=this.target;
    if(!this.suitLoading){
      this.suitLoading=true;
      createArmouredBaymax({eye:this.eyes[0]?.material as Material|undefined,hole:()=>this.chest.holeOpen?this.dockWorld():null})
        .then(a=>{mountArmour(a,this.shell,{y:.55,z:.28},2.42);this.suitBaseY=a.root.position.y;this.suit=a;})
        .catch(()=>{/* stays white if the suit can't load */});
    }
    const armourK=phase==='corrupting'?(reduced?1:MathUtils.smoothstep(t,.8,3.4)):ARMOURED.includes(phase)?1:0;
    this.restPose(T);
    if(phase==='awakening'||phase==='approaching'||phase==='loading'){T.aim.set(0,0,0);this.snap();}
    // ---------------------------------------------------------------- shell + boot
    let open=0,seal=0,seated=0,seamGlow=0,eyeOn=0;
    const after=(list:Phase[])=>list.includes(phase);
    if(phase==='panel-opening')open=t;
    if(after(['socket-ready','inserting','silence']))open=4.6;
    if(phase==='inserting')seated=span(t,.55,1.1);
    if(phase==='silence'){seated=1;seamGlow=t>1.25&&t<1.42?.35:0;}
    if(phase==='booting'){
      open=4.6;seated=1;seal=span(t,.2,1.5);
      T.inflate=span(t,1.3,2.9);T.pos.y+=span(t,1.3,2.9)*.035;T.roll=span(t,1.6,3)*.018;
      T.head.set(MathUtils.lerp(DORMANT_HEAD.x,.04,span(t,2.1,3.7)),0,MathUtils.lerp(DORMANT_HEAD.z,0,span(t,2.1,3.7)));
      eyeOn=span(t,3.5,3.75);seamGlow=span(t,1.4,2)*.45*(1-span(t,3,4.2));
      // Systems coming online: a shiver through the shell, a hand twitches, a first deep breath
      // that overshoots, and a small double-take as his eyes light and find Hiro.
      T.roll+=Math.sin(t*31)*.006*bump(t,1.5,2.7);
      T.arm=.07*bump(t,2.3,2.7)+.05*bump(t,2.85,3.2);
      T.inflate+=.05*bump(t,2.5,3.6);
      this.lookAt(camera,T,span(t,3.2,4.6)*.9);
      T.head.y+=.09*bump(t,3.6,4.5);
    }
    if(after(['diagnostic','corrupting','threat','ignition','chase','fracture','pulled','handoff'])){open=4.6;seated=1;seal=1;T.inflate=1;T.pos.y+=.035;eyeOn=1;T.head.set(.04,0,0);}
    if(phase==='diagnostic'){
      // A small, curious head tilt: the most Baymax gesture there is.
      T.head.set(.04,.04*span(t,.8,2.2),0);this.lookAt(camera,T,.9);
      T.head.z=.11*span(t,.8,2.2)*(1-span(t,4.3,5.6));
      seamGlow=.18+.14*Math.sin(t*3.1)**2;
      if(t>4.9)seamGlow=Math.sin(t*41)>.55?.55:.12;
    }
    if(phase==='corrupting'){
      const k=span(t,.2,4.6);seamGlow=.3+k*.5;
      T.pitch=.055*k;T.head.set(.04-.06*k,0,0);T.arm=.06*k+.08*span(t,2.8,4.2);T.pos.y+=.02*k;
      // He never stops watching Hiro; the corruption is in how he holds the look.
      this.lookAt(camera,T,.85+span(t,3,4.8)*.15);
      // The combat program loads in hits: three jolts through the body, each squaring him up more.
      const j=jolt(t,1.05)+jolt(t,1.85)*.8+jolt(t,2.65)*1.1;
      T.roll+=j*.03;T.pitch+=Math.abs(j)*.02;T.head.z+=j*.08;T.head.x+=.05*span(t,3.2,4.4);
    }
    if(phase==='threat'){
      seamGlow=.8;T.pitch=.055;T.arm=.14;T.pos.y+=.02;
      this.face(camera,T,.55*span(t,.6,2.4));this.lookAt(camera,T,span(t,.15,1.7));
    }
    const red=seq.red;
    // ---------------------------------------------------------------- violence
    if(phase==='ignition')this.ignition(t,T,camera);
    if(phase==='chase'){this.watch=camera;this.chase(seq,T,camera);this.watch=null;}
    if(phase==='fracture')this.fracture(t,T,camera);
    if(phase==='pulled'||phase==='handoff'){T.pos.set(1.8,4,-60);T.thrust=0;}
    this.shell.visible=!(phase==='pulled'||phase==='handoff')&&!(phase==='fracture'&&t>4.3);
    // ---------------------------------------------------------------- integrate
    const P=this.pose,k=(l:number)=>1-Math.exp(-dt*l);
    const fast=['ignition','chase','fracture'].includes(phase)&&!reduced;
    P.pos.lerp(T.pos,k(fast?7:2.6));
    P.yaw+=wrap(T.yaw-P.yaw)*k(fast?5:1.8);P.yaw=wrap(P.yaw);P.pitch=MathUtils.lerp(P.pitch,T.pitch,k(fast?5:1.6));P.roll=MathUtils.lerp(P.roll,T.roll,k(2));
    P.head.lerp(T.head,k(fast?4.5:phase==='threat'?2.4:1.6));P.look=MathUtils.lerp(P.look,T.look,k(2.2));
    P.arm=MathUtils.lerp(P.arm,T.arm,k(fast?6:2));if(P.aim.lengthSq()===0)P.aim.copy(T.aim);else P.aim.lerp(T.aim,k(8));
    P.thrust=MathUtils.lerp(P.thrust,T.thrust,k(T.thrust>P.thrust?4:2.5));P.inflate=MathUtils.lerp(P.inflate,T.inflate,k(1.5));P.stand=MathUtils.lerp(P.stand,T.stand,k(fast?3.2:2));
    // Flight layer: bank into turns, legs trail with speed and sway on the thruster, the free arm sweeps back.
    const yawVel=this.moved?wrap(P.yaw-this.prevYaw)/Math.max(dt,1e-3):0,speed=this.moved?this.tmp2.subVectors(P.pos,this.prevPos).length()/Math.max(dt,1e-3):0;
    this.prevYaw=P.yaw;this.prevPos.copy(P.pos);this.moved=!reduced;
    this.bank=MathUtils.damp(this.bank,MathUtils.clamp(-yawVel*.2,-.5,.5)*P.thrust,4,dt);
    const trail=Math.min(.45,speed*.025)*P.thrust,sway=reduced?0:Math.sin(time*1.7)*.07*P.thrust*P.stand;
    this.stretch=MathUtils.damp(this.stretch,0,5,dt);
    // Breathing: soft and slow as himself; faster and heavier once the combat program has him.
    const red0=seq.red,breathe=reduced?0:Math.sin(time*MathUtils.lerp(1.05,2.3,red0))*MathUtils.lerp(.004,.007,red0)*P.inflate;
    this.shell.position.copy(P.pos);this.shell.position.y+=breathe-.009*(1-Math.exp(-time*.18))*(1-P.inflate)+P.stand*STAND_LIFT;
    this.legR.rotation.set(P.stand*LEG_SWING+trail+sway,0,P.stand*-.05);this.legL.rotation.set(P.stand*LEG_SWING+trail-sway*.8,0,P.stand*.05);
    this.shell.rotation.set(P.pitch,P.yaw,P.roll+this.bank);
    const st=this.stretch;
    this.shell.scale.set(1+P.inflate*.006+breathe*.4-st*.03,1+P.inflate*.012+breathe+st*.05,1+P.inflate*.006+breathe*.4-st*.03);
    if(this.head){this.head.rotation.set(P.head.x,P.head.y,P.head.z);}
    // Arms: rest, a slight shoulder rise under corruption, or aimed at a world target.
    this.armL.rotation.set(trail*1.2,0,-P.arm*.6-.12*P.thrust);
    if(P.aim.lengthSq()>0){
      this.shell.updateMatrixWorld();
      this.tmp.copy(P.aim);this.shell.worldToLocal(this.tmp);this.tmp.sub(this.armR.position).normalize();
      this.q.setFromUnitVectors(DOWN,this.tmp);this.q2.identity();this.armR.quaternion.slerpQuaternions(this.q2,this.q,Math.min(1,P.arm));
    }else this.armR.rotation.set(0,0,P.arm*.6);
    this.shell.updateMatrixWorld();
    if(this.suit)this.dressSuit(armourK,P.stand);
    this.hand.getWorldPosition(seq.muzzle);
    // ---------------------------------------------------------------- light and tone
    this.eyeColor.set('#0b0f11').lerp(this.tmpColor('#e0140c'),red);
    this.eyes.forEach(eye=>{const m=eye.material as MeshBasicMaterial;m.color.copy(this.eyeColor).multiplyScalar(1+red*.45);});
    const lock=phase==='threat'?Math.exp(-Math.pow((t-1.75)*3,2)):0;
    this.eyeGlow.forEach(s=>{const m=s.material;m.color.set('#9fe4ff').lerp(this.tmpColor('#ff2a1a'),red);m.opacity=eyeOn*(.2+red*.28)+lock*.4;s.scale.setScalar(.15+red*.08+lock*.14);});
    this.armor.emissiveIntensity=red*(.16+.05*Math.sin(time*2.2))+P.thrust*.12;
    this.redLight.intensity=red*(.75+lock*1.6)+P.thrust*2.4;
    this.redLight.position.set(.1,MathUtils.lerp(3,2.1,P.thrust),MathUtils.lerp(2.2,-1.6,P.thrust));
    this.flame.uniforms.uPower.value=P.thrust;this.flame.uniforms.uTime.value=time;
    this.thruster.scale.set(1,1,.6+P.thrust*.8);this.thruster.visible=P.thrust>.01;
    this.thrusterGlow.material.opacity=P.thrust*.85;
    const charging=this.charging(phase,t,seq);
    this.charge.material.opacity=charging;this.charge.scale.setScalar(.05+charging*.75+(reduced?0:Math.sin(time*31)*.04*charging));
    this.chest.update({t:time,open,seal,seated,align:phase==='socket-ready'?seq.alignment:0,red,seamGlow});
    this.hole.uHoleOpen.value=this.chest.holeOpen?1:0;this.hole.uHoleRadius.value=this.chest.CAVITY*this.shell.scale.x;
    this.chestFrame(this.hole.uHoleCenter.value,this.hole.uHoleNormal.value);
  }

  private colorCache=new Map<string,Color>();
  private tmpColor(hex:string){let c=this.colorCache.get(hex);if(!c){c=new Color(hex);this.colorCache.set(hex,c);}return c;}
  private restPose(T:Pose){
    T.pos.set(...BAYMAX_POSITION);T.yaw=-.18;T.pitch=0;T.roll=0;T.head.set(DORMANT_HEAD.x,DORMANT_HEAD.y,DORMANT_HEAD.z);
    T.look=0;T.arm=0;T.thrust=0;T.inflate=0;T.stand=0;
  }
  private snap(){const P=this.pose,T=this.target;P.pos.copy(T.pos);P.yaw=T.yaw;P.pitch=T.pitch;P.roll=T.roll;P.head.copy(T.head);P.arm=T.arm;P.thrust=0;P.inflate=0;P.stand=0;P.aim.set(0,0,0);}
  /** Turns the head (and a little of the body) toward a world point, Baymax-slow. */
  private lookAt(point:Vector3,T:Pose,weight:number){
    if(weight<=0)return;
    // Head height follows the body's own pitch (he pivots near the feet), so aim from where the eyes really are.
    const lift=2.98+T.stand*STAND_LIFT,headY=T.pos.y+lift*Math.cos(T.pitch),reachZ=lift*Math.sin(T.pitch);
    const hx=T.pos.x+Math.sin(T.yaw)*reachZ,hz=T.pos.z+Math.cos(T.yaw)*reachZ;
    const dx=point.x-hx,dz=point.z-hz,dy=point.y-headY;
    // Relative to the body. What the neck can't reach, the body turns and leans into.
    const yaw=wrap(Math.atan2(dx,dz)-T.yaw),pitch=-Math.atan2(dy,Math.hypot(dx,dz))-T.pitch;
    const headYaw=MathUtils.clamp(yaw,-HEAD_YAW,HEAD_YAW),headPitch=MathUtils.clamp(pitch,-HEAD_PITCH_UP,HEAD_PITCH_DOWN);
    T.yaw=wrap(T.yaw+(yaw-headYaw)*weight);
    T.pitch=MathUtils.clamp(T.pitch+(pitch-headPitch)*weight,-1.1,1.1);
    T.head.y=MathUtils.lerp(T.head.y,headYaw,weight);
    T.head.x=MathUtils.lerp(T.head.x,headPitch,weight);
    T.head.z=MathUtils.lerp(T.head.z,0,weight);
  }
  private face(point:Vector3,T:Pose,weight=1){T.yaw=wrap(T.yaw+wrap(Math.atan2(point.x-T.pos.x,point.z-T.pos.z)-T.yaw)*weight);}
  /** Hiro, while the chase runs: flights keep him in view instead of showing their back. */
  private watch:Vector3|null=null;
  private flyToward(from:Vector3,to:Vector3,T:Pose,u:number,pitch=.55){
    T.pos.lerpVectors(from,to,ease(u));this.tmp2.subVectors(to,from);
    T.yaw=Math.atan2(this.tmp2.x,this.tmp2.z);T.thrust=1;T.stand=1;
    const lean=pitch*Math.min(1,Math.sin(Math.PI*Math.min(1,u*1.1))*1.7);
    if(!this.watch){T.pitch=lean;T.head.set(-.35*Math.min(1,pitch),0,0);return;}
    // Flying at Hiro he leads with his face. Pulling away he turns to keep watching him and
    // backs off, leaning back on the thruster, instead of showing his back and the soles of his feet.
    const fx=this.tmp2.x,fz=this.tmp2.z,cx=this.watch.x-T.pos.x,cz=this.watch.z-T.pos.z;
    const toward=(fx*cx+fz*cz)/Math.max(1e-4,Math.hypot(fx,fz)*Math.hypot(cx,cz));
    const away=1-span(toward,-.45,.35);
    this.face(this.watch,T,away);
    T.pitch=lean*(1-away)-.28*away*Math.min(1,lean*2);
    T.head.set(0,0,0);this.lookAt(this.watch,T,.9);
  }
  private charging(phase:Phase,t:number,seq:SequenceDirector){
    if(phase==='ignition')return span(t,.55,1.55)*(1-span(t,1.6,1.7));
    if(phase!=='chase')return 0;
    const b=seq.beat,bt=seq.beatTime;
    if(b==='silhouette')return span(bt,.2,.9)*(1-span(bt,.95,1.05));
    if(b==='rooftop')return span(bt,.75,1.4)*(1-span(bt,1.45,1.55));
    if(b==='final')return span(bt,1.05,2)*(1-span(bt,2.25,2.4));
    return 0;
  }
  private ignition(t:number,T:Pose,camera:Vector3){
    // He stands. The first thing the corrupted state does is rise to full height over Hiro.
    T.inflate=1;T.pos.y+=.035-.07*bump(t,0,.45);T.stand=span(t,.25,1.05);
    // A squash as the thruster catches, then he stretches up and away.
    if(t>2.3&&t<2.33)this.stretch=-.6;if(t>2.5&&t<2.53)this.stretch=.7;
    // Tension, aim, discharge, recoil, spool, launch.
    this.face(camera,T,.45*span(t,0,.6));this.lookAt(camera,T,1);
    T.pitch=.12*span(t,0,.5)-.1*span(t,1.6,1.75)*(1-span(t,1.9,2.3));
    T.arm=span(t,.2,1.05);T.aim.set(1.5,.7,-8.5);
    if(t>1.6&&t<1.85)T.arm=.85;
    T.thrust=span(t,1.95,2.5);
    const lift=Math.pow(span(t,2.45,4.4),1.6);
    T.pos.set(BAYMAX_POSITION[0]+lift*1.6,BAYMAX_POSITION[1]+.035+lift*13,BAYMAX_POSITION[2]-lift*5);
    T.pitch-=lift*.25;if(t>2.6){T.arm=MathUtils.lerp(T.arm,0,span(t,2.6,3.2));}
  }
  private chase(seq:SequenceDirector,T:Pose,camera:Vector3){
    const b=seq.beat,u=seq.beatTime,V=(x:number,y:number,z:number)=>this.tmp.set(x,y,z);
    T.inflate=1;T.thrust=1;T.stand=1;
    if(!b){T.pos.set(5,15,-24);T.pitch=.15;this.face(camera,T);this.lookAt(camera,T,1);return;}
    if(b!==this.beat){this.beat=b;this.lastBeatTime=0;}
    if(b==='silhouette'){
      // A far shape in the fog, eyes first, then the bolt.
      const from=new Vector3(15,13,-42),hold=new Vector3(8.6,8.2,-31);
      if(u<.6)this.flyToward(from,hold,T,u/.6,.8);else{T.pos.copy(hold);T.pos.y+=Math.sin(u*2)*.12;T.pitch=.12;}
      if(u>.6&&u<1.3){this.face(camera,T);this.lookAt(camera,T,span(u,.6,.8));T.arm=span(u,.2,.8);T.aim.set(4.75,.35,-17.4);}
      if(u>1.5)this.flyToward(hold,V(16,17,-44).clone(),T,span(u,1.5,2.8),1);
    }else if(b==='overhead'){
      // A pass directly over Hiro: red light through the dust, the thruster wash shoves him.
      const from=new Vector3(camera.x+1.6,camera.y+5.2,camera.z+10),to=new Vector3(camera.x-4,camera.y+7.5,camera.z-26);
      this.flyToward(from,to,T,Math.min(1,u/2.1),1.2);
    }else if(b==='rooftop'){
      const roof=new Vector3(-11.4,18.1,-21.6);
      if(u<.65)this.flyToward(V(-22,25,-34).clone(),roof,T,u/.65,.85);
      else{T.pos.copy(roof);T.thrust=.25;T.pitch=.18;this.face(camera,T);this.lookAt(camera,T,1);T.arm=span(u,.7,1.3)*(1-span(u,1.8,2.3));T.aim.set(-.6,-.12,-21.2);}
      if(u>2.3)this.flyToward(roof,V(-4,26,-40).clone(),T,span(u,2.3,3.6),1);
    }else if(b==='tear-pass'){
      // He comes out of the tear itself, close enough to fill the frame for a moment.
      const from=new Vector3(5.8,2.3,-23.8),to=new Vector3(-8,3.8,-19.8);
      if(u<.32){T.pos.copy(from);T.thrust=.4;}else this.flyToward(from,to,T,span(u,.32,1.45),1.1);
      if(u>.32&&u<1.1)this.lookAt(camera,T,1);
    }else if(b==='final'){
      const high=new Vector3(2.2,9.6,-29.6),ground=new Vector3(1.9,-.08,-30.4);
      if(u<1.05)this.flyToward(V(-6,14,-24).clone(),high,T,u/1.05,.85);
      else if(u<2.05){T.pos.copy(high);T.pos.y+=Math.sin(u*3)*.1;this.face(camera,T);this.lookAt(camera,T,1);T.thrust=.7;T.arm=span(u,1.05,1.5);T.aim.copy(camera);}
      else{const d=span(u,2.05,2.3);if(u>2.28&&u<2.32)this.stretch=-1;T.pos.lerpVectors(high,ground,d*d);this.face(camera,T);T.pitch=.35*d;T.arm=.9;T.aim.copy(ground).setY(-1);T.thrust=1-d*.6;}
    }
  }
  private fracture(t:number,T:Pose,camera:Vector3){
    // Caught by the instability his own blow created: resists, then is taken.
    T.inflate=1;T.stand=1;const crater=new Vector3(1.9,-.08,-30.4),hover=new Vector3(1.9,1.9,-30.9);
    T.pos.lerpVectors(crater,hover,span(t,.2,1.3));this.face(camera,T);this.lookAt(camera,T,1-span(t,2.4,3.2));
    T.thrust=span(t,.4,1)*(1+span(t,1.3,3)*.4);
    const drag=span(t,1.3,3.1)*1.4+Math.pow(span(t,3.1,4.2),2)*11;
    T.pos.z-=drag;T.pos.y+=span(t,3.1,4.2)*2.2;T.pitch=-.25*span(t,1.3,3.1)-.5*span(t,3.1,4);T.roll=Math.sin(t*2.1)*.06*span(t,1.3,3.1);
    T.arm=.4*span(t,1.4,2.2);T.aim.set(camera.x,camera.y+2,camera.z);
  }
  /** Pose the suit from this rig, swap it in or out, and keep its feet on the white rig's ground line. */
  private suitK=0;
  /** Where the camera should look for his head: the helmet once the armour is mostly on (tracker N-02). */
  headFocus(out:Vector3){if(this.suit&&this.suitK>.5)this.suit.headWorld(out);return out;}
  private dressSuit(k:number,stand:number){
    const a=this.suit!;a.set(k);this.suitK=k;
    const covered=a.covers(k);
    if(covered!==this.wasCovered){
      this.wasCovered=covered;
      if(!this.white){this.white=[];this.shell.traverse(o=>{if(o instanceof Mesh&&!this.underChest(o)&&!this.inSuit(o))this.white!.push(o);});}
      this.white.forEach(m=>{m.visible=!covered;});this.eyeGlow.forEach(g=>{g.visible=!covered;});
    }
    if(k<=0)return;
    const [aL,aR,lL,lR,h]=this.qs;
    // The shell's +x pivots are the suit's .L side.
    a.drive({armL:aL.copy(this.armR.quaternion),armR:aR.setFromEuler(this.armL.rotation),
      legL:lL.setFromEuler(this.eul.set(this.legR.rotation.x-LEG_SWING,0,this.legR.rotation.z)),legR:lR.setFromEuler(this.eul.set(this.legL.rotation.x-LEG_SWING,0,this.legL.rotation.z)),
      head:this.head?h.setFromEuler(this.head.rotation):undefined});
    // Standing: learn how far to lift the suit so its feet meet the white rig's ground line.
    if(stand>.9){let low=Infinity;for(const leg of [this.legR,this.legL])leg.children.forEach(c=>{if(c instanceof Mesh){this.box.setFromObject(c);low=Math.min(low,this.box.min.y);}});
      this.suitStandY+=(low-a.footLow())/Math.max(1e-3,this.shell.scale.y*a.root.scale.y)*.5;}
    a.root.position.y=this.suitBaseY+this.suitStandY*stand;
  }
  private underChest(o:Object3D){for(let q:Object3D|null=o;q;q=q.parent)if(q===this.chest.root)return true;return false;}
  private inSuit(o:Object3D){for(let q:Object3D|null=o;q;q=q.parent)if(q===this.suit?.root)return true;return false;}
  dispose(){this.suit?.dispose();this.shell.removeFromParent();}
}

import { CatmullRomCurve3, MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { useSceneState, type Phase } from '../state/SceneStateManager';
import { reducedMotion } from '../config/experience';
import { cameraRig } from './CameraRig';
import { CHASE_PATH, type SequenceDirector } from './SequenceDirector';

const span=(t:number,a:number,b:number)=>MathUtils.smoothstep(t,a,b);
/** How long each shot takes to arrive from wherever the previous one left the camera. */
const BLEND:Partial<Record<Phase,number>>={
  discovery:2.4,inspected:2.4,'chip-focus':2.2,'chip-reaching':1.2,'chip-held':.9,'chest-focus':1.4,'panel-opening':1.2,
  'socket-ready':1,inserting:.8,silence:.6,booting:2.6,diagnostic:2.2,corrupting:2.4,threat:1.5,ignition:.9,chase:.01,fracture:1.2,pulled:.4,handoff:.01
};
const PULL=new CatmullRomCurve3([new Vector3(1.3,1.45,-27.1),new Vector3(1.55,3.4,-30.4),new Vector3(1.8,6.2,-33.8),new Vector3(1.85,7.1,-40),new Vector3(1.9,7.2,-49)]);
const INSPECT_AIM=new Vector3(4.14,1.3,-9.02);
/**
 * How far the viewer can turn Hiro's head with the pointer, per beat (yaw, pitch in radians).
 * Wide while exploring, tight while a hand is busy or a beat is locked.
 */
const LOOK:Partial<Record<Phase,[number,number]>>={
  awakening:[.18,.1],approaching:[.62,.3],discovery:[.48,.24],inspected:[.48,.24],
  'chip-focus':[.2,.12],'chip-reaching':[.14,.09],'chip-held':[.16,.1],'chest-focus':[.2,.12],'panel-opening':[.2,.12],
  'socket-ready':[.08,.05],inserting:[.08,.05],silence:[.22,.12],booting:[.32,.16],diagnostic:[.32,.16],corrupting:[.24,.13],
  threat:[.1,.06],ignition:[.2,.12],chase:[.34,.14],fracture:[.22,.13],pulled:[.1,.06],handoff:[.4,.22]
};
/** Beats where the viewer can zoom in and out on the chip, the seam and the socket. */
const ZOOM_PHASES:Phase[]=['chip-focus','chip-reaching','chip-held','chest-focus','panel-opening','socket-ready','inserting','silence'];
export const ZOOM_RANGE=[-1,1] as const;
export type ShotContext={chest:Vector3;normal:Vector3;chip:Vector3;baymax:Vector3;head:Vector3};

/** Sole owner of the camera. Each phase is a directed shot; impulses come from the sequence. */
export class CameraDirector {
  private progress=0;private wakeTime=0;private time=0;private replay=-1;
  private look=new Vector3();private target=new Vector3();private gaze=new Vector3();
  private velocity=0;private footfall=0;
  public visualProgress=0;public wake=0;public focusDistance=19;
  public pointer={x:0,y:0};public holding=false;
  private phase:Phase='loading';private shotTime=0;
  private fromPos=new Vector3();private fromLook=new Vector3();private fromFov=45;private fromRoll=0;
  private pos=new Vector3();private aim=new Vector3();private fov=45;private roll=0;
  private lastPos=new Vector3();private lastLook=new Vector3();private lastRoll=0;
  private v=new Vector3();private v2=new Vector3();private shakeT=0;private focusPoint=new Vector3();
  private run=0;
  /** Viewer zoom while handling the chip: -1 (pulled back) … 1 (close in). */
  public zoomTarget=0;private zoom=0;
  /** Sideways step on the approach (A / D, arrow keys): -1, 0 or 1 while held. */
  public strafeInput=0;private strafe=0;private strafeGoal=0;
  private lookRange:[number,number]=[.18,.1];
  zoomBy(amount:number){if(ZOOM_PHASES.includes(this.phase))this.zoomTarget=MathUtils.clamp(this.zoomTarget+amount,ZOOM_RANGE[0],ZOOM_RANGE[1]);}
  get zoomable(){return ZOOM_PHASES.includes(this.phase);}

  update(camera:PerspectiveCamera,delta:number,_w:number,_h:number,seq?:SequenceDirector,ctx?:ShotContext){
    const state=useSceneState.getState(),dt=Math.min(delta,.1);
    if(state.replay!==this.replay){this.replay=state.replay;this.progress=0;this.wakeTime=0;this.holding=false;this.zoomTarget=0;this.zoom=0;this.strafe=0;this.strafeGoal=0;}
    this.time+=dt;
    if(state.chapter==='BOOT')return;
    this.wakeTime+=dt;
    if(this.holding&&state.phase==='approaching')state.move(dt*.052);
    const before=this.progress;
    this.progress=MathUtils.damp(this.progress,state.targetProgress,reducedMotion?20:2.3,dt);
    this.velocity=MathUtils.damp(this.velocity,(this.progress-before)/Math.max(dt,.001),3,dt);
    const p=MathUtils.smoothstep(this.progress,0,1);
    const wake=reducedMotion?1:MathUtils.smoothstep(this.wakeTime,3.3,10.5);
    this.look.x=MathUtils.damp(this.look.x,this.pointer.x,1.8,dt);this.look.y=MathUtils.damp(this.look.y,this.pointer.y,1.8,dt);
    this.gaze.x=MathUtils.damp(this.gaze.x,this.look.x,3,dt);this.gaze.y=MathUtils.damp(this.gaze.y,this.look.y,3,dt);
    this.footfall+=Math.abs(this.velocity)*dt*70;
    // A free sidestep on the approach; it eases back to the authored line once he arrives.
    if(state.phase==='approaching')this.strafeGoal=MathUtils.clamp(this.strafeGoal+this.strafeInput*dt*1.3,-1.6,1.6);else this.strafeGoal=0;
    this.strafe=MathUtils.damp(this.strafe,this.strafeGoal,2.4,dt);
    const breathing=reducedMotion?0:Math.sin(this.time*1.12)*.008;
    const step=reducedMotion?0:Math.sin(this.footfall)*Math.min(.008,Math.abs(this.velocity)*.08);
    // The approach: unchanged from the opening.
    camera.position.set(MathUtils.lerp(-1.7,1.15,p)+Math.sin(p*Math.PI)*-.6+this.look.x*.07+this.strafe,MathUtils.lerp(1.05,2.48,wake)-p*.24+breathing+step,MathUtils.lerp(8,-4.8,p));
    this.target.set(MathUtils.lerp(-.65,2.65,p)+this.gaze.x*.52+this.strafe*.6,MathUtils.lerp(.3,2.4,wake)-p*1.25-this.gaze.y*.23,-14+p*2);
    camera.fov=MathUtils.lerp(51,45,p)+(reducedMotion?0:Math.sin(this.time*.9)*.025+(1-wake)*.2);
    let roll=reducedMotion?0:(1-wake)*-.09+Math.sin(this.time*.43)*.0012-this.velocity*.01;
    const directed=seq&&ctx&&!['loading','awakening','approaching'].includes(state.phase);
    if(directed){
      if(state.phase!==this.phase){
        this.phase=state.phase;this.shotTime=0;
        this.fromPos.copy(this.lastPos);this.fromLook.copy(this.lastLook);this.fromFov=camera.fov;this.fromRoll=this.lastRoll;
        if(state.phase==='handoff'){this.fromPos.set(1.9,7.2,-44);this.fromLook.set(1.9,7.2,-90);}
      }
      this.shotTime+=dt*seq.slowmo;
      this.shot(state.phase,this.shotTime,seq,ctx,camera,dt);
      // Viewer zoom: a dolly along the shot's own line of sight plus a little lens, so the
      // chip, the seam and the socket can be studied close or seen in context.
      if(!ZOOM_PHASES.includes(state.phase))this.zoomTarget=0;
      this.zoom=MathUtils.damp(this.zoom,this.zoomTarget,reducedMotion?20:6,dt);
      if(Math.abs(this.zoom)>.001){this.v.subVectors(this.pos,this.aim);this.pos.copy(this.aim).addScaledVector(this.v,1-this.zoom*.45);this.fov*=1-this.zoom*.14;}
      const b=reducedMotion?1:span(this.shotTime,0,BLEND[state.phase]??1.2);
      camera.position.lerpVectors(this.fromPos,this.pos,b);this.target.lerpVectors(this.fromLook,this.aim,b);
      camera.fov=MathUtils.lerp(this.fromFov,this.fov,b);roll=MathUtils.lerp(this.fromRoll,this.roll,b);
      this.applyImpulses(camera,seq,dt);
    }else{this.phase=state.phase;}
    camera.lookAt(this.target);
    // Free look: the pointer turns Hiro's head within limits set by the beat. Damped twice
    // (look → gaze), so it carries weight instead of tracking the mouse 1:1.
    const range=LOOK[state.phase]??[.15,.08];
    this.lookRange[0]=MathUtils.damp(this.lookRange[0],range[0],2,dt);this.lookRange[1]=MathUtils.damp(this.lookRange[1],range[1],2,dt);
    camera.rotateY(-this.gaze.x*this.lookRange[0]);camera.rotateX(-this.gaze.y*this.lookRange[1]);
    camera.rotateZ(roll);
    cameraRig.apply(camera,dt); // global camera language: motivated shake + transition FOV kicks
    camera.updateProjectionMatrix();camera.updateMatrixWorld();
    this.lastPos.copy(camera.position);this.lastLook.copy(this.target);this.lastRoll=roll;
    this.visualProgress=p;this.wake=wake;
    if(!directed)this.focusDistance=-this.focusPoint.set(2.7,2,-12).applyMatrix4(camera.matrixWorldInverse).z;
    if(this.progress>.995&&state.phase==='approaching')state.arrive();
  }

  /** Writes the authored shot for this phase into pos / aim / fov / roll / focusDistance. */
  private shot(phase:Phase,t:number,seq:SequenceDirector,ctx:ShotContext,camera:PerspectiveCamera,dt:number){
    const P=this.pos,A=this.aim,breathe=reducedMotion?0:Math.sin(this.time*1.05),sway=reducedMotion?0:1;
    const lookX=this.gaze.x*sway,lookY=this.gaze.y*sway;
    this.roll=0;
    const chestShot=(distance:number,lift:number,fov:number)=>{
      P.copy(ctx.chest).addScaledVector(ctx.normal,distance);P.y+=lift;P.x-=.06;
      A.copy(ctx.chest).addScaledVector(ctx.normal,-.04);this.fov=fov;
    };
    switch(phase){
      case 'discovery':case 'inspected':{
        // The world narrows: a slow push toward the shell, lower and closer, with less wander.
        const k=span(t,0,9);P.set(MathUtils.lerp(1.45,1.95,k)+lookX*.04,MathUtils.lerp(2.15,1.92,k)+breathe*.006,MathUtils.lerp(-5.4,-6.9,k));
        A.set(2.72+lookX*.25,MathUtils.lerp(1.35,1.5,k)-lookY*.12,-11.6);this.fov=MathUtils.lerp(44,40,k);
        this.focusDistance=P.distanceTo(ctx.baymax)-.4;break;
      }
      case 'chip-focus':{
        const commit=seq.holdProgress;
        P.set(4.42+lookX*.03,1.62+breathe*.006-commit*.14,-7.95-commit*.36);
        A.copy(ctx.chip).lerp(ctx.chest,.18-commit*.18);A.y+=.05;A.x+=lookX*.12;this.fov=42-commit*3;
        this.focusDistance=P.distanceTo(ctx.chip);break;
      }
      case 'chip-reaching':{
        // The aim is a fixed point in front of Hiro's hands; the chip rises into it.
        P.set(4.36,MathUtils.lerp(1.46,1.66,span(t,.3,1.9)),-8.3+span(t,0,1.5)*.08);
        A.lerpVectors(this.v.set(4.02,-.1,-10.48),INSPECT_AIM,span(t,.2,1.7));this.fov=MathUtils.lerp(39,35,span(t,0,2));this.focusDistance=P.distanceTo(ctx.chip);break;
      }
      case 'chip-held':{
        // Inspection, then a deliberate redirect: the chest becomes the focal plane.
        const turn=span(t,1.55,2.7);
        this.v.set(4.36,1.66,-8.22);chestShot(2.05,.3,38);P.lerpVectors(this.v,P,turn);
        A.lerpVectors(INSPECT_AIM,A,turn);
        this.fov=MathUtils.lerp(35,38,turn);
        this.focusDistance=MathUtils.lerp(camera.position.distanceTo(ctx.chip),P.distanceTo(ctx.chest),turn);break;
      }
      case 'chest-focus':{
        chestShot(1.95-seq.holdProgress*.22,.28-seq.holdProgress*.05,38-seq.holdProgress*2);P.y+=breathe*.005;A.x+=lookX*.05;
        this.focusDistance=P.distanceTo(ctx.chest);break;
      }
      case 'panel-opening':{
        chestShot(MathUtils.lerp(1.72,1.28,span(t,.4,3.8)),MathUtils.lerp(.22,.14,span(t,.4,3.8)),MathUtils.lerp(37,34,span(t,0,4)));
        this.focusDistance=P.distanceTo(ctx.chest);break;
      }
      case 'socket-ready':case 'inserting':{
        chestShot(phase==='inserting'?MathUtils.lerp(1.16,1.04,span(t,0,1)):1.16,.12,34);P.y+=breathe*.002;
        if(phase==='inserting'&&t>1.03&&t<1.2&&!reducedMotion)P.addScaledVector(ctx.normal,-.006*Math.sin((t-1.03)*60));
        this.focusDistance=P.distanceTo(ctx.chest);break;
      }
      case 'silence':{
        chestShot(MathUtils.lerp(1.04,1.12,span(t,0,2.4)),.12,34);P.y+=breathe*.006;
        this.focusDistance=P.distanceTo(ctx.chest);break;
      }
      case 'booting':{
        // Observational: Hiro straightens and steps back to watch the whole of him wake.
        const k=span(t,.8,3.6);chestShot(1.12,.12,34);
        this.v.set(2.32,2.12,-8.55);P.lerp(this.v,k);A.lerp(this.v2.set(2.82,MathUtils.lerp(2.1,2.45,span(t,2.4,4.2)),-11.6),k);
        this.fov=MathUtils.lerp(34,42,k);this.focusDistance=P.distanceTo(ctx.chest);break;
      }
      case 'diagnostic':{
        P.set(2.34+breathe*.004,2.16,-8.7);A.set(2.8,2.5,-11.65);this.fov=41;this.focusDistance=P.distanceTo(ctx.head);break;
      }
      case 'corrupting':{
        const k=span(t,0,4.8);P.set(MathUtils.lerp(2.34,2.46,k),MathUtils.lerp(2.16,2.42,k),MathUtils.lerp(-8.7,-9.25,k));
        A.copy(ctx.head).setY(ctx.head.y-.12*(1-k));this.fov=MathUtils.lerp(41,36,k);this.focusDistance=P.distanceTo(ctx.head);break;
      }
      case 'threat':{
        // Locked. No sway. At the lock, a slow dolly-zoom presses the eyes forward.
        const lock=span(t,1.7,3.4);P.set(2.55,2.62,-9.55+lock*.25);A.copy(ctx.head);A.y-=.02;
        this.fov=MathUtils.lerp(34,29.5,lock);this.focusDistance=P.distanceTo(ctx.head);break;
      }
      case 'ignition':{
        // Hiro backs off; the blast throws him; he lies looking up as Baymax launches.
        // He stands to full height; Hiro staggers back and the lens opens so all of him reads.
        const back=span(t,0,1.25),thrown=span(t,1.62,2.05);
        this.v.set(2.55,2.5,-9.4).lerp(this.v2.set(2.05,1.55,-6.7),back);P.copy(this.v).lerp(this.v2.set(1.05,.52,-6.2),thrown);
        A.copy(ctx.head).lerp(this.v2.copy(ctx.baymax).setY(ctx.baymax.y+2.2),back*.6);A.lerp(this.v2.copy(ctx.baymax).setY(ctx.baymax.y+2.4),span(t,2,3));
        if(t>1.62&&t<2.05)A.y+=(1-thrown)*.8;
        this.fov=MathUtils.lerp(36,53,back)+thrown*5;this.roll=thrown*.32*(1-span(t,3.2,4.6)*.5);
        this.focusDistance=P.distanceTo(ctx.baymax)+.5;break;
      }
      case 'chase':{
        const u=Math.min(1,seq.chase),rise=span(t,.1,1.15);
        CHASE_PATH.getPointAt(u,P);
        const speed=seq.chaseSpeed*CHASE_PATH.getLength();
        this.run+=dt*speed*2.2;
        const instability=span(t,1.8,5.2);
        const bob=reducedMotion?0:Math.abs(Math.sin(this.run))*.07*Math.min(1,speed/2.2),side=reducedMotion?0:Math.sin(this.run*.5)*.04*Math.min(1,speed/2.2);
        P.y=MathUtils.lerp(.52,P.y,rise)+bob;P.x+=side;
        // Look well down the line; near the end, the seam itself becomes the destination.
        CHASE_PATH.getPointAt(Math.min(1,u+.16),A);A.y=MathUtils.lerp(A.y+.9,A.y+.15,rise);
        A.lerp(this.v2.set(1.8,3.4,-34),span(u,.7,1)*.6);
        if(!reducedMotion&&instability>0){P.x+=Math.sin(t*2.1)*.018*instability;P.y+=Math.sin(t*1.7)*.012*instability;A.x+=Math.sin(t*1.3+1)*.055*instability;this.roll+=Math.sin(t*1.1)*.012*instability;}
        // Glances: the director pulls Hiro's eyes to Baymax when he is the threat on screen.
        const w=this.glance(seq);if(w>0){A.lerp(this.v.copy(ctx.baymax).setY(ctx.baymax.y+1.4),w);}
        // Never crane straight up: keep the street, and whatever is about to hit it, in frame.
        const reach=Math.hypot(A.x-P.x,A.z-P.z);A.y=Math.min(A.y,P.y+reach*.42);
        A.x+=lookX*1.2;A.y-=lookY*.6;
        this.fov=52+Math.min(6,speed*2)+(1-rise)*-4;this.roll=(1-rise)*.32+side*-.3;
        this.focusDistance=12;break;
      }
      case 'fracture':{
        const k=span(t,0,5.6),disorient=span(t,.8,4.8);
        P.set(1.3+(reducedMotion?0:Math.sin(t*23)*(.01+.055*disorient)*k),1.46+(reducedMotion?0:Math.sin(t*19)*.035*disorient),-27.1+span(t,1.2,3)*.35);
        A.set(1.85,MathUtils.lerp(3.2,5.4,k),-31.5);
        if(!reducedMotion){A.x+=Math.sin(t*14)*.18*disorient;this.roll=Math.sin(t*9)*.09*disorient;}
        this.fov=MathUtils.lerp(48,60,k);this.focusDistance=6;break;
      }
      case 'pulled':{
        const resist=span(t,0,.9),drag=Math.pow(span(t,.9,4.4),1.7);
        PULL.getPointAt(drag,P);P.z+=resist*.3*(1-drag);
        PULL.getPointAt(Math.min(1,drag+.12),A);A.y+=.4*(1-drag);
        this.fov=MathUtils.lerp(58,82,drag);this.roll=drag*.9;this.focusDistance=8;break;
      }
      case 'handoff':{
        // Through. A slow re-orientation in the corridor that leads deeper.
        const k=span(t,0,26);P.set(1.9+Math.sin(t*.2)*.15,7.2+Math.sin(t*.27)*.12,MathUtils.lerp(-44,-56,k));
        A.set(1.9,7.2,-90);this.fov=MathUtils.lerp(70,58,span(t,0,6));this.roll=.5*(1-span(t,0,5));this.focusDistance=18;break;
      }
      default:{P.copy(camera.position);A.copy(this.target);this.fov=camera.fov;}
    }
  }
  private glance(seq:SequenceDirector){
    const b=seq.beat,t=seq.beatTime;
    if(b==='silhouette')return .55*span(t,.25,.8)*(1-span(t,1.6,2.4));
    if(b==='overhead')return .42*span(t,.2,.7)*(1-span(t,1.2,1.9));
    if(b==='rooftop')return .42*span(t,.3,.9)*(1-span(t,2,2.8));
    if(b==='tear-pass')return .7*span(t,.2,.45)*(1-span(t,1.1,1.6));
    if(b==='final')return .85*span(t,.4,1.1);
    return 0;
  }
  /** Shake is noise, not random jitter; kicks are damped shoves; FOV punches on hits. */
  private applyImpulses(camera:PerspectiveCamera,seq:SequenceDirector,dt:number){
    if(reducedMotion){camera.fov+=seq.fovKick*.2;return;}
    this.shakeT+=dt*(7+seq.shake*4);const s=seq.shake*seq.shake;
    const n=(o:number)=>Math.sin(this.shakeT*.72+o)*.68+Math.sin(this.shakeT*1.31+o*2.1)*.32;
    camera.position.x+=n(0)*s*.035+seq.kick.x;camera.position.y+=n(3)*s*.03+seq.kick.y*.6;camera.position.z+=seq.kick.z;
    this.target.x+=n(7)*s*.065;this.target.y+=n(11)*s*.055;
    camera.fov+=seq.fovKick;
  }
  resetPointer(){this.pointer={x:0,y:0};this.holding=false;this.strafeInput=0;this.zoomTarget=0;}
  skipAwakening(){this.wakeTime=12;}
}

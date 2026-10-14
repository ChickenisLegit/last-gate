import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import { useSceneState } from '../state/SceneStateManager';
import { reducedMotion } from '../config/experience';

export class CameraDirector {
  private progress=0;
  private wakeTime=0;
  private time=0;
  private replay=-1;
  private look=new Vector3();
  private target=new Vector3();
  private gaze=new Vector3();
  private velocity=0;
  private footfall=0;
  public visualProgress=0;
  public wake=0;
  public focusDistance=19;
  public pointer={x:0,y:0};
  public holding=false;

  update(camera:PerspectiveCamera,delta:number,width:number,height:number) {
    const state=useSceneState.getState(),dt=Math.min(delta,1);
    if(state.replay!==this.replay){this.replay=state.replay;this.progress=0;this.wakeTime=0;this.holding=false;}
    this.time+=dt;
    if(state.chapter==='BOOT')return;
    this.wakeTime+=dt;
    if(this.holding&&state.phase==='approaching')state.move(dt*.052);
    const before=this.progress;
    this.progress=MathUtils.damp(this.progress,state.targetProgress,reducedMotion?20:2.3,dt);
    this.velocity=MathUtils.damp(this.velocity,(this.progress-before)/Math.max(dt,.001),3,dt);
    const p=MathUtils.smoothstep(this.progress,0,1);
    const wake=reducedMotion?1:MathUtils.smoothstep(this.wakeTime,3.3,10.5);
    this.look.x=MathUtils.damp(this.look.x,this.pointer.x,1.8,dt);
    this.look.y=MathUtils.damp(this.look.y,this.pointer.y,1.8,dt);
    this.gaze.x=MathUtils.damp(this.gaze.x,this.look.x,3,dt);
    this.gaze.y=MathUtils.damp(this.gaze.y,this.look.y,3,dt);
    this.footfall+=Math.abs(this.velocity)*dt*70;
    const breathing=reducedMotion?0:Math.sin(this.time*1.12)*.008;
    const step=reducedMotion?0:Math.sin(this.footfall)*Math.min(.008,Math.abs(this.velocity)*.08);
    camera.position.set(MathUtils.lerp(-1.7,1.15,p)+Math.sin(p*Math.PI)*-.6+this.look.x*.07,MathUtils.lerp(1.05,2.48,wake)-p*.24+breathing+step,MathUtils.lerp(8,-4.8,p));
    this.target.set(MathUtils.lerp(-.65,2.65,p)+this.gaze.x*.52,MathUtils.lerp(.3,2.4,wake)-p*1.25-this.gaze.y*.23,-14+p*2);
    camera.fov=MathUtils.lerp(51,45,p)+(reducedMotion?0:Math.sin(this.time*.9)*.025+(1-wake)*.2);
    camera.lookAt(this.target);
    camera.rotateZ(reducedMotion?0:(1-wake)*-.09+Math.sin(this.time*.43)*.0012-this.velocity*.01);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    this.visualProgress=p;this.wake=wake;
    this.focusDistance=-new Vector3(2.7,2,-12).applyMatrix4(camera.matrixWorldInverse).z;
    if(this.progress>.995&&state.phase==='approaching')state.arrive();
  }
  resetPointer(){this.pointer={x:0,y:0};this.holding=false;}
  skipAwakening(){this.wakeTime=12;}
}

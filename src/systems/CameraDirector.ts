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
  public pointer={x:0,y:0};
  public holding=false;

  update(camera:PerspectiveCamera,delta:number,width:number,height:number) {
    const state=useSceneState.getState(),dt=Math.min(delta,1);
    if(state.replay!==this.replay){this.replay=state.replay;this.progress=0;this.wakeTime=0;this.holding=false;}
    this.time+=dt;
    if(state.chapter==='BOOT')return;
    this.wakeTime+=dt;
    if(this.holding&&state.phase==='approaching')state.move(dt*.17);
    this.progress=MathUtils.damp(this.progress,state.targetProgress,reducedMotion?20:3.4,dt);
    const p=MathUtils.smoothstep(this.progress,0,1);
    const wake=reducedMotion?1:MathUtils.smoothstep(this.wakeTime,0,6);
    this.look.x=MathUtils.damp(this.look.x,this.pointer.x,2.6,dt);
    this.look.y=MathUtils.damp(this.look.y,this.pointer.y,2.6,dt);
    const sway=reducedMotion?0:Math.sin(this.time*.85)*.023;
    camera.position.set(MathUtils.lerp(-1.4,1.1,p)+this.look.x*.1,MathUtils.lerp(.72,2.55,wake)-p*.3+sway,MathUtils.lerp(7,-5.1,p));
    this.target.set(MathUtils.lerp(.1,2.7,p)+this.look.x*.48,MathUtils.lerp(-1.5,2.5,wake)-p*.65-this.look.y*.25,-14+p*2);
    camera.fov=49;
    camera.lookAt(this.target);
    camera.rotateZ(reducedMotion?0:(1-wake)*-.105+Math.sin(this.time*.5)*.002);
    camera.updateProjectionMatrix();
    if(this.progress>.995&&state.phase==='approaching')state.arrive();
  }
  resetPointer(){this.pointer={x:0,y:0};this.holding=false;}
  skipAwakening(){this.wakeTime=8;}
}

import { CatmullRomCurve3, MathUtils, Vector2, Vector3 } from 'three';
import type { Phase } from '../state/SceneStateManager';
import { useSceneState } from '../state/SceneStateManager';
import { HOLD_TIME } from '../config/shell';
import { reducedMotion } from '../config/experience';

export type BeatId = 'launch' | 'silhouette' | 'overhead' | 'rooftop' | 'tear-pass' | 'final';
export type SequenceEvent =
  | { type:'beat'; beat:BeatId }
  | { type:'impact'; position:Vector3; power:number; tear:boolean }
  | { type:'charge'; position:Vector3 }
  | { type:'discharge'; from:Vector3; to:Vector3 };

/** Hiro's escape line: authored, never free-roam. Eye height sits ~1.6m above the asphalt. */
export const CHASE_PATH = new CatmullRomCurve3([
  new Vector3(1.05,1.42,-6.7), new Vector3(.15,1.44,-9.4), new Vector3(-1.35,1.45,-12.6),
  new Vector3(-2.45,1.45,-16.2), new Vector3(-1.2,1.46,-19.6), new Vector3(1.0,1.46,-22.7),
  new Vector3(1.55,1.45,-25.4), new Vector3(1.3,1.45,-27.1)
], false, 'centripetal');
export const CHASE_LENGTH = CHASE_PATH.getLength();
/** Where the path crosses each authored attack. `stall` lets the moment land before Hiro can run on. */
export const CHASE_BEATS:{id:BeatId;at:number;stall:number}[] = [
  {id:'silhouette',at:.04,stall:1.5},{id:'overhead',at:.26,stall:.9},{id:'rooftop',at:.47,stall:1.7},
  {id:'tear-pass',at:.67,stall:1.3},{id:'final',at:.86,stall:99}
];
/** The dimensional seam the final blast rips open (matches the anomaly in PortalDimension). */
export const SEAM_POSITION = new Vector3(1.8,4.2,-34);
type Attack = {at:number;kind:'charge'|'discharge'|'impact';to?:[number,number,number];power?:number;tear?:boolean;slowmo?:number};
/** Every violent act is authored: when it charges, where it lands, and whether it tears the dimension. */
const ATTACKS:Record<BeatId,Attack[]> = {
  launch:[{at:.55,kind:'charge'},{at:1.6,kind:'discharge',to:[1.25,-.12,-8.3],power:1.05,tear:true}],
  silhouette:[{at:.2,kind:'charge'},{at:.95,kind:'discharge',to:[4.75,.35,-17.4],power:.72,tear:true}],
  overhead:[{at:.95,kind:'impact',to:[-4.6,-.1,-19.2],power:.55,tear:false}],
  rooftop:[{at:.75,kind:'charge'},{at:1.45,kind:'discharge',to:[-.6,-.12,-21.2],power:1,tear:true}],
  'tear-pass':[{at:0,kind:'impact',to:[5.6,2.3,-23.6],power:.42,tear:true},{at:.62,kind:'impact',to:[0,2,-21],power:.25,tear:false,slowmo:.28}],
  // The last attack is Baymax himself: a dive whose shockwave splits the seam behind him.
  final:[{at:1.05,kind:'charge'},{at:2.3,kind:'impact',to:[1.9,-.12,-30.4],power:1.3,tear:true}]
};

/**
 * Shared, mutable, per-frame sequence state. Systems read it every frame; React only
 * hears about discrete phase changes. Nothing here allocates per frame.
 */
export class SequenceDirector {
  phase:Phase='loading'; phaseTime=0; time=0;
  // Input
  pointer=new Vector2(); pointerDown=false; keyHold=false; sprint=false; holdProgress=0; lastInput=0;
  /** A short press still counts: once latched, the hold completes on its own. */
  latch=false;
  // Shell
  alignment=0; docked=false;
  // Chase
  chase=0; chaseSpeed=0; beatIndex=-1; beatTime=0; stallUntil=0; finalFired=false;
  // Camera impulses
  shake=0; kick=new Vector3(); fovKick=0; slowmo=1; lookBias=new Vector3(); lookWeight=0;
  // Grade and world response
  warp=0; warpCenter=new Vector2(.5,.5); flash=0; whiteout=0; red=0; tear=0; corridor=0; collapse=0;
  /** Baymax's arm muzzle in world space; BaymaxController writes it every frame. */
  muzzle=new Vector3(2.7,2.2,-11);
  private listeners=new Set<(event:SequenceEvent)=>void>();
  private replay=-1;private fired=0;private attackBeat:BeatId|null=null;private pending:{at:number;to:Vector3;power:number;tear:boolean}[]=[];

  on(listener:(event:SequenceEvent)=>void){this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};}
  emit(event:SequenceEvent){this.listeners.forEach(listener=>listener(event));}
  get beat():BeatId|null{return this.beatIndex<0?null:CHASE_BEATS[this.beatIndex].id;}
  get holding(){return this.pointerDown||this.keyHold;}

  update(delta:number){
    const state=useSceneState.getState(),dt=Math.min(delta,.25);
    if(state.replay!==this.replay){this.replay=state.replay;this.reset();}
    if(state.phase!==this.phase){this.phase=state.phase;this.phaseTime=0;this.latch=false;this.enter(state.phase);}
    const scaled=dt*this.slowmo;
    this.phaseTime+=scaled;this.time+=dt;
    // Holds commit only on hold phases; releasing drains smoothly instead of snapping.
    const holdPhase=state.phase==='chip-focus'||state.phase==='chest-focus';
    this.holdProgress=holdPhase&&(this.holding||this.latch)?Math.min(1,this.holdProgress+dt/HOLD_TIME):Math.max(0,this.holdProgress-dt*2.4);
    if(holdPhase&&this.holdProgress>=1){this.holdProgress=0;this.latch=false;state.interact();}
    if(state.phase==='chase')this.updateChase(dt);
    this.updateAttacks(state.phase==='ignition'?'launch':state.phase==='chase'?this.beat:null,state.phase==='ignition'?this.phaseTime:this.beatTime);
    if(state.phase==='chase'&&this.beat==='final'&&this.beatTime>3.15)state.advance('chase');
    this.updateSignals(state.phase,dt);
    // Impulses decay; the camera reads them as a damped spring.
    this.shake=Math.max(0,this.shake-dt*1.6);this.flash=Math.max(0,this.flash-dt*2.2);
    this.warp=Math.max(0,this.warp-dt*1.15);this.fovKick=MathUtils.damp(this.fovKick,0,3.2,dt);
    this.kick.multiplyScalar(Math.exp(-dt*3.4));
    this.slowmo=MathUtils.damp(this.slowmo,1,2.2,dt);
  }
  /** One violent beat: shake, warp centred on screen-space impact, flash, and a camera shove. */
  impulse(power:number,screen?:Vector2,shove?:Vector3){
    const scale=reducedMotion?.25:1;
    this.shake=Math.min(1.2,this.shake+power*.55*scale);this.flash=Math.min(1,this.flash+power*.35);
    this.warp=Math.min(1,this.warp+power*.8*scale);this.fovKick+=power*3.5*scale;
    if(screen)this.warpCenter.copy(screen);if(shove)this.kick.addScaledVector(shove,scale);
  }
  private updateAttacks(beat:BeatId|null,t:number){
    if(beat!==this.attackBeat){this.attackBeat=beat;this.fired=0;}
    const list=beat?ATTACKS[beat]:[];
    while(this.fired<list.length&&t>=list[this.fired].at){
      const a=list[this.fired++],to=a.to?new Vector3(...a.to):undefined;
      if(a.kind==='charge')this.emit({type:'charge',position:this.muzzle.clone()});
      else if(a.kind==='discharge'&&to){
        this.emit({type:'discharge',from:this.muzzle.clone(),to});
        // The bolt travels; the world answers when it arrives.
        this.pending.push({at:this.time+Math.min(.32,this.muzzle.distanceTo(to)/60),to,power:a.power??1,tear:a.tear??false});
      }else if(to){this.emit({type:'impact',position:to,power:a.power??.5,tear:a.tear??false});if(a.slowmo)this.slowmo=a.slowmo;}
    }
    for(let i=this.pending.length-1;i>=0;i--){
      const p=this.pending[i];if(this.time<p.at)continue;
      this.pending.splice(i,1);this.emit({type:'impact',position:p.to,power:p.power,tear:p.tear});
    }
  }
  private reset(){
    this.pending.length=0;this.attackBeat=null;this.fired=0;
    this.chase=0;this.chaseSpeed=0;this.beatIndex=-1;this.beatTime=0;this.stallUntil=0;this.finalFired=false;
    this.alignment=0;this.docked=false;this.red=0;this.tear=0;this.corridor=0;this.collapse=0;this.whiteout=0;
    this.warp=0;this.flash=0;this.shake=0;this.slowmo=1;this.kick.set(0,0,0);this.lookWeight=0;
  }
  private enter(phase:Phase){
    if(phase==='awakening')this.reset();
    if(phase==='ignition')this.emit({type:'beat',beat:'launch'});
    if(phase==='chase'){this.chase=0;this.beatIndex=-1;this.stallUntil=this.time+1.15;}
  }
  private updateChase(dt:number){
    const input=this.sprint||this.holding;
    if(input)this.lastInput=performance.now()/1000;
    // Hiro keeps moving under pressure; input turns the stagger into a sprint.
    const stalled=this.time<this.stallUntil;
    const target=(stalled?.12:input?2.55:1.05)/CHASE_LENGTH;
    this.chaseSpeed=MathUtils.damp(this.chaseSpeed,target,stalled?6:2.6,dt);
    const nextBeat=CHASE_BEATS[this.beatIndex+1];
    const cap=nextBeat?.id==='final'||this.beatIndex===CHASE_BEATS.length-1?.97:1;
    this.chase=Math.min(cap,this.chase+this.chaseSpeed*dt*this.slowmo);
    this.beatTime+=dt*this.slowmo;
    if(nextBeat&&this.chase>=nextBeat.at){
      this.beatIndex++;this.beatTime=0;this.stallUntil=this.time+nextBeat.stall;
      this.emit({type:'beat',beat:nextBeat.id});
    }
  }
  private updateSignals(phase:Phase,dt:number){
    const t=this.phaseTime,damp=(v:number,to:number,l=2)=>MathUtils.damp(v,to,l,dt);
    const red=phase==='corrupting'?MathUtils.smoothstep(t,.4,4.4)*.7
      :['threat','ignition','chase','fracture','pulled'].includes(phase)?1:phase==='diagnostic'?MathUtils.smoothstep(t,4.8,6.6)*.12:0;
    this.red=damp(this.red,red,1.6);
    const tear=phase==='chase'?.15+this.beatIndex*.15:phase==='fracture'?.9:phase==='pulled'?1:phase==='ignition'?.08:0;
    this.tear=damp(this.tear,tear,1.2);
    this.corridor=phase==='fracture'?MathUtils.smoothstep(t,.25,3.2):phase==='pulled'||phase==='handoff'?1:0;
    this.collapse=phase==='pulled'?MathUtils.smoothstep(t,.1,3):phase==='fracture'?MathUtils.smoothstep(t,3.6,5.6)*.25:0;
    const white=phase==='pulled'?MathUtils.smoothstep(t,3.35,4.7):phase==='handoff'?1-MathUtils.smoothstep(t,.5,3.4):0;
    this.whiteout=white;
  }
}

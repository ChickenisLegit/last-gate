import { FINAL_BEATS, FINAL_DURATIONS, FINAL_NEXT } from './sequence';
import type { FinalStage } from './entry';
import { FinalAudio } from './FinalAudio';

export type FinalSnapshot = { stage:FinalStage; time:number; beat:string; text:string; small:string; aligned:number; model:number; homeCoordinates:boolean };
export class FinalRuntime {
 stage:FinalStage; time=0; total=0; paused=false; reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 aligned=[false,false,false,false]; offsets=[[1.45,.7],[-1.2,.65],[.85,-.8],[-.9,-.65]];
 pointer={x:0,y:0}; dragging=-1; alignmentHold=0; beat=''; private seen=new Set<string>();
 model=75; homeCoordinates=false; readonly audio=new FinalAudio();
 onChange:((state:FinalSnapshot)=>void)|null=null;
 constructor(stage:FinalStage){this.stage=stage;this.prepare(stage);}
 private prepare(stage:FinalStage){
  this.model=['MAX_ATTACK','VECTOR_CAPTURE'].includes(stage)?75:100;this.homeCoordinates=!['MAX_ATTACK','VECTOR_CAPTURE'].includes(stage);
  const done=['PORTAL_RECONSTRUCTION','FINAL_ESCAPE','HOME','EPILOGUE','FINAL_BLACK'].includes(stage);
  this.aligned=[done,done,done,done];this.offsets=done?[[0,0],[0,0],[0,0],[0,0]]:[[1.45,.7],[-1.2,.65],[.85,-.8],[-.9,-.65]];
 }
 enter(stage:FinalStage,time=0){this.stage=stage;this.time=time;this.seen.clear();this.beat='';this.dragging=-1;this.alignmentHold=0;this.prepare(stage);this.emit('','');this.tickBeats(false);}
 update(dt:number){
  if(this.paused||document.hidden)return;
  this.time+=Math.min(dt,.05);this.total+=Math.min(dt,.05);this.tickBeats(true);this.audio.update(this.stage,this.time);
  if(this.stage==='EXIT_VECTOR'&&this.aligned.every(Boolean)){this.alignmentHold+=dt;if(this.alignmentHold>2.8)this.enter('PORTAL_RECONSTRUCTION');}
  const duration=FINAL_DURATIONS[this.stage];if(duration&&this.time>=duration){const next=FINAL_NEXT[this.stage];if(next)this.enter(next);}
 }
 private tickBeats(play:boolean){for(const b of FINAL_BEATS[this.stage]??[]){if(this.time>=b.at&&!this.seen.has(b.id)){this.seen.add(b.id);this.beat=b.id;if(b.id==='model')this.model=100;if(b.id==='home-found')this.homeCoordinates=true;if(play)this.audio.cue(b.id);this.emit(b.text??'',b.small??'');}}}
 private emit(text:string,small:string){this.onChange?.({stage:this.stage,time:this.time,beat:this.beat,text,small,aligned:this.aligned.filter(Boolean).length,model:this.model,homeCoordinates:this.homeCoordinates});}
 align(index:number){if(this.stage!=='EXIT_VECTOR'||this.aligned[index])return;this.aligned[index]=true;this.offsets[index]=[0,0];this.audio.cue('align');this.emit(this.aligned.every(Boolean)?'':'ALIGN ATTACK VECTORS',this.aligned.every(Boolean)?'':'DRAG TOWARD THE COMMON POINT');}
 dispose(){this.audio.dispose();this.onChange=null;}
}

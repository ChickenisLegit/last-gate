import type { FinalStage } from './entry';
import { clamp } from './sequence';

/** Gesture-gated procedural sound. All sources belong to this phase and close on unmount. */
export class FinalAudio {
 get state(){return this.ctx?.state??'locked';}
 private ctx:AudioContext|null=null; private master:GainNode|null=null; private rumble:GainNode|null=null; private wind:GainNode|null=null; private city:GainNode|null=null; private lastUpdate=0;
 async unlock(){
  if(this.ctx){await this.ctx.resume();return;}
  const c=new AudioContext();this.ctx=c;this.master=c.createGain();this.master.gain.value=.22;this.master.connect(c.destination);
  this.rumble=c.createGain();this.rumble.gain.value=0;this.rumble.connect(this.master);
  for(const f of [39,58.4,78.1]){const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.value=f;g.gain.value=.23;o.connect(g);g.connect(this.rumble);o.start();}
  const buffer=c.createBuffer(1,c.sampleRate*4,c.sampleRate),data=buffer.getChannelData(0);let last=0;
  for(let i=0;i<data.length;i++){last=(last+(.09*(Math.random()*2-1)))/1.035;data[i]=last;}
  const noise=c.createBufferSource();noise.buffer=buffer;noise.loop=true;const coldFilter=c.createBiquadFilter();coldFilter.type='lowpass';coldFilter.frequency.value=400;
  this.wind=c.createGain();this.wind.gain.value=0;noise.connect(coldFilter);coldFilter.connect(this.wind);this.wind.connect(this.master);noise.start();
  const homeNoise=c.createBufferSource();homeNoise.buffer=buffer;homeNoise.loop=true;const homeFilter=c.createBiquadFilter();homeFilter.type='bandpass';homeFilter.frequency.value=1180;homeFilter.Q.value=.24;
  this.city=c.createGain();this.city.gain.value=0;homeNoise.connect(homeFilter);homeFilter.connect(this.city);this.city.connect(this.master);homeNoise.start();
  await c.resume();
 }
 update(stage:FinalStage,t:number){if(!this.ctx||!this.rumble||!this.wind||!this.city)return;const now=this.ctx.currentTime;if(now-this.lastUpdate<.12)return;this.lastUpdate=now;
  const home=stage==='HOME'||stage==='EPILOGUE';const silent=stage==='VECTOR_CAPTURE'||stage==='EXIT_VECTOR'||stage==='FINAL_BLACK';
  const charge=stage==='MAX_ATTACK'?clamp((t-12)/8):0;const pressure=home||silent||stage==='MAX_ATTACK'&&t>=21?0:stage==='FINAL_ESCAPE'?Math.max(0,.1+(t-13)*.015):.025+charge*.22;
  this.rumble.gain.setTargetAtTime(pressure,now,.35);this.wind.gain.setTargetAtTime(home||silent?0:stage==='MAX_ATTACK'&&t>21?0:.11,now,.5);this.city.gain.setTargetAtTime(home?.11:0,now,1.3);
 }
 setAudible(audible:boolean){if(this.ctx&&this.master)this.master.gain.setTargetAtTime(audible?.22:0,this.ctx.currentTime,.12);}
 cue(id:string){if(!this.ctx||!this.master)return;const c=this.ctx,t=c.currentTime;
  const settings:Record<string,[number,number,number]>={target:[680,430,.11],charge:[62,46,.7],attack:[94,22,1.8],captured:[520,780,.38],model:[460,620,.3],'home-found':[740,510,.4],align:[480,720,.34],point:[900,1160,.65],seam:[180,260,1.2],'baymax-recover':[78,51,.75],sacrifice:[420,620,1.5],'near-catch':[76,38,.7],crossing:[660,1110,1],unknown:[810,660,.22],lost:[290,140,.42],brand:[520,440,.28]};
  const s=settings[id];if(!s)return;const o=c.createOscillator(),g=c.createGain();o.type=id==='attack'||id==='baymax-recover'?'sawtooth':'sine';o.frequency.setValueAtTime(s[0],t);o.frequency.exponentialRampToValueAtTime(s[1],t+s[2]);g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(id==='attack'?.18:.045,t+.025);g.gain.exponentialRampToValueAtTime(.0001,t+s[2]);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+s[2]+.03);
 }
 dispose(){void this.ctx?.close();this.ctx=null;this.master=null;this.rumble=null;this.wind=null;this.city=null;}
}

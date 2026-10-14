export class AudioDirector {
  private ctx:AudioContext|null=null;
  private master:GainNode|null=null;
  private world:GainNode|null=null;
  private pressure:GainNode|null=null;
  private nextEvent=9;
  private enabled=false;
  async setEnabled(enabled:boolean){
    this.enabled=enabled;
    if(enabled&&!this.ctx)this.create();
    if(!this.ctx||!this.master)return;
    if(enabled)await this.ctx.resume();
    this.master.gain.setTargetAtTime(enabled?.3:0,this.ctx.currentTime,.25);
  }
  private create(){
    const ctx=new AudioContext();this.ctx=ctx;
    this.master=ctx.createGain();this.master.gain.value=0;this.master.connect(ctx.destination);
    const buffer=ctx.createBuffer(1,ctx.sampleRate*6,ctx.sampleRate),data=buffer.getChannelData(0);let last=0;
    for(let i=0;i<data.length;i++){last=(last+.025*(Math.random()*2-1))/1.025;data[i]=last*3.5;}
    const wind=ctx.createBufferSource();wind.buffer=buffer;wind.loop=true;
    const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=430;
    const gain=ctx.createGain();this.world=gain;gain.gain.value=.19;wind.connect(filter);filter.connect(gain);gain.connect(this.master);wind.start();
    const breathSource=ctx.createBufferSource();breathSource.buffer=buffer;breathSource.loop=true;
    const breathFilter=ctx.createBiquadFilter();breathFilter.type='bandpass';breathFilter.frequency.value=560;breathFilter.Q.value=.6;
    const breathVolume=ctx.createGain();breathVolume.gain.value=.055;breathSource.connect(breathFilter);breathFilter.connect(breathVolume);breathVolume.connect(this.master);breathSource.start();
    const breath=ctx.createOscillator(),breathGain=ctx.createGain();breath.frequency.value=.18;breathGain.gain.value=.045;breath.connect(breathGain);breathGain.connect(breathVolume.gain);breath.start();
    this.pressure=ctx.createGain();this.pressure.gain.value=.012;this.pressure.connect(this.master);
    for(const freq of [42,63.07,84.02]){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=freq;g.gain.value=.6;o.connect(g);g.connect(this.pressure);o.start();}
  }
  updateProgress(progress:number){
    if(!this.ctx||!this.world||!this.pressure||!this.enabled)return;
    const ctx=this.ctx,t=ctx.currentTime;
    this.world.gain.setTargetAtTime(.19*(1-progress*.88),t,.6);
    this.pressure.gain.setTargetAtTime(.011+progress*.011,t,.8);
    if(t>this.nextEvent){
      this.nextEvent=t+13.5;
      const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';
      const tick=progress>.8;o.frequency.setValueAtTime(tick?1300:83,t);o.frequency.exponentialRampToValueAtTime(tick?900:57,t+(tick?.07:1.5));
      g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(tick?.002:.005,t+(tick?.005:.35));g.gain.exponentialRampToValueAtTime(.00001,t+(tick?.1:2.5));
      o.connect(g);g.connect(this.master!);o.start();o.stop(t+(tick?.12:2.6));
    }
  }
  failedLink(){
    if(!this.ctx||!this.master)return;
    const ctx=this.ctx,osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.frequency.setValueAtTime(320,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(130,ctx.currentTime+.35);
    gain.gain.setValueAtTime(.04,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.5);
    osc.connect(gain);gain.connect(this.master);osc.start();osc.stop(ctx.currentTime+.5);
  }
  shellCue(kind:'lift'|'latch'|'align'|'lock'|'boot'|'fault'){
    if(!this.ctx||!this.master||!this.enabled)return;
    const ctx=this.ctx,t=ctx.currentTime,frequencies={lift:180,latch:92,align:440,lock:118,boot:54,fault:238};
    const o=ctx.createOscillator(),g=ctx.createGain();o.type=kind==='fault'?'sine':'triangle';
    const f=frequencies[kind];o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*(kind==='lock'?.62:kind==='fault'?.45:1.18),t+(kind==='boot'?.8:.18));
    g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(kind==='boot'?.018:.012,t+.018);g.gain.exponentialRampToValueAtTime(.0001,t+(kind==='boot'?1.1:.32));o.connect(g);g.connect(this.master);o.start();o.stop(t+(kind==='boot'?1.15:.36));
  }
  dispose(){void this.ctx?.close();this.ctx=null;this.master=null;}
}

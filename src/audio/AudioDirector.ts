export class AudioDirector {
  private ctx:AudioContext|null=null;
  private master:GainNode|null=null;
  async setEnabled(enabled:boolean){
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
    const gain=ctx.createGain();gain.gain.value=.23;wind.connect(filter);filter.connect(gain);gain.connect(this.master);wind.start();
    const breath=ctx.createOscillator(),breathGain=ctx.createGain();breath.frequency.value=.18;breathGain.gain.value=.09;breath.connect(breathGain);breathGain.connect(gain.gain);breath.start();
    for(const freq of [48,72.1,96.05]){const o=ctx.createOscillator(),g=ctx.createGain();o.frequency.value=freq;g.gain.value=.018;o.connect(g);g.connect(this.master);o.start();}
  }
  failedLink(){
    if(!this.ctx||!this.master)return;
    const ctx=this.ctx,osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.frequency.setValueAtTime(320,ctx.currentTime);osc.frequency.exponentialRampToValueAtTime(130,ctx.currentTime+.35);
    gain.gain.setValueAtTime(.04,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.5);
    osc.connect(gain);gain.connect(this.master);osc.start();osc.stop(ctx.currentTime+.5);
  }
  dispose(){void this.ctx?.close();this.ctx=null;this.master=null;}
}

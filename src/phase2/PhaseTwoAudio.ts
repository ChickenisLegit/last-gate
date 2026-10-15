import type { PhaseTwoDirector } from './model';

/** Quiet procedural pressure, breathing and event sounds; no music or network assets. */
export class PhaseTwoAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private pressure: GainNode | null = null;
  private breath: GainNode | null = null;
  private threat: GainNode | null = null;
  private nodes: AudioNode[] = [];
  private last = '';
  private enabled = false;
  async setEnabled(enabled: boolean) {
    if (enabled && !this.context) {
      this.context = new AudioContext();
      const ctx = this.context;
      const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination); this.master = master;
      const tone = (frequency: number, value: number) => {
        const oscillator = ctx.createOscillator(), gain = ctx.createGain();
        oscillator.frequency.value = frequency; gain.gain.value = value;
        oscillator.connect(gain).connect(master); oscillator.start(); this.nodes.push(oscillator, gain); return gain;
      };
      this.pressure = tone(37, .018);
      tone(39.3, .009);
      this.threat = tone(74, 0);
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate), data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * .28;
      const source = ctx.createBufferSource(); source.buffer = buffer; source.loop = true;
      const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 560;
      const breath = ctx.createGain(); breath.gain.value = 0;
      source.connect(filter).connect(breath).connect(master); source.start();
      this.breath = breath; this.nodes.push(source, filter, breath);
    }
    if (enabled) await this.context?.resume();
    this.enabled = enabled;
    this.master?.gain.setTargetAtTime(enabled ? .46 : 0, this.context!.currentTime, .3);
  }
  private cue(frequency: number, duration: number, gain: number, pan = 0) {
    if (!this.enabled || !this.context || !this.master) return;
    const ctx = this.context, now = ctx.currentTime;
    const tone = ctx.createOscillator(), volume = ctx.createGain(), spatial = ctx.createStereoPanner();
    tone.frequency.setValueAtTime(frequency, now); tone.frequency.exponentialRampToValueAtTime(Math.max(20, frequency * .24), now + duration);
    volume.gain.setValueAtTime(0, now); volume.gain.linearRampToValueAtTime(gain, now + .025); volume.gain.exponentialRampToValueAtTime(.0001, now + duration);
    spatial.pan.value = pan; tone.connect(volume).connect(spatial).connect(this.master); tone.start(); tone.stop(now + duration);
    tone.onended = () => { tone.disconnect(); volume.disconnect(); spatial.disconnect(); };
  }
  update(director: PhaseTwoDirector) {
    if (!this.context || !this.enabled) return;
    const s = director.getSnapshot(), now = this.context.currentTime;
    const quiet = s.stage === 'ready' || s.stage === 'fracture' && director.stageTime < 2;
    this.pressure?.gain.setTargetAtTime(quiet ? .002 : s.stage === 'null' ? .013 : .019, now, .6);
    this.breath?.gain.setTargetAtTime(quiet ? 0 : Math.pow(Math.max(0, Math.sin(director.time * 1.3)), 4) * .035, now, .18);
    const state = director.huntState;
    this.threat?.gain.setTargetAtTime(s.stage === 'ready' ? 0 : state === 'ATTACK_PREP' ? .055 : state === 'APPROACHING' ? .024 : .001, now, .5);
    const key = `${s.stage}/${s.assembled}/${s.stored}/${s.captured}/${s.anchors}/${state}`;
    if (key !== this.last) {
      if (state === 'ATTACK') this.cue(124, 1.2, .32);
      else if (s.stage === 'lattice') this.cue(680, 1.8, .025);
      else if (s.captured || s.stored) this.cue(920, .35, .012, -.2);
      else if (s.assembled) this.cue(280, .16, .04);
      else if (state === 'TRACKING') this.cue(85, 1.8, .07, -.75);
      this.last = key;
    }
  }
  dispose() {
    this.master?.gain.setValueAtTime(0, this.context!.currentTime);
    this.nodes.forEach(node => { if (node instanceof OscillatorNode || node instanceof AudioBufferSourceNode) node.stop(); node.disconnect(); });
    this.nodes = []; void this.context?.close(); this.context = null;
  }
}

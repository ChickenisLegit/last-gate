/**
 * Phase 6 sound, all synthesized: the switch click, his jets (and their stutter under the limit),
 * heavy footfalls, the fall, the frame's hum, the gate opening, and the boot chime. It starts on
 * the first gesture and closes with the phase.
 */
export class PhaseSixAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private jet: GainNode | null = null; private jetFilter: BiquadFilterNode | null = null;
  private hum: GainNode | null = null; private air: GainNode | null = null; private calm: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  unlock() {
    if (this.ctx) { void this.ctx.resume(); return; }
    try {
      const c = new AudioContext(); this.ctx = c;
      this.master = c.createGain(); this.master.gain.value = .5; this.master.connect(c.destination);
      const buf = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      const loop = (filter: BiquadFilterNode, gain: GainNode) => { const src = c.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(filter); filter.connect(gain); gain.connect(this.master!); src.start(); };
      // Jets: band-limited roar.
      this.jet = c.createGain(); this.jet.gain.value = 0; this.jetFilter = c.createBiquadFilter(); this.jetFilter.type = 'bandpass'; this.jetFilter.frequency.value = 520; this.jetFilter.Q.value = .5; loop(this.jetFilter, this.jet);
      // City air, and the quiet water on the other side.
      this.air = c.createGain(); this.air.gain.value = .05; const airF = c.createBiquadFilter(); airF.type = 'lowpass'; airF.frequency.value = 380; loop(airF, this.air);
      this.calm = c.createGain(); this.calm.gain.value = 0; const calmF = c.createBiquadFilter(); calmF.type = 'bandpass'; calmF.frequency.value = 900; calmF.Q.value = .3; loop(calmF, this.calm);
      // The frame's hum: two close low tones beating slowly.
      this.hum = c.createGain(); this.hum.gain.value = 0; this.hum.connect(this.master);
      for (const f of [55, 55.7, 110.4]) { const o = c.createOscillator(); o.frequency.value = f; const g = c.createGain(); g.gain.value = f > 100 ? .25 : .5; o.connect(g); g.connect(this.hum); o.start(); }
    } catch { this.ctx = null; }
  }

  /** Continuous layers, set every frame (smoothed). */
  set(s: { jet: number; sputter: number; hum: number; air: number; calm: number }) {
    const c = this.ctx; if (!c || !this.jet || !this.hum || !this.air || !this.calm || !this.jetFilter) return;
    const now = c.currentTime;
    const gate = s.sputter > 0 && Math.random() < .35 ? .1 : 1;
    this.jet.gain.setTargetAtTime(s.jet * .55 * gate, now, s.sputter > 0 ? .02 : .12);
    this.jetFilter.frequency.setTargetAtTime(380 + s.jet * 600, now, .2);
    this.hum.gain.setTargetAtTime(s.hum * .16, now, .4);
    this.air.gain.setTargetAtTime(s.air * .06, now, .8);
    this.calm.gain.setTargetAtTime(s.calm * .05, now, 1.2);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, level: number, at = 0, attack = .005) {
    const c = this.ctx; if (!c || !this.master) return;
    const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(level, t + attack); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + .05);
  }
  private burst(freq: number, q: number, dur: number, level: number, type: BiquadFilterType = 'bandpass', at = 0) {
    const c = this.ctx; if (!c || !this.master || !this.noise) return;
    const t = c.currentTime + at, src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = this.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(level, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t, Math.random()); src.stop(t + dur + .05);
  }

  click() { this.burst(4200, 2, .035, .5, 'highpass'); this.tone('square', 2400, 1800, .03, .05); this.burst(900, 4, .06, .15, 'bandpass', .012); }
  snap() { this.burst(2600, 1.5, .05, .55, 'highpass'); this.tone('triangle', 900, 500, .06, .06); }
  step(level: number) { this.tone('sine', 70, 34, .35, .5 * level); this.burst(160, .8, .18, .4 * level, 'lowpass'); }
  impact() { this.tone('sine', 62, 22, 1.6, .9); this.burst(220, .6, 1.4, .9, 'lowpass'); this.burst(1600, .7, .5, .25, 'bandpass', .02); this.tone('sawtooth', 48, 30, .5, .12); }
  ignite() { this.burst(300, .5, .7, .35, 'lowpass'); this.tone('sawtooth', 80, 160, .6, .05); }
  seat() { this.tone('sine', 520, 760, .25, .12); this.burst(3000, 2, .03, .3, 'highpass'); }
  contact() { this.burst(5200, 3, .08, .25, 'highpass'); this.tone('sine', 660, 990, .18, .06); }
  bloom() { this.burst(400, .4, 2.6, .35, 'lowpass'); [392, 494, 587, 784].forEach((f, i) => this.tone('sine', f, f * 1.002, 2.4, .05, i * .14, .4)); }
  /** His boot chime: four soft rising notes. */
  chime() { [659.3, 830.6, 987.8, 1318.5].forEach((f, i) => { this.tone('triangle', f, f, 1.6, .09, i * .16, .02); this.tone('sine', f * 2, f * 2, 1.1, .025, i * .16, .02); }); }

  dispose() { void this.ctx?.close(); this.ctx = null; }
}

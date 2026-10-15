import { enterRecovery } from '../recovery/state';
export type EntryStage = 'fracture' | 'afterimage' | 'build' | 'hunt' | 'null';
export type Stage = EntryStage | 'lattice' | 'descent' | 'ready';
export type LatticeMode = 'swarm' | 'shield' | 'decoy' | 'trace' | 'anchor' | 'crossing';
export type HuntState = 'HIDDEN' | 'DISTANT' | 'TRACKING' | 'APPROACHING' | 'ATTACK_PREP' | 'ATTACK' | 'RECOVERY' | 'REPOSITION';
export type Snapshot = Readonly<{
  stage: Stage; model: number; stored: boolean; scanning: boolean;
  assembled: number; selected: number; captured: boolean; lured: boolean;
  anchors: number; decoy: boolean; message: string; caption: string; action: string;
}>;

const COMPONENTS = ['MICROBOT REMNANTS', 'PORTAL-SCORED ARMOUR', 'MAGNETIC PREDICTOR CORE'];

/** One authored clock and discrete notifications. No frame-rate React updates. */
export class PhaseTwoDirector {
  time = 0;
  stageTime = 0;
  scanTime = 0;
  focusTime = 0;
  focused = false;
  recording = false;
  captureTime = 0;
  huntTime = 0;
  drag = false;
  paused = false;
  private listeners = new Set<() => void>();
  private snapshot: Snapshot;

  constructor(entry: EntryStage = 'fracture') {
    const recorded = ['build', 'hunt', 'null'].includes(entry);
    const built = entry === 'hunt' || entry === 'null';
    this.snapshot = {
      stage: entry, model: entry === 'null' ? 28 : recorded ? 9 : 0,
      stored: recorded, scanning: false, assembled: built ? 7 : 0,
      selected: 0, captured: entry === 'null', lured: false,
      anchors: 0, decoy: false, message: '', caption: '', action: '',
    };
    this.refresh();
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getSnapshot = () => this.snapshot;

  private patch(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach(listener => listener());
  }
  private enter(stage: Stage) {
    this.stageTime = 0;
    this.focusTime = 0;
    this.focused = false;
    this.recording = false;
    this.patch({ stage, message: '', caption: '', action: '' });
    this.refresh();
  }
  private refresh() {
    const s = this.snapshot;
    if (s.stage === 'afterimage') this.patch({
      action: s.stored ? 'FOLLOW THE TRACE  /  E' : 'FOCUS ON THE STILL LINE  /  E TO SCAN',
    });
    if (s.stage === 'build') this.patch({
      action: 'SELECT A PART  /  DRAG TO ALIGN  /  E TO ASSIST',
      message: COMPONENTS[0],
      caption: 'If he can find a path through this place... I can record it.',
    });
    if (s.stage === 'hunt') this.patch({
      caption: 'Every attack leaves a way through.', action: 'MOVE INTO THE OPEN  /  W OR SCROLL',
    });
    if (s.stage === 'null') this.patch({ caption: 'No. This time, you come to me.' });
  }
  select(index: number) {
    if (index < 0 || index > 2) return;
    if (this.snapshot.stage === 'build' && !(this.snapshot.assembled & (1 << index))) {
      this.patch({ selected: index, message: COMPONENTS[index] });
    }
  }
  connect(index = this.snapshot.selected) {
    const s = this.snapshot;
    if (index < 0 || index > 2 || s.stage !== 'build' || s.assembled & (1 << index)) return;
    const assembled = s.assembled | (1 << index);
    const next = [0, 1, 2].find(i => !(assembled & (1 << i))) ?? index;
    this.patch({ assembled, selected: next, message: COMPONENTS[next], caption: '' });
    if (assembled === 7) this.enter('lattice');
  }
  act() {
    const s = this.snapshot;
    if (s.stage === 'afterimage') {
      if (s.stored) enterRecovery();
      else if (!s.scanning) {
        this.scanTime = 0;
        this.patch({ scanning: true, action: 'RECORDING LOCAL STABILITY...' });
      }
    } else if (s.stage === 'build') this.connect();
    else if (s.stage === 'hunt') {
      if (s.captured) this.enter('descent');
      else if (!s.lured) {
        this.huntTime = 0;
        this.patch({ lured: true, action: '', caption: '' });
      }
    }
  }
  step(delta: number) {
    if (this.paused) return;
    const dt = Math.min(Math.max(delta, 0), .05);
    this.time += dt;
    this.stageTime += dt;
    const s = this.snapshot, t = this.stageTime;
    if (s.stage === 'fracture' && t >= 8) this.enter('afterimage');
    if (s.stage === 'afterimage') {
      if (this.focused && !s.scanning && !s.stored) {
        this.focusTime += dt;
        if (this.focusTime > .9) this.act();
      } else if (!this.focused) this.focusTime = 0;
      if (s.scanning && !s.stored) {
        this.scanTime += dt;
        if (this.scanTime >= 3.2) this.patch({
          stored: true, scanning: false, model: 9, message: 'AFTERIMAGE TRACE STORED',
          caption: 'He is mapping the dimension.', action: 'FOLLOW THE TRACE  /  E',
        });
      }
    }
    if (s.stage === 'lattice' && t >= 18) this.enter('hunt');
    if (s.stage === 'hunt' && s.lured && !s.captured) {
      this.huntTime += dt;
      if (this.huntTime >= 20) {
        if (this.snapshot.action !== 'FOCUS THE VECTOR  /  HOLD E TO RECORD') this.patch({
          action: 'FOCUS THE VECTOR  /  HOLD E TO RECORD', message: 'AFTERIMAGE / TRACE AVAILABLE',
        });
        if (this.focused || this.recording) this.captureTime += dt;
        if (this.captureTime >= 2.4) this.patch({
          captured: true, model: 28, message: 'VECTOR 01 // CAPTURED',
          caption: 'I do not need to outrun him.', action: 'FOLLOW THE RECORDED PATH  /  E',
        });
      }
    }
    if (s.stage === 'descent' && t >= 10) this.enter('null');
    if (s.stage === 'null') {
      const anchors = t > 11 ? 3 : t > 8 ? 2 : t > 5 ? 1 : 0;
      if (anchors !== s.anchors) this.patch({ anchors });
      if (t > 14 && !s.decoy) this.patch({ decoy: true, message: 'TARGET SOLUTION / DECOY' });
      if (t >= 34) {
        this.enter('ready');
        this.patch({ anchors: 3, decoy: true });
      }
    }
  }
  get mode(): LatticeMode {
    const s = this.snapshot, t = this.stageTime;
    if (s.stage === 'lattice') return t < 4 ? 'swarm' : t < 7 ? 'shield' : t < 10 ? 'decoy' : t < 13 ? 'trace' : t < 15 ? 'anchor' : 'crossing';
    if (s.stage === 'hunt') return s.captured || !s.lured ? 'swarm' : this.huntTime < 13 ? 'swarm' : this.huntTime < 16.4 ? 'shield' : this.huntTime < 18.5 ? 'swarm' : this.huntTime >= 20 ? 'trace' : 'swarm';
    if (s.stage === 'descent') return 'trace';
    if (s.stage === 'null' || s.stage === 'ready') return 'anchor';
    return 'swarm';
  }
  get huntState(): HuntState {
    const s = this.snapshot, t = this.huntTime;
    if (s.stage === 'ready' || (s.stage === 'null' && this.stageTime > 29)) return 'ATTACK_PREP';
    if (s.stage === 'null') return this.stageTime < 15 ? 'DISTANT' : 'APPROACHING';
    if (s.stage !== 'hunt' || !s.lured) return 'HIDDEN';
    return t < 3 ? 'DISTANT' : t < 6 ? 'TRACKING' : t < 10 ? 'REPOSITION' : t < 13 ? 'APPROACHING' : t < 16 ? 'ATTACK_PREP' : t < 17 ? 'ATTACK' : t < 21 ? 'RECOVERY' : 'REPOSITION';
  }
  dispose() { this.listeners.clear(); }
}

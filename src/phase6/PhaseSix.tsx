import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as T from 'three';
import { reducedMotion } from '../config/experience';
import { World, type RunState } from './World';
import { PhaseSixAudio } from './audio';
import { Card, FadeIn, RegulatorToggle, OutputMeter, DragHand, RingTask } from './ui';
import { ROUTE_LENGTH } from './street';
import { useP6, begin, go, skipBeat, now, setOf, isInsert, type Stage } from './store';
import { usePhaseSixEntry, type PhaseSixStep } from './entry';
import './phase-six.css';

/**
 * Phase 6. The combat chip brings Baymax back up at the relay. The regulator holds him to 35%,
 * which only buys time: Hiro runs for the old portal site and brings its frame back, but it needs
 * one more piece. He won't leave Baymax, so he lets him come at full power, then cuts the power
 * mid-air. Baymax falls, his chest opens, and the chip inside is the piece the socket needs.
 * Hiro hauls him through, and on the other side puts the healthcare chip back.
 */

const PLACE: Record<ReturnType<typeof setOf>, string> = { relay: 'TELEMETRY RELAY', street: 'GATE SITE', home: 'SAN FRANSOKYO' };

/** Re-renders on a timer while a stage runs, for UI that appears partway through it. */
function useStageTime(stage: Stage) {
  const [, tick] = useState(0);
  useEffect(() => { const id = window.setInterval(() => tick(x => x + 1), 200); return () => window.clearInterval(id); }, [stage]);
  return now() - useP6.getState().since;
}

export function PhaseSix({ initial }: { initial: PhaseSixStep }) {
  useState(() => { begin(initial); return 0; });
  const audio = useMemo(() => new PhaseSixAudio(), []);
  useEffect(() => () => audio.dispose(), [audio]);
  const s = useP6();
  const e = useStageTime(s.stage);
  const [ready, setReady] = useState(false);
  // Tell the chapter cover (presentation/chapterTransition) the scene is drawn and it can lift.
  const onReady = useCallback(() => { setReady(true); requestAnimationFrame(() => requestAnimationFrame(() => window.dispatchEvent(new Event('lastgate:scene-ready')))); }, []);
  const grab = useRef<HTMLDivElement>(null), drop = useRef<HTMLDivElement>(null);
  const hints = useMemo(() => ({ grab, drop }), []);
  const run = useRef<RunState>({ p: 0, speed: 0, forward: false, pointer: new T.Vector2(), impulse: 0 });
  const [progress, setProgress] = useState(0);
  const [moved, setMoved] = useState(false);
  const set = setOf(s.stage);

  // Sound starts with the first gesture.
  useEffect(() => {
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock); window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, [audio]);

  // Development: Ctrl+M skips to the next beat (and keeps the earlier phases' handler out of it).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const skip = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.altKey || event.shiftKey || event.metaKey || event.code !== 'KeyM') return;
      event.preventDefault(); event.stopImmediatePropagation(); skipBeat();
    };
    window.addEventListener('keydown', skip, true);
    return () => window.removeEventListener('keydown', skip, true);
  }, []);

  // The run: hold W, Space, the up arrow or the mouse; scroll for a step. The pointer looks around.
  useEffect(() => {
    if (s.stage !== 'escape') return;
    const r = run.current, fwd = ['KeyW', 'ArrowUp', 'Space'];
    const down = (ev: KeyboardEvent) => { if (fwd.includes(ev.code) && !ev.ctrlKey) { ev.preventDefault(); r.forward = true; setMoved(true); } };
    const up = (ev: KeyboardEvent) => { if (fwd.includes(ev.code)) r.forward = false; };
    const wheel = (ev: WheelEvent) => { ev.preventDefault(); if (ev.deltaY > 0) { r.impulse = Math.min(1.4, r.impulse + .45); setMoved(true); } };
    const move = (ev: PointerEvent) => r.pointer.set((ev.clientX / innerWidth - .5) * 2, (ev.clientY / innerHeight - .5) * 2);
    const press = (ev: PointerEvent) => { if (ev.button === 0 && !(ev.target as HTMLElement).closest('button')) { r.forward = true; setMoved(true); } };
    const release = () => { r.forward = false; };
    const tick = window.setInterval(() => setProgress(r.p), 250);
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('pointermove', move); window.addEventListener('pointerdown', press); window.addEventListener('pointerup', release); window.addEventListener('blur', release);
    return () => {
      window.clearInterval(tick); r.forward = false;
      window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('wheel', wheel);
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerdown', press); window.removeEventListener('pointerup', release); window.removeEventListener('blur', release);
    };
  }, [s.stage]);

  const insert = isInsert(s.stage);
  const toggle = (next: Stage) => () => { audio.unlock(); go(next); };
  const replay = () => usePhaseSixEntry.setState(st => ({ active: true, step: 'wake', run: st.run + 1 }));
  const metres = Math.max(0, Math.round((1 - progress) * ROUTE_LENGTH + 12));

  return <main className={`p6 p6-set-${set} p6-stage-${s.stage} ${insert ? 'p6-insert' : ''}`} aria-label="Phase 6: Baymax wakes again">
    <div className="p6-world">
      <Canvas dpr={[1, 1.4]} camera={{ fov: 46, near: .02, far: 900, position: [2, 2, 2] }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
        <World audio={audio} hints={hints} run={run} onReady={onReady} />
      </Canvas>
    </div>
    <div className="p6-grade" aria-hidden="true" />
    <div className="p6-bars" aria-hidden="true" />
    <header className="p6-brand"><span>THE LAST GATE</span><small>PHASE 06 · {insert ? 'REGULATOR' : s.stage === 'escape' ? 'SERVICE STREET' : PLACE[set]}</small></header>

    {/* Drag targets, placed over the 3D each frame. */}
    <div ref={grab} className="p6-hint p6-hint-grab" aria-hidden="true"><i /></div>
    <div ref={drop} className="p6-hint p6-hint-drop" aria-hidden="true"><i /></div>

    {ready && <>
      {/* 1 · Wake */}
      {(s.stage === 'wake' && e > 2.4 || s.stage === 'switchOn1') && <Card id="wake" className="p6-left">
        <p className="p6-kicker"><span className="p6-dot red" />RELAY STATION</p>
        <h1>Baymax is moving.</h1>
        <p className="p6-body">The combat chip is still running him.</p>
        <RegulatorToggle action="on" busy={insert} onPress={toggle('switchOn1')} />
      </Card>}

      {/* 2 · Regulator on */}
      {s.stage === 'limited' && <Card id={e > 9.6 ? 'buys-time' : 'limited'} className="p6-left">
        <p className="p6-kicker"><span className="p6-dot" />REGULATOR ON</p>
        {e > 9.6 ? <><h1>It only buys time.</h1><p className="p6-body">He’s still coming. Just slower.</p></> : <><h1>Held to 35%.</h1><p className="p6-body">Watch what that does to him.</p></>}
        <OutputMeter value={35} />
        {e > 9.6 && <button className="p6-btn" onClick={toggle('escape')}>GET TO THE PORTAL SITE</button>}
      </Card>}
      {s.stage === 'limited' && e > 1.6 && e < 4.4 && <FadeIn className="p6-note" key="thrust"><b>THRUST</b>not enough to fly</FadeIn>}
      {s.stage === 'limited' && e > 8 && e < 10.5 && <FadeIn className="p6-note p6-note-b" key="arm"><b>ARM</b>output capped</FadeIn>}

      {/* 3 · Escape */}
      {s.stage === 'escape' && <>
        <div className="p6-objective" role="status"><span>OBJECTIVE</span><b>Get to the portal site.</b><small>{metres} m</small></div>
        {!moved && <FadeIn className="p6-hint-line" delay={.6}>Hold <kbd>W</kbd> or the mouse to run</FadeIn>}
        <p className="sr-only">Hold W, Space or the mouse button to run along the street, or scroll to step. Move the pointer to look around.</p>
      </>}

      {/* 4 · The gate site */}
      {s.stage === 'gate' && <Card id="gate" className="p6-left p6-task">
        <p className="p6-kicker"><span className="p6-dot" />THE OLD FRAME</p>
        <h1>Bring the ring back.</h1>
        <p className="p6-body">Turn each segment so its in contact meets the out contact around it.</p>
        <RingTask audio={audio} />
      </Card>}
      {s.stage === 'powered' && <Card id="powered" className="p6-left">
        <p className="p6-kicker"><span className="p6-dot dusk" />FRAME</p>
        <h1>Frame powered.</h1>
        <p className="p6-body">One piece missing.</p>
      </Card>}

      {/* 5 · The choice */}
      {(s.stage === 'choice' || s.stage === 'switchOff') && e > .5 && !insert && <FadeIn className="p6-line" as="p" key="line"><small>HIRO</small>I’m not leaving him here.</FadeIn>}
      {(s.stage === 'choice' && e > 2.6 || s.stage === 'switchOff') && <Card id="choice" className="p6-left p6-compact">
        <RegulatorToggle action="off" busy={insert} onPress={toggle('switchOff')} />
      </Card>}

      {/* 6 · The drop */}
      {(s.stage === 'faceoff' && e > .8 || s.stage === 'switchOn2') && <Card id="faceoff" className="p6-left p6-compact">
        <p className="p6-kicker warn"><span className="p6-dot red" />FULL POWER</p>
        <RegulatorToggle action="on" busy={insert} onPress={toggle('switchOn2')} />
      </Card>}

      {/* 7 · Open the portal */}
      {s.stage === 'carry' && <Card id="carry" className="p6-left">
        <p className="p6-kicker"><span className="p6-dot dusk" />THE MISSING PIECE</p>
        <h1>The socket needs that chip.</h1>
        <p className="p6-body p6-withhand"><DragHand />Drag it from his chest to the frame.</p>
      </Card>}

      {/* 8 · Home */}
      {s.stage === 'home' && e > 2.4 && <Card id="home" className="p6-left">
        <p className="p6-kicker"><span className="p6-dot care" />THE OTHER SIDE</p>
        <h1>His healthcare chip.</h1>
        <p className="p6-body p6-withhand"><DragHand />Drag it into his chest.</p>
      </Card>}
      {s.stage === 'seated' && <Card id="seated" className="p6-left">
        <p className="p6-kicker"><span className="p6-dot care" />SEATED</p>
        <h1>Close him up.</h1>
        <button className="p6-btn" onClick={toggle('boot')}>CLOSE THE BAY</button>
      </Card>}
      {s.stage === 'end' && <div className="p6-end" role="dialog" aria-labelledby="p6-end-title">
        <Card id="end" className="p6-endcard">
          <p className="p6-kicker">THE LAST GATE</p>
          <h2 id="p6-end-title">He’s back.</h2>
          <p className="p6-body">Same city. Same Baymax.</p>
        </Card>
      </div>}
    </>}
    <div className={`p6-veil ${s.stage === 'end' && e > 6 ? 'black' : ''}`} key={`veil-${set}`} aria-hidden="true" />
    {s.stage === 'end' && e > 8 && <FadeIn className="p6-replay"><button className="p6-btn ghost" onClick={replay}>PLAY AGAIN</button></FadeIn>}
    {!ready && <div className="p6-loading" role="status">BAYMAX IS MOVING…</div>}
    {reducedMotion && <span className="sr-only">Reduced motion is on: camera shake and long fades are off.</span>}
  </main>;
}

import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { ACESFilmicToneMapping, Color, FogExp2, Group, Object3D, PerspectiveCamera, PMREMGenerator, SRGBColorSpace, Vector3 } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CinematicPost } from '../effects/CinematicPost';
import { createPortalDimension } from '../environment/PortalDimension.js';
import { createRuptureSet } from '../environment/RuptureSet.js';
import { assets } from '../systems/AssetManager';
import { CameraDirector, type ShotContext } from '../systems/CameraDirector';
import { SequenceDirector, type SequenceEvent } from '../systems/SequenceDirector';
import { BaymaxController } from '../characters/BaymaxController';
import { ChipController } from '../characters/ChipController';
import { AudioDirector } from '../audio/AudioDirector';
import { TransitionDirector } from '../transitions/TransitionDirector';
import { HOLD_PHASES, useSceneState, type Phase } from '../state/SceneStateManager';
import { reducedMotion } from '../config/experience';
import { DIAGNOSTIC_LINES, SHELL_ACTIONS, SHELL_DURATIONS } from '../config/shell';

class RenderBoundary extends Component<{children:ReactNode},{error:boolean}> {
  state={error:false};
  static getDerivedStateFromError(){return {error:true};}
  render(){return this.state.error?<Failure/>:this.props.children;}
}
function Failure(){return <div className="failure"><p>The connection was lost.</p><span>This chapter needs WebGL in a recent browser.</span><button onClick={()=>location.reload()}>RECONNECT ↗</button></div>;}

const CHAPTER_MARK:Record<string,string>={BOOT:'00',AWAKE:'00',THE_SHELL:'01',RED_WAKE:'02',THE_FRACTURE:'03'};
const MARKER_PHASES:Phase[]=['discovery','chip-focus','chest-focus'];
const STREET_BG=new Color('#101c31'),CORRIDOR_BG=new Color('#061420'),STREET_FOG=new Color('#253e59'),CORRIDOR_FOG=new Color('#123349');

type SceneProps={director:CameraDirector;seq:SequenceDirector;marker:React.RefObject<HTMLButtonElement|null>;readout:React.RefObject<HTMLDivElement|null>;audio:AudioDirector};
function AwakeScene({director,seq,marker,readout,audio}:SceneProps) {
  const {camera,gl,size,scene}=useThree();
  const advance=useThree(s=>s.advance);
  const environment=useMemo(()=>createPortalDimension(),[]);
  const rupture=useMemo(()=>createRuptureSet(environment),[environment]);
  const chip=useMemo(()=>new ChipController(),[]);
  const post=useMemo(()=>new CinematicPost(gl,scene,camera as PerspectiveCamera),[gl,scene,camera]);
  // Development only: lets tooling pump frames when the browser throttles requestAnimationFrame.
  useEffect(()=>{if((import.meta as unknown as {env?:{DEV?:boolean}}).env?.DEV){(window as unknown as {__lattiseFrame:(t?:number)=>void}).__lattiseFrame=(t?:number)=>advance(t??performance.now());(window as unknown as {__lattiseDebug:unknown}).__lattiseDebug={post,scene,gl,camera,environment,rupture,seq};}},[advance,post,scene,gl,camera,environment,rupture,seq]);
  const baymax=useRef<BaymaxController|null>(null);
  const [shell,setShell]=useState<Group|null>(null);
  const elapsed=useRef(0),replay=useRef(0),magnetCue=useRef(false);
  const ctx=useMemo<ShotContext>(()=>({chest:new Vector3(3,1.97,-11.3),normal:new Vector3(0,0,1),chip:new Vector3(),baymax:new Vector3(2.7,0,-12),head:new Vector3(2.72,2.98,-11.6)}),[]);
  const projection=useMemo(()=>new Vector3(),[]);
  useEffect(()=>{
    let active=true;
    assets.loadBaymax().then(model=>{
      if(!active)return;
      baymax.current=new BaymaxController(model);
      setShell(model);
    }).catch(()=>useSceneState.setState({error:'Could not load Baymax’s shell. Check your connection.'}));
    return ()=>{active=false;};
  },[]);
  useEffect(()=>{post.resize(size.width,size.height);},[post,size]);
  useEffect(()=>{
    const pmrem=new PMREMGenerator(gl),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04).texture;
    scene.environment=env;scene.environmentIntensity=.28;room.dispose();pmrem.dispose();
    return()=>{scene.environment=null;env.dispose();post.dispose();environment.dispose();};
  },[gl,scene,post]);
  useEffect(()=>{
    if(!shell)return;
    // Compile every program the sequence will ever need while the boot screen still covers it,
    // so no blast, tear or corridor stalls the frame the first time it appears.
    const hidden:Object3D[]=[];scene.traverse(o=>{if(!o.visible){hidden.push(o);o.visible=true;}});
    gl.compile(scene,camera);hidden.forEach(o=>{o.visible=false;});
    useSceneState.getState().ready();
  },[shell,gl,scene,camera]);
  useEffect(()=>seq.on((event:SequenceEvent)=>{
    rupture.onEvent(event,seq,camera as PerspectiveCamera);
    const pan=(p:Vector3)=>{projection.copy(p).project(camera);return Math.max(-1,Math.min(1,projection.x*.8));};
    if(event.type==='charge')audio.charge(pan(event.position));
    if(event.type==='discharge')audio.discharge(pan(event.from));
    if(event.type==='impact')audio.impact(event.power,event.tear,pan(event.position),Math.min(1,7/camera.position.distanceTo(event.position)));
    if(event.type==='beat'&&event.beat==='overhead')setTimeout(()=>audio.flyby(),250);
    if(event.type==='beat'&&event.beat==='silhouette')useSceneState.getState().say('That’s not him.');
    if(event.type==='beat'&&event.beat==='final')useSceneState.getState().say('He’s tearing it apart—');
  }),[seq,rupture,audio,camera,projection]);
  useFrame((_,delta)=>{
    const dt=Math.min(delta,.25);elapsed.current+=dt;const t=elapsed.current;
    const state=useSceneState.getState(),phase=state.phase;
    if(state.replay!==replay.current){replay.current=state.replay;rupture.reset();}
    seq.update(dt);
    const B=baymax.current;
    if(B){B.chestFrame(ctx.chest,ctx.normal);ctx.baymax.copy(B.shell.position);ctx.head.copy(B.shell.position).add(projection.set(.05,2.98,.25).applyEuler(B.shell.rotation));}
    ctx.chip.copy(chip.group.children[0].position);
    director.update(camera as PerspectiveCamera,dt,size.width,size.height,seq,ctx);
    environment.update(t,dt,reducedMotion,director.visualProgress,phase,seq,['chase','fracture','pulled'].includes(phase)?camera.position:null);
    B?.update(t,dt,reducedMotion,phase,seq,camera.position);
    chip.update(t,dt,reducedMotion,phase,seq,camera as PerspectiveCamera,B);
    rupture.update(t,dt,seq,phase,camera as PerspectiveCamera);
    if(phase==='socket-ready'&&seq.alignment>.35&&!magnetCue.current){magnetCue.current=true;audio.shellCue('magnet');}
    if(phase!=='socket-ready')magnetCue.current=false;
    audio.update(director.visualProgress,phase,seq.phaseTime,{red:seq.red,alignment:seq.alignment,corridor:seq.corridor,collapse:seq.collapse,thrust:['ignition','chase','fracture'].includes(phase)?(phase==='ignition'?Math.min(1,Math.max(0,(seq.phaseTime-1.9)*2)):1):0});
    // Through the seam the city falls away; only the corridor remains.
    const inside=phase==='handoff';
    environment.group.visible=!inside;
    const bg=scene.background as Color|null,fog=scene.fog as FogExp2|null;
    if(bg)bg.copy(inside?CORRIDOR_BG:STREET_BG);
    if(fog){fog.color.copy(inside?CORRIDOR_FOG:STREET_FOG);fog.density=inside?.012:.015+director.visualProgress*.006+seq.collapse*.01;}
    // UI anchors are projected from the world, never fixed to the screen.
    if(marker.current){
      const focus=phase==='chip-focus'?ctx.chip:phase==='chest-focus'?ctx.chest:projection.set(3.12,2.06,-11.28);
      projection.copy(focus).project(camera);
      marker.current.style.transform=`translate(${(projection.x*.5+.5)*size.width}px,${(-projection.y*.5+.5)*size.height}px) translate(-50%,-50%)`;
      marker.current.style.setProperty('--hold',seq.holdProgress.toFixed(3));
    }
    if(readout.current){
      projection.copy(ctx.head).add(ctx.normal.clone().multiplyScalar(.2)).project(camera);
      // Beside the head, past its silhouette, so the text never sits on white.
      readout.current.style.left=`${Math.min(.74,(projection.x*.5+.5)+.16)*size.width}px`;
      readout.current.style.top=`${Math.max(.18,(-projection.y*.5+.5)+.02)*size.height}px`;
    }
    const fx=post.fx;
    fx.warp=seq.warp;fx.center.copy(seq.warpCenter);fx.flash=seq.flash;fx.white=seq.whiteout;fx.red=seq.red*(phase==='handoff'?0:.8);fx.time=t;
    fx.cyan=phase==='fracture'?seq.corridor*.45:phase==='pulled'?.6:phase==='handoff'?.35:0;
    fx.chroma=seq.warp*.8+(phase==='pulled'?seq.collapse:0)+(phase==='threat'?.12:0);
    fx.aperture=['chip-focus','chip-reaching','chip-held'].includes(phase)?.00042:['chest-focus','panel-opening','socket-ready','inserting','silence'].includes(phase)?.0003:['booting','diagnostic','corrupting','threat'].includes(phase)?.00018:['discovery','inspected'].includes(phase)?.00016:0;
    gl.domElement.dataset.phase=phase;
    gl.domElement.dataset.progress=director.visualProgress.toFixed(3);
    gl.domElement.dataset.chase=seq.chase.toFixed(3);
    post.render(dt,director.wake,director.visualProgress,director.focusDistance);
    gl.domElement.dataset.drawCalls=String(gl.info.render.calls);
  },1);
  const check=(event:ThreeEvent<MouseEvent>)=>{event.stopPropagation();if(useSceneState.getState().phase==='discovery')useSceneState.getState().interact();};
  return <>
    <color attach="background" args={['#101c31']}/>
    <fogExp2 attach="fog" args={['#253e59',.015]}/>
    <primitive object={environment.group}/>
    <primitive object={rupture.root}/>
    <primitive object={chip.group}/>
    {shell&&<primitive object={shell} onClick={check} onPointerOver={()=>{if(useSceneState.getState().phase==='discovery')gl.domElement.style.cursor='crosshair';}} onPointerOut={()=>{gl.domElement.style.cursor='default';}}/>}
  </>;
}

/** Authored per-phase moments: sound one-shots and Hiro's few words. */
const PHASE_CUES:Partial<Record<Phase,[number,(audio:AudioDirector)=>void][]>>={
  'chip-reaching':[[0,a=>a.shellCue('grip')],[.25,a=>a.shellCue('lift')]],
  'chip-held':[[.2,a=>a.shellCue('inspect')]],
  'panel-opening':[[.45,a=>a.shellCue('latch')],[.75,a=>a.shellCue('release')],[1.2,a=>a.shellCue('servo')],[2.55,a=>a.shellCue('present')]],
  inserting:[[1.04,a=>a.shellCue('lock')]],
  booting:[[.2,a=>a.shellCue('seal')],[1.3,a=>a.shellCue('boot')],[3.5,a=>a.shellCue('chime')]],
  diagnostic:[[4.95,a=>a.shellCue('wrong')]],
  threat:[[1.7,a=>a.shellCue('lock-on')]],
  ignition:[[1.9,a=>a.spool()]],
  fracture:[[0,a=>a.rupture()]],
  pulled:[[3.1,a=>a.whiteout()]],
  handoff:[[1.2,a=>a.arrival()]]
};
const PHASE_LINES:Partial<Record<Phase,[number,string,('HIRO'|'BAYMAX')?][]>>={
  'chip-focus':[[1.4,'Your chip. Maybe this brings you back.']],
  'socket-ready':[[.6,'Come on, buddy.']],
  booting:[[4.3,'Baymax!']],
  threat:[[3.4,'…Baymax?']],
  ignition:[[.35,'No— wait—']],
  fracture:[[2.6,'BAYMAX!']]
};
const LINE_TIMES=[.5,1.55,2.45,3.35,4.55];
const SCRAMBLE='▚▞░▒/\\#*+=_';

function DiagnosticLine({text,delay}:{text:string;delay:number}){
  // Reconstructed, not typed: glyphs resolve from noise left to right.
  const [shown,setShown]=useState('');
  useEffect(()=>{
    let frame=0;const start=performance.now()+delay*1000;
    const id=setInterval(()=>{const t=(performance.now()-start)/1000;if(t<0)return;
      const resolved=Math.floor(t*38);
      setShown(text.split('').map((c,i)=>i<resolved||c===' '?c:i<resolved+4?SCRAMBLE[(i+frame)%SCRAMBLE.length]:'').join(''));
      frame++;if(resolved>=text.length+4)clearInterval(id);},33);
    return ()=>clearInterval(id);
  },[text,delay]);
  return <>{shown}</>;
}

export function ExperienceDirector(){
  const phase=useSceneState(s=>s.phase),chapter=useSceneState(s=>s.chapter),replay=useSceneState(s=>s.replay);
  const subtitle=useSceneState(s=>s.subtitle),speaker=useSceneState(s=>s.speaker),sound=useSceneState(s=>s.sound),error=useSceneState(s=>s.error);
  const [audioError,setAudioError]=useState(false),[linkVisible,setLinkVisible]=useState(false),[audioHint,setAudioHint]=useState(true);
  const aperture=useRef<SVGPathElement>(null),marker=useRef<HTMLButtonElement>(null),readout=useRef<HTMLDivElement>(null);
  const [idleHint,setIdleHint]=useState(false),[runHint,setRunHint]=useState(false);
  const pressedAt=useRef(0),firstScroll=useRef(true),scrollGuard=useRef(0),idleTimer=useRef<ReturnType<typeof setTimeout>|null>(null),sprintTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const camera=useMemo(()=>new CameraDirector(),[]),transitions=useMemo(()=>new TransitionDirector(),[]),audio=useMemo(()=>new AudioDirector(),[]),seq=useMemo(()=>new SequenceDirector(),[]);

  useEffect(()=>{
    if(phase==='awakening'&&aperture.current){firstScroll.current=true;transitions.awaken(aperture.current);}
  },[phase,replay,transitions]);
  useEffect(()=>{
    useSceneState.setState({chapter:'BOOT',phase:'loading',targetProgress:0,subtitle:'',error:null,sound:false});
  },[]);
  useEffect(()=>{
    setIdleHint(false);setRunHint(false);
    if(phase==='approaching')idleTimer.current=setTimeout(()=>setIdleHint(true),6500);
    if(phase==='chase')idleTimer.current=setTimeout(()=>{if(performance.now()/1000-seq.lastInput>2.4)setRunHint(true);},3200);
    return()=>{if(idleTimer.current)clearTimeout(idleTimer.current);};
  },[phase,seq]);
  useEffect(()=>{
    const duration=SHELL_DURATIONS[phase];
    if(!duration)return;
    const timer=setTimeout(()=>useSceneState.getState().advance(phase),duration*1000/(reducedMotion&&phase==='silence'?2:1));
    return()=>clearTimeout(timer);
  },[phase,replay]);
  useEffect(()=>{
    const timers=[...(PHASE_CUES[phase]??[]).map(([at,cue])=>setTimeout(()=>cue(audio),at*1000)),
      ...(PHASE_LINES[phase]??[]).map(([at,text,who])=>setTimeout(()=>useSceneState.getState().say(text,who??'HIRO'),at*1000))];
    if(phase==='diagnostic')LINE_TIMES.forEach((at,i)=>timers.push(setTimeout(()=>audio.shellCue(DIAGNOSTIC_LINES[i].tone==='ok'?'line':'fault'),at*1000)));
    return()=>timers.forEach(clearTimeout);
  },[phase,audio,replay]);
  useEffect(()=>{
    if(!subtitle)return;
    const timer=setTimeout(()=>{if(useSceneState.getState().subtitle===subtitle)useSceneState.getState().say('');},3400);
    return ()=>clearTimeout(timer);
  },[subtitle]);
  useEffect(()=>{
    setLinkVisible(false);
    if(phase!=='inspected')return;
    audio.failedLink();
    const timer=setTimeout(()=>setLinkVisible(true),2600);
    return ()=>clearTimeout(timer);
  },[phase,audio]);
  useEffect(()=>{const timer=setTimeout(()=>setAudioHint(false),16000);return ()=>clearTimeout(timer);},[]);
  useEffect(()=>()=>{transitions.dispose();audio.dispose();},[transitions,audio]);

  const skip=()=>{camera.skipAwakening();if(aperture.current)transitions.skip(aperture.current);};
  const restart=()=>{camera.resetPointer();seq.pointerDown=false;seq.keyHold=false;useSceneState.getState().restart();};
  useEffect(()=>{
    const input=()=>{setIdleHint(false);setRunHint(false);seq.lastInput=performance.now()/1000;if(idleTimer.current)clearTimeout(idleTimer.current);};
    const sprintPulse=()=>{seq.sprint=true;if(sprintTimer.current)clearTimeout(sprintTimer.current);sprintTimer.current=setTimeout(()=>{seq.sprint=false;},380);};
    const wheel=(event:WheelEvent)=>{
      const p=useSceneState.getState().phase;
      if(p==='chase'){event.preventDefault();if(event.deltaY>0){input();sprintPulse();}return;}
      if(p!=='approaching')return;
      event.preventDefault();input();
      if(firstScroll.current&&event.deltaY>0){firstScroll.current=false;scrollGuard.current=performance.now()+450;useSceneState.getState().move(.065);return;}
      if(performance.now()<scrollGuard.current)return;
      useSceneState.getState().move(Math.max(-.022,Math.min(.034,event.deltaY*.00024)));
    };
    const holdKeys=['KeyE','Space','Enter'],runKeys=['Space','ArrowUp','KeyW'];
    const down=(event:KeyboardEvent)=>{
      if(event.ctrlKey||event.metaKey||event.altKey)return;
      const p=useSceneState.getState().phase;
      if(event.code==='KeyR'){restart();return;}
      if(event.code==='Escape'&&p==='awakening')skip();
      if(event.code==='KeyE'&&p==='discovery')useSceneState.getState().inspect();
      if(runKeys.includes(event.code)&&p==='approaching'){event.preventDefault();input();camera.holding=true;}
      if(runKeys.includes(event.code)&&p==='chase'){event.preventDefault();input();seq.sprint=true;}
      // Holds work from the keyboard too: E, Space or Enter commit the chip, the seam and the dock.
      if(holdKeys.includes(event.code)&&([...HOLD_PHASES,'socket-ready'] as Phase[]).includes(p)){event.preventDefault();if(!seq.keyHold)pressedAt.current=performance.now();seq.keyHold=true;}
    };
    const up=(event:KeyboardEvent)=>{
      if(runKeys.includes(event.code)){camera.holding=false;seq.sprint=false;}
      if(holdKeys.includes(event.code)){if(seq.keyHold)latch();seq.keyHold=false;}
    };
    const move=(event:PointerEvent)=>{
      camera.pointer={x:(event.clientX/innerWidth-.5)*2,y:(event.clientY/innerHeight-.5)*2};
      seq.pointer.set((event.clientX/innerWidth)*2-1,-(event.clientY/innerHeight)*2+1);
    };
    const press=(event:PointerEvent)=>{
      if(event.button!==0||(event.target as HTMLElement).closest('button:not(.shell-interaction)'))return;
      const p=useSceneState.getState().phase;
      if(([...HOLD_PHASES,'socket-ready','chase'] as Phase[]).includes(p)){seq.pointerDown=true;pressedAt.current=performance.now();input();}
    };
    // A quick click on the chip or the seam is read as intent, not as a failed hold.
    const latch=()=>{if(HOLD_PHASES.includes(useSceneState.getState().phase)&&performance.now()-pressedAt.current<400)seq.latch=true;};
    const release=()=>{if(seq.pointerDown)latch();camera.holding=false;seq.pointerDown=false;};
    const blur=()=>{release();seq.keyHold=false;seq.sprint=false;};
    window.addEventListener('wheel',wheel,{passive:false});window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('pointermove',move);window.addEventListener('pointerdown',press);window.addEventListener('blur',blur);window.addEventListener('pointerup',release);
    return ()=>{window.removeEventListener('wheel',wheel);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('pointermove',move);window.removeEventListener('pointerdown',press);window.removeEventListener('blur',blur);window.removeEventListener('pointerup',release);};
  },[camera,transitions,seq]);

  const toggleSound=async()=>{
    const enabled=!sound;
    try{await audio.setEnabled(enabled);useSceneState.getState().toggleSound();setAudioError(false);setAudioHint(false);}catch{setAudioError(true);}
  };
  const action=SHELL_ACTIONS[phase];
  const diagnosticVisible=['diagnostic','corrupting','threat','ignition'].includes(phase);
  return <main className={`experience phase-${phase}`} aria-label="PROJECT LATTICE: Hiro’s vision inside the portal dimension">
    <div className="world">
      <RenderBoundary><Canvas camera={{fov:49,near:.05,far:280,position:[-1.4,.72,7]}} dpr={1.25} shadows gl={{antialias:true,powerPreference:'high-performance',toneMapping:ACESFilmicToneMapping,outputColorSpace:SRGBColorSpace}} onCreated={({gl})=>{gl.toneMappingExposure=1.12;}} fallback={<span aria-hidden="true"/>}>
        <AwakeScene director={camera} seq={seq} marker={marker} readout={readout} audio={audio}/>
      </Canvas></RenderBoundary>
    </div>
    <div className="lens-vignette" aria-hidden="true"/><div className="film-grain" aria-hidden="true"/>
    <div className="cinema-edge top" aria-hidden="true"/><div className="cinema-edge bottom" aria-hidden="true"/>
    <svg className="organic-blink" viewBox="0 0 1920 1080" preserveAspectRatio="none" aria-hidden="true"><defs><filter id="lid-feather"><feGaussianBlur stdDeviation="5"/></filter><mask id="eye-aperture"><rect width="1920" height="1080" fill="white"/><path ref={aperture} fill="black" filter="url(#lid-feather)"/></mask></defs><rect width="1920" height="1080" fill="#020506" mask="url(#eye-aperture)"/></svg>
    {chapter==='BOOT'&&<div className="boot" role="status"><span className="signal-line"/><span>RECONNECTING…</span></div>}
    <button className="sound" onClick={toggleSound} aria-label={sound?'Mute atmospheric sound':'Enable atmospheric sound'} aria-pressed={sound}>
      <span className={`wave ${sound?'active':''}`} aria-hidden="true"><i/><i/><i/><i/></span>
      <span>{audioError?'UNAVAILABLE':sound?'SOUND ON':'SOUND OFF'}</span>
    </button>
    {audioHint&&!sound&&<span className="audio-hint">HEADPHONES RECOMMENDED</span>}
    <div className="suit-readout" aria-label="Suit location status"><span>LOCATION <b>UNRESOLVED</b></span><span>EXIT SIGNAL <b>— — —</b></span><i>PERSONAL LINK / OFFLINE</i></div>
    <div className="subtitle" role="status" aria-live="polite">{subtitle&&<p key={subtitle} className={speaker==='BAYMAX'?'baymax':''}><span>{speaker}</span>{subtitle}</p>}</div>
    {phase==='awakening'&&<button className="skip" onClick={skip}>SKIP AWAKENING <span>ESC</span></button>}
    {phase==='approaching'&&idleHint&&<button className="approach" onClick={()=>{setIdleHint(false);useSceneState.getState().move(.065);}} aria-label="Move closer to Baymax">
      MOVE <span>//</span> SCROLL
    </button>}
    {phase==='chase'&&runHint&&<div className="run-hint" aria-hidden="true">RUN <span>//</span> HOLD · SCROLL</div>}
    <button ref={marker} className={`shell-interaction ${phase==='discovery'?'':'shell-action'}`} hidden={!MARKER_PHASES.includes(phase)}
      onPointerDown={event=>{if(phase==='discovery'){event.stopPropagation();useSceneState.getState().interact();}}}
      onKeyDown={event=>{if(phase==='discovery'&&(event.key==='Enter'||event.key===' ')){event.preventDefault();useSceneState.getState().interact();}}}
      aria-label={action?.description||'Check Baymax for a response'}>
      <span className="interaction-ring"><svg viewBox="0 0 40 40" aria-hidden="true"><circle className="hold-track" cx="20" cy="20" r="18"/><circle className="hold-fill" cx="20" cy="20" r="18"/></svg></span>
      <span className="interaction-label">{action?.label||'CHECK RESPONSE'} <small>{phase==='discovery'?'E':'HOLD'}</small></span>
    </button>
    <div ref={readout} className={`diagnostic ${diagnosticVisible?'visible':''}`} aria-live="polite">
      {diagnosticVisible&&phase!=='threat'&&phase!=='ignition'&&DIAGNOSTIC_LINES.map((line,i)=>
        <p key={line.key} className={`tone-${line.tone}`} style={{animationDelay:`${LINE_TIMES[i]}s`}}><span><DiagnosticLine text={line.key} delay={LINE_TIMES[i]}/></span><i/><b><DiagnosticLine text={line.value} delay={LINE_TIMES[i]+.35}/></b></p>)}
      {(phase==='threat'||phase==='ignition')&&<p className="threat-line"><span><DiagnosticLine text="PRIMARY THREAT" delay={1.65}/></span><i/><b><DiagnosticLine text="HIRO HAMADA" delay={2.05}/></b></p>}
    </div>
    {phase==='inspected'&&<div className={`failed-link ${linkVisible?'visible':''}`} aria-live="polite"><span className="fault-dot"/> BAYMAX <span>NO RESPONSE</span></div>}
    <div className="signature" aria-hidden="true">PROJECT <span>//</span> LATTICE <i>{CHAPTER_MARK[chapter]}</i></div>
    {phase==='inspected'&&linkVisible&&<button className="replay" onClick={restart}>REPLAY OPENING <span>R ↶</span></button>}
    {phase==='handoff'&&<div className="handoff" role="status">
      <p>PROJECT <span>//</span> LATTICE</p>
      <h1><i>03</i>THE FRACTURE CORRIDOR</h1>
      <small>SIGNAL <b>HIRO HAMADA</b> // PURSUIT CONTINUES DEEPER</small>
      <button className="replay-inline" onClick={restart}>REPLAY FROM THE BEGINNING <span>R ↶</span></button>
    </div>}
    {error&&<div className="failure"><p>{error}</p><button onClick={()=>location.reload()}>RECONNECT ↗</button></div>}
    <p className="sr-only">The opening starts automatically. Press Escape to skip awakening. Scroll, hold Space, W, or Arrow Up, or use the move closer button to approach Baymax. Select Baymax or press E to check for a response. Then press and hold the mouse, or hold E, Space or Enter, to pick up the red chip and to release Baymax’s chest access. Move the pointer to guide the chip into the socket, or hold E to guide it automatically. When Baymax attacks, Hiro runs on his own; hold the mouse, Space, W or Arrow Up, or scroll, to sprint. Press R to replay.</p>
  </main>;
}

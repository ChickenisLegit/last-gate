import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { ACESFilmicToneMapping, Group, PerspectiveCamera, SRGBColorSpace, Vector3 } from 'three';
import { createPortalDimension } from '../environment/PortalDimension.js';
import { assets } from '../systems/AssetManager';
import { CameraDirector } from '../systems/CameraDirector';
import { BaymaxController } from '../characters/BaymaxController';
import { AudioDirector } from '../audio/AudioDirector';
import { TransitionDirector } from '../transitions/TransitionDirector';
import { useSceneState } from '../state/SceneStateManager';
import { lowPower, reducedMotion } from '../config/experience';

class RenderBoundary extends Component<{children:ReactNode},{error:boolean}> {
  state={error:false};
  static getDerivedStateFromError(){return {error:true};}
  render(){return this.state.error?<Failure/>:this.props.children;}
}
function Failure(){return <div className="failure"><p>The connection was lost.</p><span>This chapter needs WebGL in a recent browser.</span><button onClick={()=>location.reload()}>RECONNECT ↗</button></div>;}

function AwakeScene({director,marker}:{director:CameraDirector;marker:React.RefObject<HTMLButtonElement|null>}) {
  const {camera,gl,size}=useThree();
  const environment=useMemo(()=>createPortalDimension(lowPower),[]);
  const [shell,setShell]=useState<Group|null>(null);
  const elapsed=useRef(0),projection=useMemo(()=>new Vector3(),[]);
  useEffect(()=>{
    let active=true;
    assets.loadBaymax().then(model=>{
      if(!active)return;
      new BaymaxController(model);
      setShell(model);
    }).catch(()=>useSceneState.setState({error:'Could not load Baymax’s shell. Check your connection.'}));
    return ()=>{active=false;};
  },[]);
  useEffect(()=>{if(shell)useSceneState.getState().ready();},[shell]);
  useFrame((_,delta)=>{
    elapsed.current+=Math.min(delta,1);
    director.update(camera as PerspectiveCamera,delta,size.width,size.height);
    environment.update(elapsed.current,Math.min(delta,1),reducedMotion);
    if(marker.current){
      projection.set(2.7,2.2,-11.3).project(camera);
      marker.current.style.left=`${(projection.x*.5+.5)*size.width}px`;
      marker.current.style.top=`${(-projection.y*.5+.5)*size.height}px`;
    }
    gl.domElement.dataset.phase=useSceneState.getState().phase;
    gl.domElement.dataset.drawCalls=String(gl.info.render.calls);
  });
  const check=(event:ThreeEvent<MouseEvent>)=>{event.stopPropagation();useSceneState.getState().inspect();};
  return <>
    <color attach="background" args={['#202b2d']}/>
    <fogExp2 attach="fog" args={['#364446',.022]}/>
    <primitive object={environment.group}/>
    {shell&&<primitive object={shell} onClick={check} onPointerOver={()=>{if(useSceneState.getState().phase==='discovery')gl.domElement.style.cursor='crosshair';}} onPointerOut={()=>{gl.domElement.style.cursor='default';}}/>}
  </>;
}

export function ExperienceDirector(){
  const phase=useSceneState(s=>s.phase),chapter=useSceneState(s=>s.chapter),replay=useSceneState(s=>s.replay);
  const subtitle=useSceneState(s=>s.subtitle),sound=useSceneState(s=>s.sound),error=useSceneState(s=>s.error);
  const [audioError,setAudioError]=useState(false),[linkVisible,setLinkVisible]=useState(false),[audioHint,setAudioHint]=useState(true);
  const top=useRef<HTMLDivElement>(null),bottom=useRef<HTMLDivElement>(null),world=useRef<HTMLDivElement>(null),marker=useRef<HTMLButtonElement>(null);
  const camera=useMemo(()=>new CameraDirector(),[]),transitions=useMemo(()=>new TransitionDirector(),[]),audio=useMemo(()=>new AudioDirector(),[]);

  useEffect(()=>{
    if(phase==='awakening'&&top.current&&bottom.current&&world.current)transitions.awaken(top.current,bottom.current,world.current);
  },[phase,replay,transitions]);
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

  const skip=()=>{camera.skipAwakening();if(top.current&&bottom.current&&world.current)transitions.skip(top.current,bottom.current,world.current);};
  useEffect(()=>{
    const wheel=(event:WheelEvent)=>{if(useSceneState.getState().phase==='approaching'){event.preventDefault();useSceneState.getState().move(Math.max(-.06,Math.min(.085,event.deltaY*.0005)));}};
    const down=(event:KeyboardEvent)=>{
      if(event.ctrlKey||event.metaKey||event.altKey)return;
      if(event.code==='KeyR'){camera.resetPointer();useSceneState.getState().restart();}
      if(event.code==='Escape'&&useSceneState.getState().phase==='awakening')skip();
      if(event.code==='KeyE')useSceneState.getState().inspect();
      if(['Space','ArrowUp','KeyW'].includes(event.code)&&useSceneState.getState().phase==='approaching'){event.preventDefault();camera.holding=true;}
    };
    const up=(event:KeyboardEvent)=>{if(['Space','ArrowUp','KeyW'].includes(event.code))camera.holding=false;};
    const move=(event:PointerEvent)=>{if(event.pointerType!=='touch')camera.pointer={x:(event.clientX/innerWidth-.5)*2,y:(event.clientY/innerHeight-.5)*2};};
    const blur=()=>{camera.holding=false;};
    window.addEventListener('wheel',wheel,{passive:false});window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('pointermove',move);window.addEventListener('blur',blur);window.addEventListener('pointerup',blur);
    return ()=>{window.removeEventListener('wheel',wheel);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('pointermove',move);window.removeEventListener('blur',blur);window.removeEventListener('pointerup',blur);};
  },[camera,transitions]);

  const toggleSound=async()=>{
    const enabled=!sound;
    try{await audio.setEnabled(enabled);useSceneState.getState().toggleSound();setAudioError(false);setAudioHint(false);}catch{setAudioError(true);}
  };
  const touchY=useRef<number|null>(null);
  return <main className={`experience phase-${phase}`} aria-label="PROJECT LATTICE: Hiro’s vision inside the portal dimension">
    <div className="world" ref={world} onPointerDown={event=>{if(event.pointerType==='touch')touchY.current=event.clientY;}} onPointerMove={event=>{if(event.pointerType==='touch'&&touchY.current!==null){useSceneState.getState().move((touchY.current-event.clientY)*.0025);touchY.current=event.clientY;}}} onPointerUp={()=>{touchY.current=null;}} onPointerCancel={()=>{touchY.current=null;}}>
      <RenderBoundary><Canvas camera={{fov:49,near:.1,far:280,position:[-1.4,.72,7]}} dpr={[1,1.7]} shadows gl={{antialias:true,powerPreference:'high-performance',toneMapping:ACESFilmicToneMapping,outputColorSpace:SRGBColorSpace}} onCreated={({gl})=>{gl.toneMappingExposure=1.12;}} fallback={<span aria-hidden="true"/>}>
        <AwakeScene director={camera} marker={marker}/>
      </Canvas></RenderBoundary>
    </div>
    <div className="lens-vignette" aria-hidden="true"/><div className="film-grain" aria-hidden="true"/>
    <div className="cinema-edge top" aria-hidden="true"/><div className="cinema-edge bottom" aria-hidden="true"/>
    <div ref={top} className="eyelid eyelid-top" aria-hidden="true"/><div ref={bottom} className="eyelid eyelid-bottom" aria-hidden="true"/>
    {chapter==='BOOT'&&<div className="boot" role="status"><span className="signal-line"/><span>RECONNECTING…</span></div>}
    <button className="sound" onClick={toggleSound} aria-label={sound?'Mute atmospheric sound':'Enable atmospheric sound'} aria-pressed={sound}>
      <span className={`wave ${sound?'active':''}`} aria-hidden="true"><i/><i/><i/><i/></span>
      <span>{audioError?'UNAVAILABLE':sound?'SOUND ON':'SOUND OFF'}</span>
    </button>
    {audioHint&&!sound&&<span className="audio-hint">HEADPHONES RECOMMENDED</span>}
    <div className="suit-readout" aria-label="Suit location status"><span>LOCATION <b>UNRESOLVED</b></span><span>EXIT SIGNAL <b>— — —</b></span><i>PERSONAL LINK / OFFLINE</i></div>
    <div className="subtitle" role="status" aria-live="polite">{subtitle&&<p key={subtitle}><span>HIRO</span>{subtitle}</p>}</div>
    {phase==='awakening'&&<button className="skip" onClick={skip}>SKIP AWAKENING <span>ESC</span></button>}
    {phase==='approaching'&&<button className="approach" onPointerDown={()=>{camera.holding=true;}} onPointerUp={()=>{camera.holding=false;}} onPointerCancel={()=>{camera.holding=false;}} onClick={()=>useSceneState.getState().move(.18)} aria-label="Move closer to Baymax">
      <span className="move-line" aria-hidden="true"/>{lowPower?'HOLD TO MOVE CLOSER':'SCROLL TO MOVE CLOSER'}<small>{lowPower?'OR SWIPE UP':'OR HOLD SPACE / ↑'}</small>
    </button>}
    <button ref={marker} className="shell-interaction" hidden={phase!=='discovery'} onClick={()=>useSceneState.getState().inspect()} aria-label="Check Baymax for a response"><span className="interaction-ring"/><span>CHECK RESPONSE <small>E</small></span></button>
    {phase==='inspected'&&<div className={`failed-link ${linkVisible?'visible':''}`} aria-live="polite"><span className="fault-dot"/> BAYMAX <span>NO RESPONSE</span><small>There’s a red chip beside his hand.</small></div>}
    <div className="signature" aria-hidden="true">PROJECT <span>//</span> LATTICE <i>{chapter==='THE_SHELL'?'01':'00'}</i></div>
    {phase==='inspected'&&linkVisible&&<button className="replay" onClick={()=>{camera.resetPointer();useSceneState.getState().restart();}}>REPLAY OPENING <span>R ↶</span></button>}
    {error&&<div className="failure"><p>{error}</p><button onClick={()=>location.reload()}>RECONNECT ↗</button></div>}
    <p className="sr-only">The opening starts automatically. Press Escape to skip awakening. Scroll, hold Space, W, or Arrow Up, or use the move closer button to approach Baymax. Select Baymax or press E to check for a response. Press R to replay. The red-chip activation is the next chapter.</p>
  </main>;
}

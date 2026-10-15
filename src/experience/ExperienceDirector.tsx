import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { ACESFilmicToneMapping, Group, PerspectiveCamera, PMREMGenerator, SRGBColorSpace, Vector3 } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { CinematicPost } from '../effects/CinematicPost';
import { createPortalDimension } from '../environment/PortalDimension.js';
import { assets } from '../systems/AssetManager';
import { CameraDirector } from '../systems/CameraDirector';
import { BaymaxController } from '../characters/BaymaxController';
import { AudioDirector } from '../audio/AudioDirector';
import { TransitionDirector } from '../transitions/TransitionDirector';
import { useSceneState } from '../state/SceneStateManager';
import { reducedMotion } from '../config/experience';
import { SHELL_ACTIONS, SHELL_DURATIONS } from '../config/shell';
import { Failure } from '../ui/Failure';
import { RenderQuality } from '../systems/RenderQuality';

class RenderBoundary extends Component<{children:ReactNode},{error:boolean}> {
  state={error:false};
  static getDerivedStateFromError(){return {error:true};}
  render(){return this.state.error?<Failure message="The 3D scene could not render." detail="Try reloading, updating your browser, or enabling hardware acceleration."/>:this.props.children;}
}

function AwakeScene({director,marker,audio}:{director:CameraDirector;marker:React.RefObject<HTMLButtonElement|null>;audio:AudioDirector}) {
  const {camera,gl,size,scene,setDpr}=useThree();
  const environment=useMemo(()=>createPortalDimension(),[]);
  const post=useRef<CinematicPost|null>(null);
  const quality=useMemo(()=>new RenderQuality(innerWidth<900),[]);
  const [contextLost,setContextLost]=useState(false);
  const baymax=useRef<BaymaxController|null>(null);
  const [shell,setShell]=useState<Group|null>(null);
  const elapsed=useRef(0),projection=useMemo(()=>new Vector3(),[]);
  useEffect(()=>{
    let active=true;
    assets.loadBaymax().then(model=>{
      if(!active)return;
      baymax.current=new BaymaxController(model);
      setShell(model);
    }).catch(()=>useSceneState.setState({error:'Could not load Baymaxâ€™s shell. Check your connection.'}));
    return ()=>{active=false;};
  },[]);
  useEffect(()=>{
    const compact=size.width<900;
    if(compact&&quality.level==='HIGH')quality.level='MEDIUM';
    setDpr(quality.pixelRatio(compact));
    post.current?.setQuality(quality.level);
    post.current?.resize(size.width,size.height);
    environment.setQuality(quality.level);
  },[size,quality,setDpr,environment]);
  useEffect(()=>{
    const lost=(event:Event)=>{event.preventDefault();setContextLost(true);useSceneState.setState({error:'The WebGL graphics context was lost. Reload to restore the experience.'});};
    gl.domElement.addEventListener('webglcontextlost',lost);
    return()=>gl.domElement.removeEventListener('webglcontextlost',lost);
  },[gl]);
  useEffect(()=>{
    if(!shell)return;
    let active=true;
    const timer=setTimeout(()=>{
      import('../effects/CinematicPost').then(({CinematicPost})=>{
        if(!active)return;
        post.current=new CinematicPost(gl,scene,camera as PerspectiveCamera);
        post.current.setQuality(quality.level);
        post.current.resize(gl.domElement.clientWidth,gl.domElement.clientHeight);
      }).catch(()=>{gl.domElement.dataset.effects='unavailable';});
    },250);
    return()=>{active=false;clearTimeout(timer);post.current?.dispose();post.current=null;};
  },[shell,gl,scene,camera,quality]);
  useEffect(()=>{
    const pmrem=new PMREMGenerator(gl),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04).texture;
    scene.environment=env;scene.environmentIntensity=.28;room.dispose();pmrem.dispose();
    return()=>{scene.environment=null;env.dispose();environment.dispose();};
  },[gl,scene,environment]);
  useEffect(()=>{if(shell)useSceneState.getState().ready();},[shell]);
  useFrame((_,delta)=>{
    elapsed.current+=Math.min(delta,1);
    director.update(camera as PerspectiveCamera,delta,size.width,size.height);
    const currentPhase=useSceneState.getState().phase;
    environment.update(elapsed.current,Math.min(delta,1),reducedMotion,director.visualProgress,currentPhase);
    baymax.current?.update(elapsed.current,reducedMotion,currentPhase);
    audio.updateProgress(director.visualProgress);
    if(scene.fog&&'density' in scene.fog)scene.fog.density=.015+director.visualProgress*.006;
    if(marker.current){
      const focus=currentPhase==='chip-focus'||currentPhase==='chip-reaching'||currentPhase==='chip-held'?new Vector3(4.05,.25,-10.45):new Vector3(3.12,2.06,-11.28);
      projection.copy(focus).project(camera);
      marker.current.style.left=`${Math.max(Math.min(110,size.width/2),Math.min(size.width-Math.min(110,size.width/2),(projection.x*.5+.5)*size.width))}px`;
      marker.current.style.top=`${Math.max(85,Math.min(size.height-130,(-projection.y*.5+.5)*size.height))}px`;
    }
    gl.domElement.dataset.phase=useSceneState.getState().phase;
    gl.domElement.dataset.progress=director.visualProgress.toFixed(3);
    if(contextLost)return;
    if(quality.sample(delta,document.visibilityState==='visible')){
      setDpr(quality.pixelRatio(size.width<900));
      post.current?.setQuality(quality.level);
      environment.setQuality(quality.level);
    }
    gl.domElement.dataset.quality=quality.level;
    if(post.current)post.current.render(Math.min(delta,1),director.wake,director.visualProgress,director.focusDistance);
    else gl.render(scene,camera);
    gl.domElement.dataset.drawCalls=String(gl.info.render.calls);
  },1);
  const check=(event:ThreeEvent<MouseEvent>)=>{event.stopPropagation();useSceneState.getState().interact();};
  return <>
    <color attach="background" args={['#101c31']}/>
    <fogExp2 attach="fog" args={['#253e59',.015]}/>
    <primitive object={environment.group}/>
    {shell&&<primitive object={shell} onClick={check} onPointerOver={()=>{if(useSceneState.getState().phase==='discovery')gl.domElement.style.cursor='crosshair';}} onPointerOut={()=>{gl.domElement.style.cursor='default';}}/>}
  </>;
}

export function ExperienceDirector(){
  const phase=useSceneState(s=>s.phase),chapter=useSceneState(s=>s.chapter),replay=useSceneState(s=>s.replay);
  const subtitle=useSceneState(s=>s.subtitle),sound=useSceneState(s=>s.sound),error=useSceneState(s=>s.error);
  const [audioError,setAudioError]=useState(false),[linkVisible,setLinkVisible]=useState(false),[audioHint,setAudioHint]=useState(true);
  const aperture=useRef<SVGPathElement>(null),marker=useRef<HTMLButtonElement>(null);
  const [idleHint,setIdleHint]=useState(false);
  const firstScroll=useRef(true),scrollGuard=useRef(0),idleTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const camera=useMemo(()=>new CameraDirector(),[]),transitions=useMemo(()=>new TransitionDirector(),[]),audio=useMemo(()=>new AudioDirector(),[]);

  useEffect(()=>{
    if(phase==='awakening'&&aperture.current){firstScroll.current=true;transitions.awaken(aperture.current);}
  },[phase,replay,transitions]);
  useEffect(()=>{
    useSceneState.setState({chapter:'BOOT',phase:'loading',targetProgress:0,subtitle:'',error:null,sound:false});
  },[]);
  useEffect(()=>{
    setIdleHint(false);
    if(phase==='approaching')idleTimer.current=setTimeout(()=>setIdleHint(true),6500);
    return()=>{if(idleTimer.current)clearTimeout(idleTimer.current);};
  },[phase]);
  useEffect(()=>{
    const duration=SHELL_DURATIONS[phase];
    if(!duration)return;
    const timer=setTimeout(()=>useSceneState.getState().advance(phase),duration*1000);
    return()=>clearTimeout(timer);
  },[phase]);
  useEffect(()=>{
    if(phase==='chip-reaching')audio.shellCue('lift');
    if(phase==='panel-opening')audio.shellCue('latch');
    if(phase==='inserting')audio.shellCue('align');
    if(phase==='sealing')audio.shellCue('lock');
    if(phase==='booting')audio.shellCue('boot');
    if(phase==='threat')audio.shellCue('fault');
  },[phase,audio]);
  useEffect(()=>{
    if(phase==='booting')useSceneState.getState().say('Baymaxâ€¦?', 'HIRO');
    if(phase==='diagnostic')useSceneState.getState().say('HEALTHCARE DIRECTIVE  //  MISSING','BAYMAX');
    if(phase==='threat')useSceneState.getState().say('PRIMARY THREAT  //  HIRO HAMADA','BAYMAX');
  },[phase]);
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
  useEffect(()=>{
    const input=()=>{setIdleHint(false);if(idleTimer.current)clearTimeout(idleTimer.current);};
    const wheel=(event:WheelEvent)=>{if(useSceneState.getState().phase==='approaching'){
      event.preventDefault();input();
      if(firstScroll.current&&event.deltaY>0){firstScroll.current=false;scrollGuard.current=performance.now()+450;useSceneState.getState().move(.065);return;}
      if(performance.now()<scrollGuard.current)return;
      useSceneState.getState().move(Math.max(-.022,Math.min(.034,event.deltaY*.00024)));
    }};
    const down=(event:KeyboardEvent)=>{
      if(event.ctrlKey||event.metaKey||event.altKey)return;
      if(event.code==='KeyR'){camera.resetPointer();useSceneState.getState().restart();}
      if(event.code==='Escape'&&useSceneState.getState().phase==='awakening')skip();
      if(event.code==='KeyE')useSceneState.getState().interact();
      if(['Space','ArrowUp','KeyW'].includes(event.code)&&!(event.target instanceof HTMLElement&&event.target.closest('button'))&&useSceneState.getState().phase==='approaching'){event.preventDefault();input();camera.holding=true;}
    };
    const up=(event:KeyboardEvent)=>{if(['Space','ArrowUp','KeyW'].includes(event.code))camera.holding=false;};
    const move=(event:PointerEvent)=>{if(event.pointerType==='touch')return;camera.pointer={x:(event.clientX/innerWidth-.5)*2,y:(event.clientY/innerHeight-.5)*2};};
    const blur=()=>{camera.holding=false;};
    window.addEventListener('wheel',wheel,{passive:false});window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('pointermove',move);window.addEventListener('blur',blur);window.addEventListener('pointerup',blur);
    return ()=>{window.removeEventListener('wheel',wheel);window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('pointermove',move);window.removeEventListener('blur',blur);window.removeEventListener('pointerup',blur);};
  },[camera,transitions]);

  const toggleSound=async()=>{
    const enabled=!sound;
    try{await audio.setEnabled(enabled);useSceneState.getState().toggleSound();setAudioError(false);setAudioHint(false);}catch{setAudioError(true);}
  };
  return <main className={`experience phase-${phase}`} aria-label="PROJECT LATTICE: Hiroâ€™s vision inside the portal dimension">
    <div className="world">
      <RenderBoundary><Canvas camera={{fov:49,near:.1,far:280,position:[-1.4,.72,7]}} dpr={innerWidth<900?1:1.25} shadows gl={{antialias:true,powerPreference:'high-performance',toneMapping:ACESFilmicToneMapping,outputColorSpace:SRGBColorSpace}} onCreated={({gl})=>{gl.toneMappingExposure=1.12;}} fallback={<Failure message="WebGL is unavailable or disabled." detail="Enable hardware acceleration or try a recent browser with WebGL 2 support."/>}>
        <AwakeScene director={camera} marker={marker} audio={audio}/>
      </Canvas></RenderBoundary>
    </div>
    <div className="lens-vignette" aria-hidden="true"/><div className="film-grain" aria-hidden="true"/>
    <div className="cinema-edge top" aria-hidden="true"/><div className="cinema-edge bottom" aria-hidden="true"/>
    <svg className="organic-blink" viewBox="0 0 1920 1080" preserveAspectRatio="none" aria-hidden="true"><defs><filter id="lid-feather"><feGaussianBlur stdDeviation="5"/></filter><mask id="eye-aperture"><rect width="1920" height="1080" fill="white"/><path ref={aperture} fill="black" filter="url(#lid-feather)"/></mask></defs><rect width="1920" height="1080" fill="#020506" mask="url(#eye-aperture)"/></svg>
    {chapter==='BOOT'&&<div className="boot" role="status"><span className="signal-line"/><span>RECONNECTINGâ€¦</span></div>}
    <button className="sound" onClick={toggleSound} aria-label={sound?'Mute atmospheric sound':'Enable atmospheric sound'} aria-pressed={sound}>
      <span className={`wave ${sound?'active':''}`} aria-hidden="true"><i/><i/><i/><i/></span>
      <span>{audioError?'UNAVAILABLE':sound?'SOUND ON':'SOUND OFF'}</span>
    </button>
    {audioHint&&!sound&&<span className="audio-hint">HEADPHONES RECOMMENDED</span>}
    <div className="suit-readout" aria-label="Suit location status"><span>LOCATION <b>UNRESOLVED</b></span><span>EXIT SIGNAL <b>â€” â€” â€”</b></span><i>PERSONAL LINK / OFFLINE</i></div>
    <div className="subtitle" role="status" aria-live="polite">{subtitle&&<p key={subtitle}><span>HIRO</span>{subtitle}</p>}</div>
    {phase==='awakening'&&<button className="skip" onClick={skip}>SKIP AWAKENING <span>ESC</span></button>}
    {phase==='approaching'&&<button className={`approach ${idleHint?'idle-hint':''}`} onPointerDown={event=>{event.currentTarget.setPointerCapture(event.pointerId);camera.holding=true;setIdleHint(false);}} onPointerUp={()=>{camera.holding=false;}} onPointerCancel={()=>{camera.holding=false;}} onLostPointerCapture={()=>{camera.holding=false;}} onClick={()=>useSceneState.getState().move(.065)} aria-label="Move closer to Baymax">
      <span className="desktop-move">MOVE // SCROLL</span><span className="touch-move">HOLD TO MOVE CLOSER</span>
    </button>}
    <button ref={marker} className={`shell-interaction ${phase==='chip-focus'||phase==='chip-reaching'||phase==='chip-held'||phase==='panel-opening'||phase==='socket-ready'?'shell-action':''}`} hidden={!['discovery','chip-focus','chip-held','socket-ready'].includes(phase)} onClick={()=>useSceneState.getState().interact()} aria-label={SHELL_ACTIONS[phase]?.description||'Check Baymax for a response'}><span className="interaction-ring"/><span>{SHELL_ACTIONS[phase]?.label||'CHECK RESPONSE'} <small>{phase==='discovery'?'E':'SELECT'}</small></span></button>
    {(phase==='diagnostic'||phase==='threat')&&<div className="system-readout" aria-live="polite"><span>{phase==='diagnostic'?'HEALTHCARE DIRECTIVE':'PRIMARY THREAT'}</span><b>{phase==='diagnostic'?'MISSING':'HIRO HAMADA'}</b></div>}
    {phase==='inspected'&&<div className={`failed-link ${linkVisible?'visible':''}`} aria-live="polite"><span className="fault-dot"/> BAYMAX <span>NO RESPONSE</span></div>}
    <div className="signature" aria-hidden="true">PROJECT <span>//</span> LATTICE <i>{chapter==='THE_SHELL'?'01':'00'}</i></div>
    {chapter!=='BOOT'&&phase!=='awakening'&&<button className="replay" onClick={()=>{camera.resetPointer();useSceneState.getState().restart();}}>REPLAY OPENING <span>R â†¶</span></button>}
    {error&&<div className="failure"><p>{error}</p><button onClick={()=>location.reload()}>RECONNECT â†—</button></div>}
    <p className="sr-only">The opening starts automatically. Press Escape to skip awakening. Scroll, hold Space, W, or Arrow Up, or use the move closer button to approach Baymax. Select Baymax or press E to check for a response. Press R to replay. Select the action marker or press E to continue the red-chip activation.</p>
  </main>;
}

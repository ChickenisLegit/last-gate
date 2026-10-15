import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Failure } from './ui/Failure';
import { PhaseTwoHost } from './phase2/PhaseTwoHost';
import './ui/experience.css';
const Experience = lazy(() => import('./experience/ExperienceDirector').then(module => ({default:module.ExperienceDirector})));
function supportsWebGL(){try{const context=document.createElement('canvas').getContext('webgl2');if(!context)return false;context.getExtension('WEBGL_lose_context')?.loseContext();return true;}catch{return false;}}
class AppBoundary extends Component<{children:ReactNode},{error:boolean}>{state={error:false};static getDerivedStateFromError(){return {error:true};}render(){return this.state.error?<Failure message="The experience could not start." detail="Reload to try again. If the problem continues, try a recent browser with hardware acceleration enabled."/>:this.props.children;}}
function App(){const [supported]=useState(supportsWebGL);if(!supported)return <Failure message="WebGL is unavailable or disabled." detail="This experience needs WebGL 2. Enable hardware acceleration or try a recent browser."/>;return <AppBoundary><Suspense fallback={<main className="boot" role="status">LOADING EXPERIENCE…</main>}><PhaseTwoHost><Experience/></PhaseTwoHost></Suspense></AppBoundary>}
createRoot(document.getElementById('root')!).render(<App/>);

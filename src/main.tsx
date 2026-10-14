import React, {useEffect,useState} from 'react';
import { createRoot } from 'react-dom/client';
import { ExperienceDirector } from './experience/ExperienceDirector';
import './ui/experience.css';
function DesktopGate(){
  const [supported,setSupported]=useState(innerWidth>=1280);
  useEffect(()=>{const resize=()=>setSupported(innerWidth>=1280);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize);},[]);
  return supported?<ExperienceDirector/>:<main className="desktop-required"><p>PROJECT <span>//</span> LATTICE</p><h1>DESKTOP EXPERIENCE</h1><span>1280PX+ DISPLAY REQUIRED</span></main>;
}
createRoot(document.getElementById('root')!).render(<DesktopGate/>);

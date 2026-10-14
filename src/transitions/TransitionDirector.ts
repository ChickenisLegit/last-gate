import gsap from 'gsap';
import { reducedMotion } from '../config/experience';
import { useSceneState } from '../state/SceneStateManager';

export class TransitionDirector {
  constructor(){gsap.ticker.lagSmoothing(0);}
  private timeline:gsap.core.Timeline|null=null;
  awaken(top:HTMLElement,bottom:HTMLElement,world:HTMLElement){
    this.timeline?.kill();
    gsap.set([top,bottom],{yPercent:0});
    if(reducedMotion){gsap.set(top,{yPercent:-105});gsap.set(bottom,{yPercent:105});gsap.set(world,{filter:'none'});useSceneState.getState().finishAwakening();return;}
    const t=gsap.timeline();this.timeline=t;
    gsap.set(world,{filter:'blur(7px) saturate(.5)'});
    t.to(top,{yPercent:-23,duration:1.1,ease:'power2.inOut'},.5)
     .to(bottom,{yPercent:23,duration:1.1,ease:'power2.inOut'},.5)
     .to([top,bottom],{yPercent:0,duration:.45,ease:'power2.in'},1.6)
     .to(top,{yPercent:-105,duration:1.7,ease:'power2.inOut'},2.2)
     .to(bottom,{yPercent:105,duration:1.7,ease:'power2.inOut'},2.2)
     .to(world,{filter:'blur(0px) saturate(1)',duration:3.2,ease:'power1.out'},2.7)
     .call(()=>useSceneState.getState().say('Where… am I?'),[],4)
     .call(()=>useSceneState.getState().finishAwakening(),[],7.2);
  }
  skip(top:HTMLElement,bottom:HTMLElement,world:HTMLElement){this.timeline?.kill();gsap.set(top,{yPercent:-105});gsap.set(bottom,{yPercent:105});gsap.set(world,{filter:'none'});useSceneState.getState().finishAwakening();}
  dispose(){this.timeline?.kill();}
}

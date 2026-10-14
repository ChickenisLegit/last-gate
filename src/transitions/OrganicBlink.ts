import gsap from 'gsap';
import { reducedMotion } from '../config/experience';
import { useSceneState } from '../state/SceneStateManager';

// An asymmetric aperture in one continuous mask, never sliding rectangular lids.
export class TransitionDirector {
  private timeline:gsap.core.Timeline|null=null;
  constructor(){gsap.ticker.lagSmoothing(0);}
  private draw(path:SVGPathElement,open:number){
    const edge=Math.pow(open,2.35),cy=535+Math.sin(open*4)*9;
    path.setAttribute('d',`M -180 ${cy-edge*1050} C 150 ${cy-open*620}, 610 ${cy-open*950}, 1010 ${cy-open*830} C 1430 ${cy-open*840}, 1780 ${cy-open*570}, 2100 ${cy-edge*1050+open*12} L 2100 ${cy+edge*1010} C 1680 ${cy+open*540}, 1370 ${cy+open*800}, 950 ${cy+open*890} C 510 ${cy+open*750}, 160 ${cy+open*560}, -180 ${cy+edge*1010} Z`);
  }
  awaken(path:SVGPathElement){
    this.timeline?.kill();const eye={open:0};this.draw(path,0);
    if(reducedMotion){this.draw(path,1);useSceneState.getState().finishAwakening();return;}
    const update=()=>this.draw(path,eye.open);
    this.timeline=gsap.timeline()
      .to(eye,{open:.055,duration:.9,ease:'power2.inOut',onUpdate:update},1)
      .to(eye,{open:0,duration:.35,ease:'power2.in',onUpdate:update},2.05)
      .to(eye,{open:.24,duration:1.1,ease:'power2.inOut',onUpdate:update},3)
      .to(eye,{open:0,duration:.42,ease:'power1.in',onUpdate:update},4.45)
      .to(eye,{open:1,duration:3.9,ease:'power2.inOut',onUpdate:update},5.6)
      .call(()=>useSceneState.getState().say('Where… am I?'),[],8.1)
      .call(()=>useSceneState.getState().finishAwakening(),[],10.7);
  }
  skip(path:SVGPathElement){this.timeline?.kill();this.draw(path,1);useSceneState.getState().finishAwakening();}
  dispose(){this.timeline?.kill();}
}

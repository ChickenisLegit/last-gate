import { create } from 'zustand';

export type Chapter = 'BOOT' | 'AWAKE' | 'THE_SHELL' | 'RED_WAKE' | 'THE_FRACTURE';
export type Phase = 'loading' | 'awakening' | 'approaching' | 'discovery' | 'inspected'
  | 'chip-focus' | 'chip-reaching' | 'chip-held' | 'chest-focus' | 'panel-opening' | 'socket-ready'
  | 'inserting' | 'silence' | 'booting' | 'diagnostic' | 'corrupting' | 'threat'
  | 'ignition' | 'chase' | 'fracture' | 'pulled' | 'handoff';
export type Speaker = 'HIRO' | 'BAYMAX';
const next: Partial<Record<Phase,Phase>> = {
  discovery:'inspected', inspected:'chip-focus', 'chip-focus':'chip-reaching',
  'chip-reaching':'chip-held', 'chip-held':'chest-focus', 'chest-focus':'panel-opening',
  'panel-opening':'socket-ready', 'socket-ready':'inserting', inserting:'silence', silence:'booting',
  booting:'diagnostic', diagnostic:'corrupting', corrupting:'threat', threat:'ignition',
  ignition:'chase', chase:'fracture', fracture:'pulled', pulled:'handoff'
};
const chapterOf=(phase:Phase,current:Chapter):Chapter=>
  ['booting','diagnostic','corrupting','threat','ignition','chase'].includes(phase)?'RED_WAKE'
  :['fracture','pulled','handoff'].includes(phase)?'THE_FRACTURE':current;
/** Phases where the player commits by holding (pointer on the focus, or E / Space). */
export const HOLD_PHASES:Phase[]=['chip-focus','chest-focus'];
type ExperienceState = {
  chapter: Chapter; phase: Phase; targetProgress: number; subtitle: string; speaker:Speaker;
  sound: boolean; error: string | null; replay: number; started: boolean;
  ready: () => void; finishAwakening: () => void; move: (amount: number) => void;
  arrive: () => void; inspect: () => void; interact: () => void;
  advance: (from:Phase) => void; restart: () => void;
  say: (text: string,speaker?:Speaker) => void; toggleSound: () => void;
};
export const useSceneState = create<ExperienceState>((set, get) => ({
  chapter:'BOOT',phase:'loading',targetProgress:0,subtitle:'',speaker:'HIRO',sound:false,error:null,replay:0,started:false,
  ready:()=>set({chapter:'AWAKE',phase:'awakening',started:true}),
  finishAwakening:()=>{if(get().phase==='awakening')set({phase:'approaching',subtitle:'Baymax… where are you?',speaker:'HIRO'});},
  move:(amount)=>{if(get().phase==='approaching')set({targetProgress:Math.max(0,Math.min(1,get().targetProgress+amount))});},
  arrive:()=>{if(get().phase==='approaching')set({chapter:'THE_SHELL',phase:'discovery',subtitle:'Baymax. You’re here.',speaker:'HIRO'});},
  inspect:()=>{if(get().phase==='discovery')get().advance('discovery');},
  interact:()=>{const p=get().phase;if(['discovery',...HOLD_PHASES,'socket-ready'].includes(p))get().advance(p);},
  advance:(from)=>{const to=next[from];if(get().phase!==from||!to)return;set({phase:to,chapter:chapterOf(to,get().chapter),subtitle:'',speaker:'HIRO'});},
  restart:()=>set({chapter:'AWAKE',phase:'awakening',targetProgress:0,subtitle:'',speaker:'HIRO',replay:get().replay+1}),
  say:(subtitle,speaker='HIRO')=>set({subtitle,speaker}),toggleSound:()=>set({sound:!get().sound}),
}));
// Development only: lets the director's console jump between beats while tuning.
if((import.meta as unknown as {env?:{DEV?:boolean}}).env?.DEV)(window as unknown as {__lattice:typeof useSceneState}).__lattice=useSceneState;

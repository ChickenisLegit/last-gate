import { create } from 'zustand';

export type Chapter = 'BOOT' | 'AWAKE' | 'THE_SHELL';
export type Phase = 'loading' | 'awakening' | 'approaching' | 'discovery' | 'inspected'
  | 'chip-focus' | 'chip-reaching' | 'chip-held' | 'panel-opening' | 'socket-ready'
  | 'inserting' | 'sealing' | 'silence' | 'booting' | 'diagnostic' | 'threat' | 'corrupted';
export type Speaker = 'HIRO' | 'BAYMAX';
const next: Partial<Record<Phase,Phase>> = {
  discovery:'inspected', inspected:'chip-focus', 'chip-focus':'chip-reaching',
  'chip-reaching':'chip-held', 'chip-held':'panel-opening', 'panel-opening':'socket-ready',
  'socket-ready':'inserting', inserting:'sealing', sealing:'silence', silence:'booting',
  booting:'diagnostic', diagnostic:'threat', threat:'corrupted'
};
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
  finishAwakening:()=>{if(get().phase==='awakening')set({phase:'approaching',subtitle:'Baymax…?',speaker:'HIRO'});},
  move:(amount)=>{if(get().phase==='approaching')set({targetProgress:Math.max(0,Math.min(1,get().targetProgress+amount))});},
  arrive:()=>{if(get().phase==='approaching')set({chapter:'THE_SHELL',phase:'discovery',subtitle:'It’s me. Hiro.',speaker:'HIRO'});},
  inspect:()=>{if(get().phase==='discovery')get().advance('discovery');},
  interact:()=>{const p=get().phase;if(['discovery','chip-focus','chip-held','socket-ready'].includes(p))get().advance(p);},
  advance:(from)=>{if(get().phase!==from||!next[from])return;set({phase:next[from],subtitle:'',speaker:'HIRO'});},
  restart:()=>set({chapter:'AWAKE',phase:'awakening',targetProgress:0,subtitle:'',speaker:'HIRO',replay:get().replay+1}),
  say:(subtitle,speaker='HIRO')=>set({subtitle,speaker}),toggleSound:()=>set({sound:!get().sound}),
}));

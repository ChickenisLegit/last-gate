import { create } from 'zustand';

export type Chapter = 'BOOT' | 'AWAKE' | 'THE_SHELL';
export type Phase = 'loading' | 'awakening' | 'approaching' | 'discovery' | 'inspected';
type ExperienceState = {
  chapter: Chapter; phase: Phase; targetProgress: number; subtitle: string;
  sound: boolean; error: string | null; replay: number; started: boolean;
  ready: () => void; finishAwakening: () => void; move: (amount: number) => void;
  arrive: () => void; inspect: () => void; restart: () => void;
  say: (text: string) => void; toggleSound: () => void;
};
export const useSceneState = create<ExperienceState>((set, get) => ({
  chapter:'BOOT',phase:'loading',targetProgress:0,subtitle:'',sound:false,error:null,replay:0,started:false,
  ready:()=>set({chapter:'AWAKE',phase:'awakening',started:true}),
  finishAwakening:()=>{if(get().phase==='awakening')set({phase:'approaching',subtitle:'Baymax…?'});},
  move:(amount)=>{if(get().phase==='approaching')set({targetProgress:Math.max(0,Math.min(1,get().targetProgress+amount))});},
  arrive:()=>{if(get().phase==='approaching')set({chapter:'THE_SHELL',phase:'discovery',subtitle:'It’s me. Hiro.'});},
  inspect:()=>{if(get().phase==='discovery')set({phase:'inspected',subtitle:'Come on, buddy. Say something.'});},
  restart:()=>set({chapter:'AWAKE',phase:'awakening',targetProgress:0,subtitle:'',replay:get().replay+1}),
  say:(subtitle)=>set({subtitle}),toggleSound:()=>set({sound:!get().sound}),
}));

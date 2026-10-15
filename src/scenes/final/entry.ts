import { create } from 'zustand';

export type FinalStage = 'MAX_ATTACK' | 'VECTOR_CAPTURE' | 'EXIT_VECTOR' | 'PORTAL_RECONSTRUCTION' | 'FINAL_ESCAPE' | 'HOME' | 'EPILOGUE' | 'FINAL_BLACK';
type FinalEntry = { active:boolean; initialStage:FinalStage; run:number };
export const useFinalEntry = create<FinalEntry>(()=>({active:false,initialStage:'MAX_ATTACK',run:0}));

// Task 15 imports this one function when its decoy and three anchors are ready.
export function enterFinalPhase(){ useFinalEntry.setState(s=>({active:true,initialStage:'MAX_ATTACK',run:s.run+1})); }

export function getDebugFinalStage(hash:string):FinalStage|null {
  if(!import.meta.env.DEV)return null;
  const match=/^#final(?:\/([A-Z_]+))?$/.exec(hash);
  if(!match)return null;
  const stages:FinalStage[]=['MAX_ATTACK','VECTOR_CAPTURE','EXIT_VECTOR','PORTAL_RECONSTRUCTION','FINAL_ESCAPE','HOME','EPILOGUE','FINAL_BLACK'];
  return stages.includes(match[1] as FinalStage)?match[1] as FinalStage:'MAX_ATTACK';
}

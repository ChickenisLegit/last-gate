import type { FinalStage } from './entry';

export const FINAL_DURATIONS:Partial<Record<FinalStage,number>>={MAX_ATTACK:29,VECTOR_CAPTURE:12,PORTAL_RECONSTRUCTION:18,FINAL_ESCAPE:23,HOME:12,EPILOGUE:13};
export const FINAL_NEXT:Partial<Record<FinalStage,FinalStage>>={MAX_ATTACK:'VECTOR_CAPTURE',VECTOR_CAPTURE:'EXIT_VECTOR',EXIT_VECTOR:'PORTAL_RECONSTRUCTION',PORTAL_RECONSTRUCTION:'FINAL_ESCAPE',FINAL_ESCAPE:'HOME',HOME:'EPILOGUE',EPILOGUE:'FINAL_BLACK'};
export type FinalBeat = {at:number; id:string; text?:string; small?:string};
export const FINAL_BEATS:Partial<Record<FinalStage,FinalBeat[]>>={
 MAX_ATTACK:[
  {at:0,id:'quiet'}, {at:8,id:'target',text:'TARGET ACQUIRED'},
  {at:13,id:'charge'}, {at:20,id:'attack'}, {at:22,id:'silence'}, {at:25,id:'trace',text:'AFTERIMAGE // RECORDING'}
 ],
 VECTOR_CAPTURE:[
  {at:1.5,id:'captured',text:'VECTOR 04 // CAPTURED'},
  {at:5,id:'model',text:'DIMENSION MODEL // 100%'},
  {at:8.5,id:'home-found',text:'HOME COORDINATES FOUND'}
 ],
 EXIT_VECTOR:[{at:0,id:'alignment',text:'ALIGN ATTACK VECTORS',small:'DRAG EACH VECTOR ENDPOINT TOWARD THE COMMON POINT'}],
 PORTAL_RECONSTRUCTION:[{at:0,id:'point'}, {at:5,id:'seam'}, {at:10,id:'home-glimpse',text:'HOME ROUTE // STABLE'}],
 FINAL_ESCAPE:[{at:0,id:'escape'}, {at:2,id:'baymax-recover'}, {at:5,id:'conflict'}, {at:10,id:'sacrifice'}, {at:13,id:'run'}, {at:18,id:'near-catch'}, {at:20.5,id:'crossing'}],
 HOME:[{at:0,id:'home'}, {at:7,id:'stillness'}],
 EPILOGUE:[{at:2,id:'unknown',text:'UNKNOWN VECTOR DETECTED'}, {at:7,id:'lost',text:'CONNECTION LOST'}, {at:10,id:'clear'}],
 FINAL_BLACK:[{at:1.8,id:'brand',text:'LAST GATE'}]
};
export const ease=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t)};
export const clamp=(x:number,a=0,b=1)=>Math.max(a,Math.min(b,x));

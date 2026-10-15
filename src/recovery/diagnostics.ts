import { create } from 'zustand';
export const SYSTEMS = [
  {id:'core',name:'Program core',short:'CORE',position:[.15,2.05,.3]},
  {id:'power',name:'Power distribution',short:'POWER',position:[0,1.25,0]},
  {id:'left',name:'Left thruster',short:'L / THRUST',position:[-.62,1.65,-.7]},
  {id:'right',name:'Right thruster',short:'R / THRUST',position:[.62,1.65,-.7]},
  {id:'motor',name:'Motor control',short:'MOTOR',position:[0,.5,.2]},
  {id:'arm',name:'Arm / actuator',short:'ACTUATOR',position:[-1.15,1.6,.15]},
  {id:'armour',name:'Armour connections',short:'ARMOUR',position:[.95,2.3,0]},
  {id:'sensor',name:'Sensor / targeting',short:'SENSORS',position:[0,2.98,.3]},
] as const;
export type SystemId = typeof SYSTEMS[number]['id'];
export type ViewMode = 'exterior' | 'internal' | 'isolate';
type Diagnostics = {
 selected:SystemId|null; mode:ViewMode; tested:SystemId[]; bayOpen:boolean;
 isolated:boolean; route:'original'|'bypass'; connectorAngle:number; connectorDepth:number; thrusterFixed:boolean;
 neutral:number; actuatorFixed:boolean; notice:string; log:string[];
 select:(id:SystemId)=>void; setMode:(mode:ViewMode)=>void; probe:()=>void;
 isolate:(value:boolean)=>void; reroute:(route:'original'|'bypass')=>void;
 rotateConnector:(angle:number)=>void; insertConnector:(depth:number)=>void;
 setNeutral:(angle:number)=>void; calibrate:()=>void;
};
const record=(log:string[],line:string)=>[line,...log].slice(0,5);
export const useDiagnostics=create<Diagnostics>((set,get)=>({
 selected:null,mode:'exterior',tested:[],bayOpen:false,isolated:false,route:'original',connectorAngle:0,connectorDepth:0,thrusterFixed:false,neutral:-24,actuatorFixed:false,notice:'',log:['Service session opened. Actuation inhibited.'],
 select:selected=>set({selected,notice:''}),setMode:mode=>set({mode}),
 probe:()=>{const s=get(),id=s.selected;if(!id)return;set({tested:s.tested.includes(id)?s.tested:[...s.tested,id],bayOpen:s.bayOpen||id==='core',mode:['core','power','arm'].includes(id)?'internal':s.mode,notice:'',log:record(s.log,id==='core'?'Program bay opened. Healthcare socket is empty.':`${SYSTEMS.find(x=>x.id===id)!.name}: test recorded.`)});},
 isolate:isolated=>{if(!get().tested.includes('power'))return;set(s=>({isolated,route:isolated?s.route:'original',log:record(s.log,isolated?'Damaged power branch isolated.':'Original branch restored; bypass released.')}));},
 reroute:route=>{const s=get();if(!s.tested.includes('power')||!s.isolated){set({notice:'Isolate the damaged branch before routing power.'});return;}set({route,notice:'',log:record(s.log,route==='bypass'?'Power routed through auxiliary rail B. Bus stable.':'Bypass disconnected. Power remains degraded.')});},
 rotateConnector:connectorAngle=>{if(get().thrusterFixed)return;set({connectorAngle,connectorDepth:0,notice:''});},
 insertConnector:connectorDepth=>{const s=get();if(!s.tested.includes('left')||s.thrusterFixed)return;const fixed=s.connectorAngle===90&&connectorDepth>=96;set({connectorDepth:s.connectorAngle===90?connectorDepth:Math.min(35,connectorDepth),thrusterFixed:fixed,notice:s.connectorAngle!==90?'Key mismatch. Rotate the plug to match the vertical socket.':'',log:fixed?record(s.log,'Left thruster control line seated. Limited thrust available.'):s.log});},
 setNeutral:neutral=>{if(!get().actuatorFixed)set({neutral,notice:''});},
 calibrate:()=>{const s=get();if(!s.tested.includes('arm')||s.route!=='bypass'){set({notice:'Measure the actuator and stabilize the power bus first.'});return;}if(Math.abs(s.neutral-12)>2){set({notice:'Neutral is outside tolerance. Align the reference marks to 12° ± 2°.'});return;}set({actuatorFixed:true,notice:'Neutral reference stored. Motion remains limited by damaged leg assemblies.',log:record(s.log,'Arm actuator neutral calibrated. Partial movement restored.')});},
}));
export const isComplete=(s:Diagnostics)=>SYSTEMS.every(x=>s.tested.includes(x.id))&&s.route==='bypass'&&s.thrusterFixed&&s.actuatorFixed;
export function reading(id:SystemId,s:Diagnostics):{status:string;facts:[string,string][];detail:string}{
 switch(id){
 case 'core':return{status:'INCOMPLETE',facts:[['Healthcare chip','NOT PRESENT'],['Combat program','ACTIVE'],['Direct control','UNAVAILABLE']],detail:'The healthcare socket is physically empty. Software cannot replace the missing chip. The combat program is still active; physical repairs cannot make Baymax safe.'};
 case 'power':return{status:s.route==='bypass'?'STABLE':'DEGRADED',facts:[['Power core','FUNCTIONAL / 62% output'],['Primary connection','DAMAGED'],['Supply route',s.route==='bypass'?'AUXILIARY RAIL B':'PRIMARY RAIL A']],detail:'The core is working. An impact damaged the distribution connection. Isolate that branch and use the intact auxiliary rail.'};
 case 'left':return{status:s.thrusterFixed?'LIMITED':'OFFLINE',facts:[['Control line',s.thrusterFixed?'CONNECTED':'DISCONNECTED'],['Connector key','VERTICAL / 90°'],['Thrust envelope','LIMITED / no flight clearance']],detail:'The control plug has pulled free. Match its key to the vertical socket, then slide it fully into the carrier. The damaged assembly cannot support full flight.'};
 case 'right':return{status:s.route==='bypass'?'LIMITED':'UNSTABLE',facts:[['Control bus','RESPONDING'],['Nozzle housing','CRACKED'],['Full output','UNAVAILABLE']],detail:'Stable supply reduces oscillation, but the cracked housing prevents normal output. This cannot be fully repaired with the parts available here.'};
 case 'motor':return{status:s.actuatorFixed?'PARTIAL':'DEGRADED',facts:[['Leg assemblies','IMPACT DAMAGE'],['Motion envelope',s.actuatorFixed?'ASSISTED / LIMITED':'INHIBITED'],['Full mobility','UNAVAILABLE']],detail:'Motor controllers respond, but the damaged leg assemblies cannot support normal mobility. Calibrating the arm actuator restores only a limited movement envelope.'};
 case 'arm':return{status:s.actuatorFixed?'CALIBRATED':'MISALIGNED',facts:[['Neutral reference','12° ± 2°'],['Measured offset',`${s.neutral}°`],['Actuation','INHIBITED DURING SERVICE']],detail:'The arm encoder has lost its neutral reference. Align the mechanical witness mark with the 12° reference and store that position. This is calibration, not permission to move.'};
 case 'armour':return{status:'DAMAGED / RETAINED',facts:[['Shoulder mounts','SECURED'],['Outer plating','IMPACT SCORED'],['Replacement parts','UNAVAILABLE']],detail:'The remaining mounts retain the plates. Scored armour and damaged leg parts need replacement later; they cannot be made new by resetting a control.'};
 case 'sensor':return{status:'ACTIVE',facts:[['Optical sensors','RESPONDING'],['Targeting bus','ACTIVE'],['Healthcare supervision','ABSENT']],detail:'The targeting bus is still live. A functioning sensor system does not establish that Baymax is safe or that Hiro has direct control.'};
 }
}

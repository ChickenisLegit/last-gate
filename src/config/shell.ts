import type { Phase } from '../state/SceneStateManager';
export const SHELL_DURATIONS:Partial<Record<Phase,number>> = {
  inspected:3.2,'chip-reaching':3.2,'panel-opening':3.8,inserting:3.4,sealing:2.4,
  silence:4.8,booting:6.8,diagnostic:5.6,threat:4.8
};
export const SHELL_ACTIONS:Partial<Record<Phase,{label:string;description:string}>> = {
  discovery:{label:'Baymax…?',description:'Check Baymax for a response'},
  'chip-focus':{label:'Reach for the chip',description:'Reach for the fallen red chip'},
  'chip-held':{label:'Release the latch',description:'Open Baymax’s chest access panel'},
  'socket-ready':{label:'Insert the chip',description:'Press the chip into the keyed socket'}
};

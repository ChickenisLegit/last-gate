import assert from 'node:assert/strict';
import {useDiagnostics as store,SYSTEMS,reading,isComplete} from './src/recovery/diagnostics.ts';
const get=()=>store.getState();
get().select('power');get().probe();get().reroute('bypass');assert.equal(get().route,'original');
get().isolate(true);get().reroute('bypass');assert.equal(reading('power',get()).status,'STABLE');
get().select('left');get().probe();get().insertConnector(100);assert.equal(get().thrusterFixed,false);assert.equal(get().connectorDepth,35);
get().rotateConnector(90);get().insertConnector(100);assert.equal(get().thrusterFixed,true);
get().select('arm');get().probe();get().calibrate();assert.equal(get().actuatorFixed,false);
get().setNeutral(12);get().calibrate();assert.equal(get().actuatorFixed,true);assert.equal(isComplete(get()),false);
for(const s of SYSTEMS){get().select(s.id);get().probe();}
assert.equal(isComplete(get()),true);assert.equal(get().bayOpen,true);
assert.deepEqual(reading('core',get()).facts,[['Healthcare chip','NOT PRESENT'],['Combat program','ACTIVE'],['Direct control','UNAVAILABLE']]);
get().isolate(false);assert.equal(isComplete(get()),false);assert.equal(get().route,'original');
console.log('PASS: invalid repairs blocked; three constrained repairs; all-system investigation; missing chip and unavailable control stay unchanged.');

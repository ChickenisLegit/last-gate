import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { districtExit } from './exit';
import { DistrictWorld, DISTRICT_PART_NAMES, type DistrictStage, type PartId } from './DistrictWorld';
import './district.css';

type LocationId = 'archive' | 'actuator' | 'isolation' | 'thruster';
type PartDetails = { condition: string; purpose: string; connections: string };
const LOCATIONS: { id: LocationId; number: string; name: string; note: string; landmark: string }[] = [
  { id: 'archive', number: '01', name: 'SERVICE ARCHIVE', note: 'The cabinet is jammed beneath a fallen ceiling brace. A manual is visible behind its cracked glass.', landmark: 'RECORDS COUNTER · BAY 6' },
  { id: 'actuator', number: '02', name: 'ACTUATOR TEST STAND', note: 'A bench-mounted motor governor remains bolted to a test fixture. Its casing is bruised, but the spindle turns.', landmark: 'LOAD TEST RAIL · BAY 6' },
  { id: 'isolation', number: '03', name: 'LOAD ISOLATION CABINET', note: 'The high-current relay has been pulled from its panel. Two load lugs and the ceramic body are still intact.', landmark: 'NORTH WALL · BAY 6' },
  { id: 'thruster', number: '04', name: 'THRUSTER TEST CRADLE', note: 'A field clamp is trapped in the cradle’s manual release. Its bracket is pitted; the cable contacts are usable.', landmark: 'REAR SERVICE APRON · BAY 6' },
];
const PART_DETAILS: Record<PartId, PartDetails> = {
  relay: { condition: 'Worn housing; both load lugs remain sound.', purpose: 'Gives Hiro a physical, local disconnect for the high-current feed.', connections: 'Source feed IN → governor feed OUT.' },
  governor: { condition: 'Cracked isolation cover; regulator spindle still moves.', purpose: 'Reduces actuator current instead of attempting to alter Baymax’s combat chip.', connections: 'Relay load OUT → motor feed IN.' },
  clamp: { condition: 'Pitted frame; contact faces and mounting bracket are intact.', purpose: 'Restricts the separate thruster branch so lift cannot bypass the motor limit.', connections: 'Governor branch → thruster feed clamp.' },
};
const PARTS: PartId[] = ['relay', 'governor', 'clamp'];
const EMPTY: Record<PartId, boolean> = { relay: false, governor: false, clamp: false };

function LocationCard({ location, active, visited, onClick }: {
  location: typeof LOCATIONS[number]; active: boolean; visited: boolean; onClick: () => void;
}) {
  return <button className={`district-location ${active ? 'selected' : ''}`} onClick={onClick} aria-pressed={active}>
    <span className="district-location-index">{location.number}</span>
    <span className="district-location-copy"><b>{location.name}</b><small>{location.landmark}</small></span>
    <i aria-label={visited ? 'Investigated' : 'Not yet investigated'}>{visited ? 'LOGGED' : '· · ·'}</i>
  </button>;
}

export function DistrictExperience() {
  const [stage, setStage] = useState<DistrictStage>('district');
  const [location, setLocation] = useState<LocationId>('archive');
  const [visited, setVisited] = useState<Partial<Record<LocationId, boolean>>>({});
  const [manualRead, setManualRead] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [found, setFound] = useState(EMPTY);
  const [inspected, setInspected] = useState(EMPTY);
  const [selectedPart, setSelectedPart] = useState<PartId | null>(null);
  const [placed, setPlaced] = useState(EMPTY);
  const [aligned, setAligned] = useState(EMPTY);
  const [routes, setRoutes] = useState<[boolean, boolean]>([false, false]);
  const [output, setOutput] = useState(50);
  const [armedAt, setArmedAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(45);
  const [expired, setExpired] = useState(false);
  const allPartsInspected = PARTS.every(part => found[part] && inspected[part]);
  const allPlaced = PARTS.every(part => placed[part]);
  const allAligned = PARTS.every(part => aligned[part]);
  const readyToBuild = manualRead && allPartsInspected;
  const selectedLocation = LOCATIONS.find(site => site.id === location)!;
  useEffect(() => { if (stage === 'calibration') void districtExit()?.prepare?.().catch(() => {}); }, [stage]);

  useEffect(() => {
    if (armedAt === null) return;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((armedAt + 45_000 - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) setExpired(true);
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [armedAt]);

  const inspectFoundPart = (part: PartId) => setSelectedPart(part);
  const recoverPart = (part: PartId) => {
    setFound(state => ({ ...state, [part]: true }));
    setVisited(state => ({ ...state, [location]: true }));
    setSelectedPart(part);
  };
  const finishInspection = () => {
    if (!selectedPart) return;
    setInspected(state => ({ ...state, [selectedPart]: true }));
    setSelectedPart(null);
  };
  const placePart = (part: PartId) => setPlaced(state => ({ ...state, [part]: true }));
  const alignPart = (part: PartId) => setAligned(state => ({ ...state, [part]: true }));
  const routePower = (index: 0 | 1) => setRoutes(current => {
    const next: [boolean, boolean] = [...current];
    next[index] = true;
    return next;
  });
  const resetDistrict = () => {
    setStage('district'); setLocation('archive'); setVisited({}); setManualRead(false);
    setFound(EMPTY); setInspected(EMPTY); setSelectedPart(null); setPlaced(EMPTY); setAligned(EMPTY);
    setRoutes([false, false]); setOutput(50); setArmedAt(null); setRemaining(45); setExpired(false);
  };
  const clock = `00:${String(remaining).padStart(2, '0')}`;

  return <main className={`district-phase district-stage-${stage}`} aria-label="Phase 4: district search and power limiter">
    <div className="district-world"><DistrictWorld stage={stage} location={location} selectedPart={selectedPart} placed={placed} aligned={aligned} routes={routes} /></div>
    <header className="district-header">
      <div className="district-brand"><span>THE LAST GATE</span><small>PHASE 04 <b>·</b> NORTH SERVICE DISTRICT</small></div>
      <div className="district-header-center"><span>LOCATION <b>{stage === 'district' ? 'SAN FRANSOKYO · BAY 6' : 'ROBOTICS MAINTENANCE · BAY 6'}</b></span><span>OBJECTIVE <b>{stage === 'district' ? 'REDUCE OUTPUT. BUY TIME.' : stage === 'assembly' || stage === 'calibration' ? 'BUILD A LOCAL HARDWARE LIMIT.' : 'TEMPORARY OUTPUT LIMIT'}</b></span></div>
      <button className="district-restart" onClick={resetDistrict}>RESTART CHAPTER <span>↺</span></button>
    </header>

    {stage === 'district' && <div className="district-exploration">
      <aside className="district-panel district-site-list">
        <div className="district-kicker">INVESTIGATE LOCATIONS <span>01—04</span></div>
        <h1>The trail ends here.<br /><em>Bay 6 is still running.</em></h1>
        <p className="district-lead">Three blocks east of the fracture, a maintenance yard is still drawing service current. Hiro follows the evidence: archive, test stand, isolation cabinet, thruster cradle.</p>
        <nav className="district-locations" aria-label="Bay 6 investigation locations">
          {LOCATIONS.map(site => <LocationCard key={site.id} location={site} active={site.id === location} visited={!!visited[site.id]} onClick={() => { setLocation(site.id); setSelectedPart(null); }} />)}
        </nav>
        <div className="district-checklist"><span>ENGINEERING ROUTE</span><b className={manualRead ? 'complete' : ''}>{manualRead ? '01' : '00'} / 01 <i>· SERVICE MANUAL</i></b><b className={allPartsInspected ? 'complete' : ''}>{PARTS.filter(part => inspected[part]).length} / 03 <i>· COMPONENTS INSPECTED</i></b></div>
        {readyToBuild && <button className="district-primary district-begin-build" onClick={() => { setStage('assembly'); setLocation('archive'); }}><span>OPEN THE BUILD WORKSPACE</span><i>→</i></button>}
      </aside>

      <section className="district-panel district-site-detail" aria-live="polite">
        {selectedPart ? <div className="district-inspector">
          <button className="district-back" onClick={() => setSelectedPart(null)}>← LOCATION NOTES</button>
          <div className="district-kicker">PART INSPECTION <span>DRAG TO ROTATE</span></div>
          <h2>{DISTRICT_PART_NAMES[selectedPart]}</h2>
          <dl className="district-part-facts"><div><dt>CONDITION</dt><dd>{PART_DETAILS[selectedPart].condition}</dd></div><div><dt>PURPOSE</dt><dd>{PART_DETAILS[selectedPart].purpose}</dd></div><div><dt>USABLE CONNECTION</dt><dd>{PART_DETAILS[selectedPart].connections}</dd></div></dl>
          <button className="district-primary" onClick={finishInspection}><span>{inspected[selectedPart] ? 'CLOSE INSPECTION' : 'MARK INSPECTION COMPLETE'}</span><i>↗</i></button>
        </div> : <>
          <div className="district-kicker">FIELD NOTE <span>{selectedLocation.number} / 04</span></div>
          <div className="district-landmark">{selectedLocation.landmark}</div>
          <h2>{selectedLocation.name}</h2>
          <p>{selectedLocation.note}</p>
          {location === 'archive' ? <>
            <div className="district-object-card"><span className="district-object-icon">▤</span><div><b>MAINTENANCE / SERVICE LOG</b><small>{manualRead ? 'RECOVERED · REVIEWED' : 'DAMAGED COPY · READABLE PAGES'}</small></div></div>
            <button className="district-primary" onClick={() => { setVisited(state => ({ ...state, archive: true })); setStage('district'); setSelectedPart(null); setManualOpen(true); }}><span>{manualRead ? 'REOPEN SERVICE MANUAL' : 'RECOVER SERVICE MANUAL'}</span><i>↗</i></button>
          </> : <>
            <div className="district-object-card"><span className="district-object-icon">{location === 'actuator' ? '◉' : location === 'isolation' ? '⌑' : '⊙'}</span><div><b>{DISTRICT_PART_NAMES[location === 'actuator' ? 'governor' : location === 'isolation' ? 'relay' : 'clamp']}</b><small>{found[location === 'actuator' ? 'governor' : location === 'isolation' ? 'relay' : 'clamp'] ? 'RECOVERED · READY FOR INSPECTION' : 'ONE USABLE UNIT LOCATED'}</small></div></div>
            <button className="district-primary" onClick={() => {
              const part: PartId = location === 'actuator' ? 'governor' : location === 'isolation' ? 'relay' : 'clamp';
              if (found[part]) inspectFoundPart(part); else recoverPart(part);
            }}><span>{found[location === 'actuator' ? 'governor' : location === 'isolation' ? 'relay' : 'clamp'] ? 'INSPECT COMPONENT' : 'RECOVER COMPONENT'}</span><i>↗</i></button>
          </>}
          {PARTS.some(part => found[part]) && <div className="district-inventory"><div className="district-kicker">RECOVERED HARDWARE</div>{PARTS.filter(part => found[part]).map(part => <button key={part} onClick={() => inspectFoundPart(part)}><span className={inspected[part] ? 'inventory-dot inspected' : 'inventory-dot'} />{DISTRICT_PART_NAMES[part]}<i>{inspected[part] ? 'INSPECTED' : 'INSPECT →'}</i></button>)}</div>}
          <div className="district-limit-note"><span>CONSTRAINT</span><p>No combat-chip rewrite. No remote command. A local governor can only limit the physical feed while its temporary latch holds.</p></div>
        </>}
      </section>

      <div className="district-coordinate" aria-hidden="true"><span>{selectedLocation.number} // {selectedLocation.landmark}</span><i>BLOCK 06 · SERVICE DISTRICT</i></div>
      <div className="district-reticle" aria-hidden="true" />
    </div>}

    {stage === 'assembly' && <section className="district-workspace">
      <aside className="district-panel workspace-inventory">
        <div className="district-kicker">WORKSPACE / COMPONENTS <span>{PARTS.filter(part => placed[part]).length} OF 03 PLACED</span></div>
        <h1>Make the machine<br /><em>give him a minute.</em></h1>
        <p className="district-lead">The manual gives him a narrow route, not a miracle. Seat each recovered part on the service rail, then align the contacts that carry motor and thruster current.</p>
        <div className="workspace-parts">{PARTS.map((part, index) => <article className="workspace-part" key={part}>
          <span className={`workspace-part-index ${aligned[part] ? 'done' : ''}`}>0{index + 1}</span><div className="workspace-part-data"><b>{DISTRICT_PART_NAMES[part]}</b><small>{placed[part] ? aligned[part] ? 'SEATED · CONTACT ALIGNED' : 'SEATED · ALIGN CONNECTOR' : 'IN INVENTORY · NOT SEATED'}</small></div>
          {!placed[part] ? <button onClick={() => placePart(part)}>PLACE</button> : !aligned[part] ? <button onClick={() => alignPart(part)}>ALIGN</button> : <span className="workspace-confirm">LOCKED</span>}
        </article>)}</div>
        <div className="workspace-instruction"><span>ASSEMBLY ORDER</span><b>RELAY <i>→</i> GOVERNOR <i>→</i> FIELD CLAMP</b></div>
      </aside>

      <div className="workbench-label"><span>BENCH 02 / ACTUATOR REGULATION</span><b>PHYSICAL CONNECTIONS</b></div>
      <aside className="district-panel workspace-power">
        <div className="district-kicker">POWER PATH <span>{routes.filter(Boolean).length} / 02</span></div>
        <h2>Route the feed.</h2>
        <p>Each connection is a separate physical circuit. Verify the seated parts before routing current.</p>
        <div className="power-route"><i className={routes[0] ? 'power-state live' : 'power-state'}>01</i><div><b>RELAY OUT → GOVERNOR IN</b><small>HIGH-CURRENT MOTOR FEED</small></div></div>
        <button className="power-connect" disabled={!allAligned || routes[0]} onClick={() => routePower(0)}>{routes[0] ? 'CONNECTED' : allAligned ? 'CONNECT POWER RUN 01' : 'ALIGN ALL CONNECTORS FIRST'}</button>
        <div className="power-route"><i className={routes[1] ? 'power-state live' : 'power-state'}>02</i><div><b>GOVERNOR → FIELD CLAMP</b><small>THRUSTER BRANCH LIMIT</small></div></div>
        <button className="power-connect" disabled={!routes[0] || routes[1]} onClick={() => routePower(1)}>{routes[1] ? 'CONNECTED' : routes[0] ? 'CONNECT POWER RUN 02' : 'WAITING FOR RUN 01'}</button>
        <div className="power-status"><span className={allPlaced ? 'power-dot ready' : 'power-dot'} />{allPlaced ? allAligned ? routes.every(Boolean) ? 'CIRCUIT READY FOR CALIBRATION' : 'CONNECTORS ALIGNED' : 'ALIGN EACH SEATED CONNECTOR' : 'PLACE ALL THREE COMPONENTS'}</div>
        {routes.every(Boolean) && <button className="district-primary workspace-next" onClick={() => setStage('calibration')}><span>CALIBRATE OUTPUT</span><i>→</i></button>}
      </aside>
      <div className="workbench-legend"><span><i className="legend-source" />SOURCE</span><span><i className="legend-regulator" />MOTOR REGULATION</span><span><i className="legend-load" />THRUSTER BRANCH</span></div>
    </section>}

    {stage === 'calibration' && <section className="district-calibration">
      <div className="district-panel calibration-panel"><div className="district-kicker">BENCH 02 / CALIBRATION <span>OUTPUT GOVERNOR</span></div><h1>Reduce the output.<br /><em>Leave the rest alone.</em></h1><p>Set the service governor to 35%. The relay and field clamp keep the motor and thruster feeds on one local, temporary limit.</p>
        <div className="calibration-readout"><span>LIMITED OUTPUT</span><b>{output}<small>%</small></b><i style={{ '--output': `${output}%` } as CSSProperties} /></div>
        <label className="calibration-slider">REGULATOR SETTING<input aria-label="Regulator output percentage" type="range" min="20" max="60" value={output} onChange={event => setOutput(Number(event.target.value))} /><span><i>20%</i><i>60%</i></span></label>
        <div className="calibration-target"><span>FIELD NOTE</span><b>Set point: 35% <i>·</i> temporary hardware limit</b></div>
        <button className="district-primary calibration-confirm" disabled={output !== 35} onClick={() => { setStage('result'); setArmedAt(Date.now()); }}><span>{output === 35 ? 'ARM TEMPORARY LIMIT' : 'CALIBRATE TO 35%'}</span><i>↗</i></button>
        <small className="calibration-warning">This limits motor and thruster output. It does not make Baymax friendly, control him, or repair him.</small>
      </div>
      <div className="calibration-badge"><span>ACTUATOR FEED</span><b>35%</b><i>SET POINT</i></div>
    </section>}

    {stage === 'result' && <section className="district-result" aria-live="polite">
      <div className="district-panel result-panel"><div className="district-kicker">PHASE 04 COMPLETE / BAY 6 <span>{expired ? 'LATCH WINDOW ENDED' : 'HARDWARE LIMIT ACTIVE'}</span></div><h1>{expired ? 'The circuit held.' : 'A minute is enough.'}<br /><em>{expired ? 'Now Hiro knows the cost.' : 'Now Hiro can move.'}</em></h1>
        <div className="output-comparison"><div><span>NORMAL OUTPUT</span><b>100<small>%</small></b></div><i aria-hidden="true">→</i><div className="output-limited"><span>{expired ? 'WINDOW ENDED' : 'LIMITED OUTPUT'}</span><b>{expired ? '—' : '35'}<small>{expired ? '' : '%'}</small></b></div></div>
        <div className={`safe-window ${expired ? 'expired' : ''}`}><span className="safe-window-dot" /><div><b>{expired ? 'SAFE WINDOW ENDED' : 'SAFE WINDOW · TEMPORARY'}</b><small>{expired ? 'The limiter needs a manual reset. Output is no longer verified.' : 'LOCAL HARDWARE LIMIT · NO REMOTE CONTROL'}</small></div><strong>{expired ? 'END' : clock}</strong></div>
        <p className="result-explanation">The governor is doing exactly what the service manual promised: reducing motor and thruster output while the latch holds. The combat chip is untouched. Baymax’s behavior is unchanged. Hiro did not take control—he made room to act.</p>
        <div className="result-actions"><button className="district-primary" onClick={resetDistrict}><span>REPLAY DISTRICT SEARCH</span><i>↺</i></button>{districtExit() && <button className="district-primary" onClick={districtExit()!.go}><span>{districtExit()!.label}</span><i>→</i></button>}</div>
      </div>
      <div className="result-readout"><span>HARDWARE OUTPUT LIMIT</span><b>{expired ? 'INACTIVE' : '35%'}</b><i>ACTUATORS + THRUSTERS</i></div>
    </section>}

    {stage === 'district' && <div className="district-footer"><span>BAY 6 / ROBOTICS MAINTENANCE</span><span>LOCAL HARDWARE LIMIT <i>·</i> COMBAT PROGRAM UNCHANGED</span></div>}

    {manualOpen && <ManualDialog onClose={() => { setManualOpen(false); setManualRead(true); }} />}
  </main>;
}

function ManualDialog({ onClose }: { onClose: () => void }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.querySelector('button')?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); onClose(); } if (e.key === 'Tab') { e.preventDefault(); panel.current?.querySelector('button')?.focus(); } };
    window.addEventListener('keydown', key); return () => { window.removeEventListener('keydown', key); previous?.focus(); };
  }, [onClose]);
  return <div className="manual-scrim" role="presentation"><section ref={panel} className="manual-dialog" role="dialog" aria-modal="true" aria-labelledby="manual-heading">
    <div className="district-kicker">BAYMAX / SERVICE MANUAL <span>RECOVERED COPY · PAGE 06</span></div>
    <div className="manual-heading-row"><span className="manual-symbol">B</span><div><h2 id="manual-heading">Emergency output regulation</h2><p>PHYSICAL SERVICE POWER GOVERNOR · ACTUATOR SYSTEMS</p></div></div>
    <p className="manual-intro">Emergency actuator output limiting is possible without altering the combat chip. Isolate the high-current source, use the service power governor for emergency motor regulation, then restrict the separate thruster branch with the field clamp.</p>
    <ol className="manual-systems"><li><b>01 / HIGH-CURRENT RELAY</b><span>Interrupts and isolates the main supply during service.</span></li><li><b>02 / MOTOR GOVERNOR</b><span>Emergency motor regulation limits actuator output at the physical feed.</span></li><li><b>03 / FIELD CLAMP</b><span>Thruster restriction prevents lift from bypassing the motor limit.</span></li></ol>
    <div className="manual-flow"><span>POWER SOURCE</span><i>→</i><span>RELAY</span><i>→</i><span>GOVERNOR</span><i>→</i><span>MOTOR + THRUSTER BRANCH</span></div>
    <div className="manual-foot"><span>NOTE: SERVICE LIMIT IS TEMPORARY. BEHAVIORAL SYSTEMS ARE NOT AFFECTED.</span><button className="district-primary" onClick={onClose}><span>LOG ENGINEERING ROUTE</span><i>↗</i></button></div>
  </section></div>;
}

import { useEffect, useRef, useState } from 'react';
import { districtExit } from './exit';
import { DistrictWorld, type DistrictStage } from './DistrictWorld';
import './district.css';

const PAGES = [
  { title: 'FIELD INVENTIONS', subtitle: 'A SERVICE NOTEBOOK FROM BAY 6', copy: 'District records mention a current limiter in a locked service case. Search the Bay 6 inventory notes for its location.', diagram: 'BOOK CLUE  →  BAY 6  →  CASE 04', action: 'SEARCH THE DISTRICT' },
  { title: 'BAY 6 SERVICE RECORD', subtitle: 'MATCH FOUND · CASE 04', copy: 'The service case is concealed behind the damaged inspection cart near Bench 02. Follow the marked route into the service bay.', diagram: 'INSPECTION CART  /  CASE 04', action: 'WALK TO BAY 6' },
];

export function DistrictExperience() {
  const [stage, setStage] = useState<DistrictStage>('district');
  const [bookPage, setBookPage] = useState(0);
  const [inspected, setInspected] = useState(false);
  const [discoveryStep, setDiscoveryStep] = useState<'closed' | 'open' | 'removed'>('closed');
  const [walkStep, setWalkStep] = useState(0);
  const walkStepRef = useRef(0);
  const inputLockUntil = useRef(0);
  const reset = () => { walkStepRef.current = 0; inputLockUntil.current = 0; setStage('district'); setBookPage(0); setInspected(false); setDiscoveryStep('closed'); setWalkStep(0); };
  const handleDiscoveryStep = (step: 'closed' | 'open' | 'removed') => { setDiscoveryStep(step); if (step === 'removed') setStage('result'); };
  const beginWalk = () => { walkStepRef.current = 0; inputLockUntil.current = 0; setWalkStep(0); setStage('roam'); };
  useEffect(() => {
    if (stage !== 'book' || bookPage !== PAGES.length - 1) return;
    const timer = window.setTimeout(beginWalk, 700);
    return () => window.clearTimeout(timer);
  }, [stage, bookPage]);
  const advanceWalk = (delta: number) => {
    if (stage !== 'roam') return;
    const now = performance.now();
    if (now < inputLockUntil.current) return;
    inputLockUntil.current = now + 520;
    const next = Math.max(0, Math.min(3, walkStepRef.current + delta));
    if (next === walkStepRef.current) return;
    walkStepRef.current = next;
    setWalkStep(next);
    if (next >= 3) setStage('discovery');
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (stage === 'roam' && (event.key === 'w' || event.key === 'W')) { event.preventDefault(); advanceWalk(1); } };
    const onWheel = (event: WheelEvent) => { if (stage === 'roam') { event.preventDefault(); advanceWalk(event.deltaY > 0 ? 1 : -1); } };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('wheel', onWheel, { passive: false });
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('wheel', onWheel); };
  }, [stage]);
  const worldStage: DistrictStage = stage === 'book' || stage === 'inspect' ? 'district' : stage;
  const objective = stage === 'district' ? 'SEARCH DISTRICT RECORDS' : stage === 'book' ? 'LOCATE BAY 6 CASE' : stage === 'roam' ? (walkStep < 3 ? 'WALK · W / SCROLL' : 'SERVICE BAY REACHED') : stage === 'inspect' ? 'INSPECT THE SERVICE CASE' : 'RECOVER THE LIMITER';
  return <main className={`district-phase district-${stage}`} aria-label="Phase 4: Bay 6 case discovery">
    <div className="district-world"><DistrictWorld stage={worldStage} location="archive" discoveryStep={discoveryStep} walkStep={walkStep} onDiscoveryStep={handleDiscoveryStep} /></div>
    <header className="district-header"><div className="district-brand"><span>THE LAST GATE</span><small>PHASE 04 <b>·</b> NORTH SERVICE DISTRICT</small></div><div className="district-header-center"><span>LOCATION <b>SAN FRANSOKYO · BAY 6</b></span><span>OBJECTIVE <b>{objective}</b></span></div><button className="district-restart" onClick={reset}>RESTART CHAPTER <span>↺</span></button></header>
    {stage === 'district' && <section className="district-book-landing"><div className="district-panel district-book-card"><div className="district-kicker">FIELD OBJECT / BAY 6 <span>01</span></div><h1>Something useful<br /><em>was left behind.</em></h1><p className="district-lead">A weatherproof notebook lies open on the service road. Its diagrams are still dry beneath the cover.</p><div className="book-object" aria-label="A notebook on the ground"><span>▤</span><b>SERVICE NOTEBOOK</b><small>FIELD INVENTIONS · BAY 6</small></div><button className="district-primary" onClick={() => setStage('book')}><span>OPEN SEARCH RECORD</span><i>↗</i></button></div></section>}
    {stage === 'book' && <section className="district-book-reader"><div className="book-reader-panel"><div className="district-kicker">BAY 6 / SERVICE NOTEBOOK <span>PAGE {bookPage + 1} / 2</span></div><div className="book-page"><div className="book-page-mark">BAY 6</div><h1>{PAGES[bookPage].title}</h1><h2>{PAGES[bookPage].subtitle}</h2><p>{PAGES[bookPage].copy}</p><div className="book-diagram">{PAGES[bookPage].diagram}</div><div className="book-page-rule" /><small>HANDWRITTEN · KEEP THE COMBAT CHIP UNTOUCHED</small></div><div className="book-controls">{bookPage > 0 && <button className="book-secondary" onClick={() => setBookPage(page => page - 1)}>← PREVIOUS</button>}{bookPage < PAGES.length - 1 ? <button className="district-primary" onClick={() => setBookPage(page => page + 1)}><span>TURN PAGE</span><i>→</i></button> : <span className="book-walk-hint">THE ROUTE IS AHEAD · PRESS W OR SCROLL TO WALK</span>}</div></div></section>}
    {stage === 'inspect' && <section className="district-book-landing"><div className="district-panel district-book-card"><div className="district-kicker">BAY 6 / CASE 04 <span>INSPECT</span></div><h1>Inspect the<br /><em>service case.</em></h1><p className="district-lead">The case is on the bench. Check its seal before opening it.</p><div className="book-object"><span>▣</span><b>INDUSTRIAL SERVICE CASE</b><small>BENCH 02 · BAY 6</small></div>{!inspected ? <button className="district-primary" onClick={() => setInspected(true)}><span>INSPECT CASE</span><i>⌕</i></button> : <><p className="district-lead">The case is ready to open.</p><button className="district-primary" onClick={() => setStage('discovery')}><span>OPEN CASE</span><i>↗</i></button></>}</div></section>}
    {stage === 'roam' && <section className="district-guided-panel" aria-live="polite"><div className="district-kicker">BAY 6 / WALKING ROUTE <span>WAYPOINT {Math.min(walkStep + 1, 4)} / 4</span></div><h1>{walkStep < 3 ? <>Walk to<br /><em>Bay 6.</em></> : <>Service bay<br /><em>reached.</em></>}</h1><p>{walkStep < 3 ? 'Press W or scroll to move. Scroll is captured while walking.' : 'Arriving at Case 04…'}</p><div className="district-stepper">{['SERVICE ROAD', 'GATE', 'BAY 6', 'CASE 04'].map((label, i) => <span className={i <= walkStep ? 'active' : ''} key={label}><b>{String(i + 1).padStart(2, '0')}</b>{label}</span>)}</div><div className="district-movement-status">W · SCROLL TO WALK <span>{Math.round((walkStep / 3) * 100)}%</span></div></section>}
    {stage === 'discovery' && <section className="district-discovery-hint"><div className="district-panel"><div className="district-kicker">CASE 04 / BAY 6 <span>DISCOVERY</span></div><h1>{discoveryStep === 'closed' ? <>Open the<br /><em>service case.</em></> : discoveryStep === 'open' ? <>The limiter<br /><em>is inside.</em></> : <>Limiter<br /><em>removed.</em></>}</h1><p className="district-lead">{discoveryStep === 'closed' ? 'Select OPEN CASE 04 in the service bay.' : discoveryStep === 'open' ? 'Select the limiter to lift it out.' : 'Limiter recovered. Preparing handoff.'}</p></div></section>}
    {stage === 'result' && <section className="district-result"><div className="district-panel result-panel"><div className="district-kicker">PHASE 04 COMPLETE / BAY 6 <span>OBJECT RECOVERED</span></div><h1>Limiter recovered.<br /><em>Bay 6 is clear.</em></h1><p className="result-explanation">The current limiter is ready for the next step.</p><div className="result-actions"><button className="district-primary" onClick={reset}><span>REPLAY SEARCH</span><i>↺</i></button>{districtExit() && <button className="district-primary" onClick={districtExit()!.go}><span>{districtExit()!.label}</span><i>→</i></button>}</div></div></section>}
    {(stage === 'district' || stage === 'book') && <div className="district-footer"><span>BAY 6 · GUIDED INVESTIGATION</span><span>LOCAL HARDWARE ONLY <i>·</i> TIME, NOT CONTROL</span></div>}
  </main>;
}

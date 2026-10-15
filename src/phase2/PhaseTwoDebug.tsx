import { useEffect, useState } from 'react';
import type { EntryStage, PhaseTwoDirector } from './model';
import { usePhaseTwoEntry } from './entry';

const entries: [EntryStage, string][] = [['fracture', 'FRACTURE'], ['afterimage', 'AFTERIMAGE'], ['build', 'BUILD'], ['hunt', 'VECTOR HUNT'], ['null', 'NULL CHAMBER']];

/** Development-only shortcuts. This lazy module is not imported by production. */
export default function PhaseTwoDebug({ director }: { director: PhaseTwoDirector }) {
  const [open, setOpen] = useState(false);
  const jump = (entry: EntryStage) => usePhaseTwoEntry.setState(state => ({ active: true, entry, session: state.session + 1 }));
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.code === 'F2') { event.preventDefault(); setOpen(value => !value); }
      if (event.altKey && /^Digit[1-5]$/.test(event.code)) { event.preventDefault(); jump(entries[Number(event.code.slice(-1)) - 1][0]); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, []);
  return <nav className={`p2-debug ${open ? 'open' : ''}`} aria-label="Phase II development shortcuts"><button onClick={() => setOpen(!open)}>DEV / F2</button>{open && <><span>ALT + 1-5</span>{entries.map(([entry, label]) => <button key={entry} onClick={() => jump(entry)}>{label}</button>)}<button onClick={() => { director.paused = !director.paused; }}>PAUSE / RESUME</button></>}</nav>;
}

# The Last Gate

A desktop, browser-based Big Hero 6 fan story in six chapters, played through Hiro's eyes. Baymax
is stuck on a combat chip on the far side of a broken portal; Hiro has to bring him back up, keep
him from hurting anyone, find out where his healthcare chip went, and get them both home.

Built with React, TypeScript, Vite, Three.js, React Three Fiber, Zustand and GSAP. Art direction
targets 1920×1080; viewports narrower than 1280px get a desktop-required screen and never mount WebGL.

## Run

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev        # http://127.0.0.1:4173
npm run build      # type-checks, then writes the static site to dist/
npm run preview    # serves the production build
node server.mjs    # serves dist/ with no dependencies
```

`npm run check` type-checks only. `npm run assets` re-exports the white Baymax shell to
`public/models/baymax-shell.glb`.

## The story

1. **The portal.** Hiro comes to inside the portal dimension, runs for the still-open gate,
   reaches San Fransokyo, turns back for Baymax and is hurt crossing back. He finds Baymax's silent
   shell and a red chip beside it, opens the chest bay and seats the chip. Baymax wakes, runs a
   diagnostic, finds no healthcare directive and locks onto Hiro. A chase through the tearing city
   ends in a fracture that pulls them both through.
2. **The fracture.** In the afterimage of the crossing, Hiro focuses on the one still line and
   scans it, then follows the stored trace back to the city and lands at the harbour beside
   Baymax, down and armoured.
3. **The engineering board.** Baymax on a diagnostic board: inspect each system, see through the
   shell or isolate it, and make three physical repairs. The chip bay is scanned, not opened.
4. **Bay 6.** A walk along the live street cable to a service bay, then a search inside it: the
   bench lamps, a job card, the hot line under the crates, and a warm case holding a power
   regulator.
5. **The limiter and the relay.** The regulator goes on Baymax's chest plate and is tested: he
   comes back up, still hostile, held to 35%. Then a telemetry relay deeper in the city: five
   console repairs recover the healthcare chip's last transmission, which went straight through
   the portal.
6. **Baymax wakes again.** The combat chip brings him up at the relay, and the regulator only buys
   time. Hiro runs for the old portal site, brings its frame back, and lets Baymax come at full
   power before cutting him to 35% mid-air. Baymax falls. The gate's reader is tuned to his combat
   chip, so Hiro pulls it, plays the relay's capture of the healthcare chip's signal into the
   reader, and hauls Baymax through by his boots. On the other side the healthcare chip is in a
   harbour litter bin. Hiro fetches it, seats it, and Baymax boots as himself.

## Controls

- **Look:** move the pointer. **Move:** scroll, hold W / Space / Arrow Up, or the mouse button.
  On some approaches A / D step sideways.
- **Interact:** click the highlighted thing, or press E. Steps that need commitment are
  **click and hold** (mouse, or E / Space / Enter); the ring fills as you hold.
- **Chips:** guide the chip to the socket with the pointer (it draws itself in when close), or
  hold E to let it seat itself. While handling a chip, scroll or + / − zooms.
- **Sound:** the control in the corner. Audio starts only after a user gesture.
- **Replay:** R, or **Replay** on a chapter card.

Reduced motion is respected throughout. Keyboard operation, captions, and asset or WebGL failure
messages are included.

## Development

Development builds accept these shortcuts:

| URL | Opens at |
|---|---|
| `/` | Chapter 1 from the start (Ctrl+M skips to the next beat) |
| `?phase2=fracture`, `?phase2=afterimage` | Chapter 2 |
| `?recovery=1`, `?recovery=journey` | The harbour landing, the engineering board |
| `?phase4=walk`, `bay`, `box`, `found` | Chapter 4: the walk, the bay, the uncovered case, the regulator in hand |
| `?phase5=1`, `?phase5=facility` | Chapter 5: the limiter, the relay |
| `?phase6=wake`, `escape`, `gate`, `drop`, `portal`, `home` | Chapter 6 beats |

Alt+Shift+F toggles a debug HUD; Alt+Shift+R restarts the current checkpoint.

### Tests

The scripts drive a real Chrome against the dev server through Puppeteer (`puppeteer-core`, not a
dependency; point `PUPPETEER` at its ESM entry). Results and screenshots go to `artifacts/`.

```bash
PUPPETEER=<path to puppeteer-core esm entry> BASE=http://localhost:4173 node scripts/recovery-interactions.mjs
PUPPETEER=<path to puppeteer-core esm entry> BASE=http://localhost:4173 node scripts/recovery-smoke.mjs
```

`recovery-interactions` plays Chapter 6's interactions with the mouse and keyboard (regulator, run,
gate rings, chip pull, cartridge, the haul, the bin and the healthcare chip). `recovery-smoke` walks
every Chapter 6 stage and records errors.

## Source map

- `src/experience`, `src/state`, `src/systems`, `src/transitions`: Chapter 1. `ExperienceDirector`
  runs the frame, `SceneStateManager` holds the beat graph, `CameraDirector` owns the camera, and
  `config/shell.ts` holds beat lengths and diagnostic lines.
- `src/characters`: Baymax (white shell, `ChestAccess` bay, `ChestBay` mount), the rigged
  armoured suit (`ArmouredBaymax`), the chips, Hiro and the regulator controller.
- `src/environment`, `src/effects`: the portal dimension, the rift gate, the rupture set, the
  harbour city and the post-processing stack.
- `src/phase2`, `src/recovery`, `src/engineering`, `src/phase4`, `src/phase5`, `src/phase6`: one
  folder per chapter. Later chapters plug in through small exit/entry registries, so earlier
  chapters never import later ones.
- `src/audio`: fully synthesized sound, with no recordings.
- `src/presentation`, `src/ui`, `src/core`, `src/performance`: chapter transitions, shared UI,
  quality scaling, and the shader warm-up done behind each loading cover.

`docs/` holds design briefs and handoff notes from development.

## Credits

Technical:
Shivam Singh Sisodiya
Rudraksh Dubey
Ojasvi Goswami

Team Delhi Public School, Maruti Kunj

This is a fan concept made for a Big Hero 6 competition brief, not affiliated with Disney.

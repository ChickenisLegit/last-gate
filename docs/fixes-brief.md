# THE LAST GATE: changes to make (brief for agents)

Each agent takes **one task block** below. Read the shared context first.

## Shared context (read this before your task)

- **What it is:** THE LAST GATE is a story-driven web game. It's built with React 19, TypeScript, Vite 7, three.js 0.180, React Three Fiber, zustand and GSAP.
- **Branches:** it's split into stacked branches `phase1` → `phase5`.
  - Each branch's own commit adds only that phase, plus one hook line in `main.tsx`.
  - The full game is on `phase5`.
- **Phase folders:**
  - Phase 1: the original game
  - Phase 2: harbour landing, in `src/recovery` and `src/phase2`
  - Phase 3: Baymax engineering board, in `src/engineering`
  - Phase 4: walk and district, in `src/phase4`
  - Phase 5: limiter test and telemetry relay, in `src/phase5`
- **How phases connect:** later phases plug in through small registries, so earlier phases never import later ones. See `src/recovery/journey.ts`, `src/engineering/exit.ts` and `src/phase4/exit.ts`.
- **Running it:** `npm run dev` serves it on http://localhost:4173.
  - Dev shortcuts: `?recovery=1`, `?recovery=journey`, `?phase4=walk`, `?phase4=district`, `?phase5=1`, `?phase5=facility`.
  - Ctrl+M skips ahead.
- **Story so far:**
  1. Phase 1: Hiro is displaced through the portal.
  2. He wakes in a harbour district with Baymax down nearby.
  3. He repairs Baymax's body. Baymax is still running the red combat chip, and the healthcare chip is missing.
  4. He searches the district for a way to limit Baymax and builds a power regulator.
  5. He tests the regulator and traces the healthcare chip's signal: it went outbound, across the portal boundary.
- **Where to work:** work on `phase5` in your own worktree. Ask before committing, and never push.
  - If your change belongs to an earlier phase's files, say which branch it should land on in your final report. Don't rebase the other branches.
- **Done means:**
  - `npx tsc --noEmit` and `npm run build` both pass.
  - There are no console errors.
  - There are before and after screenshots at 1440×810.
- **Words to avoid:** no "protocol", "initiate", "sequence", "override", "neural" or "commence". Write the way a person talks.

### Shared UI direction (applies to every task that touches UI)

- **It should feel like a clean website laid over a game, not a game HUD.** Right now the whole thing feels purely game-like.
- **Website-style panels and buttons:**
  - Put them in the open space on the left and right, the way a well-designed website does.
  - Give them curved corners: 20–24 px on panels, and fully rounded pill ends (`border-radius: 999px`) on buttons.
- **Left taskbar:**
  - Use one consistent left-side task panel in every phase where Hiro has jobs to do.
  - Hiro completes his tasks from it: each task is a row with a short title, its state and a button.
  - Build it once as a shared component (for example `src/ui/TaskRail.tsx`) and reuse it.
- **Colours:**
  - Soft white base (`#F7F4EF` for panels, `#FFFFFF` for highlights).
  - One or two reference colours from Big Hero 6, used sparingly. For example:
    - San Fransokyo dusk purple `#5B4B8A`
    - Hiro's hoodie blue-grey `#3C4A5C` for text
    - Baymax red `#C8102E`, for danger only
  - **Don't make orange the main colour** (the team decided against it).
- **Font:** a distinctive but readable display font for headings, for example "Space Grotesk", "Sora" or "Outfit" from Google Fonts. Keep a small mono for readings.
- **Text:** keep it short, with one headline and one line at most. Leave space empty, but put real information in it: what Hiro is doing, why, and what's next.

---

## Task A: Dialogue after Hiro wakes up (Phase 1)

- **The problem:** in Phase 1, the lines after Hiro regains consciousness don't match the story.
- **What to do:**
  1. Find every line of dialogue and subtitle from the moment he comes to through the end of Phase 1. Start with `src/experience/ExperienceDirector.tsx`, `src/state/SceneStateManager.ts` and `src/core/legacyCheckpoints.ts`. This work lands on the `phase1` branch.
  2. Rewrite them so they follow the story above:
     - He's just been thrown through the portal into a broken version of his city.
     - He finds Baymax down.
     - He knows the red combat chip is still in Baymax, and that the healthcare chip is gone.
     - His only goal is to get Baymax working and get them both home.
  3. Lines must not mention things he hasn't learned yet, like the regulator or the signal.
- **Output:** a before and after table of every changed line in your report.

## Task B: Baymax lies unconscious, not floating (Phase 2 / Phase 3)

- **The problem:** after they get pulled through, Baymax should be lying collapsed and unconscious on the ground. In the engineering board (`src/engineering`) and the landing (`src/phase2`), he's basically levitating.
- **What to do:**
  - Put him down properly:
    - His body rests on the ground with real contact shadow and no gap.
    - Slumped, with his limbs resting on the ground.
    - Eyes dark.
  - Keep the board's inspect and rotate features working with him lying down. Adjust the camera framing, hotspots and the arm and thruster repair animations to match.

## Task C: Restructure Phase 4: the book

- **Remove the current idea:** the current Phase 4 has Hiro search the district and collect three separate parts (relay, governor and field clamp) to combine into the limiter. The team finds this unnecessary, so remove it.
- **New flow, in simple words:**
  1. A book lies on the ground in the district.
  2. Hiro picks it up.
  3. It's full of different tools and inventions. Show it as a page-turning UI: website-style, soft white pages and clean diagrams.
  4. He flips through and finds the **power regulator** page, then stops there.
  5. Then he builds it from that page. It's a hands-on build step, in the same spirit as the Phase 3 repairs, worked out from the page's diagram rather than printed answers.
- **What to keep:**
  - The walk to Bay 6 (`src/phase4/Walk.tsx`).
  - Phase 4's exit into Phase 5 (`registerDistrictExit` with "FIT THE LIMITER TO BAYMAX").
  - Phase 5 must still start the same way.
- **What to change:**
  - The district part search, `src/phase4/parts.ts` and the three-part combining UI in `src/phase4/DistrictExperience.tsx`.
  - Delete code that's no longer used.

## Task D: Zoom in and out, everywhere

- **The problem:** zoom (scroll, and +/− where it's supported) misbehaves across the phases.
- **What to do:**
  1. Test every phase and step: Phase 1 approach and chip, landing, board, walk, district, limiter test and facility.
  2. List what goes wrong in each, for example:
     - It zooms through walls or the model.
     - It's limited too much or too little.
     - The scroll also scrolls the page.
     - It fights the camera animation.
     - It's jumpy.
  3. Fix it with one shared zoom helper:
     - Clamped min and max per scene.
     - Smoothed (damped).
     - `preventDefault` on wheel, with passive: false.
     - Disabled during scripted camera moves.
     - Touchpad pinch works.

## Task E: Phase 5 telemetry: buildings block the receiver

- **The problem:** in the telemetry relay (`src/phase5/facility.ts`), buildings block the view of the receiver dish.
- **What to do:**
  - Move or trim the buildings or the camera so the dish and its beam stay clearly visible in every console step, especially "aim the dish".
  - Check it at 1440×810 and 1280×720.

## Task F: Baymax's movement (overall)

- **The problem:** Baymax's movement looks wrong across the phases.
- **What to do:** fix it everywhere:
  - **Weight:** he's big and soft, so give him slow ease-in and ease-out with no snapping.
  - **Contact:** his feet are planted when he walks, with no sliding or floating unless his thrusters are on.
  - **Combat state:** tense and heavier.
  - **Limited state (Phase 5):** sluggish and clearly held back.
  - **Turning:** he turns his body, not only his head.
  - **Gaze:** keep the Phase 1 fix where he looks at Hiro.
- **Where:** list the files you changed in each phase.

## Task G: Website-style UI pass (overall)

- **What to do:** apply the "Shared UI direction" above to every phase's overlay:
  - Build the shared left task rail and reuse it in Phase 3 repairs, Phase 4 (book and build) and Phase 5 console tasks.
  - Add website-style buttons and info panels in the open left and right areas.
  - Use curved corners, the new font and the soft white plus Big Hero 6 colour palette.
- **Shared files:** put the shared tokens in one CSS file (for example `src/ui/theme.css`) and switch each phase's CSS over to it.
- **Coordinate:** Task C builds Phase 4's UI and Task A changes dialogue text, so use their components rather than overwriting them.

---

### Order and conflicts

- These can run in parallel: **A, B, D, E and F** touch mostly separate things.
- Run **G** after **C**. Alternatively, have G build the shared theme and task rail first, and have C use them.
- **Phase 6** is being built in another session on top of `phase5`, and it's using an orange accent colour. It should switch to the soft white plus Big Hero 6 palette above.

Build **Phase 6 of THE LAST GATE**: "Baymax wakes again". It's a playable 3D scene with a website-style UI around it. It continues straight on from Phase 5.

### Project setup (follow what's already there)
- **Stack:** React 19, TypeScript, Vite 7, three.js 0.180, React Three Fiber, zustand and GSAP.
- **Branch:** create `phase6` from `phase5`. This phase's own commit adds `src/phase6/` and one hook line in `main.tsx`, the same way phases 2–5 did.
- **Wiring:** later phases plug in through small registries, so an earlier phase never imports a later one. For examples, see `src/recovery/journey.ts`, `src/engineering/exit.ts` and `src/phase4/exit.ts` (`registerDistrictExit`).
  - Add `src/phase5/exit.ts` with a `registerPhaseFiveExit({label, go})` function.
  - Show its button on Phase 5's final discovery screen (`.p5-found` in `src/phase5/PhaseFive.tsx`).
  - Phase 6's `index.ts` registers itself as `{ label: 'GO AFTER THE SIGNAL', go: enterPhaseSix }`.
- **Copy these Phase 5 files:**
  - `src/phase5/entry.ts` for the zustand entry store and the `?phase6=…` dev shortcut.
  - `src/phase5/PhaseFiveHost.tsx` for the lazy-loaded host with an inline loading cover.
- **Reuse the scenes you already have:**
  - Baymax's model and red combat eyes from `src/phase5/bay.ts`.
  - The cold cyan city look and skyline from Phase 4 and Phase 5.
- **Dev shortcuts:**
  - `?phase6=wake`
  - `?phase6=escape`
  - `?phase6=gate`
  - `?phase6=drop`
  - `?phase6=portal`
  - `?phase6=home`
- **Ctrl+M** skips to the next beat, like the other phases.
- **Optional reference:** the separate branch `fight-sequence-we-can-reuse-somewhere` has an older portal reconstruction, escape and home sequence. Its portal effects, camera moves and the "home" reveal can be reused, but don't merge that branch.

### The story, beat by beat

**1. Wake (back at the relay station)**
- Hiro is still at the console from Phase 5.
- Outside, Baymax's eyes flicker red, he stands up, and his combat stance locks in. The red combat chip is still running him.
- **UI:** a small status card fades in, saying "Baymax is moving." There's one action: **SWITCH ON REGULATOR**.

**2. Regulator ON (first use)**
- **Hand close-up:** Hiro's gloved hand reaches in, his thumb flips a guard cover open, and his index finger pushes a rocker switch. It's a short, physical animation of about 1.2 s, with a little overshoot and a click.
- After that, the UI shows a power meter dropping to 35%.
- Baymax tries his full moves, but each one falls short:
  - His thrusters sputter and he only gets a metre off the ground.
  - A punch comes in slow and pulls up short.
  - His walk turns heavy.
- Show it, don't tell it. Only two or three short UI notes appear, for example "Thrust: not enough to fly" and "Arm output capped".
- **Make it clear:** the regulator doesn't beat him. It only buys time.

**3. Escape through the city**
- This is a short guided run deeper into the city: hold W or the mouse to move, like the Phase 4 walk.
- Baymax follows, slowed down. He can be heard and sometimes seen behind Hiro.
- The objective in the corner reads "Get to the portal site."

**4. The gate site**
- Hiro reaches the old portal frame, which is dead and ringed in scaffolding.
- **First task (hands-on, like the Phase 3 and 5 repairs):** bring the frame's power ring back. For example, line up three ring segments by rotating them until their contacts meet. Work it out from the readings, and don't print the answer.
- When it's done, the frame hums but doesn't open. One socket in the centre stays empty and dark.
- **UI:** "Frame powered. One piece missing." Hiro doesn't know what that piece is, and the player doesn't either.

**5. The choice**
- Hiro says, as a short subtitle-style line rather than a speech: "I'm not leaving him here."
- **UI:** one action, **SWITCH OFF REGULATOR**.
- **Hand close-up:** his finger rocks the switch back and the guard snaps shut.
- Full power comes back. Baymax rises in the distance, flies in, and hovers in front of Hiro at eye level, eyes red and thrusters roaring. Hold on this for a beat.

**6. The drop**
- **UI:** **SWITCH ON REGULATOR**, again with the hand animation, faster this time.
- His thrusters cut out mid-air and Baymax falls. He hits the ground hard, with dust, a camera shake and cracked paving.
- His eyes fade to black: he's unconscious.
- A beat later, his chest chip bay slides open and the chip inside starts to glow. That glow is the missing piece.
- **UI:** "The socket needs that chip."

**7. Open the portal**
- **Drag interaction:** the player takes the chip from Baymax's chest bay and carries it to the frame's socket. The portal blooms open.
- **Camera:**
  1. Hiro looks at the portal once, with a full reveal.
  2. Cut to Baymax lying behind him.
  3. Hiro takes his arm and drags him, slowly and heavily. Keep the drag animation weighty: Hiro leans back and his steps are short.
  4. They cross through together.

**8. Home**
- Somewhere quiet on the other side. Hiro finds the healthcare chip, the one Phase 5 traced.
- **Drag interaction:** Hiro slots it into the chest bay and closes the bay.
- Baymax boots normally: soft white eyes, his usual slow head tilt, and the classic boot chime.
- End card, short and calm. Then fade out.

### UI and look (very important)
- **It should feel like a clean website laid over a game, not a game HUD.** Use plenty of empty space and don't fill the screen.
- **Keep text short:** one headline and one supporting line at most per moment. No paragraphs and no stat walls.
- **Colours:**
  - Soft white base: `#F7F4EF` for panels, with `#FFFFFF` highlights.
  - Orange for actions: `#F26B1F` with a hover of `#FF8A3D`.
  - Big Hero 6 reference colours, used sparingly:
    - Baymax's armour red `#C8102E`, for danger and combat state only.
    - San Fransokyo dusk purple `#5B4B8A`, for portal glow.
    - Hiro's hoodie blue-grey `#3C4A5C`, for body text.
  - The combat-state red stays inside the 3D scene and warnings only.
- **Buttons:** pill-shaped with fully rounded ends (`border-radius: 999px`). Use orange fill and white text for main actions and a soft white outline for secondary ones, with a gentle press-down animation.
  - The **SWITCH ON / SWITCH OFF REGULATOR** button is the hero control. It's a large pill toggle with a sliding knob and a clear ON or OFF state, and it's synced with the 3D hand animation.
- **Panels:** soft white, slightly translucent cards with large rounded corners (20–24 px), a soft shadow and no hard borders.
- **Type:** a clean rounded sans for headlines (for example Nunito or Manrope) and a small mono for readings. Follow the existing brand mark in the top-left corner.
- **Motion:**
  - Use GSAP for UI fades and slides of about 300–500 ms with easing.
  - Use real animation for the hand: fingers bend at the joints and don't snap.
  - Respect `prefers-reduced-motion`.
- **Words to avoid:** no "protocol", "initiate", "sequence", "override", "neural", "system breach", "commence" or "engage". Write the way a person would say it.

### Done means
- The phase can be played start to finish from Phase 5's button, and from every `?phase6=` shortcut.
- `npx tsc --noEmit` and `npm run build` both pass.
- There are no console errors.
- The FPS stays near the earlier phases on an integrated GPU.
- Screenshots are taken at 1440×810 of the wake, regulator ON, the hover face-off, the drop, the portal and the home boot.


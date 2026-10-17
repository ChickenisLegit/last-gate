# Phases 2–5 presentation and performance pass

The existing story, hardware models and diagnostic tasks remain the basis of the experience. Phase 2 gives Hiro's arrival line and player-controlled movement before inspection. The later screenshot follow-up replaces the Phase 5 ending with only “Signal crossed the boundary.” and “Healthcare chip not found.”

## Transitions and camera

- Replace the 6.5-second Phase 1 handoff card with “Baymax…” and a brief covered cut.
- Prepare the harbour world during awakening and compile its renderer while the opening is interactive. The hidden Canvas uses demand mode; it does not run a second render loop. Reuse it when the player reaches the harbour, and unmount the opening.
- Reveal subsequent chapter cuts after the incoming scene has compiled. Loading covers contain no story text.
- Use weighted acceleration on the harbour approach and damped head movement on the Bay 6 walk. Site, bench and receiver shots ease from the live camera with zero velocity at their endpoints.
- Frame the model between DOM panels. Cache layout with ResizeObserver instead of querying layout each frame.

## Rendering and physical feedback

- Retain the existing portal-city geometry as a static backdrop. Bake its sky and static surface lighting, merge compatible surfaces, and remove its lights, shadows, warp shaders and per-frame chase updates.
- Use a small shared studio environment for material response. Amortize foreground shadow updates, with a tighter 1024px harbour shadow frustum.
- Keep exterior Baymax in the opaque pass. Use transparency only for internal inspection. Distant practical lights do not participate in close-up character shading.
- Prepare the real internal hardware and both shell shader passes in the covered incoming renderer, avoiding compilation when inspection first opens.
- Animate component placement and alignment on the existing service bench. Preserve shared hardware materials when disposing individual component geometry.
- Reveal the limiter feed progressively and seat a visible connector at the live chest dock. Drive the eyes, head and shoulder with the output test. Throttle DOM progress updates while the 3D animation runs every frame.
- Keep the console spectrum and trajectory SVGs from shrinking inside the scrollable panel. Give the service manual keyboard focus and Escape support. Guard completed console tasks against repeated advancement.

## Verification

TypeScript and the production build are required. Browser verification covers the harbour controls, all three Baymax repairs, insufficient current and missing-feed rejection, sensor inspection, absent healthcare chip, every chapter handoff, Bay 6 recovery/assembly/calibration, physical limiter fitting, all five relay tasks and their invalid inputs, repeated-success clicks, and the Phase 5 ending at 1600px and 1280px desktop widths.

Normal-motion checks also sample the camera path, the progressively revealed limiter feed, incoming renderer readiness and the hidden demand renderer's frame counter. Hardware-backed Chrome is used for timing; software headless rendering is not used as a desktop FPS benchmark.

Initial pass verified on 2026-10-16: production build and 28 browser checks passed with no page/console errors. The full flow passed at 1600×900 and 1280×720. In normal-motion Chrome at 1920×1080 on Intel UHD 630, the warmed handoff took 1,817ms; the hidden renderer produced zero frames over 600ms. A separate inspection-entry sample had a 33.7ms maximum frame interval after shader preparation. See PHASE5_SCENE_FOLLOWUP.md for the subsequent model, camera and resolution changes.

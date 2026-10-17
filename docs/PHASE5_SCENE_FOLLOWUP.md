# Phase 3–5 screenshot corrections

The ending now contains only “Signal crossed the boundary.” and “Healthcare chip not found.” The existing repair story and five relay tasks remain intact.

## Physical scenes and interaction

- Bay 6 uses the same open workshop facade in the walk and investigation: raised shutter, deep work floor, tool storage, service machinery, gantry trusses, window reveals and a physical service cable socket. The guided street has storefront layers, awnings, utility trays, drains, bollards and textured pavement.
- The relay room has an open breaker cabinet, recessed switches, conduit, patch sockets, detailed operator desks and server racks. Four lights and local floor pools establish warm/cool depth.
- The receiver has a thick parabolic reflector, joined feed braces, radial rear ribs, a rear spindle, a separate elevation gimbal and azimuth pedestal, and an anchored lattice tower. The reflector stands ahead of the yoke to prevent intersections.
- Calibration gives a recorded bearing sector, direction guidance, 1° adjustments and reset. It still requires the player to peak the return and lock it.
- Recorded positions appear in actual city space. Chronological DOM controls place four 3D markers and connecting track segments; readable labels project from those same world positions. Extrapolation extends the existing outgoing track.
- The camera exits through the broken wall and moves around the receiver rather than through it. Baymax assessment framing fits his model bounds to the available area beside the assessment; its copy and actions scroll inside the viewport when necessary.

## Rendering

Static workshop/street detail and rigid hardware use material batching. The three limiter components retain all 15,866 triangles while reducing their mesh count from 132 to 34. Shared materials are preserved when disposing instances. SceneKit owns every mesh geometry for chapter cleanup.

Only the 3D canvas adapts its pixel ratio under sustained frame load. The DOM remains at native display resolution; geometry, textures and lights are retained. At a 3840×2160 viewport on Intel UHD 630, the measured relay frame interval improved from about 80.5ms to 32.7ms with a 2227×1252 model buffer. At 1920×1080, the receiver and trajectory averaged about 16.6ms. These are machine-specific measurements, not a promise of native 4K/60fps.

The frozen sky renders as an infinite background, so oblique exterior shots do not expose its far clipping edge.

## Checkout and preview

The work branch `phase5` is updated through `origin/phase5` commit `6fdc6e5`, including the latest portal escape/re-entry opening and its automatic playback/black-screen correction (`af079f0`). The separate `last-gate` checkout serving port 4173 was repeatedly restored during verification; the stable review preview runs from `project-lattice-1` on port 4174.

Browser verification covers every repair and relay task, invalid inputs, repeated-success protection, calibration reset/fine control, chronological 3D positions, the simplified ending, responsive assessment/ending layout and hardware-backed rendering at 1080p and a 4K viewport. Production compilation and TypeScript are checked separately.

Final verification on 2026-10-16: all 30 complete-flow checks passed at 1280×720; all eight focused normal-motion visual checks passed; no browser errors were recorded. The production build passed. A smoke check of the retained latest opening and incoming recovery measured a 2,571ms warmed handoff, zero hidden harbour frames over 600ms, and one active canvas after the cut. Generated-output conflicts from the fast-forward were resolved by rebuilding; the working tree has no unmerged paths.

After pulling the newer opening, a separate natural-playback check observed all eleven beats without player input: portal sighted, call Baymax, move to portal, crossing, San Fransokyo arrival, turn back, return decision, return crossing, damaged re-entry, awakening and interactive Baymax approach. The opening connected to the polished recovery scene with no browser errors. Later-phase source changes were retained.


## Complete buildings and opening pass

The relay now has a continuous roof, parapet, plant equipment, full lower floors and neighboring building masses instead of floating roof strips. Bay 6 has a solid service-hall roof and upper office floor. The lab route uses varied solid blocks with three different ground-floor frontages, end-wall windows, alleys, ladders and roof equipment; the redundant background block loop was removed. The receiver reflector now clears the tower at its initial bearing as well as the locked bearing.

The normal-world opening uses a newly batched waterfront, suspension bridge, stepped skyline, promenade and inexpensive water reflections. A stencil aperture separates the two worlds. Camera initialization no longer blends from the origin; crossing FOV changes and return shake are gentler. GPU preparation targets the actual composer, draws portal/hero/city views under the boot cover, and waits for queued preparation to complete. Awakening keeps its original timing with curved lids moving on compositor layers; its soft focus shares the existing grading pass rather than rendering the whole city again for depth blur.

The relay omits its hidden exterior while the indoor camera faces its closed walls and restores it before the camera exits. This reduced the enclosed power view from 137,622 to 13,538 submitted triangles. The final focused run measured 23.2ms at 1080p and 33.1ms at a 4K viewport (2227×1252 adaptive buffer) on Intel UHD 630; exterior receiver and trajectory views averaged 20.8ms and 16.7ms. All 30 flow checks and eight focused visual checks passed with no browser errors. Performance remains device dependent.

Final opening playback reached all eleven beats automatically with no browser errors. The first portal and Baymax turn no longer incur multi-second pauses (measured maximum intervals 100ms and 117ms). City/crossing beats averaged about 21–32ms; awakening averaged 42ms on this integrated GPU, so this is not a native 4K/60fps claim. The compositor-lid change reduces the measured awakening cost from roughly 65–83ms.

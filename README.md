# PROJECT // LATTICE — Awake

The first desktop chapter of Path 1. The viewport is Hiro's vision: a blinking awakening, fractured San Fransokyo, a controlled approach to Baymax's silent shell, and a red chip beside his hand. This opening ends before chip insertion or RED_WAKE. Desktop layout and camera framing are used at every viewport size.

## Run

Requires Node.js 20.19+ or 22.12+. Run `npm install`, then `npm run dev`, and open http://localhost:4173. `npm run build` checks TypeScript and generates the deployable static site in `dist/`. `npm run preview` serves that production build. `node server.mjs` also serves the built site without dependencies.

## Controls

- Awakening starts automatically. Escape or **Skip awakening** skips the blink sequence.
- Move the pointer to look around slightly.
- Scroll, hold Space / W / Arrow Up, or use the subtle move closer control to approach Baymax.
- On touch screens, swipe upward or hold the move closer control.
- Click Baymax, select the response marker, or press E to check for a response.
- Enable original synthesized ambience through the upper-right sound control. Audio starts only after a user gesture.
- Press R or select **Replay opening** to restart.

The sequence respects reduced motion. Keyboard operation, touch controls, live captions, and asset/WebGL failure messages are included.

## Architecture

React, TypeScript, Vite, Three.js, React Three Fiber, Zustand, and GSAP. One Canvas and one experience controller coordinate BOOT → AWAKE → THE_SHELL. CameraDirector exclusively owns the camera. TransitionDirector owns the eye-opening timeline. AudioDirector owns original ambience. AssetManager loads the shell GLB once. BaymaxController keeps the shell dormant. The environment uses instanced windows, repeated details and drifting debris; particles render in a single point cloud.

The source is grouped into `src/experience`, `src/state`, `src/systems`, `src/characters`, `src/environment`, `src/transitions`, `src/audio`, `src/ui`, and `src/config`. Later chapters should extend the state manager and use the existing directors. AFTERIMAGE is the planned in-world recording system; it is not activated in this opening.

## Assets

The stylized Baymax model, street geometry and textures, portal shader, and ambience are original procedural assets. `npm run assets` exports the reusable model to `public/models/baymax-shell.glb` (approximately 250 KB). This is an intentionally simplified approximation, ready to replace with a more detailed model. No external film model, soundtrack or voice recording is included. Interface fonts load from Google Fonts with local fallbacks. Dependency licenses remain with their installed packages.

This is a fan concept made for the supplied Big Hero 6 competition brief, without affiliation with Disney.

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Box3, MathUtils, type Material, type Mesh, type Object3D, Raycaster, Vector3 } from 'three';
import type { JourneyWorld } from '../recovery/journey';
import { reducedMotion } from '../config/experience';
import { createInternals } from './internals';
import { hotspotElements, SYSTEMS, useBoard, type SystemId } from './state';

const SHELL_OPACITY = { exterior: 1, internal: .13, isolate: .06 } as const;
/** How often (s) the board re-checks what stands between the camera and Baymax. */
const OCCLUDER_INTERVAL = .1;

/**
 * The board's 3D half. It takes over the landing's camera with an orbit around the same Baymax,
 * builds his internals once, drives the view modes and the chest bay, and pins each hotspot
 * button over its system. All interaction state lives in the board store; nothing here owns UI.
 */
export function BoardScene({ world }: { world: JourneyWorld }) {
  const { camera, gl } = useThree();
  const internals = useMemo(() => createInternals(world.baymax), [world]);
  const shellMats = useMemo(() => {
    const list = internals.shellMaterials([world.bay.root]) as (Material & { opacity: number })[];
    // Transparent from the start so view changes never recompile; opaque look at opacity 1.
    list.forEach(m => { m.transparent = true; m.needsUpdate = true; });
    return list;
  }, [internals, world]);
  const body = useMemo(() => new Box3().setFromObject(world.baymax).getCenter(new Vector3()), [world]);
  // `home` is the overview angle: side-on from the lane, looking down on his chest. Dragging takes over.
  const orbit = useRef({ az: 0, el: .6, dist: 5, ready: false, homeAz: 0, homeEl: .92, user: false });
  const target = useRef(new Vector3()), desired = useRef(new Vector3()), tmp = useRef(new Vector3()), projected = useRef(new Vector3());
  const opacity = useRef(1), bayOpen = useRef(0);
  // Props that can block the view: everything the district built except the ground (it never occludes).
  const occluders = useMemo(() => {
    const list: Object3D[] = [], box = new Box3();
    world.district.props.traverse(o => { if ((o as Mesh).isMesh && box.setFromObject(o).max.y > -.4) list.push(o); });
    return list;
  }, [world]);
  const hidden = useRef(new Set<Object3D>()), ray = useMemo(() => new Raycaster(), []), sinceCheck = useRef(0);
  const viewShift = useRef(0), sinceLayout = useRef(1);

  useEffect(() => () => {
    internals.dispose(); shellMats.forEach(m => { m.opacity = 1; m.depthWrite = true; });
    hidden.current.forEach(o => { o.visible = true; }); hidden.current.clear();
    if ('clearViewOffset' in camera) (camera as unknown as { clearViewOffset: () => void }).clearViewOffset();
  }, [internals, shellMats, camera]);

  // Orbit input: drag on the world rotates, the wheel zooms. Panels sit above and keep their own input.
  useEffect(() => {
    const el = gl.domElement; let drag: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => { if (e.button !== 0) return; drag = { x: e.clientX, y: e.clientY }; el.setPointerCapture(e.pointerId); };
    const move = (e: PointerEvent) => {
      if (!drag) return;
      const o = orbit.current;
      o.user = true; o.az -= (e.clientX - drag.x) * .006; o.el = MathUtils.clamp(o.el + (e.clientY - drag.y) * .004, .22, 1.35);
      drag = { x: e.clientX, y: e.clientY };
    };
    const up = () => { drag = null; };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoom = MathUtils.clamp(useBoard.getState().zoom * (1 + Math.sign(e.deltaY) * .1), .5, 1.3);
      useBoard.setState({ zoom });
    };
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => { el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('wheel', wheel); };
  }, [gl]);

  const anchor = (system: SystemId, out: Vector3) => system === 'chip' ? out.copy(world.bay.dockWorld()) : internals.anchorWorld(system, out);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, .05), time = clock.elapsedTime, s = useBoard.getState(), o = orbit.current;
    world.baymax.updateMatrixWorld();
    // Start the orbit exactly where the landing camera is, so START JOURNEY is one continuous move.
    if (!o.ready) {
      tmp.current.copy(camera.position).sub(body);
      o.az = Math.atan2(tmp.current.x, tmp.current.z); o.dist = tmp.current.length();
      o.el = Math.asin(MathUtils.clamp(tmp.current.y / o.dist, -1, 1)); target.current.copy(body); o.ready = true;
      // Body axis from hips to head; the overview looks across it from the lane side.
      internals.anchorWorld('sensors', tmp.current); const axis = tmp.current.sub(body);
      let px = -axis.z, pz = axis.x; if (px > 0) { px = -px; pz = -pz; }
      o.homeAz = Math.atan2(px, pz);
    }
    if (!o.user) { o.az += Math.atan2(Math.sin(o.homeAz - o.az), Math.cos(o.homeAz - o.az)) * (reducedMotion ? 1 : 1 - Math.exp(-1.6 * dt)); o.el += (o.homeEl - o.el) * (reducedMotion ? 1 : 1 - Math.exp(-1.6 * dt)); }
    if (s.selected) anchor(s.selected, desired.current); else desired.current.copy(body);
    const k = (l: number) => reducedMotion ? 1 : 1 - Math.exp(-l * dt);
    target.current.lerp(desired.current, k(2.6));
    const dist = (s.selected ? (s.selected === 'chip' ? 1.8 : 2.9) : 7.4) * s.zoom;
    o.dist += (dist - o.dist) * k(2.2);
    camera.position.set(
      target.current.x + Math.sin(o.az) * Math.cos(o.el) * o.dist,
      target.current.y + Math.sin(o.el) * o.dist,
      target.current.z + Math.cos(o.az) * Math.cos(o.el) * o.dist,
    );
    camera.lookAt(target.current);

    // Keep Baymax in the free space between the systems rail and the inspector, not under a panel.
    const w = gl.domElement.clientWidth, h = gl.domElement.clientHeight;
    sinceLayout.current += dt;
    if (sinceLayout.current > .5) {
      sinceLayout.current = 0;
      const rail = document.querySelector('.board-rail')?.getBoundingClientRect(), panel = document.querySelector('.board-inspector')?.getBoundingClientRect();
      viewShift.current = rail && panel ? Math.round(((rail.right + panel.left) / 2 - w / 2)) : 0;
    }
    const cam = camera as unknown as { setViewOffset: (fw: number, fh: number, x: number, y: number, w: number, h: number) => void };
    const shift = Math.abs(viewShift.current);
    cam.setViewOffset(w + shift * 2, h, viewShift.current < 0 ? shift * 2 : 0, 0, w, h);

    // Anything standing between the camera and Baymax is set aside while it's in the way.
    sinceCheck.current += dt;
    if (sinceCheck.current > OCCLUDER_INTERVAL) {
      sinceCheck.current = 0;
      tmp.current.subVectors(camera.position, target.current); const reach = tmp.current.length();
      ray.set(target.current, tmp.current.normalize()); ray.far = reach;
      const blocking = new Set(ray.intersectObjects(occluders, false).map(hit => hit.object));
      // A second ray from his body catches walls the target ray misses when a system is selected.
      tmp.current.subVectors(camera.position, body); const reachBody = tmp.current.length();
      ray.set(body, tmp.current.normalize()); ray.far = reachBody;
      ray.intersectObjects(occluders, false).forEach(hit => blocking.add(hit.object));
      hidden.current.forEach(o => { if (!blocking.has(o)) { o.visible = true; hidden.current.delete(o); } });
      blocking.forEach(o => { o.visible = false; hidden.current.add(o); });
    }

    // View modes: the shell fades so the internals read; isolate fades it further.
    opacity.current += (SHELL_OPACITY[s.mode] - opacity.current) * k(5);
    for (const m of shellMats) { m.opacity = opacity.current; m.depthWrite = opacity.current > .98; }
    internals.update(time, dt, s);

    // The chest bay opens only when Hiro asks to see the chips.
    bayOpen.current += ((s.bayOpen ? 1 : 0) - bayOpen.current) * (reducedMotion ? 1 : Math.min(1, dt * 1.3));
    world.bay.update({ t: time, open: bayOpen.current * 4.6, seated: 1, red: .9, seamGlow: .12 + .2 * bayOpen.current });

    // Hotspots follow their systems on screen; hidden behind the camera or under a panel.
    const railRight = document.querySelector('.board-rail')?.getBoundingClientRect().right ?? 0;
    const panelLeft = document.querySelector('.board-inspector')?.getBoundingClientRect().left ?? w;
    for (const system of SYSTEMS) {
      const el = hotspotElements.get(system); if (!el) continue;
      projected.current.copy(anchor(system, tmp.current)).project(camera);
      const x = (projected.current.x * .5 + .5) * w, y = (-projected.current.y * .5 + .5) * h;
      const visible = projected.current.z < 1 && x > railRight + 12 && x < panelLeft - 12;
      el.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
      el.style.visibility = visible ? 'visible' : 'hidden';
    }
  });

  // A soft work light over the apron: Baymax reads first, the street falls back.
  return <pointLight position={[body.x - .6, body.y + 3.4, body.z + 1.2]} intensity={7} distance={9} decay={1.6} color="#d6ecff" />;
}

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ACESFilmicToneMapping, PMREMGenerator } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { useCanvasBudget } from '../performance/CanvasBudget';

/** Shared Phase 1 material response; a small studio reflection, with amortized shadow work. */
export function SceneQuality({ ready = true, prepare, onReady }: { ready?: boolean; prepare?: () => Promise<void>; onReady?: () => void }) {
  const { gl, scene, camera } = useThree();
  useCanvasBudget(ready);
  const sinceShadow = useRef(1);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const debug = window as Window & { __lastGateScene?: { gl: typeof gl; scene: typeof scene; camera: typeof camera } };
    const current = { gl, scene, camera }; debug.__lastGateScene = current;
    return () => { if (debug.__lastGateScene === current) delete debug.__lastGateScene; };
  }, [gl, scene, camera]);
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl), room = new RoomEnvironment();
    const environment = pmrem.fromScene(room, .04);
    scene.environment = environment.texture; scene.environmentIntensity = .55;
    gl.toneMapping = ACESFilmicToneMapping; gl.toneMappingExposure = 1.02;
    gl.shadowMap.autoUpdate = false; gl.shadowMap.needsUpdate = true;
    room.dispose(); pmrem.dispose();
    return () => { scene.environment = null; environment.dispose(); };
  }, [gl, scene]);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const frame = requestAnimationFrame(() => {
      gl.compileAsync(scene, camera).then(() => alive ? prepare?.() : undefined).then(() => {
        if (!alive) return;
        gl.shadowMap.needsUpdate = true;
        onReady?.(); window.dispatchEvent(new Event('lastgate:scene-ready'));
      }).catch(() => { if (alive) { onReady?.(); window.dispatchEvent(new Event('lastgate:scene-ready')); } });
    });
    return () => { alive = false; cancelAnimationFrame(frame); };
  }, [ready, gl, scene, camera, prepare, onReady]);
  useFrame((_, dt) => {
    sinceShadow.current += dt;
    if (sinceShadow.current > .16) { gl.shadowMap.needsUpdate = true; sinceShadow.current = 0; }
  });
  return null;
}

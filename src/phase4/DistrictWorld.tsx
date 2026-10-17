import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Color, Group, Mesh, Vector3 } from 'three';
import { createCityBackdrop } from '../presentation/Backdrop';
import { CameraShot } from '../presentation/CameraShot';
import { SceneQuality } from '../presentation/SceneQuality';
import { concreteTexture } from '../presentation/Surfaces';
import { createBaySixArchitecture, createYardSurroundings } from './environmentDetail';
import { reducedMotion } from '../config/experience';
import { createPart } from './parts';

export type PartId = 'relay' | 'governor' | 'clamp';
export type DistrictStage = 'district' | 'assembly' | 'calibration' | 'result';

const PART_NAMES: Record<PartId, string> = {
  relay: 'HIGH-CURRENT RELAY',
  governor: 'MOTOR GOVERNOR',
  clamp: 'FIELD CLAMP',
};

function ComponentModel({
  part, position, scale = 1, rotatable = false, aligned = false,
}: { part: PartId; position: [number, number, number]; scale?: number; rotatable?: boolean; aligned?: boolean }) {
  const rotation = useRef<[number, number]>([.28, -.12]);
  const object = useRef<Group>(null), initialPosition = useRef(position);
  const targetPosition = useMemo(() => new Vector3(...position), [position]);
  const targetScale = useMemo(() => new Vector3(scale, scale, scale), [scale]);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const model = useMemo(() => createPart(part), [part]);
  useEffect(() => () => {
    // Part geometry belongs to this instance; its material library is shared with Phase 5.
    model.traverse(o => { if (o instanceof Mesh) o.geometry.dispose(); });
  }, [model]);
  useFrame((_, dt) => {
    const g = object.current; if (!g) return;
    const k = reducedMotion ? 1 : 1 - Math.exp(-Math.min(dt, .05) * 6);
    g.position.lerp(targetPosition, k);
    g.rotation.x += ((rotatable ? rotation.current[1] : aligned ? 0 : .08) - g.rotation.x) * k;
    g.rotation.y += ((rotatable ? rotation.current[0] : aligned ? 0 : -.12) - g.rotation.y) * k;
    g.scale.lerp(targetScale, k);
  });
  const down = (event: ThreeEvent<PointerEvent>) => {
    if (!rotatable) return;
    event.stopPropagation();
    drag.current = { x: event.clientX, y: event.clientY };
    (event.target as unknown as { setPointerCapture: (id: number) => void }).setPointerCapture(event.pointerId);
  };
  const move = (event: ThreeEvent<PointerEvent>) => {
    if (!rotatable || !drag.current) return;
    event.stopPropagation();
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    drag.current = { x: event.clientX, y: event.clientY };
    rotation.current = [rotation.current[0] + dx * .008, rotation.current[1] + dy * .008];
  };
  const up = () => { drag.current = null; };
  return <group
    ref={object}
    position={initialPosition.current}
    scale={scale}
    onPointerDown={down}
    onPointerMove={move}
    onPointerUp={up}
    onPointerCancel={up}
  >
    <primitive object={model} />
  </group>;
}

function Street({ stage, location, selectedPart, placed, aligned, routes }: {
  stage: DistrictStage;
  location: string;
  selectedPart: PartId | null;
  placed: Record<PartId, boolean>;
  aligned: Record<PartId, boolean>;
  routes: [boolean, boolean];
}) {
  const { camera } = useThree();
  const floorMap = useMemo(concreteTexture, []);
  const workshop = useMemo(() => { const kit = createBaySixArchitecture(); kit.root.position.z = -8; return kit; }, []);
  const surroundings = useMemo(createYardSurroundings, []);
  useEffect(() => { floorMap.repeat.set(4, 14); return () => { floorMap.dispose(); workshop.dispose(); surroundings.dispose(); }; }, [floorMap, workshop, surroundings]);
  // The displaced portal city behind Bay 6: the same skyline and fracture as every earlier phase.
  const skyline = useMemo(() => {
    const city = createCityBackdrop();
    city.group.position.set(0, -4, -78); city.group.scale.setScalar(1.25);
    // Backdrop only: its lights shouldn't cast (a 4096px shadow map nobody sees here).
    city.group.traverse(o => { o.castShadow = false; });
    return city;
  }, []);
  useEffect(() => () => skyline.dispose(), [skyline]);
  const rig = useMemo(() => new CameraShot(), []);
  const cameraTarget = useMemo(() => new Vector3(), []);
  const cameraPosition = useMemo(() => new Vector3(), []);
  useFrame(({ clock }, dt) => {
    let position: [number, number, number] = [0, 7.2, 20];
    let focus: [number, number, number] = [0, 1.7, -5];
    if (stage === 'district' && selectedPart) {
      // Close on the pedestal: the part fills the space between the two panels.
      position = [0, 2.1, 3.6]; focus = [0, 1.15, -1.7];
    } else if (stage === 'district') {
      const sites: Record<string, [[number, number, number], [number, number, number]]> = {
        archive: [[0, 2.8, 8.5], [0, 1.6, -6]],
        actuator: [[-1.1, 2.4, -.2], [3.1, 1.35, -6.3]],
        isolation: [[.6, 2.5, -1.8], [-4.1, 1.4, -7.6]],
        thruster: [[-.2, 2.6, -2.9], [4.1, 1.4, -7.2]],
      };
      const shot = sites[location];
      if (shot) [position, focus] = shot;
    } else if (stage === 'assembly' || stage === 'calibration') {
      position = [0, 2.9, 3.9]; focus = [0, 1.15, -1.4];
    } else if (stage === 'result') {
      position = [0, 4.6, 11.5]; focus = [0, 1.9, -2.7];
    }
    cameraPosition.set(...position);
    cameraTarget.set(...focus);
    rig.update(camera, `${stage}-${location}-${selectedPart}`, cameraPosition, cameraTarget, Math.min(dt, .05));
  });

  const sockets: Record<PartId, [number, number, number]> = {
    relay: [-1.35, 1.05, -1.3], governor: [0, 1.05, -1.3], clamp: [1.35, 1.05, -1.3],
  };
  const staging: Record<PartId, [number, number, number]> = {
    relay: [-1.7, .48, .8], governor: [0, .48, .8], clamp: [1.7, .48, .8],
  };
  const partPosition = (part: PartId): [number, number, number] => placed[part] ? sockets[part] : staging[part];
  return <>
    <color attach="background" args={[new Color('#0b1622')]} />
    <fog attach="fog" args={['#1b3038', 30, 95]} />
    <hemisphereLight args={['#b4ccc9', '#222726', .75]} />
    <primitive object={workshop.root} />
    <primitive object={surroundings.root} />
    <primitive object={skyline.group} />
    <directionalLight position={[-8, 13, 8]} intensity={2.1} color="#f1dfc4" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-11} shadow-camera-right={11} shadow-camera-top={10} shadow-camera-bottom={-11} shadow-camera-far={48} shadow-normalBias={.035} />
    <pointLight position={[0, 3.4, -11.5]} intensity={26} distance={18} color="#f0c99e" />
    <pointLight position={[3.5, 3.2, -3.2]} intensity={9} distance={12} color="#85c3c8" />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.12, -5]} receiveShadow><planeGeometry args={[180, 180]} /><meshStandardMaterial color="#252e30" roughness={.96} /></mesh>
    <mesh position={[0, -.04, 4]} receiveShadow><boxGeometry args={[8.6, .14, 36]} /><meshStandardMaterial color="#63706a" map={floorMap} bumpMap={floorMap} bumpScale={.025} roughness={.92} /></mesh>
    {[-1.1, 1.1].map(x => <mesh key={x} position={[x, .04, 3]}><boxGeometry args={[.09, .025, 30]} /><meshStandardMaterial color="#bba979" roughness={.8} /></mesh>)}
    {stage === 'assembly' || stage === 'calibration' || stage === 'result' ? <group>
      <mesh position={[0, .72, -1.45]} castShadow receiveShadow><boxGeometry args={[5.9, .16, 2.55]} /><meshStandardMaterial color="#40484a" metalness={.32} roughness={.58} /></mesh>
      <mesh position={[0, .64, -.25]}><boxGeometry args={[5.9, .12, .16]} /><meshStandardMaterial color="#926a4a" metalness={.55} roughness={.4} /></mesh>
      <mesh position={[0, .25, .8]} castShadow><boxGeometry args={[5.5, .14, .82]} /><meshStandardMaterial color="#343c3d" metalness={.3} roughness={.68} /></mesh>
      {[-1.35, 0, 1.35].map(x => <group key={x} position={[x, .82, -1.3]}>
        <mesh><boxGeometry args={[1.12, .025, .92]} /><meshStandardMaterial color="#161d1e" metalness={.4} roughness={.54} /></mesh>
        <mesh position={[0, .025, -.49]}><boxGeometry args={[.75, .025, .05]} /><meshStandardMaterial color="#a08057" metalness={.4} roughness={.48} /></mesh>
      </group>)}
      {routes[0] && <mesh position={[-.67, .96, -1.3]}><boxGeometry args={[.68, .035, .035]} /><meshStandardMaterial color="#d58c59" emissive="#bd5423" emissiveIntensity={.6} metalness={.7} /></mesh>}
      {routes[1] && <mesh position={[.67, .96, -1.3]}><boxGeometry args={[.68, .035, .035]} /><meshStandardMaterial color="#78b5b3" emissive="#317b7d" emissiveIntensity={.45} metalness={.7} /></mesh>}
      {(['relay', 'governor', 'clamp'] as PartId[]).map(part => <ComponentModel key={part} part={part} position={partPosition(part)} scale={placed[part] ? .72 : .52} aligned={aligned[part]} />)}
      {stage === 'result' && <mesh position={[0, 2.48, -2.7]}><boxGeometry args={[.78, .24, .08]} /><meshStandardMaterial color="#9dc8ac" emissive="#57a576" emissiveIntensity={1.5} /></mesh>}
    </group> : null}
    {stage === 'district' && selectedPart && <>
      <mesh position={[0, .12, -1.7]}><cylinderGeometry args={[1.65, 1.8, .2, 40]} /><meshStandardMaterial color="#3e494a" metalness={.36} roughness={.55} /></mesh>
      <mesh position={[0, .24, -1.7]}><cylinderGeometry args={[1.35, 1.42, .045, 40]} /><meshStandardMaterial color="#9b7c57" metalness={.56} roughness={.4} /></mesh>
      <ComponentModel part={selectedPart} position={[0, .9, -1.7]} scale={2.1} rotatable />
    </>}
    {stage === 'district' && (['archive', 'actuator', 'isolation', 'thruster'] as const).map((key, i) => {
      const coords: Record<string, [number, number, number]> = { archive: [-2.4, .85, -6.65], actuator: [3.1, .85, -6.3], isolation: [-4.1, 1.2, -7.6], thruster: [4.1, 1.25, -7.2] };
      const p = coords[key];
      return <group key={key} position={p}>
        <mesh><boxGeometry args={[.7, .9, .55]} /><meshStandardMaterial color={location === key ? '#a57b53' : '#546365'} metalness={.38} roughness={.54} emissive={location === key ? '#584329' : '#000000'} emissiveIntensity={.35} /></mesh>
        <mesh position={[0, .53, .29]}><boxGeometry args={[.8, .06, .06]} /><meshStandardMaterial color="#c3a476" emissive="#6d5431" emissiveIntensity={.25} /></mesh>
        <mesh position={[.24, -.12, .3]}><boxGeometry args={[.18, .22, .08]} /><meshStandardMaterial color="#9c614a" metalness={.65} roughness={.4} /></mesh>
        <mesh position={[-.2, -.1, .3]}><boxGeometry args={[.13, .18, .1]} /><meshStandardMaterial color="#688783" metalness={.5} roughness={.46} /></mesh>
      </group>;
    })}
  </>;
}

export function DistrictWorld({ stage, location, selectedPart, placed, aligned, routes }: {
  stage: DistrictStage;
  location: string;
  selectedPart: PartId | null;
  placed: Record<PartId, boolean>;
  aligned: Record<PartId, boolean>;
  routes: [boolean, boolean];
}) {
  return <Canvas shadows dpr={[1, 1.35]} camera={{ position: [0, 2.8, 8.5], fov: 48, near: .1, far: 100 }} gl={{ antialias: true, powerPreference: 'high-performance' }}>
    <Street stage={stage} location={location} selectedPart={selectedPart} placed={placed} aligned={aligned} routes={routes} />
    <SceneQuality />
  </Canvas>;
}

export const DISTRICT_PART_NAMES = PART_NAMES;

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Color, Vector3 } from 'three';
import { createPortalDimension } from '../environment/PortalDimension.js';
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
  const [rotation, setRotation] = useState<[number, number]>([.28, -.12]);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const model = useMemo(() => createPart(part), [part]);
  const down = (event: ThreeEvent<PointerEvent>) => {
    if (!rotatable) return;
    event.stopPropagation();
    drag.current = { x: event.clientX, y: event.clientY };
  };
  const move = (event: ThreeEvent<PointerEvent>) => {
    if (!rotatable || !drag.current) return;
    event.stopPropagation();
    const dx = event.clientX - drag.current.x;
    const dy = event.clientY - drag.current.y;
    drag.current = { x: event.clientX, y: event.clientY };
    setRotation(([x, y]) => [x + dx * .012, y + dy * .012]);
  };
  const up = () => { drag.current = null; };
  return <group
    position={position}
    scale={scale}
    rotation={rotatable ? [rotation[1], rotation[0], 0] : aligned ? [0, 0, 0] : [.08, -.12, 0]}
    onPointerDown={down}
    onPointerMove={move}
    onPointerUp={up}
    onPointerOut={up}
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
  // The displaced portal city behind Bay 6: the same skyline and fracture as every earlier phase.
  const skyline = useMemo(() => {
    const city = createPortalDimension();
    city.group.position.set(0, -4, -78); city.group.scale.setScalar(1.25);
    // Backdrop only: its lights shouldn't cast (a 4096px shadow map nobody sees here).
    city.group.traverse(o => { o.castShadow = false; });
    return city;
  }, []);
  useEffect(() => () => skyline.dispose(), [skyline]);
  const target = useMemo(() => new Vector3(), []);
  const cameraTarget = useMemo(() => new Vector3(), []);
  const cameraPosition = useMemo(() => new Vector3(), []);
  useFrame(({ clock }, dt) => {
    skyline.update(clock.elapsedTime, Math.min(dt, .05), false, 0, 'approaching');
    let position: [number, number, number] = [0, 7.2, 20];
    let focus: [number, number, number] = [0, 1.7, -5];
    if (stage === 'district' && selectedPart) {
      // Close on the pedestal: the part fills the space between the two panels.
      position = [0, 2.2, 2.3]; focus = [0, 1.12, -1.7];
    } else if (stage === 'district') {
      const sites: Record<string, [[number, number, number], [number, number, number]]> = {
        archive: [[0, 6.4, 12], [0, 1.6, -6]],
        actuator: [[3.6, 3, -1], [2.8, 1.5, -4]],
        isolation: [[-4, 3, -5], [-4, 1.4, -7]],
        thruster: [[4.2, 3.1, -7], [3.2, 1.5, -8]],
      };
      const shot = sites[location];
      if (shot) [position, focus] = shot;
    } else if (stage === 'assembly' || stage === 'calibration') {
      position = [0, 3.6, 9.2]; focus = [0, 1.15, -1.4];
    } else if (stage === 'result') {
      position = [0, 4.6, 11.5]; focus = [0, 1.9, -2.7];
    }
    cameraPosition.set(...position);
    cameraTarget.set(...focus);
    const damping = 1 - Math.exp(-Math.min(dt, .05) * 2.8);
    camera.position.lerp(cameraPosition, damping);
    target.lerp(cameraTarget, damping);
    camera.lookAt(target);
  });

  const blocks = [
    [-10, 5, -14, 6, 10, 7], [-7.5, 3, -23, 5, 6, 6], [12, 5, -15, 7, 10, 8],
    [17, 4, -24, 6, 8, 7], [-18, 6, -30, 8, 12, 9], [22, 7, -34, 9, 14, 10],
    [-11, 3, 2, 5, 6, 5], [13, 3, 4, 6, 6, 5], [-24, 4, -8, 5, 8, 6], [26, 5, -13, 7, 10, 7],
  ];
  const sockets: Record<PartId, [number, number, number]> = {
    relay: [-1.35, 1.05, -1.3], governor: [0, 1.05, -1.3], clamp: [1.35, 1.05, -1.3],
  };
  const staging: Record<PartId, [number, number, number]> = {
    relay: [-1.7, .48, .8], governor: [0, .48, .8], clamp: [1.7, .48, .8],
  };
  const partPosition = (part: PartId): [number, number, number] => placed[part] ? sockets[part] : staging[part];
  return <>
    <color attach="background" args={[new Color('#0b1622')]} />
    <fog attach="fog" args={['#1a3146', 22, 78]} />
    <ambientLight intensity={.95} color="#b9cfe0" />
    <primitive object={skyline.group} />
    <directionalLight position={[-8, 13, 8]} intensity={2.7} color="#f1dfc4" castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
    <pointLight position={[0, 5, -8]} intensity={13} distance={21} color="#e1a56d" />
    <pointLight position={[3, 3, -4]} intensity={6} distance={12} color="#85b5bd" />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.12, -5]} receiveShadow><planeGeometry args={[180, 180]} /><meshStandardMaterial color="#252e30" roughness={.96} /></mesh>
    <mesh position={[0, -.04, 4]} receiveShadow><boxGeometry args={[8.6, .14, 36]} /><meshStandardMaterial color="#343b3c" roughness={.92} /></mesh>
    {[-1.1, 1.1].map(x => <mesh key={x} position={[x, .04, 3]}><boxGeometry args={[.09, .025, 30]} /><meshStandardMaterial color="#bba979" roughness={.8} /></mesh>)}
    {blocks.map(([x, y, z, w, h, d], i) => <group key={i} position={[x, y, z]}>
      <mesh castShadow receiveShadow><boxGeometry args={[w, h, d]} /><meshStandardMaterial color={i % 2 ? '#3a4648' : '#303b3e'} roughness={.88} /></mesh>
      {[-1, 0, 1].flatMap(row => [-1, 0, 1].map(column => <mesh key={`${row}-${column}`} position={[column * w * .28, row * h * .22, d / 2 + .012]}><boxGeometry args={[w * .14, h * .11, .035]} /><meshStandardMaterial color="#a3b5a9" emissive={row === 0 && column === 0 ? '#8d744e' : '#405957'} emissiveIntensity={row === 0 && column === 0 ? .68 : .46} roughness={.5} /></mesh>))}
      <mesh position={[0, h * .29, d / 2 + .025]}><boxGeometry args={[w * .56, .055, .045]} /><meshStandardMaterial color="#a3815b" emissive="#604a32" emissiveIntensity={.18} /></mesh>
    </group>)}
    <group position={[0, 0, -8]}>
      <mesh position={[0, 2.05, -.15]}><boxGeometry args={[11.2, 4.1, .6]} /><meshStandardMaterial color="#303b3d" roughness={.85} /></mesh>
      <mesh position={[0, 1.55, .2]}><boxGeometry args={[5.2, 3.1, .08]} /><meshStandardMaterial color="#101719" roughness={.9} /></mesh>
      {[-4.25, 4.25].map(x => <mesh key={x} position={[x, 1.85, .2]}><boxGeometry args={[2.2, 3.7, .2]} /><meshStandardMaterial color="#576263" metalness={.32} roughness={.68} /></mesh>)}
      <mesh position={[0, 3.84, .22]}><boxGeometry args={[10.8, .38, .28]} /><meshStandardMaterial color="#596364" metalness={.28} roughness={.72} /></mesh>
      <mesh position={[0, .15, 1]}><boxGeometry args={[9.7, .32, 2.5]} /><meshStandardMaterial color="#343d3e" metalness={.12} roughness={.88} /></mesh>
      <mesh position={[-4.4, 2.4, .36]}><boxGeometry args={[1.5, .38, .12]} /><meshStandardMaterial color="#b18b5d" emissive="#805f39" emissiveIntensity={.24} /></mesh>
      {[-2.6, 2.6].map(x => <mesh key={x} position={[x, .9, .1]} rotation={[0, 0, -.26]}><boxGeometry args={[.08, 1.3, .08]} /><meshStandardMaterial color="#647271" metalness={.5} roughness={.48} /></mesh>)}
      <mesh position={[0, 3.55, .42]}><boxGeometry args={[3.8, .22, .05]} /><meshBasicMaterial color="#d0b98e" /></mesh>
    </group>
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
  return <Canvas shadows dpr={[1, 1.35]} camera={{ position: [0, 7.2, 20], fov: 48, near: .1, far: 100 }} gl={{ antialias: false, powerPreference: 'high-performance' }}>
    <Street stage={stage} location={location} selectedPart={selectedPart} placed={placed} aligned={aligned} routes={routes} />
  </Canvas>;
}

export const DISTRICT_PART_NAMES = PART_NAMES;

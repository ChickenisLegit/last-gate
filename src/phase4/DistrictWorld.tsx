import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import * as T from 'three';
import { createLimiter } from './parts';

export type DistrictStage = 'district' | 'book' | 'roam' | 'inspect' | 'discovery' | 'result';
type DiscoveryStep = 'closed' | 'open' | 'removed';

const mat = (color: string, metalness = 0, roughness = .7) => <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />;

function ServiceCase({ step, onStep }: { step: DiscoveryStep; onStep: (step: DiscoveryStep) => void }) {
  const lid = useRef<T.Group>(null), limiter = useRef<T.Group>(null), open = useRef(0), lift = useRef(0);
  const model = useMemo(() => createLimiter(), []);
  useEffect(() => () => model.traverse(o => (o as T.Mesh).geometry?.dispose()), [model]);
  useFrame((_, dt) => {
    const d = 1 - Math.exp(-Math.min(dt, .05) * 5);
    open.current += ((step === 'closed' ? 0 : 1) - open.current) * d;
    lift.current += ((step === 'removed' ? 1 : 0) - lift.current) * d;
    if (lid.current) lid.current.rotation.x = -open.current * 1.82;
    if (limiter.current) { const t = lift.current * lift.current * (3 - 2 * lift.current); limiter.current.position.set(0, .56 + t * 1.55, t * .42); limiter.current.rotation.z = -.08 * t; }
  });
  const clickCase = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (step === 'closed') onStep('open'); };
  const clickLimiter = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (step === 'open') onStep('removed'); };
  const shell = '#263536', edge = '#66716a', dark = '#162322', brass = '#c5964f', warning = '#d47a35';
  return <group position={[-4.55, 1.46, -12.4]} rotation={[0, .08, 0]}>
    {/* Thick lower shell, inset deck, and removable foam bed. */}
    <mesh position={[0, .18, 0]} castShadow onClick={clickCase}><boxGeometry args={[5.9, .48, 3.7]} />{mat(shell, .78, .3)}</mesh>
    <mesh position={[0, .46, 0]} onClick={clickCase}><boxGeometry args={[5.62, .16, 3.43]} />{mat(edge, .65, .42)}</mesh>
    <mesh position={[0, .55, 0]}><boxGeometry args={[5.26, .1, 3.08]} />{mat('#37433d', .1, .9)}</mesh>
    <mesh position={[0, .61, 0]}><boxGeometry args={[4.86, .08, 2.68]} />{mat('#a4a38b', 0, 1)}</mesh>
    {[[-2.65, 1.45], [2.65, 1.45], [-2.65, -1.45], [2.65, -1.45]].map(([x, z]) => <mesh key={`${x}-${z}`} position={[x, .42, z]} castShadow><boxGeometry args={[.34, .68, .34]} />{mat(dark, .55, .42)}</mesh>)}
    {[-2.35, 2.35].map(x => <mesh key={x} position={[x, .64, 0]}><boxGeometry args={[.16, .16, 2.86]} />{mat(dark, .3, .8)}</mesh>)}
    {[-1.18, 0, 1.18].map(z => <mesh key={z} position={[0, .66, z]}><boxGeometry args={[4.65, .1, .13]} />{mat('#46524a', .1, .92)}</mesh>)}
    {/* Hinged lid: the pivot is deliberately at the rear edge of the case. */}
    <group ref={lid} position={[0, .49, -1.62]}>
      <mesh position={[0, .08, 1.62]} castShadow onClick={clickCase}><boxGeometry args={[5.9, .3, 3.7]} />{mat(shell, .78, .3)}</mesh>
      <mesh position={[0, -.1, 1.62]} onClick={clickCase}><boxGeometry args={[5.48, .12, 3.28]} />{mat(edge, .65, .38)}</mesh>
      <mesh position={[0, -.18, 1.62]}><boxGeometry args={[4.9, .08, 2.7]} />{mat('#1b2927', .15, .7)}</mesh>
      <mesh position={[0, -.23, 1.62]}><boxGeometry args={[4.48, .045, 2.28]} />{mat('#b9a875', .1, .8)}</mesh>
      {[-2.18, 2.18].map(x => <mesh key={x} position={[x, -.2, 1.62]}><boxGeometry args={[.18, .18, 2.9]} />{mat(dark, .4, .65)}</mesh>)}
      {[-1.55, 0, 1.55].map(x => <mesh key={x} position={[x, -.27, .35]}><boxGeometry args={[.32, .08, .18]} />{mat(brass, .85, .25)}</mesh>)}
      <mesh position={[0, -.29, 1.62]}><boxGeometry args={[1.8, .035, .34]} />{mat(warning, .35, .5)}</mesh>
    </group>
    {/* Three positive latches, side grab handles, and hinge barrels. */}
    {[-1.75, 0, 1.75].map(x => <group key={x} position={[x, .55, 1.78]}><mesh castShadow onClick={clickCase}><boxGeometry args={[.42, .5, .18]} />{mat(brass, .85, .25)}</mesh><mesh position={[0, .03, .11]}><boxGeometry args={[.2, .2, .05]} />{mat(dark, .4, .45)}</mesh></group>)}
    {[-2.98, 2.98].map(x => <group key={x} position={[x, .25, -.05]}><mesh rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.42, .07, 8, 20, Math.PI]} />{mat(brass, .8, .3)}</mesh><mesh position={[0, -.23, 0]}><boxGeometry args={[.34, .12, .28]} />{mat(dark, .5, .45)}</mesh></group>)}
    {[-2.05, 0, 2.05].map(x => <mesh key={x} position={[x, .67, -1.72]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.13, .13, .32, 16]} />{mat(brass, .85, .25)}</mesh>)}
    <mesh position={[-1.35, .72, 1.58]}><boxGeometry args={[1.55, .035, .16]} />{mat('#e8d6a3', .05, .55)}</mesh>
    <mesh position={[-1.35, .745, 1.58]}><boxGeometry args={[.95, .025, .04]} />{mat('#2a3936', .1, .65)}</mesh>
    <group ref={limiter} position={[0, .56, 0]} onClick={clickLimiter}><primitive object={model} scale={.38} /><mesh position={[0, .58, .1]} onClick={clickLimiter}><boxGeometry args={[2.2, 1.7, 1.35]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh></group>
  </group>;
}

function Prop({ p, s, c, r = [0, 0, 0] as [number, number, number] }: { p: [number, number, number]; s: [number, number, number]; c: string; r?: [number, number, number] }) { return <mesh position={p} rotation={r} castShadow receiveShadow><boxGeometry args={s} />{mat(c, .35, .72)}</mesh>; }
function Shelf({ x, z, color = '#4d5a59' }: { x: number; z: number; color?: string }) { return <group position={[x, 0, z]}>{[1.0, 2.25, 3.5].map(y => <mesh key={y} position={[0, y, 0]} castShadow><boxGeometry args={[3.2, .12, 1.2]} />{mat('#87694a', .2, .78)}</mesh>)}{[-1.45, 1.45].map(s => <mesh key={s} position={[s, 2, 0]}><boxGeometry args={[.12, 4, 1.12]} />{mat(color, .7, .45)}</mesh>)}{[1.35, 2.6].flatMap(y => [-1, 0, 1].map(i => <mesh key={`${y}-${i}`} position={[i * .75, y + .2, -.1]}><boxGeometry args={[.55, .38, .72]} />{mat(i === 0 ? '#b47b43' : '#6b7770', .3, .7)}</mesh>))}</group>; }

function Room({ stage, discoveryStep, walkStep, onDiscoveryStep }: { stage: DistrictStage; discoveryStep: DiscoveryStep; walkStep: number; onDiscoveryStep: (step: DiscoveryStep) => void }) {
  const { camera } = useThree(); const target = useMemo(() => new T.Vector3(), []); const desired = useMemo(() => new T.Vector3(), []); const look = useMemo(() => new T.Vector3(), []);
  useFrame((_, dt) => { const route: [number, number, number][] = [[0, 2.05, 8.5], [1.0, 2.05, 1.5], [0, 2.05, -5], [-2.2, 2.15, -9.3]]; const focus: [number, number, number][] = [[0, 1.7, 0], [0, 1.75, -4], [-1, 1.75, -8], [-4.3, 1.5, -12.2]]; let p: [number, number, number] = [0, 5.8, 16], f: [number, number, number] = [0, 2, -5]; if (stage === 'roam') { const q = Math.min(3, Math.max(0, walkStep)), i = Math.floor(q), t = q - i, a = route[i], b = route[Math.min(3, i + 1)], aa = focus[i], bb = focus[Math.min(3, i + 1)]; p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; f = [aa[0] + (bb[0] - aa[0]) * t, aa[1] + (bb[1] - aa[1]) * t, aa[2] + (bb[2] - aa[2]) * t]; } if (stage === 'discovery' || stage === 'result') { p = [-1.1, 3.35, -7.1]; f = [-4.4, 1.25, -12.3]; } desired.set(...p); look.set(...f); target.lerp(look, 1 - Math.exp(-Math.min(dt, .05) * 3.8)); camera.position.lerp(desired, 1 - Math.exp(-Math.min(dt, .05) * 3.8)); camera.lookAt(target); });
  const caseVisible = stage === 'discovery' || stage === 'result' || (stage === 'roam' && walkStep >= 3);
  return <>
    <color attach="background" args={['#111b1d']} /><fog attach="fog" args={['#172528', 18, 50]} /><ambientLight intensity={.72} color="#b8cbd0" /><directionalLight position={[-8, 12, 8]} intensity={2.1} color="#ffe2b0" castShadow /><pointLight position={[-4, 4, -11]} intensity={12} distance={14} color="#f2ad67" /><pointLight position={[5, 3, -3]} intensity={7} distance={12} color="#78c4cc" />
    <mesh position={[0, -.12, -4]} receiveShadow><boxGeometry args={[24, .18, 31]} />{mat('#333d3d', .05, .95)}</mesh>
    {/* complete enclosed shell: four walls, ceiling and a framed entry doorway */}<Prop p={[0, 7, -11]} s={[24, .35, 31]} c="#344244" /><Prop p={[-12, 3.5, -11]} s={[.4, 7, 31]} c="#435253" /><Prop p={[12, 3.5, -11]} s={[.4, 7, 31]} c="#435253" /><Prop p={[0, 3.5, -26.4]} s={[24, 7, .4]} c="#303a3d" /><Prop p={[-7, 3.5, 4.4]} s={[10, 7, .35]} c="#303a3d" /><Prop p={[7, 3.5, 4.4]} s={[10, 7, .35]} c="#303a3d" /><Prop p={[0, 6.2, 4.4]} s={[4, 1.6, .35]} c="#303a3d" /><Prop p={[0, 3.1, 4.15]} s={[8, .16, .12]} c="#c69753" />
    {[-8, 0, 8].map(x => <group key={x}><mesh position={[x, 6.65, -5]}><boxGeometry args={[4.5, .12, 1.4]} />{mat('#ead6a8', .2, .4)}</mesh><pointLight position={[x, 6.1, -5]} intensity={2.4} distance={9} color="#ffd08c" /></group>)}
    <Shelf x={-9} z={-8} /><Shelf x={9} z={-9} color="#596561" />
    {/* workbench, cabinets, crates, bins and cable/pipes create a readable hidden route */}<Prop p={[-4.8, 1.35, -12.4]} s={[5.8, .22, 2.2]} c="#76583c" /><Prop p={[-7.2, .65, -12.4]} s={[.18, 1.3, .18]} c="#596766" /><Prop p={[-2.4, .65, -12.4]} s={[.18, 1.3, .18]} c="#596766" /><Prop p={[5.9, 1.35, -13]} s={[2.4, 2.7, 1.6]} c="#3f4c4c" /><Prop p={[5.9, 2.72, -13]} s={[2.55, .12, 1.72]} c="#a9875d" />
    {[-8.5, -6.8, 6.8, 8.5].map(x => <Prop key={x} p={[x, .35, -18]} s={[1.1, .7, 1.1]} c={x < 0 ? '#b07846' : '#65706a'} />)}
    {[-10, 10].map(x => <group key={x}><Prop p={[x, 2.4, -3]} s={[.18, 4.8, .18]} c="#89918b" />{[1, 2, 3, 4].map(y => <mesh key={y} position={[x, y, -3]}><boxGeometry args={[.3, .08, .3]} />{mat('#b34b37', .2, .6)}</mesh>)}</group>)}
    <Prop p={[0, 1.1, -20]} s={[.14, 2.2, 12]} c="#7d4a37" r={[Math.PI / 2, 0, 0]} /><Prop p={[2.8, .08, -8]} s={[.12, .08, 14]} c="#c47b42" r={[0, .1, 0]} />
    <mesh position={[0, 4.9, -26.1]}><boxGeometry args={[6.5, .55, .08]} />{mat('#a53e32', .1, .55)}</mesh>
    {caseVisible && <ServiceCase step={discoveryStep} onStep={onDiscoveryStep} />}
  </>;
}

export function DistrictWorld({ stage, location: _location, discoveryStep, walkStep = 0, onDiscoveryStep }: { stage: DistrictStage; location: string; discoveryStep: DiscoveryStep; walkStep?: number; onDiscoveryStep: (step: DiscoveryStep) => void }) { return <Canvas shadows dpr={[1, 1.35]} camera={{ position: [0, 5.8, 16], fov: 48, near: .1, far: 80 }} gl={{ antialias: false, powerPreference: 'high-performance' }}><Room stage={stage} discoveryStep={discoveryStep} walkStep={walkStep} onDiscoveryStep={onDiscoveryStep} /></Canvas>; }

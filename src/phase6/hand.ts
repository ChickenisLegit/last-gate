import * as T from 'three';
import gsap from 'gsap';

/**
 * The hand close-up. The regulator's switch unit is strapped to Hiro's left wrist; his gloved
 * right hand comes in, the thumb flips the guard cover up and the index finger rocks the switch.
 * Built at a fixed spot well below the ground of every set, with its own light and a soft-focus
 * backdrop, so any set can cut to it.
 *
 * Hand frame: built with fingers along -Z, palm down (-Y), thumb on -X; turned so it comes in
 * from the right, fingers pointing left, thumb toward the camera (a right hand).
 */
export const INSERT = new T.Vector3(0, -60, 0);
export const INSERT_CAMERA = { pos: new T.Vector3(-.02, .25, .32), look: new T.Vector3(.0, .0, .0) };

type Finger = { joints: T.Group[] };
export type HandMode = 'on' | 'off' | 'onFast';

const BOKEH_FS = `varying vec2 vUv;uniform float uTime;
float disc(vec2 p,vec2 c,float r){return smoothstep(r,r*.55,length(p-c));}
void main(){vec2 p=vUv;vec3 col=mix(vec3(.025,.05,.075),vec3(.05,.1,.14),p.y);
col+=vec3(.18,.42,.55)*disc(p,vec2(.2,.72),.09)*.5+vec3(.95,.55,.22)*disc(p,vec2(.78,.8),.07)*.35;
col+=vec3(.25,.55,.7)*disc(p,vec2(.62,.58),.05)*.3+vec3(.7,.75,.8)*disc(p,vec2(.38,.9),.06)*.18;
col+=vec3(.9,.4,.2)*disc(p,vec2(.9,.35),.1)*.12;gl_FragColor=vec4(col,1.);}`;

export function createHandInsert() {
  const geos: T.BufferGeometry[] = [], mats: T.Material[] = [];
  const own = <M extends T.Material>(m: M) => { mats.push(m); return m; };
  const g = <G extends T.BufferGeometry>(x: G) => { geos.push(x); return x; };
  const root = new T.Group(); root.name = 'regulator-insert'; root.position.copy(INSERT);

  const glove = own(new T.MeshStandardMaterial({ color: '#1d2025', roughness: .8 }));
  const pad = own(new T.MeshStandardMaterial({ color: '#3a4048', roughness: .7 }));
  const sleeve = own(new T.MeshStandardMaterial({ color: '#2f3a4a', roughness: .95 }));
  const shell = own(new T.MeshStandardMaterial({ color: '#e7e2d8', roughness: .45, metalness: .05 }));
  const face = own(new T.MeshStandardMaterial({ color: '#22262b', roughness: .5, metalness: .3 }));
  const rockerMat = own(new T.MeshStandardMaterial({ color: '#30353b', roughness: .4, metalness: .2 }));
  // Tinted, see-through plastic. Plain transparency, not transmission: transmission would cost a
  // second render of the whole scene every frame.
  const guardMat = own(new T.MeshStandardMaterial({ color: '#6C5BA0', roughness: .25, metalness: 0, transparent: true, opacity: .78 }));
  const ledMat = own(new T.MeshBasicMaterial({ color: '#2a2638', toneMapped: false }));
  const markMat = own(new T.MeshBasicMaterial({ color: '#f7f4ef', toneMapped: false }));

  // Backdrop: the scene beyond, out of focus.
  const backdrop = new T.Mesh(g(new T.PlaneGeometry(1.4, .9)), own(new T.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}', fragmentShader: BOKEH_FS, depthWrite: false, fog: false })));
  backdrop.position.set(-.08, -.32, -.3); backdrop.lookAt(new T.Vector3().copy(INSERT_CAMERA.pos).add(new T.Vector3(0, 0, 0)));
  root.add(backdrop);

  // Left forearm across the frame, the unit strapped on top of it.
  const arm = new T.Mesh(g(new T.CapsuleGeometry(.038, .34, 8, 18)), sleeve);
  arm.rotation.z = Math.PI / 2; arm.rotation.y = .35; arm.position.set(-.03, -.045, .02); root.add(arm);
  for (const x of [-.035, .035]) { const strap = new T.Mesh(g(new T.CylinderGeometry(.0405, .0405, .016, 24)), face); strap.position.set(x * Math.cos(.35) - .03, -.045, .02 - x * Math.sin(.35)); strap.rotation.set(0, .35, Math.PI / 2); root.add(strap); }
  const unit = new T.Group(); unit.position.set(-.03, -.005, .02); unit.rotation.y = .35; root.add(unit);
  const rounded = (w: number, d: number, r: number, depth: number) => {
    const s = new T.Shape(); const x = -w / 2, y = -d / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
    s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    const geo = g(new T.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: .002, bevelSize: .002, bevelSegments: 2, curveSegments: 6 }));
    geo.rotateX(-Math.PI / 2); return geo;
  };
  const body = new T.Mesh(rounded(.11, .07, .012, .022), shell); unit.add(body);
  const plate = new T.Mesh(rounded(.08, .05, .008, .002), face); plate.position.y = .023; unit.add(plate);
  // The rocker, on a pivot across its middle: ON is the left end down.
  const rocker = new T.Group(); rocker.position.set(.005, .028, 0); unit.add(rocker);
  const rock = new T.Mesh(g(new T.BoxGeometry(.034, .01, .022)), rockerMat); rocker.add(rock);
  const onMark = new T.Mesh(g(new T.PlaneGeometry(.006, .0016)), markMat); onMark.rotation.x = -Math.PI / 2; onMark.position.set(-.01, .0052, 0); rocker.add(onMark);
  const offMark = new T.Mesh(g(new T.RingGeometry(.0018, .0028, 16)), markMat); offMark.rotation.x = -Math.PI / 2; offMark.position.set(.01, .0052, 0); rocker.add(offMark);
  // The guard cover: hinged on the far edge (-Z), it lifts toward the wrist when flipped.
  const guard = new T.Group(); guard.position.set(.005, .026, -.017); unit.add(guard);
  const cover = new T.Mesh(g(new T.BoxGeometry(.046, .016, .036)), guardMat); cover.position.set(0, .006, .017); guard.add(cover);
  const lip = new T.Mesh(g(new T.BoxGeometry(.03, .004, .006)), guardMat); lip.position.set(0, .006, .037); guard.add(lip);
  const led = new T.Mesh(g(new T.CircleGeometry(.003, 16)), ledMat); led.rotation.x = -Math.PI / 2; led.position.set(-.03, .0255, -.012); unit.add(led);
  // Output scale beside the switch: six ticks, the lowest two lit once the limit is on.
  const ticks: T.Mesh[] = [];
  for (let i = 0; i < 6; i++) { const m = new T.Mesh(g(new T.PlaneGeometry(.0025, .007)), own(new T.MeshBasicMaterial({ color: '#2a2f35', toneMapped: false }))); m.rotation.x = -Math.PI / 2; m.position.set(.03, .0255, .014 - i * .0055); m.rotation.z = Math.PI / 2; unit.add(m); ticks.push(m); }

  // The glove: palm, four jointed fingers, a jointed thumb, the sleeve cuff behind the wrist.
  const hand = new T.Group(); root.add(hand);
  const palm = new T.Mesh(g(new T.SphereGeometry(1, 20, 14)), glove); palm.scale.set(.043, .016, .05); palm.position.z = -.002; hand.add(palm);
  const cuff = new T.Mesh(g(new T.CylinderGeometry(.033, .036, .09, 18)), sleeve); cuff.rotation.x = Math.PI / 2; cuff.position.set(.004, .002, .085); hand.add(cuff);
  const wrist = new T.Mesh(g(new T.CylinderGeometry(.027, .03, .04, 16)), glove); wrist.rotation.x = Math.PI / 2; wrist.position.set(.002, .001, .04); hand.add(wrist);
  const segment = (len: number, r: number) => { const geo = g(new T.CapsuleGeometry(r, len, 4, 10)); geo.rotateX(-Math.PI / 2); geo.translate(0, 0, -len / 2); return geo; };
  const fingers: Finger[] = [];
  const specs: [number, number, number[]][] = [[-.028, .0092, [.03, .022, .018]], [-.009, .0095, [.033, .025, .019]], [.011, .009, [.031, .023, .018]], [.03, .008, [.025, .018, .015]]];
  for (const [x, r, lens] of specs) {
    const joints: T.Group[] = [];
    let parent: T.Object3D = hand, z = -.045;
    lens.forEach((len, i) => {
      const j = new T.Group(); j.position.set(i === 0 ? x : 0, i === 0 ? .002 : 0, z); parent.add(j);
      const m = new T.Mesh(segment(len, r * (1 - i * .08)), glove); j.add(m);
      if (i === 0) { const knuckle = new T.Mesh(g(new T.SphereGeometry(r * 1.05, 10, 8)), pad); knuckle.position.y = r * .5; j.add(knuckle); }
      joints.push(j); parent = j; z = -len;
    });
    fingers.push({ joints });
  }
  // Thumb: from the heel of the palm, angled out and forward; it bends across, not down.
  const thumbBase = new T.Group(); thumbBase.position.set(-.036, -.004, -.006); thumbBase.rotation.set(0, .75, -.35); hand.add(thumbBase);
  const thumb: T.Group[] = [];
  { let parent: T.Object3D = thumbBase, z = 0; [.026, .022, .019].forEach((len, i) => { const j = new T.Group(); j.position.z = z; parent.add(j); j.add(new T.Mesh(segment(len, .0105 - i * .0008), glove)); thumb.push(j); parent = j; z = -len; }); }
  root.traverse(o => { o.frustumCulled = false; });

  // The animated state; GSAP tweens these, update() applies them.
  const s = { x: .34, y: .08, z: .05, pitch: .25, roll: -.25, curl: .55, index: .45, thumb: .3, thumbIn: 0, guard: 0, rocker: .2, led: 0 };
  const rest = { x: .34, y: .08, z: .05, pitch: .25, roll: -.25, curl: .55, index: .45, thumb: .3, thumbIn: 0 };
  let timeline: gsap.core.Timeline | null = null;
  const ON = -.2, OFF = .2;

  return {
    root,
    /** Instantly set the switch without the hand (entering a beat directly). */
    set(on: boolean) { timeline?.kill(); timeline = null; Object.assign(s, rest, { guard: on ? 1.95 : 0, rocker: on ? ON : OFF, led: on ? 1 : 0 }); },
    /** Plays the reach-and-flip. onClick fires the moment the rocker lands; onDone as the hand leaves. */
    play(mode: HandMode, onClick: () => void, onDone: () => void, rate = 1, seek?: number) {
      timeline?.kill();
      Object.assign(s, rest, mode === 'off' ? { guard: 1.95, rocker: ON, led: 1 } : { guard: 0, rocker: OFF, led: 0 });
      const tl = gsap.timeline({ onComplete: onDone, defaults: { lazy: false } }); timeline = tl;
      const fast = mode === 'onFast';
      if (mode !== 'off') {
        // Reach in, thumb under the lip of the guard.
        tl.to(s, { x: .05, y: .05, z: -.02, pitch: .08, roll: -.12, curl: .35, index: .3, thumb: .05, thumbIn: .25, duration: fast ? .2 : .32, ease: 'power2.out' })
          // Thumb flicks up and the guard swings open past its stop, then settles.
          .to(s, { thumb: -.45, thumbIn: -.1, y: .062, duration: fast ? .1 : .14, ease: 'power2.in' })
          .to(s, { guard: 1.95, duration: fast ? .2 : .28, ease: 'back.out(2.4)' }, '<.04')
          // Index straightens and comes down on the ON end of the rocker.
          .to(s, { x: .093, z: .025, y: .05, index: .06, thumb: .2, thumbIn: .2, curl: .5, duration: fast ? .1 : .16, ease: 'power2.inOut' }, fast ? '-=.12' : '-=.16')
          .to(s, { y: .043, index: .12, duration: fast ? .06 : .1, ease: 'power3.in' })
          .to(s, { rocker: ON, duration: .07, ease: 'back.out(3)' }, '<.03')
          .call(() => { s.led = 1; onClick(); })
          // Settle off the switch.
          .to(s, { y: .06, x: .11, index: .3, curl: .45, duration: fast ? .12 : .2, ease: 'power2.out' })
          .to(s, { ...rest, duration: fast ? .14 : .22, ease: 'power2.in' });
      } else {
        // The guard is up. Index onto the OFF end, rock it back, then the guard snaps shut.
        tl.to(s, { x: .115, y: .055, z: -.012, pitch: .06, roll: -.1, curl: .45, index: .08, thumb: .25, duration: .3, ease: 'power2.out' })
          .to(s, { x: .112, y: .04, index: .15, duration: .11, ease: 'power3.in' })
          .to(s, { rocker: OFF, duration: .07, ease: 'back.out(3)' }, '<.04')
          .call(() => { s.led = 0; onClick(); })
          // Two fingers sweep the cover down; it falls the last part on its spring.
          .to(s, { y: .075, x: .1, z: -.03, index: .25, curl: .2, duration: .16, ease: 'power2.out' })
          .to(s, { guard: 1.1, x: .09, z: -.005, y: .068, duration: .1, ease: 'power2.in' })
          .to(s, { guard: 0, duration: .14, ease: 'bounce.out' })
          .to(s, { ...rest, duration: .26, ease: 'power2.in' }, '-=.05');
      }
      tl.timeScale(rate);
      if (seek !== undefined) tl.pause(seek);
    },
    update(t: number) {
      hand.position.set(s.x, s.y, s.z); hand.rotation.set(-s.pitch, Math.PI / 2 - .3, s.roll, 'YXZ');
      // Fingers bend at each joint, the outer joints a little less than the first.
      fingers.forEach((f, i) => {
        const c = i === 0 ? s.index : s.curl + i * .05;
        f.joints[0].rotation.x = -c * 1.1; f.joints[1].rotation.x = -c * 1.35; f.joints[2].rotation.x = -c * .9;
      });
      thumb[0].rotation.set(-s.thumb * .6, -s.thumbIn, 0); thumb[1].rotation.x = -s.thumb * .9; thumb[2].rotation.x = -s.thumb * .7;
      guard.rotation.x = -s.guard;
      rocker.rotation.z = s.rocker;
      ledMat.color.set(s.led > .5 ? '#c9b8ff' : '#2a2638').multiplyScalar(s.led > .5 ? 1.6 + .2 * Math.sin(t * 6) : 1);
      ticks.forEach((m, i) => (m.material as T.MeshBasicMaterial).color.set(s.led > .5 ? (i < 2 ? '#c9b8ff' : '#2a2f35') : (i < 6 ? '#8fe0ff' : '#2a2f35')).multiplyScalar(s.led > .5 && i < 2 ? 1.5 : s.led > .5 ? 1 : .9));
      (backdrop.material as T.ShaderMaterial).uniforms.uTime.value = t;
    },
    stop() { timeline?.kill(); timeline = null; },
    dispose() { timeline?.kill(); geos.forEach(x => x.dispose()); mats.forEach(m => m.dispose()); root.removeFromParent(); },
  };
}
export type HandInsert = ReturnType<typeof createHandInsert>;

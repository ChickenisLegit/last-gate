import * as T from 'three';
import { createFracture } from '../scenes/fracture/createFracture';
import { createLatticeBuild, type LatticeBuildWorld } from '../scenes/lattice/createLatticeBuild';
import { createFallingCity, type FallingCityWorld } from '../scenes/vector-hunt/createFallingCity';
import { createNullChamber, type NullChamberWorld } from '../scenes/null-chamber/createNullChamber';
import { BaymaxActor } from '../scenes/vector-hunt/BaymaxActor';
import { LatticeSwarm } from '../systems/lattice/LatticeSwarm';
import { RenderQuality } from '../systems/RenderQuality';
import { assets } from '../systems/AssetManager';
import { PhaseTwoCamera } from './PhaseTwoCamera';
import { PhaseTwoPost } from './PhaseTwoPost';
import { PhaseTwoDirector, type Stage } from './model';
import type { ChapterWorld } from './SceneKit';
import type { PhaseTwoAudio } from './PhaseTwoAudio';
import { ATTACK_START, ATTACK_END } from '../systems/vector/paths';

type World = ChapterWorld & Partial<Pick<LatticeBuildWorld, 'pickables' | 'components'>> & Partial<Pick<FallingCityWorld, 'attackScar' | 'captureLine'>> & Partial<Pick<NullChamberWorld, 'anchors' | 'decoy'>>;
const chapterFor = (stage: Stage) => stage === 'fracture' || stage === 'afterimage' ? 'fracture' : stage === 'build' || stage === 'lattice' ? 'build' : stage === 'hunt' || stage === 'descent' ? 'hunt' : 'null';

/** All live Phase II systems share this single update and are owned by its lifetime. */
export class PhaseTwoRuntime {
  readonly cameraDirector = new PhaseTwoCamera();
  private world!: World;
  private chapter = '';
  private root = new T.Group();
  private swarm = new LatticeSwarm();
  private baymax = new BaymaxActor();
  private post: PhaseTwoPost;
  private quality = new RenderQuality(false);
  private raycaster = new T.Raycaster();
  private pointer = new T.Vector2(3, 3);
  private projected = new T.Vector3();
  private projectedB = new T.Vector3();
  private focusA = new T.Vector3();
  private focusB = new T.Vector3();
  private width = 1920;
  private height = 1080;
  private statsTime = 0;
  private loaded = false;
  private alive = true;
  private dragIndex = -1;
  private dragPlane = new T.Plane(new T.Vector3(0, 0, 1), 2);
  private dragPoint = new T.Vector3();
  private dragging = false;
  private cleanup: (() => void)[] = [];
  private pickTargets: T.Intersection[] = [];
  private reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(private gl: T.WebGLRenderer, private scene: T.Scene, private camera: T.PerspectiveCamera, readonly director: PhaseTwoDirector, private audio: PhaseTwoAudio, private setDpr: (value: number) => void) {
    this.root.name = 'PHASE II / active systems';
    this.scene.add(this.root);
    this.scene.background = new T.Color('#07121f');
    this.scene.fog = new T.FogExp2('#12273b', .0075);
    this.scene.environmentIntensity = .15;
    const ambient = new T.HemisphereLight('#aecce8', '#081121', 2.1);
    const key = new T.DirectionalLight('#c9e3f0', 3.3);
    key.position.set(-10, 16, 8);
    const fill = new T.DirectionalLight('#3b74a6', 1.4);
    fill.position.set(14, 3, -24);
    this.root.add(ambient, key, fill, this.swarm.root, this.baymax.root);
    this.post = new PhaseTwoPost(gl, scene, camera);
    this.resize(gl.domElement.clientWidth, gl.domElement.clientHeight);
    this.setWorld();
    this.installInput();
  }

  private setWorld() {
    const chapter = chapterFor(this.director.getSnapshot().stage);
    if (chapter === this.chapter) return;
    this.world?.dispose();
    this.world = chapter === 'fracture' ? createFracture(this.director) : chapter === 'build' ? createLatticeBuild(this.director) : chapter === 'hunt' ? createFallingCity(this.director) : createNullChamber(this.director);
    this.chapter = chapter;
    this.root.add(this.world.root);
    const fog = this.scene.fog as T.FogExp2;
    fog.color.set(chapter === 'null' ? '#080e1e' : '#12273b');
    fog.density = chapter === 'null' ? .0048 : chapter === 'hunt' ? .0105 : .0075;
    (this.scene.background as T.Color).set(chapter === 'null' ? '#030714' : '#081421');
    if ((chapter === 'build' || chapter === 'hunt' || chapter === 'null') && !this.loaded) {
      this.loaded = true;
      assets.loadBaymax().then(model => { if (this.alive) this.baymax.attachModel(model); }).catch(() => {
        // The isolated procedural silhouette stays visible if the optional shell fails.
        this.gl.domElement.dataset.baymax = 'procedural-fallback';
      });
    }
  }

  resize(width: number, height: number) {
    this.width = width; this.height = height;
    const ratio = this.quality.level === 'LOW' ? .85 : this.quality.level === 'MEDIUM' ? 1 : Math.min(devicePixelRatio, 1.25);
    this.setDpr(ratio);
    this.post.resize(width, height, ratio);
  }

  private installInput() {
    const canvas = this.gl.domElement;
    const move = (event: PointerEvent) => {
      this.pointer.set(event.clientX / this.width * 2 - 1, -(event.clientY / this.height * 2 - 1));
      this.cameraDirector.pointer.set(this.pointer.x, -this.pointer.y);
      if (this.dragIndex >= 0 && this.world.components) {
        this.raycaster.setFromCamera(this.pointer, this.camera);
        if (this.raycaster.ray.intersectPlane(this.dragPlane, this.dragPoint)) {
          const part = this.world.components[this.dragIndex];
          part.position.lerp(this.dragPoint, .55);
          if (part.position.distanceTo(new T.Vector3(0, .35, -1.7)) < 1.35) {
            this.director.connect(this.dragIndex); this.dragIndex = -1; this.director.drag = false;
          }
        }
      }
    };
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if (this.world.pickables && this.director.getSnapshot().stage === 'build') {
        this.raycaster.setFromCamera(this.pointer, this.camera);
        this.pickTargets.length = 0;
        this.raycaster.intersectObjects(this.world.pickables, true, this.pickTargets);
        if (this.pickTargets[0]) {
          const index = this.pickTargets[0].object.userData.componentIndex;
          if (typeof index === 'number') {
            this.director.select(index); this.dragIndex = index;
            this.director.drag = true; this.dragging = true;
            canvas.setPointerCapture(event.pointerId);
          }
        }
      } else if (this.director.focused) this.director.act();
    };
    const release = () => { this.dragIndex = -1; this.dragging = false; this.director.drag = false; this.director.recording = false; };
    const keydown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.target instanceof HTMLElement && event.target.closest('button,input,select')) return;
      if (event.code === 'KeyE') {
        event.preventDefault();
        if (!event.repeat) this.director.act();
        this.director.recording = true;
      }
      if (['KeyW', 'ArrowUp', 'Space'].includes(event.code)) {
        event.preventDefault();
        if (!event.repeat && this.director.getSnapshot().stage === 'hunt') this.director.act();
      }
      if (['KeyQ', 'KeyR'].includes(event.code) && this.world.components && this.director.getSnapshot().stage === 'build') {
        const component = this.world.components[this.director.getSnapshot().selected];
        component.rotation.z += event.code === 'KeyQ' ? -.2 : .2;
      }
      if (event.code === 'Tab' && this.director.getSnapshot().stage === 'build') {
        event.preventDefault();
        const s = this.director.getSnapshot();
        for (let i = 1; i < 4; i++) { const next = (s.selected + i) % 3; if (!(s.assembled & (1 << next))) { this.director.select(next); break; } }
      }
    };
    const keyup = (event: KeyboardEvent) => { if (event.code === 'KeyE') this.director.recording = false; };
    const wheel = (event: WheelEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('button,nav')) return;
      event.preventDefault();
      const s = this.director.getSnapshot();
      if (s.stage === 'hunt' && !s.lured && event.deltaY > 0) this.director.act();
      if (s.stage === 'build' && this.world.components) this.world.components[s.selected].rotation.y += event.deltaY * .0025;
    };
    const visibility = () => { this.director.paused = document.hidden; if (document.hidden) release(); };
    canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerdown', down);
    window.addEventListener('pointerup', release); window.addEventListener('blur', release);
    window.addEventListener('keydown', keydown); window.addEventListener('keyup', keyup);
    window.addEventListener('wheel', wheel, { passive: false }); document.addEventListener('visibilitychange', visibility);
    this.cleanup.push(() => {
      canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointerup', release); window.removeEventListener('blur', release);
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup);
      window.removeEventListener('wheel', wheel); document.removeEventListener('visibilitychange', visibility);
    });
  }

  private focus() {
    const s = this.director.getSnapshot();
    const trace = s.stage === 'afterimage' && !s.stored || s.stage === 'hunt' && this.director.huntTime >= 20 && !s.captured;
    if (!trace || this.pointer.x > 2) { this.director.focused = false; return; }
    if (s.stage === 'afterimage') { this.focusA.set(-4, 1.1, -5); this.focusB.set(8.5, 5.4, -55); }
    else { this.focusA.set(...ATTACK_START); this.focusB.set(...ATTACK_END); }
    this.projected.copy(this.focusA).project(this.camera);
    this.projectedB.copy(this.focusB).project(this.camera);
    const ax = this.projected.x, ay = this.projected.y, dx = this.projectedB.x - ax, dy = this.projectedB.y - ay;
    const t = T.MathUtils.clamp(((this.pointer.x - ax) * dx + (this.pointer.y - ay) * dy) / Math.max(.0001, dx * dx + dy * dy), 0, 1);
    const distance = Math.hypot((this.pointer.x - ax - dx * t) * this.width / this.height, this.pointer.y - ay - dy * t);
    this.director.focused = distance < .085;
  }

  update(delta: number) {
    if (!this.alive || this.director.paused) return;
    const dt = Math.min(delta, .05);
    this.focus(); this.director.step(dt); this.setWorld();
    const d = this.director, s = d.getSnapshot();
    this.cameraDirector.update(this.camera, d, dt);
    this.world.update(d.time, dt);
    this.swarm.root.visible = ['lattice', 'hunt', 'descent', 'null', 'ready'].includes(s.stage);
    if (this.swarm.root.visible) {
      this.swarm.root.position.set(0, s.stage === 'lattice' ? .8 : 1.5, s.stage === 'lattice' ? -1.7 : 3.2);
      if (s.stage === 'null' || s.stage === 'ready') this.swarm.root.position.set(0, 0, -8);
      if (s.stage === 'hunt' && d.mode === 'shield') this.swarm.root.position.set(-3, .8, 1.5);
      this.swarm.update(d.time, d.mode, d.stageTime, s.anchors, s.decoy, s.stage, dt, this.camera, d.huntTime);
    }
    this.baymax.update(d.time, s.stage, d.huntState, s.stage === 'hunt' ? d.huntTime : d.stageTime);
    this.audio.update(d);
    if (this.quality.sample(delta, !document.hidden)) {
      this.post.setLow(this.quality.level === 'LOW'); this.resize(this.width, this.height);
    }
    const arrival = s.stage === 'fracture' ? 1 - T.MathUtils.smoothstep(d.stageTime, 1.3, 5.5) : 0;
    const impact = s.stage === 'hunt' ? Math.max(0, 1 - Math.abs(d.huntTime - 16.5) * 2.3) : 0;
    this.gl.toneMappingExposure = 1.12;
    this.gl.info.reset();
    this.post.render(dt, d.time, arrival, this.reduced ? 0 : impact);
    this.statsTime += dt;
    if (this.statsTime > .25) {
      this.statsTime = 0;
      const canvas = this.gl.domElement;
      canvas.dataset.phase2 = s.stage; canvas.dataset.chapter = this.chapter;
      canvas.dataset.model = String(s.model); canvas.dataset.huntState = d.huntState;
      canvas.dataset.drawCalls = String(this.gl.info.render.calls);
      canvas.dataset.triangles = String(this.gl.info.render.triangles);
      canvas.dataset.geometries = String(this.gl.info.memory.geometries);
      canvas.dataset.quality = this.quality.level;
      canvas.style.cursor = this.dragging ? 'grabbing' : s.stage === 'build' ? 'grab' : d.focused ? 'crosshair' : 'default';
    }
  }
  dispose() {
    this.alive = false; this.cleanup.forEach(fn => fn());
    this.world.dispose(); this.swarm.dispose(); this.baymax.dispose(); this.post.dispose();
    this.root.removeFromParent(); this.scene.fog = null; this.scene.background = null;
  }
}

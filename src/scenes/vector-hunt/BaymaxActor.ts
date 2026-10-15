import * as T from 'three';
import type { HuntState } from '../../phase2/model';

/** Authored Baymax staging. The GLB has no animation clips, so all motion is transform based. */
export class BaymaxActor {
  readonly root = new T.Group();
  private fallback = new T.Group();
  private model: T.Object3D | null = null;
  private eye: T.Mesh;
  private redLight: T.PointLight;
  private readonly bodyMat = new T.MeshStandardMaterial({ color: '#e8edf1', roughness: .65, metalness: .02 });
  private readonly redMat = new T.MeshBasicMaterial({ color: '#ef3d42', transparent: true, opacity: .9 });
  private target = new T.Vector3();
  private ownedMaterials = new Set<T.Material>();
  private eyes: T.Mesh[] = [];
  private scaleTarget = new T.Vector3();
  private state: HuntState = 'HIDDEN';

  constructor() {
    this.root.name = 'BAYMAX / authored vector hunter';
    const body = new T.Mesh(new T.SphereGeometry(1.15, 20, 14), this.bodyMat);
    body.scale.set(.92, 1.12, .62);
    body.position.y = .18;
    this.fallback.add(body);
    const head = new T.Mesh(new T.SphereGeometry(.54, 16, 10), this.bodyMat);
    head.scale.z = .62;
    head.position.set(0, 1.58, -.02);
    this.fallback.add(head);
    const eyeBar = new T.Mesh(new T.BoxGeometry(.52, .045, .045), this.redMat);
    eyeBar.position.set(0, 1.6, -.34);
    this.eye = eyeBar;
    this.fallback.add(eyeBar);
    const left = new T.Mesh(new T.SphereGeometry(.08, 8, 6), this.redMat);
    left.position.set(-.27, 1.6, -.34);
    const right = left.clone(); right.position.x = .27;
    this.fallback.add(left, right);
    const shoulder = new T.Mesh(new T.CapsuleGeometry(.23, 1.25, 5, 10), this.bodyMat);
    shoulder.rotation.z = Math.PI / 2; shoulder.position.set(0, .3, 0);
    this.fallback.add(shoulder);
    this.root.add(this.fallback);
    this.redLight = new T.PointLight('#f03b41', 0, 9, 2.1);
    this.redLight.position.set(0, 1.5, .2);
    this.root.add(this.redLight);
  }

  attachModel(model: T.Object3D) {
    this.model?.removeFromParent();
    this.model = model.clone(true);
    this.model.position.set(0, 0, 0);
    this.model.rotation.set(0, 0, 0);
    this.model.name = 'Baymax shell / phase two clone';
    this.model.traverse(object => {
      if (object instanceof T.Mesh) {
        const clone = (material: T.Material) => { const copy = material.clone(); this.ownedMaterials.add(copy); return copy; };
        object.material = Array.isArray(object.material) ? object.material.map(clone) : clone(object.material);
        if (object.name === 'dormant-eye') {
          const eye = new T.MeshBasicMaterial({color: '#ff3344', toneMapped: false});
          this.ownedMaterials.add(eye); object.material = eye; this.eyes.push(object);
        }
        object.castShadow = false; object.receiveShadow = false;
      }
    });
    this.model.scale.setScalar(.9);
    this.model.rotation.y = 0;
    this.root.add(this.model);
    this.fallback.visible = false;
  }

  setState(state: HuntState) { this.state = state; }

  update(time: number, stage: string, huntState: HuntState, stageTime: number) {
    this.state = huntState;
    const visible = stage === 'hunt' || stage === 'descent' || stage === 'null' || stage === 'ready';
    this.root.visible = visible && huntState !== 'HIDDEN';
    if (!visible) return;
    let p: [number, number, number] = [0, 2, -70];
    let scale = .28;
    if (stage === 'null' || stage === 'ready') {
      if (huntState === 'DISTANT') { p = [0, 3.2, -92]; scale = .22; }
      else if (huntState === 'APPROACHING') { p = [0, 2.3, -34]; scale = .42; }
      else { p = [0, 1.4, -16]; scale = .72; }
    } else {
      if (huntState === 'DISTANT') { p = [10, 5, -72]; scale = .3; }
      else if (huntState === 'TRACKING') { p = [-8, 4, -45]; scale = .48; }
      else if (huntState === 'REPOSITION') { p = [6, 5 + Math.sin(time) * .8, -28]; scale = .6; }
      else if (huntState === 'APPROACHING') { p = [2.5, 3.1, -17]; scale = .82; }
      else if (huntState === 'ATTACK_PREP') { p = [0, 1.35, -10]; scale = 1.02; }
      else if (huntState === 'ATTACK') { p = [-1.2, 1.2, -7]; scale = 1.08; }
      else if (huntState === 'RECOVERY') { p = [-9, 3.5, -29]; scale = .58; }
    }
    this.target.set(...p);
    this.root.position.lerp(this.target, Math.min(1, .045 + stageTime * .006));
    this.root.scale.lerp(this.scaleTarget.setScalar(scale), .08);
    this.root.rotation.y = Math.sin(time * .35) * .05;
    this.root.rotation.z = Math.sin(time * .24) * .025;
    const threat = huntState === 'ATTACK_PREP' || huntState === 'ATTACK' || stage === 'ready';
    this.redLight.intensity = threat ? 2.6 + Math.sin(time * 8) * .6 : huntState === 'HIDDEN' ? 0 : .7;
    if (this.eye.material instanceof T.MeshBasicMaterial) this.eye.material.opacity = threat ? .98 : .7;
    if (this.model) {
      this.eyes.forEach(object => { if (object.material instanceof T.MeshBasicMaterial) object.material.color.set(threat ? '#ff5263' : '#ef3038'); });
    }
  }

  dispose() {
    this.root.removeFromParent();
    this.bodyMat.dispose(); this.redMat.dispose();
    this.ownedMaterials.forEach(material => material.dispose());
    this.fallback.traverse(object => { if (object instanceof T.Mesh) object.geometry.dispose(); });
    this.model = null;
  }
}

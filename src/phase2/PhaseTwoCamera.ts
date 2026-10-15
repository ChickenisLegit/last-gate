import * as T from 'three';
import type { PhaseTwoDirector } from './model';

export class PhaseTwoCamera {
  pointer = new T.Vector2();
  private smooth = new T.Vector2();
  private position = new T.Vector3(0, 2.1, 10);
  private target = new T.Vector3(0, 2.8, -24);
  private look = new T.Vector3(0, 2.8, -24);
  private roll = 0;
  private first = true;

  update(camera: T.PerspectiveCamera, director: PhaseTwoDirector, dt: number) {
    const s = director.getSnapshot(), t = director.stageTime;
    const weightless = s.stage === 'fracture' ? 1 - T.MathUtils.smoothstep(t, 1.5, 7.5) : 0;
    const damp = 1 - Math.exp(-dt * (weightless ? 1.3 : 3.5));
    this.smooth.lerp(this.pointer, damp);
    this.position.set(0, 2.1, 10);
    this.target.set(.5, 3.1, -26);
    if (s.stage === 'build' || s.stage === 'lattice') {
      this.position.set(0, 3.25, 8.1); this.target.set(0, .9, -2.4);
    }
    if (s.stage === 'hunt' || s.stage === 'descent') {
      const travel = s.lured ? T.MathUtils.smoothstep(director.huntTime, 0, 4) : 0;
      this.position.set(.15, 2.5, 13 - travel * 4.2);
      this.target.set(0, 3.3, -25);
      const hit = Math.max(0, 1 - Math.abs(director.huntTime - 16.5) * 2.7);
      this.position.x += Math.sin(director.time * 64) * hit * .13;
      this.position.y += Math.cos(director.time * 47) * hit * .08;
      if (s.stage === 'descent') {
        this.position.z -= T.MathUtils.smoothstep(t, 0, 10) * 27;
        this.target.set(0, 3, -72);
      }
    }
    if (s.stage === 'null' || s.stage === 'ready') {
      this.position.set(1.25, 2.15, 10.5);
      this.target.set(0, 1.1, -34);
    }
    const still = s.stage === 'null' || s.stage === 'ready';
    const mouse = still ? .035 : s.stage === 'build' ? .08 : .24;
    this.position.x += this.smooth.x * mouse;
    this.position.y -= this.smooth.y * mouse * .55;
    this.position.x += Math.sin(director.time * .24) * .14 * weightless;
    this.position.y += Math.cos(director.time * .21) * .2 * weightless;
    this.target.x += this.smooth.x * mouse * 1.4;
    this.target.y -= this.smooth.y * mouse;
    const roll = weightless * (-.28 + Math.sin(director.time * .5) * .06);
    const speed = this.first ? 1 : 1 - Math.exp(-dt * (still ? 1.2 : 2.4));
    camera.position.lerp(this.position, speed);
    this.look.lerp(this.target, speed);
    this.roll = T.MathUtils.lerp(this.roll, roll, speed);
    camera.up.set(Math.sin(this.roll), Math.cos(this.roll), 0);
    camera.lookAt(this.look);
    camera.fov = T.MathUtils.lerp(camera.fov, s.stage === 'build' ? 42 : still ? 47 : 51, speed);
    camera.updateProjectionMatrix();
    this.first = false;
  }
}

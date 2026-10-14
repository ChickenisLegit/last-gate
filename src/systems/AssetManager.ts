import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Group } from 'three';
import { MODEL_URL } from '../config/experience';

class AssetManager {
  private baymax: Promise<Group> | null = null;
  loadBaymax(): Promise<Group> {
    this.baymax ??= new GLTFLoader().loadAsync(MODEL_URL).then(gltf => {
      gltf.scene.traverse(object => { if ('isMesh' in object) { object.castShadow = true; object.receiveShadow = true; } });
      return gltf.scene;
    }).catch(error=>{this.baymax=null;throw error;});
    return this.baymax;
  }
}
export const assets = new AssetManager();

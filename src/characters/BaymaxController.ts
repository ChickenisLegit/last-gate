import { CanvasTexture, Color, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, RepeatWrapping, type Group } from 'three';
import { BAYMAX_POSITION } from '../config/experience';
import type { Phase } from '../state/SceneStateManager';

export class BaymaxController {
  private access:Group|null=null; private internal:Group|null=null; private seal:Group|null=null;
  private eyes:Mesh[]=[]; private started=false;
  constructor(public readonly shell: Group) {
    shell.position.set(...BAYMAX_POSITION);
    shell.rotation.y = -.18;
    shell.name = 'Baymax / dormant shell';
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#bbbbbb';ctx.fillRect(0,0,128,128);
    for(let y=0;y<128;y+=4)for(let x=0;x<128;x+=4){const v=178+Math.sin(x*.31+y*.2)*5;ctx.fillStyle=`rgb(${v},${v},${v})`;ctx.fillRect(x,y,4,4);}
    const roughness=new CanvasTexture(canvas);roughness.wrapS=roughness.wrapT=RepeatWrapping;roughness.repeat.set(3,3);
    const skin=new MeshPhysicalMaterial({color:'#eee8dc',roughness:.79,roughnessMap:roughness,metalness:0,sheen:.38,sheenColor:new Color('#ead8c3'),sheenRoughness:.9,clearcoat:.02,envMapIntensity:.45});
    shell.traverse(object=>{
      if(object.name==='medical-interface')this.internal=object as Group;
      if(object.name==='access-seal')this.seal=object as Group;
      if(object.name==='access-panel'||object.name==='access-ring')this.access ??= object.parent as Group;
      if(object instanceof Mesh&&!Array.isArray(object.material)){
        if(object.material.name==='inflatable')object.material=skin;
        else if(object.material.name==='armor'){object.material=new MeshPhysicalMaterial({name:'armor',color:'#8c1531',roughness:.3,metalness:.48,clearcoat:.28,clearcoatRoughness:.36,envMapIntensity:.65});}
        if(object.name==='dormant-eye')this.eyes.push(object);
      }
    });
    this.internal && (this.internal.visible=false);
    this.seal && (this.seal.visible=false);
  }
  update(time:number,reduced:boolean,phase:Phase='approaching'){
    if(reduced)return;
    this.shell.position.y=BAYMAX_POSITION[1]-.009*(1-Math.exp(-time*.18));
    const head=this.shell.getObjectByName('dormant-head');
    if(head)head.rotation.z=-.12-.006*(1-Math.exp(-time*.12));
    const opening=['panel-opening','socket-ready','inserting'].includes(phase);
    if(this.access){
      const p=opening?1:0;
      this.access.position.z=.63+p*.13;
      this.access.rotation.z=opening?Math.sin(time*1.8)*.008:0;
      this.access.visible=!['silence','booting','diagnostic','threat','corrupted'].includes(phase);
    }
    if(this.internal){
      this.internal.visible=opening||['sealing','silence','booting','diagnostic','threat','corrupted'].includes(phase);
      const glow=this.internal.children.find(o=>o instanceof Mesh && o.material instanceof MeshBasicMaterial) as Mesh|undefined;
      if(glow&&glow.material instanceof MeshBasicMaterial)glow.material.opacity=.48+Math.max(0,Math.sin(time*2.1))*.22;
    }
    if(this.seal){this.seal.visible=['sealing','silence','booting','diagnostic','threat','corrupted'].includes(phase);this.seal.position.z=.63+(phase==='sealing'?.13:0);}
    const normal=['booting','diagnostic'].includes(phase), corrupted=['threat','corrupted'].includes(phase);
    this.eyes.forEach((eye,i)=>{const mat=eye.material as MeshBasicMaterial;mat.color.set(corrupted?'#d42b2b':normal?'#c4f2ff':'#172022');if(corrupted)mat.color.multiplyScalar(1.2);});
    if(phase==='threat'||phase==='corrupted'){
      const threatHead=this.shell.getObjectByName('dormant-head');if(threatHead)threatHead.rotation.y=Math.sin(time*.8)*.04-.18;
    }
  }
  // Dormancy is deliberate. Future boot animation belongs to RED_WAKE.
  dispose() { this.shell.removeFromParent(); }
}

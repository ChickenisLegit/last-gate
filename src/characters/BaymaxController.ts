import { CanvasTexture, Color, Mesh, MeshPhysicalMaterial, RepeatWrapping, type Group } from 'three';
import { BAYMAX_POSITION } from '../config/experience';

export class BaymaxController {
  constructor(public readonly shell: Group) {
    shell.position.set(...BAYMAX_POSITION);
    shell.rotation.y = -.18;
    shell.name = 'Baymax / dormant shell';
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#bbbbbb';ctx.fillRect(0,0,128,128);
    for(let y=0;y<128;y+=4)for(let x=0;x<128;x+=4){const v=178+Math.sin(x*.31+y*.2)*5;ctx.fillStyle=`rgb(${v},${v},${v})`;ctx.fillRect(x,y,4,4);}
    const roughness=new CanvasTexture(canvas);roughness.wrapS=roughness.wrapT=RepeatWrapping;roughness.repeat.set(3,3);
    const skin=new MeshPhysicalMaterial({color:'#eee8dc',roughness:.79,roughnessMap:roughness,metalness:0,sheen:.38,sheenColor:new Color('#ead8c3'),sheenRoughness:.9,clearcoat:.02,envMapIntensity:.45});
    shell.traverse(object=>{if(object instanceof Mesh&&!Array.isArray(object.material)){
      if(object.material.name==='inflatable')object.material=skin;
      else if(object.material.name==='armor'){object.material=new MeshPhysicalMaterial({name:'armor',color:'#8c1531',roughness:.3,metalness:.48,clearcoat:.28,clearcoatRoughness:.36,envMapIntensity:.65});}
    }});
  }
  update(time:number,reduced:boolean){if(!reduced){this.shell.position.y=BAYMAX_POSITION[1]-.009*(1-Math.exp(-time*.18));const head=this.shell.getObjectByName('dormant-head');if(head)head.rotation.z=-.12-.006*(1-Math.exp(-time*.12));}}
  // Dormancy is deliberate. Future boot animation belongs to RED_WAKE.
  dispose() { this.shell.removeFromParent(); }
}

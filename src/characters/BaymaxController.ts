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
    const skin=new MeshPhysicalMaterial({color:'#e9e2d5',roughness:.84,roughnessMap:roughness,metalness:0,sheen:.46,sheenColor:new Color('#e5cdb5'),sheenRoughness:.95,clearcoat:.025,envMapIntensity:.3});
    shell.traverse(object=>{if(object instanceof Mesh&&!Array.isArray(object.material)){
      if(object.material.name==='inflatable')object.material=skin;
      else if(object.material instanceof MeshPhysicalMaterial){object.material.envMapIntensity=.55;}
    }});
  }
  update(time:number,reduced:boolean){if(!reduced){this.shell.position.y=BAYMAX_POSITION[1]-.009*(1-Math.exp(-time*.18));const head=this.shell.getObjectByName('dormant-head');if(head)head.rotation.z=-.12-.006*(1-Math.exp(-time*.12));}}
  // Dormancy is deliberate. Future boot animation belongs to RED_WAKE.
  dispose() { this.shell.removeFromParent(); }
}

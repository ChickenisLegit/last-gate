import * as T from 'three';
import type { LatticeMode, Stage } from '../../phase2/model';
import { ATTACK_START, ATTACK_END, ANCHORS, DECOY } from '../vector/paths';

/** One instanced mesh; preallocated interpolation buffers; all modes use physical coordinates. */
export class LatticeSwarm {
  readonly root = new T.Group();
  private readonly max = 420;
  private readonly geometry = new T.BoxGeometry(.045, .022, .085);
  private readonly material = new T.MeshStandardMaterial({color:'#83a5b5',roughness:.36,metalness:.7,emissive:'#367892',emissiveIntensity:.5});
  private readonly mesh = new T.InstancedMesh(this.geometry,this.material,this.max);
  private readonly dummy = new T.Object3D();
  private readonly positions = new Float32Array(this.max*3);
  private readonly seed = new Float32Array(this.max*3);
  private started=false;
  constructor(){
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.mesh.frustumCulled=false;
    let seed=0x4c415454;
    for(let i=0;i<this.seed.length;i++){seed=(seed*1664525+1013904223)>>>0;this.seed[i]=seed/4294967296*2-1;}
    const color=new T.Color();
    for(let i=0;i<this.max;i++)this.mesh.setColorAt(i,color.set(i%9===0?'#b9f5ff':i%3===0?'#5b97ad':'#9eb1bc'));
    this.root.add(this.mesh);
  }
  update(time:number,mode:LatticeMode,stageTime:number,anchors=0,decoy=false,stage:Stage='lattice',dt=1/60,camera?:T.Camera,huntTime=0){
    const chamber=stage==='null'||stage==='ready';
    const count=chamber?330:this.max;
    const reveal=stage==='lattice'?T.MathUtils.smoothstep(stageTime,0,3):1;
    this.mesh.count=Math.max(18,Math.floor(count*reveal));
    this.material.emissiveIntensity=mode==='shield'?.9:.45;
    const blend=1-Math.exp(-dt*(mode==='shield'?13:mode==='crossing'?8:4.5));
    for(let i=0;i<this.mesh.count;i++){
      const a=this.seed[i*3],b=this.seed[i*3+1],c=this.seed[i*3+2];
      const phase=i/this.mesh.count,angle=phase*Math.PI*2+time*.12;
      let x=Math.cos(angle)*(1.4+Math.abs(a)*1.5),y=.7+Math.sin(angle*2)*.6+b*.35,z=Math.sin(angle)*.8-1.3,scale=.8+Math.abs(b)*.6;
      const anchorBot=chamber&&i<144;
      const decoyBot=chamber&&i>=144&&decoy;
      if(mode==='crossing'&&camera){
        const u=T.MathUtils.smoothstep(stageTime,15,18);
        x=a*6.5;y=b*3.6;z=-11+u*10.85+c*.28;
        this.dummy.position.set(x,y,z).applyQuaternion(camera.quaternion).add(camera.position).sub(this.root.position);
        x=this.dummy.position.x;y=this.dummy.position.y;z=this.dummy.position.z;scale=2.5+u*7;
      }else if(anchorBot){
        const index=i%3,point=ANCHORS[index];
        const u=T.MathUtils.smoothstep(stageTime,3+index*3,5+index*3);
        const travel=stage==='ready'?1:u;
        x=T.MathUtils.lerp(x,point[0]+Math.cos(angle*7)*.55-this.root.position.x,travel);
        y=T.MathUtils.lerp(y,point[1]+Math.sin(angle*7)*.55-this.root.position.y,travel);
        z=T.MathUtils.lerp(z,point[2]+c*.18-this.root.position.z,travel);
        scale=.8;
      }else if(mode==='decoy'||decoyBot){
        const t=decoyBot?(i-144)/(this.mesh.count-144):phase;
        if(t<.22){const theta=t/.22*Math.PI*8;x=Math.cos(theta)*.3;y=1.6+b*.3;z=Math.sin(theta)*.25;}
        else if(t<.66){const u=(t-.22)/.44;x=a*(.38+Math.sin(u*Math.PI)*.12);y=1.3-u*1.2;z=c*.18;}
        else if(t<.82){const u=(t-.66)/.16;x=(i%2?1:-1)*(.42+u*.13);y=1.1-u*.95;z=c*.12;}
        else {const u=(t-.82)/.18;x=(i%2?1:-1)*(.19+u*.12);y=.15-u*1.05;z=c*.15;}
        if(decoyBot){x+=DECOY[0]-this.root.position.x;y+=DECOY[1]-this.root.position.y;z+=DECOY[2]-this.root.position.z;}
        scale=.75;
      }else if(mode==='shield'){
        const column=i%28,row=Math.floor(i/28),theta=(column/27-.5)*2.15;
        x=Math.sin(theta)*2.25;y=(row/14)*3.1-.35;z=Math.cos(theta)*.8-1.1;
        scale=1.7;
        const fracture=stage==='hunt'?T.MathUtils.smoothstep(huntTime,16.1,16.4):0;
        x+=a*fracture*4;y+=b*fracture*3;z+=c*fracture*3;
      }else if(mode==='trace'&&(stage==='hunt'||stage==='descent')){
        const u=(phase+time*.16)%1;
        x=T.MathUtils.lerp(ATTACK_START[0],ATTACK_END[0],u)-this.root.position.x;
        y=T.MathUtils.lerp(ATTACK_START[1],ATTACK_END[1],u)-this.root.position.y+b*.04;
        z=T.MathUtils.lerp(ATTACK_START[2],ATTACK_END[2],u)-this.root.position.z+c*.04;
        scale=.7;
      }else if(mode==='trace'){
        const u=(phase+time*.13)%1;x=-3.8+u*7.6;y=.3+u*2.7;z=-1-u*6;scale=.65;
      }else if(mode==='anchor'&&!chamber){
        const index=i%3;x=(index-1)*3+Math.cos(angle*6)*.45;y=.1+Math.sin(angle*6)*.45;z=-2.5+c*.2;scale=.65;
      }
      if(!this.started){this.positions[i*3]=x;this.positions[i*3+1]=y;this.positions[i*3+2]=z;}
      this.positions[i*3]+=(x-this.positions[i*3])*blend;
      this.positions[i*3+1]+=(y-this.positions[i*3+1])*blend;
      this.positions[i*3+2]+=(z-this.positions[i*3+2])*blend;
      this.dummy.position.set(this.positions[i*3],this.positions[i*3+1],this.positions[i*3+2]);
      this.dummy.rotation.set(time*.35+a*3,time*.23+b*3,c*3);
      this.dummy.scale.setScalar(scale);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);
    }
    this.started=true;this.mesh.instanceMatrix.needsUpdate=true;
  }
  dispose(){this.root.removeFromParent();this.mesh.dispose();this.geometry.dispose();this.material.dispose();}
}

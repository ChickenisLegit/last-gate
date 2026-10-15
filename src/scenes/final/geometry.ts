import * as T from 'three';

export const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
export function mesh(parent:T.Object3D,geo:T.BufferGeometry,mat:T.Material,x=0,y=0,z=0){const m=new T.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m;}
export function box(parent:T.Object3D,mat:T.Material,x:number,y:number,z:number,w:number,h:number,d:number){return mesh(parent,new T.BoxGeometry(w,h,d),mat,x,y,z);}
export function ellipsoid(parent:T.Object3D,mat:T.Material,x:number,y:number,z:number,sx:number,sy:number,sz:number){const m=mesh(parent,new T.SphereGeometry(1,24,16),mat,x,y,z);m.scale.set(sx,sy,sz);return m;}
export function line(parent:T.Object3D,points:T.Vector3[],color:string,opacity=1){const m=new T.Line(new T.BufferGeometry().setFromPoints(points),new T.LineBasicMaterial({color,transparent:true,opacity,depthWrite:false}));parent.add(m);return m;}
export function tube(parent:T.Object3D,points:T.Vector3[],radius:number,mat:T.Material){const curve=new T.CatmullRomCurve3(points);const m=mesh(parent,new T.TubeGeometry(curve,64,radius,5,false),mat);return {mesh:m,curve};}
export function seeded(seed=41){return()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};}
export function labelTexture(text:string,sub=''){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle='#caf5ff';ctx.font='22px monospace';ctx.letterSpacing='4px';ctx.fillText(text,12,52);ctx.fillStyle='#739aa6';ctx.font='14px monospace';ctx.fillText(sub,12,85);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;return t;}
export function disposeTree(root:T.Object3D){const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();root.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Line||o instanceof T.Points){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);}}});geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();}

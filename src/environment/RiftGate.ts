import * as T from 'three';

/** A clear opening between two worlds, bounded by a thin torn light seam. */
export function createPortalGate(z=24) {
  const group=new T.Group();group.name='PortalGate';group.position.set(0,4.2,z);
  const geometries:T.BufferGeometry[]=[],materials:T.Material[]=[];
  const mesh=(geometry:T.BufferGeometry,material:T.Material)=>{geometries.push(geometry);materials.push(material);const m=new T.Mesh(geometry,material);group.add(m);return m;};
  const maskMaterial=new T.MeshBasicMaterial({colorWrite:false,depthWrite:false,depthTest:false,side:T.DoubleSide,stencilWrite:true,stencilRef:1,stencilFunc:T.AlwaysStencilFunc,stencilZPass:T.ReplaceStencilOp});
  const mask=mesh(new T.CircleGeometry(1,96),maskMaterial);mask.name='portal-aperture';mask.renderOrder=-1000;
  const field=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,uniforms:{uTime:{value:0},uClose:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec2 vUv;uniform float uTime;uniform float uClose;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float angle=atan(p.y,p.x);float aperture=mix(.89,.34,uClose);float edge=smoothstep(aperture-.018,aperture+.018,r);float outer=1.-smoothstep(.96,1.,r);float filaments=pow(.5+.5*sin(angle*19.+r*41.-uTime*.9+sin(angle*5.-uTime*.21)),7.);float core=exp(-pow((r-aperture)*85.,2.));float a=(edge*(.045+filaments*.12)+core*.65)*outer;vec3 col=mix(vec3(.35,.7,.78),vec3(.68,.58,.84),.5+.5*sin(angle*2.+uTime*.13));gl_FragColor=vec4(col+core*.55,a);}`});
  const membrane=mesh(new T.CircleGeometry(5,128),field);membrane.scale.set(.8,1.1,1);membrane.renderOrder=5;
  const points=Array.from({length:129},(_,i)=>{const a=i/128*Math.PI*2,r=5*(1+.009*Math.sin(a*7)+.006*Math.cos(a*11));return new T.Vector3(Math.cos(a)*r*.8,Math.sin(a)*r*1.1,.025*Math.sin(a*4));});
  const curve=new T.CatmullRomCurve3(points,true);
  mesh(new T.TubeGeometry(curve,192,.036,6,true),new T.MeshBasicMaterial({color:new T.Color('#b9e1df').multiplyScalar(1.5),toneMapped:false})).renderOrder=6;
  mesh(new T.TubeGeometry(curve,192,.09,6,true),new T.MeshBasicMaterial({color:'#8a9dc5',transparent:true,opacity:.18,depthWrite:false,blending:T.AdditiveBlending})).renderOrder=4;
  let close=0;
  return {group,z,get closeAmount(){return close;},setClose(v:number){close=T.MathUtils.clamp(v,0,1);},update(t:number,dt:number,target?:number){if(target!==undefined)close=T.MathUtils.damp(close,target,2,dt);const r=5*T.MathUtils.lerp(.89,.34,close);mask.scale.set(r*.8,r*1.1,1);field.uniforms.uTime.value=t;field.uniforms.uClose.value=close;},dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.removeFromParent();group.clear();}};
}

/** Cache material state once; crossing changes GPU stencil state, never shaders. */
export function portalWorldMask(root:T.Object3D) {
  const originals=new Map<T.Material,{write:boolean;ref:number;func:T.Material['stencilFunc'];pass:T.Material['stencilZPass']}>();
  root.traverse(o=>{const value=(o as T.Mesh).material;if(value)for(const m of Array.isArray(value)?value:[value])if(!originals.has(m))originals.set(m,{write:m.stencilWrite,ref:m.stencilRef,func:m.stencilFunc,pass:m.stencilZPass});});
  let current:string|null=null;
  return {set(mode:'inside'|'outside'|'none'){if(current===mode)return;current=mode;const enabled=mode!=='none';for(const [m,old]of originals){m.stencilWrite=enabled||old.write;m.stencilRef=enabled?1:old.ref;m.stencilFunc=enabled?(mode==='inside'?T.EqualStencilFunc:T.NotEqualStencilFunc):old.func;m.stencilZPass=enabled?T.KeepStencilOp:old.pass;}},dispose(){for(const[m,old]of originals){m.stencilWrite=old.write;m.stencilRef=old.ref;m.stencilFunc=old.func;m.stencilZPass=old.pass;}}};
}

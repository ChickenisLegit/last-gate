import { MathUtils, PerspectiveCamera, Scene, Vector2, WebGLRenderer } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { reducedMotion } from '../config/experience';

export class CinematicPost {
  readonly composer:EffectComposer;
  private bokeh:BokehPass;
  private grade:ShaderPass;
  private bloom:UnrealBloomPass;
  private ao:GTAOPass;
  private width=1920;private height=1080;
  private measured=0;private total=0;
  private medium=false;
  constructor(private gl:WebGLRenderer,scene:Scene,camera:PerspectiveCamera){
    this.composer=new EffectComposer(gl);
    this.composer.addPass(new RenderPass(scene,camera));
    this.ao=new GTAOPass(scene,camera,960,540);this.ao.blendIntensity=.35;
    this.ao.updateGtaoMaterial({radius:.38,thickness:.12,distanceExponent:1.5,samples:12});
    this.ao.updatePdMaterial({radius:5,samples:8});this.composer.addPass(this.ao);
    this.bokeh=new BokehPass(scene,camera,{focus:3,aperture:.0012,maxblur:.018});this.composer.addPass(this.bokeh);
    this.bloom=new UnrealBloomPass(new Vector2(1920,1080),.12,.55,1.35);this.composer.addPass(this.bloom);
    this.grade=new ShaderPass({uniforms:{tDiffuse:{value:null},instability:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`uniform sampler2D tDiffuse;uniform float instability;varying vec2 vUv;void main(){vec2 d=vUv-.5;vec2 offset=d*dot(d,d)*instability;vec3 c=texture2D(tDiffuse,vUv).rgb;c.r=texture2D(tDiffuse,vUv+offset).r;c.b=texture2D(tDiffuse,vUv-offset).b;float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,.94);c*=vec3(.997,1.,1.006);gl_FragColor=vec4(max(c,0.),1.);}`});this.composer.addPass(this.grade);this.composer.addPass(new OutputPass());this.composer.addPass(new FXAAPass());
  }
  resize(width:number,height:number){this.width=width;this.height=height;this.composer.setSize(width,height);this.ao.setSize(Math.ceil(width*.5),Math.ceil(height*.5));}
  render(dt:number,wake:number,progress:number,focus:number){
    const recovering=!reducedMotion&&wake<1;
    this.bokeh.enabled=recovering||progress>.48;
    const uniforms=this.bokeh.uniforms as Record<string,{value:number}>;
    uniforms.focus.value=recovering?MathUtils.lerp(2.8,focus,MathUtils.smoothstep(wake,.55,1)):focus;
    uniforms.aperture.value=recovering?MathUtils.lerp(.0013,.000045,wake):MathUtils.lerp(.00004,.00024,MathUtils.smoothstep(progress,.48,1));
    uniforms.maxblur.value=recovering?.018:(this.medium?.006:.009);
    this.grade.uniforms.instability.value=recovering?(1-wake)*.003:0;
    this.gl.toneMappingExposure=recovering?MathUtils.lerp(.74,1.08,wake):1.08;
    if(document.visibilityState==='visible'&&dt<.12&&dt>.001&&wake===1){this.measured++;this.total+=dt;if(this.measured===180&&this.total/this.measured>.029&&!this.medium){this.medium=true;this.composer.setPixelRatio(1);this.ao.setSize(Math.ceil(this.width*.4),Math.ceil(this.height*.4));this.ao.updateGtaoMaterial({samples:8});this.bloom.strength=.09;}}
    this.gl.domElement.dataset.quality=this.medium?'MEDIUM':'HIGH';
    this.composer.render(dt);
  }
  dispose(){for(const pass of this.composer.passes)pass.dispose?.();this.composer.dispose();}
}

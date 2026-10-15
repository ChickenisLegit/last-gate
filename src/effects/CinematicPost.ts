import { MathUtils, PerspectiveCamera, Scene, Vector2, WebGLRenderer } from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { reducedMotion } from '../config/experience';
import type { Quality } from '../systems/RenderQuality';

export class CinematicPost {
  readonly composer:EffectComposer;
  private bokeh?:BokehPass;
  private grade?:ShaderPass;
  private bloom?:UnrealBloomPass;
  private ao?:GTAOPass;
  private smaa?:SMAAPass;
  private width:number;
  private height:number;
  private elapsed=0;
  private stage=0;
  private quality:Quality='HIGH';

  constructor(private gl:WebGLRenderer,private scene:Scene,private camera:PerspectiveCamera){
    this.width=gl.domElement.clientWidth;this.height=gl.domElement.clientHeight;
    this.composer=new EffectComposer(gl);
    this.composer.addPass(new RenderPass(scene,camera));
    this.composer.addPass(new OutputPass());
  }
  setQuality(level:Quality){
    this.quality=level;
    this.composer.setPixelRatio(level==='LOW'?.75:level==='MEDIUM'?1:1.25);
    if(this.ao){this.ao.enabled=level==='HIGH';this.ao.updateGtaoMaterial({samples:level==='HIGH'?12:8});}
    if(this.bloom){this.bloom.enabled=level!=='LOW';this.bloom.strength=level==='HIGH'?.18:.09;}
    if(this.smaa)this.smaa.enabled=level!=='LOW';
    this.resize(this.width,this.height);
  }
  resize(width:number,height:number){
    this.width=width;this.height=height;
    this.composer.setSize(width,height);
    this.ao?.setSize(Math.ceil(width*.5),Math.ceil(height*.5));
  }
  // Allocate and warm one effect at a time, after the model is visible.
  private addEffect(){
    this.stage++;
    if(this.quality==='LOW')return;
    let pass;
    if(this.stage===1&&this.quality==='HIGH'){
      this.ao=new GTAOPass(this.scene,this.camera,this.width*.5,this.height*.5);
      this.ao.blendIntensity=.38;
      this.ao.updateGtaoMaterial({radius:.38,thickness:.12,distanceExponent:1.5,samples:12});
      this.ao.updatePdMaterial({radius:5,samples:8});pass=this.ao;
    }else if(this.stage===2){
      this.bokeh=new BokehPass(this.scene,this.camera,{focus:3,aperture:.0012,maxblur:.018});pass=this.bokeh;
    }else if(this.stage===3){
      this.bloom=new UnrealBloomPass(new Vector2(this.width,this.height),this.quality==='HIGH'?.18:.09,.55,1.65);pass=this.bloom;
    }else if(this.stage===4){
      this.grade=new ShaderPass({uniforms:{tDiffuse:{value:null},instability:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`uniform sampler2D tDiffuse;uniform float instability;varying vec2 vUv;void main(){vec2 d=vUv-.5;vec2 offset=d*dot(d,d)*instability;vec3 c=texture2D(tDiffuse,vUv).rgb;c.r=texture2D(tDiffuse,vUv+offset).r;c.b=texture2D(tDiffuse,vUv-offset).b;gl_FragColor=vec4(max(c,0.),1.);}`});pass=this.grade;
    }else if(this.stage===5){this.smaa=new SMAAPass();pass=this.smaa;}
    if(pass){this.composer.insertPass(pass,this.composer.passes.length-1);this.resize(this.width,this.height);}
  }
  render(dt:number,wake:number,progress:number,focus:number){
    this.elapsed+=dt;
    if(this.elapsed>.35&&this.stage<5){this.elapsed=0;this.addEffect();}
    const recovering=!reducedMotion&&wake<1;
    if(this.bokeh){
      this.bokeh.enabled=this.quality!=='LOW'&&(recovering||progress>.48);
      const uniforms=this.bokeh.uniforms as Record<string,{value:number}>;
      uniforms.focus.value=recovering?MathUtils.lerp(2.8,focus,MathUtils.smoothstep(wake,.55,1)):focus;
      uniforms.aperture.value=recovering?MathUtils.lerp(.0013,.000045,wake):MathUtils.lerp(.000025,.00013,MathUtils.smoothstep(progress,.48,1));
      uniforms.maxblur.value=recovering?.018:.006;
    }
    if(this.grade)this.grade.uniforms.instability.value=recovering?(1-wake)*.003:0;
    this.gl.toneMappingExposure=recovering?MathUtils.lerp(.74,1.08,wake):1.08;
    this.composer.render(dt);
  }
  dispose(){for(const pass of this.composer.passes)pass.dispose?.();this.composer.dispose();}
}

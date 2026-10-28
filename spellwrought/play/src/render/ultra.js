import*as THREE from"../../vendor/three/three.module.js";const RIM={uRim:{value:0},uRimCol:{value:new THREE.Color(.6,.65,.85)}};const LIT="#if defined( STANDARD ) || defined( PHONG ) || defined( LAMBERT ) || defined( TOON )";const done=new WeakSet;function rimMaterial(m){if(!m||done.has(m)||!(m.isMeshStandardMaterial||m.isMeshPhongMaterial||m.isMeshLambertMaterial||m.isMeshToonMaterial))return;done.add(m);const prev=m.onBeforeCompile,prevKey=m.customProgramCacheKey?m.customProgramCacheKey.bind(m):()=>"";m.onBeforeCompile=function(sh,r){if(prev)prev.call(this,sh,r);Object.assign(sh.uniforms,RIM);sh.fragmentShader=sh.fragmentShader.replace("#include <common>","#include <common>\nuniform float uRim; uniform vec3 uRimCol;").replace("#include <opaque_fragment>",`${LIT}
if (uRim > 0.0) {
  // (on what stands, not on the ground: a floor seen far off would only grey over)
  float side = 1.0 - smoothstep(0.55, 0.85, dot(normalize(normal), normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz)));
  float fr = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 2.6) * side;
  float lit = clamp(dot(outgoingLight, vec3(0.299, 0.587, 0.114)) * 1.6, 0.0, 1.0);
  outgoingLight += uRimCol * fr * uRim * (0.2 + 0.8 * lit);
}
#endif
#include <opaque_fragment>`)};const src=prev?prev.toString():"";m.customProgramCacheKey=()=>"rim|"+src+"|"+prevKey();m.needsUpdate=true}function rimAll(root){root.traverse(o=>{if(o.material)for(const m of[].concat(o.material))rimMaterial(m)})}function rimFor(quality,fogCol,under){RIM.uRim.value=quality==="ultra"?under?.85:.55:0;RIM.uRimCol.value.copy(fogCol).multiplyScalar(under?2.5:1).lerp(new THREE.Color(.62,.68,.9),.6)}export{RIM,rimAll,rimFor,rimMaterial};

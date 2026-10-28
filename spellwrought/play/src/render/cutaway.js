import*as THREE from"../../vendor/three/three.module.js";const CUT={uHero:{value:new THREE.Vector3},uCam:{value:new THREE.Vector3},uCut:{value:2.6}};function cutaway(mat,{minY=.25}={}){mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,CUT);sh.vertexShader=sh.vertexShader.replace("#include <common>","#include <common>\nvarying vec3 vCutP;").replace("#include <project_vertex>",`#include <project_vertex>
        vec4 cutP = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          cutP = instanceMatrix * cutP;
        #endif
        vCutP = (modelMatrix * cutP).xyz;`);const at=sh.fragmentShader.includes("#include <common>")?"#include <common>":"#include <packing>";sh.fragmentShader=sh.fragmentShader.replace(at,`${at}
        varying vec3 vCutP; uniform vec3 uHero, uCam; uniform float uCut;
        float bayer4(vec2 p) {
          vec2 q = mod(floor(p), 4.0);
          float i = q.x + q.y * 4.0;
          // the 4x4 Bayer matrix, row by row
          return (i < 1.0 ? 0.0 : i < 2.0 ? 8.0 : i < 3.0 ? 2.0 : i < 4.0 ? 10.0 : i < 5.0 ? 12.0 : i < 6.0 ? 4.0 : i < 7.0 ? 14.0 : i < 8.0 ? 6.0
            : i < 9.0 ? 3.0 : i < 10.0 ? 11.0 : i < 11.0 ? 1.0 : i < 12.0 ? 9.0 : i < 13.0 ? 15.0 : i < 14.0 ? 7.0 : i < 15.0 ? 13.0 : 5.0) / 16.0;
        }`).replace("#include <clipping_planes_fragment>",`#include <clipping_planes_fragment>
        {
          vec3 toHero = uHero - uCam; float th = length(toHero); vec3 dh = toHero / th;
          vec3 toP = vCutP - uCam; float along = dot(toP, dh);
          if (along < th - 0.5 && vCutP.y > ${minY.toFixed(2)}) {
            float d = length(toP - dh * along);
            float rad = uCut * clamp(along / th, 0.3, 1.0);
            float k = (1.0 - smoothstep(rad * 0.55, rad, d)) * smoothstep(${minY.toFixed(2)}, ${(minY+.5).toFixed(2)}, vCutP.y);
            if (k * 0.92 > bayer4(gl_FragCoord.xy)) discard;
          }
        }`)};mat.customProgramCacheKey=()=>"cutaway"+minY;return mat}export{CUT,cutaway};

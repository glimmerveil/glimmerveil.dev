// © 2026 Glimmerveil. All rights reserved.
import*as THREE from"three";import{N,SEA,onSize}from"../sim/config.js";let HALF=(N-1)/2;onSize(()=>{HALF=(N-1)/2});const tileToX=tx=>tx-HALF;const tileToZ=ty=>ty-HALF;const xToTile=x=>x+HALF;const zToTile=z=>z+HALF;function heightToY(h){if(h<SEA)return(h-SEA)*32;let y=(h-SEA)*22;if(h>.6){const k=h-.6;y+=k*k*170}return y}const toLin=c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);function lin(r,g,b){return[toLin(r),toLin(g),toLin(b)]}function mixc(a,b,t,out=[0,0,0]){out[0]=a[0]+(b[0]-a[0])*t;out[1]=a[1]+(b[1]-a[1])*t;out[2]=a[2]+(b[2]-a[2])*t;return out}const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};const tileTex=()=>{const t=new THREE.DataTexture(new Uint8Array(N*N),N,N,THREE.RedFormat,THREE.UnsignedByteType);t.magFilter=t.minFilter=THREE.LinearFilter;t.needsUpdate=true;return t};let SNOW_TEX=tileTex();function snowLift(u,v){const d=SNOW_TEX.image.data;const x=Math.max(0,Math.min(N-1.001,u)),y=Math.max(0,Math.min(N-1.001,v));const x0=x|0,y0=y|0,fx=x-x0,fy=y-y0,i=y0*N+x0;const a=d[i],b=d[i+1]??a,c=d[i+N]??a,e=d[i+N+1]??a;return((a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+e*fx)*fy)/255*.55}let PATH_TEX=tileTex();function sizeTiles(){if(SNOW_TEX.image.width===N)return;SNOW_TEX.dispose();PATH_TEX.dispose();SNOW_TEX=tileTex();PATH_TEX=tileTex();SEASON_U.uSnowTex.value=SNOW_TEX;SEASON_U.uPathTex.value=PATH_TEX}const SEASON_U={uTime:{value:0},uSnow:{value:0},uTint:{value:new THREE.Color(1,1,1)},uAutumn:{value:0},uBare:{value:0},uOverlay:{value:0},uWind:{value:new THREE.Vector2},uClouds:{value:Array.from({length:16},()=>new THREE.Vector4)},uCloudN:{value:0},uWet:{value:0},uNight:{value:0},uLamp:{value:0},uSnowTex:{value:SNOW_TEX},uPathTex:{value:PATH_TEX},uCut:{value:new THREE.Vector3},uClip:{value:new THREE.Vector4},uClipDir:{value:new THREE.Vector2(0,1)},uClipTop:{value:0}};const CLOUD_GLSL=`
uniform vec4 uClouds[16];
uniform int uCloudN;
float cloudShade(vec2 p) {
  float s = 1.0;
  for (int i = 0; i < 16; i++) {
    if (i >= uCloudN) break;
    vec2 d = p - uClouds[i].xy;
    s *= 1.0 - uClouds[i].w * (1.0 - smoothstep(0.45, 1.0, length(d) / uClouds[i].z));
  }
  return s;
}
`;function seasonal(mat,opts={}){mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,SEASON_U);let vHead="attribute float snowy;\nvarying float vSnowy;\nvarying float vUpY;\nvarying vec2 vWXZ;\nuniform float uTime;\nuniform float uBare;\nuniform vec2 uWind;\n";let fHead="uniform float uSnow;\nuniform vec3 uTint;\nuniform float uAutumn;\nuniform float uBare;\nvarying float vSnowy;\nvarying float vUpY;\nvarying vec2 vWXZ;\nuniform float uWet;\n"+CLOUD_GLSL;let vBody="vSnowy = snowy; vUpY = objectNormal.y;\n";let fBody="";if(opts.windows){vHead+="attribute float leaf;\nvarying float vGlow;\nvarying float vLate;\n";fHead+="varying float vGlow;\nvarying float vLate;\nuniform float uLamp;\nuniform float uNight;\n";vBody+="vGlow = step(1.5, leaf); vLate = step(2.5, leaf);\n"}if(opts.leaves){const g=c=>`vec3(${lin(...c).map(v=>v.toFixed(4)).join(", ")})`;const[a1,a2]=opts.autumn||[[.75,.32,.06],[.85,.62,.12]];vHead+="attribute float leaf;\nattribute float rnd;\nvarying float vLeaf;\nvarying float vRnd;\nvarying vec3 vLeafP;\n"+(opts.masses?"attribute vec3 leafc;\nattribute vec3 itint;\n":"");fHead+="varying float vLeaf;\nvarying float vRnd;\nvarying vec3 vLeafP;\nfloat lh(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }\nfloat ln3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(lh(i), lh(i + vec3(1,0,0)), f.x), mix(lh(i + vec3(0,1,0)), lh(i + vec3(1,1,0)), f.x), f.y), mix(mix(lh(i + vec3(0,0,1)), lh(i + vec3(1,0,1)), f.x), mix(lh(i + vec3(0,1,1)), lh(i + vec3(1,1,1)), f.x), f.y), f.z); }\n";vBody+="vLeaf = leaf; vRnd = rnd; vLeafP = transformed;\n";vBody+=opts.masses?"transformed = mix(transformed, leafc, uBare * leaf);\n":"transformed = mix(transformed, vec3(0.0, transformed.y * 0.9 + 0.12, 0.0), uBare * 0.5 * leaf);\n";if(opts.shimmer)vBody+="transformed += leaf * vec3(sin(uTime * 11.0 + dot(transformed, vec3(41.0, 29.0, 37.0))), 0.0, cos(uTime * 9.0 + dot(transformed, vec3(23.0, 47.0, 31.0)))) * (0.004 + length(uWind) * 0.012);\n";fBody+=`
        vec3 aut = mix(${g(a1)}, ${g(a2)}, fract(vRnd * 7.31));
        // leaves: clusters of light and shade, not a smooth balloon
        float dap = ln3(vLeafP * 22.0) * 0.6 + ln3(vLeafP * 47.0) * 0.4;
        diffuseColor.rgb *= mix(1.0, 0.72 + 0.5 * dap, vLeaf);
        diffuseColor.rgb = mix(diffuseColor.rgb, aut * (0.7 + 0.45 * dap), uAutumn * vLeaf);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.16, 0.13) * (0.8 + 0.4 * dap), uBare * vLeaf * 0.9);
      `}if(opts.ground){fHead+="uniform sampler2D uPathTex;\nfloat gh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nfloat gn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(gh(i), gh(i + vec2(1, 0)), f.x), mix(gh(i + vec2(0, 1)), gh(i + vec2(1, 1)), f.x), f.y); }\n";fBody+=`
        {
          vec2 gp = vWXZ;
          float fw = length(fwidth(gp));
          float big = gn(gp * 0.09) * 0.6 + gn(gp * 0.23) * 0.4;
          float clump = gn(gp * 1.6) * 0.65 + gn(gp * 3.7) * 0.35;
          float mid = gn(gp * 6.5);
          // short streaks, like blades leaning the same way
          vec2 bp = mat2(0.86, 0.5, -0.5, 0.86) * gp * vec2(30.0, 11.0);
          float blade = gh(floor(bp)) * 0.7 + gh(floor(bp * 1.9 + 3.1)) * 0.3;
          float kc = 1.0 - smoothstep(0.1, 0.4, fw), km = 1.0 - smoothstep(0.04, 0.14, fw), kf = 1.0 - smoothstep(0.012, 0.035, fw);
          float lum = 0.9 + (big - 0.5) * 0.3 + (clump - 0.5) * 0.32 * kc + (mid - 0.5) * 0.24 * km + (blade - 0.5) * 0.34 * kf;
          diffuseColor.rgb *= lum;
          // the ways people made: worn track, dirt path, gravel road, cobbled street
          float pl = texture2D(uPathTex, (gp + ${HALF.toFixed(1)} + 0.5) / ${N.toFixed(1)}).r * 4.05;
          if (pl > 0.2) {
            float track = smoothstep(0.25, 1.0, pl), dirt = smoothstep(1.15, 1.9, pl), road = smoothstep(2.2, 2.9, pl), wide = smoothstep(3.2, 3.85, pl);
            vec3 earth = vec3(0.4, 0.31, 0.21) * (0.85 + 0.25 * gn(gp * 2.3)) * (0.9 + 0.15 * gh(floor(gp * 22.0)) * km);
            diffuseColor.rgb = mix(diffuseColor.rgb, mix(diffuseColor.rgb, earth, 0.55), track);
            diffuseColor.rgb = mix(diffuseColor.rgb, earth, dirt);
            vec3 gravel = vec3(0.47, 0.43, 0.37) * (0.8 + 0.35 * gh(floor(gp * 16.0)) * kc + 0.1 * gn(gp * 1.5));
            diffuseColor.rgb = mix(diffuseColor.rgb, gravel, road);
            vec2 cq = gp * 4.2; cq.x += floor(cq.y) * 0.5;
            vec2 cf = fract(cq) - 0.5;
            float stone = (1.0 - smoothstep(0.32, 0.5, max(abs(cf.x), abs(cf.y) * 1.15)));
            vec3 cob = mix(vec3(0.24, 0.22, 0.2), vec3(0.56, 0.53, 0.48) * (0.82 + 0.3 * gh(floor(cq))), mix(0.7, stone, km));
            diffuseColor.rgb = mix(diffuseColor.rgb, cob, wide);
          }
          // sun-dried patches of grass go straw-coloured (grass only: soil, rock and paths keep theirs)
          float grassy = clamp((diffuseColor.g - diffuseColor.r) * 8.0, 0.0, 1.0);
          float straw = smoothstep(0.55, 0.85, gn(gp * 0.13 + 7.0)) * 0.45 * grassy;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(dot(diffuseColor.rgb, vec3(0.45, 0.45, 0.1))) * vec3(1.05, 1.0, 0.62), straw);
        }
      `}if(opts.wind){vBody+=`
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
          vec3 lw = transpose(mat3(instanceMatrix)) * vec3(uWind.x, 0.0, uWind.y) / dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz);
        #else
          vec3 ip = vec3(0.0);
          vec3 lw = vec3(uWind.x, 0.0, uWind.y);
        #endif
        float ws = length(uWind);
        float gust = 0.55 + 0.45 * sin(uTime * 0.9 - dot(ip.xz, uWind / (ws + 0.001)) * 0.18);
        float sway = sin(uTime * (1.4 + ws * 2.5) + ip.x * 0.8 + ip.z * 0.6) + 0.5 * sin(uTime * 2.3 + ip.x * 1.9);
        float k = max(transformed.y, 0.0);
        transformed.x += sway * (0.02 + ws * 0.06) * k * k;
        transformed.z += sway * (0.015 + ws * 0.045) * k * k;
        transformed.xz += lw.xz * gust * 0.2 * k * k;
      `}if(opts.cutaway){vHead+="uniform vec3 uCut;\n";vBody+=`
        #ifdef USE_INSTANCING
          if (uCut.z > 0.0) { vec2 cd = vec2(instanceMatrix[3][0], instanceMatrix[3][2]) - uCut.xy; transformed *= smoothstep(uCut.z * 0.75, uCut.z, length(cd)); }
        #endif
      `}vBody+=`
      #ifdef USE_INSTANCING
        vWXZ = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xz;
      #else
        vWXZ = (modelMatrix * vec4(transformed, 1.0)).xz;
      #endif
    `;if(opts.clip){vHead+="varying float vWY;\n";fHead+="uniform vec4 uClip;\nuniform vec2 uClipDir;\nuniform float uClipTop;\nvarying float vWY;\n";vBody+=`
        #ifdef USE_INSTANCING
          vWY = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).y;
        #else
          vWY = (modelMatrix * vec4(transformed, 1.0)).y;
        #endif
      `;fBody=`if (uClip.z > 0.0) { vec2 cd = vWXZ - uClip.xy; if (dot(cd, cd) < uClip.z * uClip.z && (dot(cd, uClipDir) > -0.04 || vWY > uClipTop) && vWY > uClip.w) discard; }
`+fBody}let vs=vHead+sh.vertexShader;if(opts.ground){vs=`uniform sampler2D uSnowTex;
varying float vSnowDepth;
float snowAt(vec2 xz) { return texture2D(uSnowTex, (xz + ${HALF.toFixed(1)} + 0.5) / ${N.toFixed(1)}).r; }
`+vs.replace("#include <beginnormal_vertex>",`#include <beginnormal_vertex>
          { float l = snowAt(position.xz - vec2(0.7, 0.0)), r = snowAt(position.xz + vec2(0.7, 0.0));
            float u = snowAt(position.xz - vec2(0.0, 0.7)), d = snowAt(position.xz + vec2(0.0, 0.7));
            objectNormal = normalize(objectNormal + vec3(l - r, 0.0, u - d) * 0.75); }`);vBody=`vSnowDepth = snowAt(transformed.xz); transformed.y += vSnowDepth * 0.55;
`+vBody;fHead+="varying float vSnowDepth;\n"}sh.vertexShader=vs.replace("#include <begin_vertex>","#include <begin_vertex>\n"+vBody);if(opts.masses)sh.vertexShader=sh.vertexShader.replace("#include <color_vertex>","#include <color_vertex>\nvColor.rgb *= mix(vec3(1.0), itint, leaf);");if(opts.windows)sh.fragmentShader=sh.fragmentShader.replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
      totalEmissiveRadiance += vec3(1.0, 0.58, 0.22) * vGlow * mix(uLamp, min(1.0, uNight * 1.6), vLate) * 2.4;`);sh.fragmentShader=fHead+sh.fragmentShader.replace("#include <lights_fragment_end>",`#include <lights_fragment_end>
      // a cloud overhead takes the sun away (and the sun's shadows with it)
      reflectedLight.directDiffuse *= cloudShade(vWXZ);
    `).replace("#include <color_fragment>",`#include <color_fragment>
      diffuseColor.rgb *= uTint * (1.0 - uWet * 0.12);
      ${fBody}
      float snowK = uSnow * vSnowy * smoothstep(0.45, 0.8, vUpY);
      ${opts.ground?"snowK = max(snowK * 0.25, smoothstep(0.015, 0.2, vSnowDepth));":""}
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.8, 0.82, 0.88), snowK);
    `)};mat.customProgramCacheKey=()=>"seasonal7"+(opts.windows?"N":"")+(opts.ground?"G":"")+(opts.leaves?"L"+(opts.masses?"M":"")+(opts.shimmer?"S":"")+JSON.stringify(opts.autumn||""):"")+(opts.wind?"W":"")+(opts.clip?"C":"");return mat}function paint(geo,rgb,{snowy=1,leaf=0}={}){const g=geo.index?geo.toNonIndexed():geo;const n=g.attributes.position.count;const col=new Float32Array(n*3),sn=new Float32Array(n),lf=new Float32Array(n);const c=lin(...rgb);for(let i=0;i<n;i++){col[i*3]=c[0];col[i*3+1]=c[1];col[i*3+2]=c[2];sn[i]=snowy;lf[i]=leaf}g.setAttribute("color",new THREE.BufferAttribute(col,3));g.setAttribute("snowy",new THREE.BufferAttribute(sn,1));g.setAttribute("leaf",new THREE.BufferAttribute(lf,1));if(g.attributes.uv)g.deleteAttribute("uv");return g}function rhash(i,k=0){let h=Math.imul(i^2654435769,2246822507)^Math.imul(k+668265261,3266489909);h=Math.imul(h^h>>>15,739982445);h^=h>>>13;return(h>>>0)/4294967296}const KINGDOM_HEX=["#d9a530","#c0392b","#2e86de","#27ae60","#8e44ad","#e67e22","#16a085","#d35480"];const KINGDOM_RGB=KINGDOM_HEX.map(h=>[1,3,5].map(k=>parseInt(h.slice(k,k+2),16)/255));export{CLOUD_GLSL,HALF,KINGDOM_HEX,KINGDOM_RGB,PATH_TEX,SEASON_U,SNOW_TEX,heightToY,lin,mixc,paint,rhash,seasonal,sizeTiles,smooth,snowLift,tileToX,tileToZ,xToTile,zToTile};

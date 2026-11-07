// © 2026 Glimmerveil. All rights reserved.
import*as THREE from"three";const VERT=`
  attribute float depth;
  uniform float uTime;
  uniform float uWind;
  uniform float uWash;
  uniform float uSwell;
  uniform vec2 uWindDir;
  varying float vDepth;
  varying float vWave;
  varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main() {
    // the wash: up her sand and back, a slow breath along the whole shore (only where the water is shallow)
    float wash = uWash * (0.085 * sin(uTime * 0.55 + position.x * 0.045) + 0.03 * sin(uTime * 1.3 + position.x * 0.13));
    vDepth = depth + wash * (1.0 - smoothstep(0.0, 0.7, depth));
    vWave = 0.0;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float sea = smoothstep(0.15, 1.6, depth) * uSwell, k = 0.7 + uWind * 1.6;
    wp.y += ((sin(wp.x * 0.62 + uTime * 1.1) * 0.035 + sin(wp.x * 0.41 - wp.z * 0.73 + uTime * 0.83) * 0.03 + sin(wp.z * 1.3 + uTime * 1.7) * 0.012) * k
      + sin(dot(wp.xz, uWindDir) * 0.9 - uTime * 1.6) * 0.03 * uWind) * sea;
    vWorld = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;const FRAG=`
  uniform float uTime;
  uniform vec3 uSunDir;
  uniform vec3 uDeep;
  uniform vec3 uShallow;
  uniform vec3 uSky;
  uniform vec3 uGlint;
  uniform vec3 uInner;
  uniform float uWind;
  uniform float uSurf;
  uniform float uRain;
  varying float vDepth;
  varying float vWave;
  varying vec3 vWorld;
  #include <fog_pars_fragment>
  // the rain on it (as the park's lake takes it: rings where the drops land, widening and fading), two layers of cells, a
  // drop in each at its own moment
  float rainRings(vec2 p, float t) {
    float s = 0.0;
    for (int k = 0; k < 2; k++) {
      vec2 q = p * (k == 0 ? 1.3 : 2.1) + float(k) * 7.3, c = floor(q), f = fract(q) - 0.5;
      float h = fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453);
      vec2 o = vec2(fract(h * 13.1), fract(h * 71.7)) - 0.5;
      float a = fract(t * (0.8 + 0.4 * h) + h), d = length(f - o * 0.6);
      s += smoothstep(0.04, 0.0, abs(d - a * 0.42)) * (1.0 - a);
    }
    return s;
  }
  void main() {
    vec2 p = vWorld.xz;
    float t = uTime;
    float dx = 0.9 * cos(p.x * 0.9 + t * 1.1) * 0.35 + 2.3 * cos((p.x + p.y) * 2.3 + t * 2.0) * 0.08 + 3.1 * cos((p.x - p.y) * 3.1 - t * 1.7) * 0.05;
    float dz = 1.1 * cos(p.y * 1.1 - t * 0.9) * 0.35 + 2.3 * cos((p.x + p.y) * 2.3 + t * 2.0) * 0.08 - 3.1 * cos((p.x - p.y) * 3.1 - t * 1.7) * 0.05;
    vec3 n = normalize(vec3(-dx * 0.12, 1.0, -dz * 0.12));
    vec3 V = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
    float d = clamp(vDepth / 2.2, 0.0, 1.0);
    vec3 col = mix(uShallow, uDeep, smoothstep(0.0, 1.0, d));
    col += uInner * (1.0 - fres) * (0.6 + 0.4 * sin(t * 0.8 + p.x * 1.3 + p.y));
    col = mix(col, uSky, fres * 0.75);
    vec3 H = normalize(uSunDir + V);
    float spec = pow(max(dot(n, H), 0.0), 140.0);
    col += spec * uGlint * 0.9;
    float foam = (1.0 - smoothstep(0.0, 0.22, vDepth)) * step(0.0, vDepth) * (0.55 + 0.45 * sin(t * 2.2 + p.x * 2.7 + p.y * 1.9));
    float surf = uSurf * (1.0 - smoothstep(0.1, 0.9, vDepth)) * step(0.02, vDepth) * smoothstep(0.55, 1.0, sin(vDepth * 14.0 + t * 2.4 + sin(p.x * 0.8 + p.y * 0.6) * 1.5));
    float s1 = sin(p.x * 2.3 + t * 1.3 + sin(p.y * 0.37 + t * 0.2) * 3.0), s2 = sin(p.y * 2.9 - t * 0.9 + sin(p.x * 0.29) * 3.0), s3 = sin((p.x + p.y) * 0.53 + t * 0.4);
    float cap = uSurf * smoothstep(1.2, 2.5, vDepth) * smoothstep(0.985 - uWind * 0.03, 1.0, s1 * s2) * smoothstep(0.3 - uWind * 0.2, 0.9, s3);
    float crest = (1.0 - smoothstep(0.0, 0.18, vDepth)) * smoothstep(0.02, 0.08, vWave);
    foam = max(foam, max(surf * 0.75, max(cap * 0.6, crest * 0.8)));
    if (uRain > 0.01) foam = max(foam, rainRings(p, t) * uRain * 0.9);
    col = mix(col, mix(vec3(0.8, 0.82, 0.88), uSky, 0.35), foam * 0.6);
    float alpha = mix(0.35, 0.93, smoothstep(0.0, 1.4, vDepth)) + foam * 0.3;
    if (vDepth < -0.05) discard;
    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;const TWILIGHT={deep:[.012,.025,.06],shallow:[.07,.14,.19],sky:[.62,.42,.55],glint:[1,.66,.42],sun:[0,.06,-1],inner:[0,0,0]};const POOL={deep:[.02,.1,.11],shallow:[.08,.2,.18],sky:[.2,.16,.26],glint:[1,.8,.55],sun:[.2,.5,-1],inner:[.09,.1,.04]};function waterMat(P,{wash=1,swell=1,surf=1,wind=.3}={}){const uniforms=THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{uTime:{value:0},uSunDir:{value:new THREE.Vector3(...P.sun).normalize()},uDeep:{value:new THREE.Color(...P.deep)},uShallow:{value:new THREE.Color(...P.shallow)},uSky:{value:new THREE.Color(...P.sky)},uGlint:{value:new THREE.Color(...P.glint)},uInner:{value:new THREE.Color(...P.inner)},uWind:{value:wind},uWindDir:{value:new THREE.Vector2(.3,-1).normalize()},uWash:{value:wash},uSwell:{value:swell},uSurf:{value:surf},uRain:{value:0}}]);return new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:FRAG,uniforms,transparent:true,depthWrite:false,fog:true})}function makeSea({y=0,shoreZ=0,width=120,out=160}={}){const mat=waterMat(TWILIGHT),uniforms=mat.uniforms;const rows=64,cols=Math.max(24,Math.round(width/2.5)),up=3,pos=[],dep=[],idx=[];for(let j=0;j<=rows;j++){const f=j/rows,dz=-up+(out+up)*f*f;const z=shoreZ-dz,depth=dz<=0?dz*.11:.11*dz+.0025*dz*dz;for(let i=0;i<=cols;i++){pos.push(-width/2+width*i/cols,0,z);dep.push(depth)}}for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const a=j*(cols+1)+i,b=a+cols+1;idx.push(a,a+1,b,b,a+1,b+1)}const geo=new THREE.BufferGeometry;geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));geo.setAttribute("depth",new THREE.Float32BufferAttribute(dep,1));geo.setIndex(idx);const mesh=new THREE.Mesh(geo,mat);mesh.position.y=y;mesh.renderOrder=2;mesh.frustumCulled=false;mesh.userData.noInk=true;const farGeo=new THREE.PlaneGeometry(width*8,1600).rotateX(-Math.PI/2),farDep=new Float32Array(farGeo.attributes.position.count).fill(9);farGeo.setAttribute("depth",new THREE.BufferAttribute(farDep,1));const far=new THREE.Mesh(farGeo,mat);far.position.set(0,y-.02,shoreZ-out-800+2);far.renderOrder=1;far.userData.noInk=true;const group=new THREE.Group;group.add(mesh,far);return{group,mesh,uniforms,level:y,shoreZ,splashAt(){return false},reflect(){},update(t,dt,w={}){uniforms.uTime.value=t;uniforms.uWind.value=Math.min(1,.25+(w.wind||0)*.6);uniforms.uRain.value=w.rain||0}}}function makePool({rx=1.5,rz=1.2,y=.035,depth=.8,warm=false,glow=null}={}){const P={...POOL,...warm?{}:{inner:[.02,.08,.14],deep:[.02,.12,.2],shallow:[.1,.3,.36]},...glow?{inner:glow}:{}};const mat=waterMat(P,{wash:0,swell:0,surf:0,wind:.15});const rings=6,seg=40,pos=[],dep=[],idx=[];pos.push(0,0,0);dep.push(depth);for(let j=1;j<=rings;j++){const r=j/rings;for(let i=0;i<seg;i++){const a=i/seg*6.2832,wob=1+.06*Math.sin(a*3+rx)+.04*Math.sin(a*5+rz);pos.push(Math.cos(a)*rx*r*wob,0,Math.sin(a)*rz*r*wob);dep.push(depth*(1-r*r)-.02*r)}}for(let i=0;i<seg;i++)idx.push(0,1+(i+1)%seg,1+i);for(let j=1;j<rings;j++)for(let i=0;i<seg;i++){const a=1+(j-1)*seg+i,b=1+(j-1)*seg+(i+1)%seg,c=a+seg,d=b+seg;idx.push(a,b,c,b,d,c)}const geo=new THREE.BufferGeometry;geo.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));geo.setAttribute("depth",new THREE.Float32BufferAttribute(dep,1));geo.setIndex(idx);const mesh=new THREE.Mesh(geo,mat);mesh.position.y=y;mesh.renderOrder=2;mesh.userData.noInk=true;const group=new THREE.Group;group.add(mesh);return{group,mesh,uniforms:mat.uniforms,level:y,rx,rz,depth,splashAt(){return false},reflect(){},update(t,dt,w={}){mat.uniforms.uTime.value=t;mat.uniforms.uRain.value=w.rain||0}}}export{makePool,makeSea};

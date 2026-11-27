import*as THREE from"three";import{makeRng}from"../sim/rng.js";import{Q}from"./quality.js";import{gateArt}from"./gate.js";const NOISE=`
  float h3(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float n3(vec3 x) { vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
  #ifndef OCT
  #define OCT 6
  #endif
  float fbm(vec3 p) { float s = 0.0, a = 0.5; for (int i = 0; i < OCT; i++) { s += a * n3(p); p = p * 2.03 + vec3(1.7, 9.2, 4.1); a *= 0.5; } return s; }
`;function createSpace(scene,seed=1){const rng=makeRng(seed);const hue=rng.next(),palette=[[new THREE.Color().setHSL(hue,.65,.16),new THREE.Color().setHSL((hue+.12)%1,.75,.42),new THREE.Color().setHSL((hue+.55)%1,.7,.5)]][0];const group=new THREE.Group;scene.add(group);const nebMat=new THREE.ShaderMaterial({uniforms:{uOff:{value:new THREE.Vector2},uT:{value:0},uA:{value:palette[0]},uB:{value:palette[1]},uC:{value:palette[2]},uSeed:{value:rng.range(0,100)}},vertexShader:"varying vec2 vP; void main() { vP = position.xy; vec4 q = projectionMatrix * modelViewMatrix * vec4(position, 1.0); q.z = q.w * 0.99999; gl_Position = q; }",fragmentShader:`${NOISE}
      uniform vec2 uOff; uniform float uT, uSeed; uniform vec3 uA, uB, uC; varying vec2 vP;
      void main() {
        vec2 p = (vP + uOff) * 0.0016;
        vec3 q = vec3(p, uSeed);
        float w = fbm(q + vec3(fbm(q * 1.7 + 3.1), fbm(q * 1.3 - 7.7), 0.0) * 1.6);
        float d = fbm(q * 3.1 + 11.0);
        float dust = smoothstep(0.42, 0.95, w);
        float lanes = smoothstep(0.55, 0.35, fbm(q * 2.2 + 5.0)) * 0.65;
        vec3 col = vec3(0.004, 0.006, 0.014);
        col += uA * smoothstep(0.25, 0.8, w) * 1.4;
        col += uB * dust * dust * 1.5 * (0.6 + 0.6 * d);
        col += uC * pow(smoothstep(0.62, 0.98, w * d * 1.6), 2.0) * 0.9;
        col *= 1.0 - lanes;
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,depthWrite:false});const neb=new THREE.Mesh(new THREE.PlaneGeometry(4e4,4e4,8,8),nebMat);neb.rotation.x=-Math.PI/2;neb.position.y=-1400;neb.renderOrder=-10;neb.frustumCulled=false;group.add(neb);const layers=[];const starMat=(size,L)=>new THREE.ShaderMaterial({uniforms:{uCam:{value:new THREE.Vector3},uL:{value:L},uSize:{value:size},uT:{value:0},uPR:{value:1},uK:{value:1}},vertexShader:`uniform vec3 uCam; uniform float uL, uSize, uT, uPR, uK; attribute float aMag; attribute vec3 aCol; varying vec3 vCol; varying float vA;
      void main() {
        float L = uL * uK; vec3 p = position * uK; p.y = uCam.y - 72.0 * uK + position.y * uK; p.xz = uCam.xz + mod(p.xz - uCam.xz + L * 0.5, L) - L * 0.5;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float tw = 0.75 + 0.25 * sin(uT * (1.0 + aMag * 3.0) + position.x * 0.37);
        gl_PointSize = max(1.0, uSize * aMag * uPR * 420.0 * uK / -mv.z);
        vCol = aCol; vA = tw * min(1.0, aMag * 1.6);
        gl_Position = projectionMatrix * mv;
      }`,fragmentShader:`varying vec3 vCol; varying float vA;
      void main() { vec2 c = gl_PointCoord - 0.5; float r = length(c) * 2.0; float a = smoothstep(1.0, 0.0, r); a = a * a;
        float core = smoothstep(0.35, 0.0, r); gl_FragColor = vec4(vCol * (a + core * 1.5) * vA, 1.0); }`,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});for(const[n,y,size,L]of[[5200,-1100,2.3,3600],[2600,-600,2,2200],[900,-260,1.7,1300]]){const pos=new Float32Array(n*3),mag=new Float32Array(n),col=new Float32Array(n*3);for(let i=0;i<n;i++){pos[i*3]=rng.range(-L/2,L/2);pos[i*3+1]=y+rng.range(-40,40);pos[i*3+2]=rng.range(-L/2,L/2);mag[i]=Math.pow(rng.next(),3.2)*1.6+.12;const t=rng.next(),c=t<.15?[.7,.8,1]:t<.25?[1,.82,.6]:t<.29?[1,.6,.55]:[.92,.94,1];col.set(c,i*3)}const g=new THREE.BufferGeometry;g.setAttribute("position",new THREE.BufferAttribute(pos,3));g.setAttribute("aMag",new THREE.BufferAttribute(mag,1));g.setAttribute("aCol",new THREE.BufferAttribute(col,3));const pts=new THREE.Points(g,starMat(size,L));pts.frustumCulled=false;pts.renderOrder=-9;group.add(pts);layers.push(pts)}const sunDir=new THREE.Vector3(rng.range(-.8,.8),.55,rng.range(-.9,-.2)).normalize();const sunTex=glowTexture();const sun=new THREE.Sprite(new THREE.SpriteMaterial({map:sunTex,color:16773848,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));const sunCore=new THREE.Sprite(new THREE.SpriteMaterial({map:sunTex,color:16777215,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));sun.scale.set(900,900,1);sunCore.scale.set(150,150,1);group.add(sun);group.add(sunCore);let sky=null,shown=true,sunK=1;const starTint=new THREE.Color;function system(sys){if(sky){group.remove(sky.root);disposeTree(sky.root)}const r=makeRng(seed*2654435761>>>0^hashStr(sys?.name||""));const star=STAR[sys?.star]||STAR.G;sun.material.color.set(sys?.color||star[0]).lerp(new THREE.Color(16777215),.25);sunCore.material.color.set(sys?.color||star[0]).lerp(new THREE.Color(16777215),.7);sunK=star[1];const planets=sys?sys.planets:[{kind:r.pick(["barren","ice","gas","gas","ocean","jungle","ruin"])}];starTint.set(sys?.color||star[0]).lerp(WHITE,.55);sky=buildSky(r,planets,!!sys?.field,sunDir,palette,starTint);group.add(sky.root);sky.root.visible=shown}system(null);const real=realBodies(scene,()=>{if(sky)sky.root.visible=shown&&!real.any;sun.visible=sunCore.visible=shown&&!real.any});return{sunDir,palette,system,bodies(show){shown=show;sun.visible=sunCore.visible=show&&!real.any;if(sky)sky.root.visible=show&&!real.any;real.show(show)},update(camera,t,pr=1){const c=camera.position;const K=Math.max(1,(c.y+1400)/1472);nebMat.uniforms.uOff.value.set(c.x*.12/K,-c.z*.12/K);nebMat.uniforms.uT.value=t;neb.position.set(c.x,c.y-72*K-1400*K,c.z);neb.scale.set(K,K,1);for(const l of layers){l.material.uniforms.uCam.value.copy(c);l.material.uniforms.uT.value=t;l.material.uniforms.uPR.value=pr;l.material.uniforms.uK.value=K}sun.position.set(c.x*.9+sunDir.x*950*K,c.y-72*K-900*K,c.z*.9-sunDir.z*760*K);sunCore.position.copy(sun.position);sun.scale.setScalar(900*sunK*K);sunCore.scale.setScalar(150*sunK*K*(1+.03*Math.sin(t*2.3)));if(sky)sky.update(c,t,pr)},world(w){real.update(w)},dispose(){scene.remove(group);disposeTree(group);real.dispose()}}}const STAR={O:[10203391,1.5],B:[11190271,1.35],A:[13819647,1.2],F:[16316415,1.08],G:[16773334,1],K:[16764047,.9],M:[16751194,.78]};const WHITE=new THREE.Color(1,1,1);const KIND={barren:0,ice:1,jungle:2,ocean:3,gas:4,ruin:5};const hsl=(h,s,l)=>new THREE.Color().setHSL((h%1+1)%1,s,l);function hashStr(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}function worldLook(kind,r){const j=(a=.02)=>r.range(-a,a);switch(kind){case"barren":return{c1:hsl(.07+j(.03),.14,.3),c2:hsl(.08+j(.03),.1,.56),c3:hsl(.06,.12,.17),air:hsl(.6,.1,.6),airK:0};case"ice":return{c1:hsl(.57+j(),.3,.66),c2:hsl(.55,.4,.84),c3:hsl(.58+j(),.6,.42),air:hsl(.55,.6,.75),airK:.45};case"jungle":return{c1:hsl(.3+j(.04),.55,.2),c2:hsl(.2+j(.04),.45,.38),c3:hsl(.58+j(),.6,.22),air:hsl(.58,.7,.65),airK:1};case"ocean":return{c1:hsl(.22+j(),.35,.42),c2:hsl(.13,.4,.62),c3:hsl(.6+j(),.7,.2),air:hsl(.58,.8,.68),airK:1.15};case"gas":{const warm=r.chance(.6),h=warm?r.pick([.07,.09,.11]):r.pick([.5,.56,.62,.75]);return{c1:hsl(h,.45,.36),c2:hsl(h+(warm?.03:-.04),.32,.6),c3:hsl(warm?.02:h+.08,.6,.5),air:hsl(h,.5,.7),airK:.75}}default:return{c1:hsl(.07+j(),.18,.24),c2:hsl(.09,.14,.42),c3:hsl(.08,.95,.58),air:hsl(.07,.4,.5),airK:.6}}}const WORLD_VS="varying vec3 vN, vNw, vW; void main() { vN = normalize(normal); vNw = normalize(mat3(modelMatrix) * normal); vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }";const WORLD_FS=`${NOISE}
  vec3 cr3(vec3 p) { p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6))); return fract(sin(p) * 43758.5453); }
  float craters(vec3 p, float keep) {
    vec3 i = floor(p), f = fract(p); float s = 1.0;
    for (int x = -1; x <= 1; x++) for (int y = -1; y <= 1; y++) for (int z = -1; z <= 1; z++) {
      vec3 g = vec3(float(x), float(y), float(z)), o = cr3(i + g); if (o.z > keep) continue;
      float rad = 0.22 + 0.3 * fract(o.x * 7.1 + o.y * 3.3), u = length(g + o - f) / rad;
      if (u < 1.6) s *= 1.0 - 0.38 * smoothstep(0.9, 0.25, u) + 0.32 * exp(-pow((u - 0.97) * 7.0, 2.0)) + 0.06 * exp(-pow((u - 1.3) * 5.0, 2.0));
    }
    return s;
  }
  uniform vec3 uSun, uC1, uC2, uC3, uAir, uStar; uniform float uT, uKind, uSeed, uAirK, uFade; varying vec3 vN, vNw, vW;
  void main() {
    vec3 n = normalize(vN), nw = normalize(vNw);
    vec3 col; float spec = 0.0, lights = 0.0;
    if (uKind < 0.5) {
      float h = fbm(n * 3.0 + uSeed);
      float basin = smoothstep(0.55, 0.7, fbm(n * 1.6 + uSeed + 4.0));
      col = mix(uC1, uC2, smoothstep(0.3, 0.75, h));
      col = mix(col, uC3, basin * 0.75);
      col *= craters(n * 3.2 + uSeed, 0.45) * craters(n * 9.0 + uSeed * 1.7 + 3.0, 0.6) * (0.9 + 0.14 * n3(n * 40.0 + uSeed));
    } else if (uKind < 1.5) {
      float h = fbm(n * 2.5 + uSeed);
      col = mix(uC1, uC2, smoothstep(0.35, 0.7, h));
      float crack = 1.0 - smoothstep(0.0, 0.03, abs(fbm(n * 4.0 + uSeed + 2.0) - 0.5));
      float crack2 = 1.0 - smoothstep(0.0, 0.02, abs(fbm(n * 9.0 + uSeed + 6.0) - 0.5));
      col = mix(col, uC3, crack * 0.8 + crack2 * 0.35);
      spec = 0.35;
    } else if (uKind < 3.5) {
      bool jungle = uKind < 2.5;
      float h = fbm(n * 2.4 + uSeed), at = jungle ? 0.48 : 0.62;
      float land = smoothstep(at, at + 0.025, h);
      vec3 sea = mix(uC3 * 0.8, uC3 * 1.7 + vec3(0.0, 0.06, 0.08), smoothstep(at - 0.1, at, h));
      vec3 ground = mix(uC1, uC2, clamp(smoothstep(at + 0.04, at + 0.24, h) + 0.35 * (fbm(n * 8.0 + uSeed) - 0.5), 0.0, 1.0));
      col = mix(sea, ground, land);
      col = mix(col, vec3(0.93), smoothstep(0.8, 0.93, abs(n.y)));
      float cl = smoothstep(0.5, 0.78, fbm(n * 3.6 + vec3(uT * 0.004, 0.0, uSeed + 3.0) + fbm(n * 7.0 + uSeed) * 0.45));
      col = mix(col, vec3(0.96), cl * (jungle ? 0.7 : 0.76));
      spec = (1.0 - land) * (1.0 - cl);
    } else if (uKind < 4.5) {
      float tb = fbm(vec3(n.x * 2.0, n.y * 14.0, n.z * 2.0) + uSeed);
      float b = n.y * 9.0 + tb * 1.8 + 0.35 * sin(n.x * 6.0 + n.z * 4.0 + uT * 0.02);
      col = mix(uC1, uC2, 0.5 + 0.5 * sin(b * 2.1));
      col = mix(col, uC1 * 0.62, smoothstep(0.6, 0.9, fbm(n * 6.0 + uSeed)) * 0.45);
      vec3 sp = normalize(vec3(0.62, -0.28, 0.73)); float sd = distance(n, sp) + 0.05 * n3(n * 26.0 + uSeed);
      col = mix(col, uC3, smoothstep(0.2, 0.11, sd));
      col = mix(col, uC2 * 1.1, smoothstep(0.11, 0.06, sd) * 0.6);
    } else {
      float h = fbm(n * 2.6 + uSeed);
      float land = smoothstep(0.47, 0.5, h);
      col = mix(uC1 * 0.55, mix(uC1, uC2, fbm(n * 7.0 + uSeed)), land);
      float scar = 1.0 - smoothstep(0.0, 0.018, abs(fbm(n * 5.0 + uSeed + 9.0) - 0.5));
      col = mix(col, uC1 * 0.3, scar * 0.7);
      float city = land * smoothstep(0.48, 0.62, fbm(n * 3.0 + uSeed + 1.0));
      vec3 g3 = abs(fract(n * 70.0 + uSeed) - 0.5); float street = 1.0 - smoothstep(0.0, 0.06, min(g3.x, min(g3.y, g3.z)));
      float block = 0.75 + 0.25 * h3(floor(n * 70.0 + uSeed));
      col = mix(col, vec3(0.42, 0.4, 0.38) * block * (1.0 - 0.45 * street), city * 0.7);
      col *= craters(n * 4.5 + uSeed + 7.0, 0.5);
      float grid = step(0.9, h3(floor(n * 160.0) + uSeed)) * city;
      lights = grid * (0.7 + 0.3 * sin(uT * 0.7 + h * 40.0));
    }
    float l = dot(nw, uSun), lit = smoothstep(-0.12, 0.35, l);
    vec3 V = normalize(cameraPosition - vW), H = normalize(uSun + V);
    float rim = pow(1.0 - max(0.0, dot(nw, V)), 3.0);
    vec3 c = col * (0.02 + 0.86 * lit * uStar) + uStar * spec * pow(max(0.0, dot(nw, H)), 36.0) * 0.55 * lit;
    c += uAir * rim * uAirK * (0.2 + 1.4 * smoothstep(-0.3, 0.6, l)) * 0.85;
    c += uC3 * lights * (1.0 - lit) * 1.8;
    gl_FragColor = vec4(c * uFade, 1.0);
    #include <colorspace_fragment>
  }`;const AIR_FS=`uniform vec3 uSun, uAir; uniform float uAirK, uFade; varying vec3 vN, vNw, vW;
  void main() { vec3 V = normalize(cameraPosition - vW); float f = pow(1.0 - abs(dot(normalize(vNw), V)), 2.2);
    float l = smoothstep(-0.4, 0.5, dot(normalize(vNw), uSun)); gl_FragColor = vec4(uAir * f * l * 1.2 * uAirK * uFade, 1.0); }`;const RING_FS=`${NOISE}
  uniform vec3 uC1, uC2, uSun, uPC; uniform float uIn, uOut, uSeed, uR; varying vec3 vP, vW;
  void main() {
    float r = length(vP.xy), u = (r - uIn) / (uOut - uIn);
    float b1 = n3(vec3(u * 26.0, uSeed, 0.0)), b2 = n3(vec3(u * 95.0, uSeed + 5.0, 0.0)), b3 = n3(vec3(u * 7.0, uSeed + 9.0, 0.0));
    float dens = (0.3 + 0.7 * b3) * (0.5 + 0.5 * b1) * (0.7 + 0.3 * b2);
    float gaps = smoothstep(0.012, 0.04, abs(u - 0.64)) * smoothstep(0.0, 0.12, u) * smoothstep(1.0, 0.78, u);
    float a = dens * gaps * 0.58;
    vec3 d = vW - uPC; float along = dot(d, uSun); float off = length(d - uSun * along);
    float shade = along < 0.0 ? smoothstep(uR * 0.92, uR * 1.02, off) : 1.0;
    vec3 col = mix(uC1, uC2, u) * (0.25 + 0.85 * shade);
    gl_FragColor = vec4(col * a, a);
    #include <colorspace_fragment>
  }`;function worldMesh(kind,R,look,sunDir,r,segs=96,fade=1,star=WHITE){const u={uSun:{value:sunDir},uStar:{value:star},uFade:{value:fade},uT:{value:0},uKind:{value:KIND[kind]??0},uSeed:{value:r.range(0,50)},uC1:{value:look.c1},uC2:{value:look.c2},uC3:{value:look.c3},uAir:{value:look.air},uAirK:{value:look.airK}};const sg=Q.low?Math.max(24,segs>>1):segs;const m=new THREE.Mesh(new THREE.SphereGeometry(R,sg,sg*2/3|0),new THREE.ShaderMaterial({uniforms:u,vertexShader:WORLD_VS,fragmentShader:WORLD_FS,defines:{OCT:Q.low?4:6}}));const g=new THREE.Group,tilt=new THREE.Group;g.add(tilt);tilt.add(m);tilt.rotation.set(Math.PI/2-r.range(.6,.95),0,r.range(-.6,.6));if(look.airK>0)g.add(new THREE.Mesh(new THREE.SphereGeometry(R*1.06,64,40),new THREE.ShaderMaterial({uniforms:u,vertexShader:WORLD_VS,fragmentShader:AIR_FS,transparent:true,blending:THREE.AdditiveBlending,side:THREE.BackSide,depthWrite:false})));return{g,tilt,spin:m,u}}function buildSky(r,planets,field,sunDir,palette,star){const root=new THREE.Group,movers=[],timed=[];const gi=planets.findIndex(p=>p.kind==="gas"),mi=planets.length?gi>=0&&r.chance(.6)?gi:Math.floor(r.next()*planets.length):-1;if(mi>=0){const p=planets[mi],gas=p.kind==="gas",R=r.range(170,240)*(gas?1.25:1);const w=worldMesh(p.kind,R,worldLook(p.kind,r),sunDir,r,96,.74,star);const at=new THREE.Vector3(r.range(-420,420),-1e3,r.range(-330,170));root.add(w.g);timed.push(w.u);movers.push({o:w.g,at,k:.82,spin:w.spin,sp:.004});if(gas&&r.chance(.55)){const inR=R*1.3,outR=R*r.range(1.9,2.25);const ru={uC1:{value:worldLook("gas",r).c2},uC2:{value:hsl(.1,.15,.55)},uSun:{value:sunDir},uPC:{value:new THREE.Vector3},uIn:{value:inR},uOut:{value:outR},uSeed:{value:r.range(0,20)},uR:{value:R}};const ring=new THREE.Mesh(new THREE.RingGeometry(inR,outR,160,1),new THREE.ShaderMaterial({uniforms:ru,vertexShader:"varying vec3 vP, vW; void main() { vP = position; vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }",fragmentShader:RING_FS,transparent:true,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;w.tilt.add(ring);movers[movers.length-1].ring=ru}const nm=gas?1+Math.floor(r.next()*3):r.chance(.55)?1:0;for(let i=0;i<nm;i++){const kind=r.pick(["barren","barren","ice"]),mR=R*r.range(.045,.085),w2=worldMesh(kind,mR,worldLook(kind,r),sunDir,r,40,.66,star);root.add(w2.g);timed.push(w2.u);movers.push({o:w2.g,moonOf:w.g,orbit:R*(gas?2.7:1.8)+R*.55*i,a0:r.range(0,6.28),w:r.range(.012,.03)/(1+i),tilt:r.range(.15,.4),spin:w2.spin,sp:.01})}}planets.forEach((p,i)=>{if(i===mi)return;const R=r.range(26,52)*(p.kind==="gas"?1.6:1),w=worldMesh(p.kind,R,worldLook(p.kind,r),sunDir,r,48,.6,star);const a=r.range(0,6.28),d=r.range(560,1050);root.add(w.g);timed.push(w.u);movers.push({o:w.g,at:new THREE.Vector3(Math.cos(a)*d,-1250-r.range(0,120),Math.sin(a)*d*.7),k:.87,spin:w.spin,sp:.006})});let belt=null;if(field)belt=makeBelt(r,palette);if(belt)root.add(belt.root);return{root,update(c,t,pr){for(const m of movers){if(m.moonOf){const a=m.a0+t*m.w,o=m.moonOf.position;m.o.position.set(o.x+Math.cos(a)*m.orbit,o.y+Math.sin(a)*m.orbit*m.tilt,o.z+Math.sin(a)*m.orbit)}else m.o.position.set(c.x*m.k+m.at.x,m.at.y,c.z*m.k+m.at.z);m.spin.rotation.y=t*m.sp;if(m.ring)m.ring.uPC.value.copy(m.o.position)}for(const u of timed)u.uT.value=t;if(belt)belt.update(c,t,pr)}}}function makeBelt(r,palette){const root=new THREE.Group,L=3600,W=115,Y=-560;const ang=r.range(.25,Math.PI-.25),D=new THREE.Vector2(Math.cos(ang),Math.sin(ang)),P=new THREE.Vector2(-D.y,D.x);const off=new THREE.Vector2(r.range(-160,160),r.range(-140,80)),O=new THREE.Vector2;const across=()=>(r.next()+r.next()+r.next()-1.5)/1.5*W;const shapes=[0,1,2].map(k=>{const g2=new THREE.IcosahedronGeometry(1,k===2?1:0),p2=g2.attributes.position,v=new THREE.Vector3;for(let i=0;i<p2.count;i++){v.fromBufferAttribute(p2,i);const h=Math.sin(v.x*12.9898+v.y*78.233+v.z*37.719+k*7.1)*43758.5453;v.multiplyScalar(.72+.5*(h-Math.floor(h)));v.y*=.75;p2.setXYZ(i,v.x,v.y,v.z)}g2.computeVertexNormals();return g2});const NR=Q.low?360:760,rockMat=new THREE.MeshStandardMaterial({color:16777215,roughness:.95,metalness:.04,flatShading:true});const meshes=shapes.map(g2=>{const m=new THREE.InstancedMesh(g2,rockMat,Math.ceil(NR/3));m.frustumCulled=false;m.renderOrder=-8;root.add(m);return m});const rocks=[],c=new THREE.Color,dusty=hsl(.07,.14,.42),rusty=hsl(.04,.3,.36),pale=hsl(.1,.08,.6);for(let i=0;i<NR;i++){const big=r.next()<.06,k=i%3,m=meshes[k],j=Math.floor(i/3);rocks.push({m,j,u:r.range(-L/2,L/2),v:across(),y:Y+r.range(-45,45),s:big?r.range(5,9):Math.pow(r.next(),2.2)*4+.9,ax:r.range(0,6.28),ay:r.range(0,6.28),wx:r.range(-.12,.12),wy:r.range(-.2,.2)});c.copy(r.next()<.2?rusty:r.next()<.3?pale:dusty).multiplyScalar(.5+.4*r.next());m.setColorAt(j,c)}for(const m of meshes){m.count=Math.ceil(NR/3);m.instanceColor.needsUpdate=true}const NG=Q.low?1800:4200,gp=new Float32Array(NG*3),gm=new Float32Array(NG),gc=new Float32Array(NG*3);for(let i=0;i<NG;i++){gp[i*3]=r.range(-L/2,L/2);gp[i*3+1]=across()*1.1;gp[i*3+2]=Y+r.range(-60,60);gm[i]=.3+Math.pow(r.next(),2)*.9;c.copy(r.next()<.25?rusty:dusty).multiplyScalar(.6+.6*r.next());gc.set([c.r,c.g,c.b],i*3)}const g=new THREE.BufferGeometry;g.setAttribute("position",new THREE.BufferAttribute(gp,3));g.setAttribute("aMag",new THREE.BufferAttribute(gm,1));g.setAttribute("aCol",new THREE.BufferAttribute(gc,3));const u={uO:{value:O},uD:{value:D},uP:{value:P},uCamU:{value:0},uL:{value:L},uPR:{value:1}};const gravel=new THREE.Points(g,new THREE.ShaderMaterial({uniforms:u,vertexShader:`uniform vec2 uO, uD, uP; uniform float uCamU, uL, uPR; attribute float aMag; attribute vec3 aCol; varying vec3 vCol;
      void main() {
        float u = uCamU + mod(position.x - uCamU + uL * 0.5, uL) - uL * 0.5;
        vec2 xz = uO + uD * u + uP * position.y;
        vec4 mv = modelViewMatrix * vec4(xz.x, position.z, xz.y, 1.0);
        gl_PointSize = max(1.0, aMag * uPR * 1800.0 / -mv.z); vCol = aCol;
        gl_Position = projectionMatrix * mv;
      }`,fragmentShader:`varying vec3 vCol; void main() { vec2 c = gl_PointCoord - 0.5; if (dot(c, c) > 0.25) discard; gl_FragColor = vec4(vCol, 1.0);
      #include <colorspace_fragment>
      }`}));gravel.frustumCulled=false;gravel.renderOrder=-8;root.add(gravel);const du={uO:u.uO,uD:u.uD,uP:u.uP,uCamU:u.uCamU,uW:{value:W},uA:{value:palette[1].clone().lerp(hsl(.08,.3,.5),.65)},uSeed:{value:r.range(0,40)}};const dust=new THREE.Mesh(new THREE.PlaneGeometry(L,W*3.4,1,1),new THREE.ShaderMaterial({uniforms:du,vertexShader:"uniform vec2 uO, uD, uP; uniform float uCamU; varying vec2 vB; void main() { vB = vec2(position.x + uCamU, position.y); vec2 xz = uO + uD * (position.x + uCamU) + uP * position.y; gl_Position = projectionMatrix * viewMatrix * vec4(xz.x, -640.0, xz.y, 1.0); }",fragmentShader:`${NOISE}
      uniform float uW, uSeed; uniform vec3 uA; varying vec2 vB;
      void main() { float v = vB.y / uW; float band = exp(-v * v * 1.3);
        float n = fbm(vec3(vB.x * 0.005, vB.y * 0.014, uSeed)); float a = band * (0.3 + 0.7 * smoothstep(0.3, 0.75, n)) * 0.32;
        gl_FragColor = vec4(uA * a, 1.0); }`,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));dust.frustumCulled=false;dust.renderOrder=-9;root.add(dust);const m4=new THREE.Matrix4,q=new THREE.Quaternion,e=new THREE.Euler,p=new THREE.Vector3,sc=new THREE.Vector3;return{root,update(cam,t,pr){O.set(cam.x*.6+off.x,cam.z*.6+off.y);const cu=(cam.x-O.x)*D.x+(cam.z-O.y)*D.y;u.uCamU.value=cu;u.uPR.value=pr;for(const k of rocks){const w=cu+((k.u-cu+L/2)%L+L)%L-L/2;p.set(O.x+D.x*w+P.x*k.v,k.y,O.y+D.y*w+P.y*k.v);e.set(k.ax+t*k.wx,k.ay+t*k.wy,0);q.setFromEuler(e);sc.setScalar(k.s);k.m.setMatrixAt(k.j,m4.compose(p,q,sc))}for(const m of meshes)m.instanceMatrix.needsUpdate=true}}}function disposeTree(o){o.traverse(x=>{x.geometry?.dispose();const ms=Array.isArray(x.material)?x.material:x.material?[x.material]:[];for(const m of ms){m.map?.dispose();m.dispose()}})}function glowTexture(size=128){const cv=document.createElement("canvas");cv.width=cv.height=size;const g=cv.getContext("2d"),grd=g.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);grd.addColorStop(0,"rgba(255,255,255,1)");grd.addColorStop(.18,"rgba(255,255,255,0.55)");grd.addColorStop(.45,"rgba(255,255,255,0.12)");grd.addColorStop(1,"rgba(255,255,255,0)");g.fillStyle=grd;g.fillRect(0,0,size,size);const t=new THREE.CanvasTexture(cv);t.colorSpace=THREE.SRGBColorSpace;return t}function burnZone(star,col){const R0=star.r,R1=star.burn,u={uT:{value:0},uR0:{value:R0},uR1:{value:R1},uCol:{value:col.clone()},uRays:{value:1}};const m=new THREE.Mesh(new THREE.RingGeometry(R0*.82,R1*1.05,160,1).rotateX(-Math.PI/2),new THREE.ShaderMaterial({uniforms:u,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,side:THREE.DoubleSide,vertexShader:"varying vec2 vP; void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",fragmentShader:`varying vec2 vP; uniform float uT, uR0, uR1, uRays; uniform vec3 uCol;
      float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float ring(float a, float y, float n) { float x = a / 6.2831853 * n, i = floor(x), f = fract(x), j = floor(y), g = fract(y); f = f * f * (3.0 - 2.0 * f); g = g * g * (3.0 - 2.0 * g);
        return mix(mix(h(vec2(mod(i, n), j)), h(vec2(mod(i + 1.0, n), j)), f), mix(h(vec2(mod(i, n), j + 1.0)), h(vec2(mod(i + 1.0, n), j + 1.0)), f), g); }
      void main() {
        float d = length(vP), a = atan(vP.y, vP.x) + 3.14159265, span = uR1 - uR0;
        float k = clamp(1.0 - (d - uR0) / span, 0.0, 1.0), inside = step(d, uR1) * smoothstep(uR0 * 0.82, uR0 * 0.97, d);
        float rays = 0.0;
        if (uRays > 0.5) { float out1 = d / span * 2.2 - uT * 0.22, out2 = d / span * 5.0 - uT * 0.38;
          rays = smoothstep(0.45, 0.9, ring(a, out1, 31.0)) * 0.6 + smoothstep(0.55, 0.95, ring(a + 1.7, out2, 73.0)) * 0.4;
          rays *= smoothstep(0.0, 0.1, k) * (0.4 + 0.6 * smoothstep(0.0, 0.6, k)); }
        float body = (0.05 + 0.27 * k * k + rays * (0.045 + 0.2 * k)) * inside;
        float w = span * 0.011, flick = 0.6 + 0.4 * ring(a, uT * 0.9, 97.0);
        float e1 = (d - uR1) / w, e2 = (d - uR1 + w * 4.0) / (w * 3.0);
        float rim = exp(-e1 * e1) * flick * 0.85 + exp(-e2 * e2) * 0.14 * inside;
        vec3 c = mix(mix(uCol, vec3(1.0, 0.46, 0.14), 0.7), mix(uCol, vec3(1.0, 0.8, 0.5), 0.4), k) * body + mix(uCol, vec3(1.0, 0.86, 0.62), 0.55) * rim;
        if (c.r + c.g + c.b < 0.004) discard;
        gl_FragColor = vec4(c, 1.0);
      }`}));m.renderOrder=-3;m.frustumCulled=false;return{m,u}}function realBodies(scene,onChange){const group=new THREE.Group;scene.add(group);let last=null,items=[],gate=null,lastGate=null;const api={any:false,update(w){const B=w?.bodies||[];if(B!==last){last=B;build(B);api.any=items.length>0;onChange()}if((w?.gate||null)!==lastGate){lastGate=w?.gate||null;buildGate(lastGate)}if(gate)gate.tick(.016);for(const it of items){if(it.zone){it.u.uT.value+=.016;it.u.uRays.value=Q.low?0:1;continue}it.spin.rotation.y+=2e-4;if(it.u)it.u.uT.value+=.016}},show(v){group.visible=v},dispose(){scene.remove(group);disposeTree(group)}};function buildGate(G){if(gate){group.remove(gate.g);disposeTree(gate.g);gate=null}if(!G)return;gate=gateArt(G);gate.g.position.set(G.x,-1,-G.y);group.add(gate.g)}function build(B){for(const it of items){group.remove(it.g);disposeTree(it.g)}items=[];const star=B.find(b=>b.kind==="star"),r0=makeRng(B.length*977+Math.round((star?.x||0)+(star?.y||0)));for(const b of B){if(b.kind==="star"){const col=new THREE.Color(b.color||(STAR[b.cls]||STAR.G)[0]),g=new THREE.Group;const ball=new THREE.Mesh(new THREE.SphereGeometry(b.r,48,32),new THREE.MeshBasicMaterial({color:col.clone().lerp(new THREE.Color(1,1,1),.6).multiplyScalar(2.2),toneMapped:false}));const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTexture(),color:col,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true,toneMapped:false}));glow.scale.setScalar(b.r*7);g.add(ball);g.add(glow);const light=new THREE.PointLight(col.clone().lerp(new THREE.Color(1,1,1),.5),1.1,0,0);g.add(light);g.position.set(b.x,-b.r*1.05-4,-b.y);group.add(g);items.push({g,spin:ball});if(b.burn>b.r){const z=burnZone(b,col);z.m.position.set(b.x,-1.2,-b.y);group.add(z.m);items.push({g:z.m,spin:z.m,u:z.u,zone:true})}continue}const kind=b.kind==="moon"?r0.chance(.7)?"barren":"ice":b.kind in KIND?b.kind:"barren";const sd=star?new THREE.Vector3(star.x-b.x,0,-(star.y-b.y)).normalize().setY(.35).normalize():new THREE.Vector3(.4,.6,-.5).normalize();const w=worldMesh(kind,b.r,worldLook(kind,r0),sd,r0,b.r>400?128:96,.95,star?new THREE.Color(star.color||(STAR[star.cls]||STAR.G)[0]).lerp(WHITE,.55):WHITE);w.g.position.set(b.x,-b.r*1.03-3,-b.y);group.add(w.g);items.push({g:w.g,spin:w.spin,u:w.u})}}return api}export{createSpace,glowTexture};

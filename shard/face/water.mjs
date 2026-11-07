// © 2026 Glimmerveil. All rights reserved.
import*as THREE from"three";import{GROUND}from"../engine/world.mjs";import{cellCentre,cellAt,WATER_Y}from"./layout.mjs";import{Rng}from"../engine/rng.mjs";const VERT=`
uniform mat4 textureMatrix;
varying vec4 vUvR;
varying vec3 vN;
varying vec3 vW;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vUvR = textureMatrix * wp;                                   // world space: the lake and every puddle share one mirror
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;const FRAG=`
uniform sampler2D tReflect;
uniform vec3 deep;
uniform vec3 camPos;
uniform float bend;
uniform float streak;
uniform float wet;
varying vec2 vUv;
varying vec4 vUvR;
varying vec3 vN;
varying vec3 vW;
void main() {
  vec3 V = normalize(camPos - vW);
  float facing = max(dot(vN, V), 0.0);
  float fres = 0.3 + 0.7 * pow(1.0 - facing, 2.0);
  vec4 uv = vUvR;
  uv.xy += vec2(vN.x * 0.6, vN.z * 1.6) * bend * uv.w;        // the swell bends the picture, most of all up and down
  vec3 refl = texture2DProj(tReflect, uv).rgb;
  // a light on rippled water is a long broken streak, not a point: look up and down the picture for anything bright
  vec3 hot = vec3(0.0);
  for (int k = 1; k <= 7; k++) {
    float o = float(k) * streak * uv.w * (0.6 + 0.4 * sin(vW.z * 9.0 + float(k) * 1.7 + vN.x * 40.0));
    vec3 a = texture2DProj(tReflect, uv + vec4(0.0, o, 0.0, 0.0)).rgb, b = texture2DProj(tReflect, uv - vec4(0.0, o, 0.0, 0.0)).rgb;
    hot = max(hot, max(a, b) * (1.0 - float(k) / 9.0));
  }
  float glint = smoothstep(0.35, 0.9, max(hot.r, max(hot.g, hot.b)));
  refl = max(refl, hot * glint * (0.55 + 0.45 * abs(vN.z) * 12.0));
  float a = 1.0;
  #ifdef PUDDLE
    float rad = length(vUv - 0.5) * 2.0;
    a = wet * smoothstep(1.0, 0.55, rad);
    fres = 0.55 + 0.45 * fres;
  #endif
  gl_FragColor = vec4(deep * (1.0 - fres) + refl * fres * 0.92, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;function makeWater(place,seed){let x0=Infinity,x1=-Infinity,z0=Infinity,z1=-Infinity;const wet=[];for(let y=0;y<place.h;y++)for(let x=0;x<place.w;x++)if(place.cells[y*place.w+x]===GROUND.water){const[X,Z]=cellCentre(place,x,y);wet.push([X,Z]);x0=Math.min(x0,X);x1=Math.max(x1,X);z0=Math.min(z0,Z);z1=Math.max(z1,Z)}if(!wet.length)return null;const W=x1-x0+4,D=z1-z0+6;const geo=new THREE.PlaneGeometry(W,D,Math.ceil(W*2.5),Math.ceil(D*2.5));geo.rotateX(-Math.PI/2);const rt=new THREE.WebGLRenderTarget(512,256,{colorSpace:THREE.SRGBColorSpace});const textureMatrix=new THREE.Matrix4;const mat=new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:FRAG,uniforms:{tReflect:{value:rt.texture},textureMatrix:{value:textureMatrix},deep:{value:new THREE.Color(397854)},camPos:{value:new THREE.Vector3},bend:{value:.06},streak:{value:.012},wet:{value:0}}});const mesh=new THREE.Mesh(geo,mat);mesh.position.set((x0+x1)/2,WATER_Y,(z0+z1)/2);const base=Float32Array.from(geo.attributes.position.array);const isWet=(X,Z)=>{const[x,y]=cellAt(place,X,Z);return x>=0&&y>=0&&x<place.w&&y<place.h&&place.cells[y*place.w+x]===GROUND.water};const RINGS=48,ringGeo=new THREE.RingGeometry(.86,1,20,1);ringGeo.rotateX(-Math.PI/2);const ringMat=new THREE.MeshBasicMaterial({color:12374248,transparent:true,opacity:.55,depthWrite:false});const rings=new THREE.InstancedMesh(ringGeo,ringMat,RINGS),live=Array.from({length:RINGS},()=>({age:9,x:0,z:0,size:1}));const d=new THREE.Object3D;rings.frustumCulled=false;const ripple=(x,z,size,y=WATER_Y+.07)=>{const r=live.reduce((a,b)=>b.age>a.age?b:a);Object.assign(r,{age:0,x,z,size,y})};const prng=new Rng(`${seed}:puddles`),paths=[];for(let y=0;y<place.h;y++)for(let x=0;x<place.w;x++)if(place.cells[y*place.w+x]===GROUND.path)paths.push([x,y]);const puddleMat=new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:FRAG,uniforms:{...mat.uniforms,deep:{value:new THREE.Color(1381135)}},defines:{PUDDLE:1},transparent:true,depthWrite:false});const puddles=[];for(let k=0;k<Math.min(44,paths.length);k++){const[cx,cy]=paths.splice(prng.int(paths.length),1)[0],[X,Z]=cellCentre(place,cx,cy);const r=.35+prng.float()*.6,g=new THREE.CircleGeometry(1,16);g.rotateX(-Math.PI/2);const pos=g.attributes.position.array;for(let i=3;i<pos.length;i+=3){const j=.7+prng.float()*.5;pos[i]*=j;pos[i+2]*=j*(.8+prng.float()*.4)}const m=new THREE.Mesh(g,puddleMat);m.position.set(X+(prng.float()-.5)*.4,.035,Z+(prng.float()-.5)*1.2);m.renderOrder=1;puddles.push({m,r,x:m.position.x,z:m.position.z})}let wetness=0;const fish=new THREE.Mesh(new THREE.ConeGeometry(.07,.36,5),new THREE.MeshStandardMaterial({color:9082528,roughness:.4,metalness:.5}));fish.rotation.z=Math.PI/2;fish.visible=false;const leap={t:9,x:0,z:0,dir:1};let nextFish=6;const group=new THREE.Group;group.add(mesh,rings,fish,...puddles.map(p=>p.m));const virtual=new THREE.PerspectiveCamera,plane=new THREE.Plane,clip=new THREE.Vector4,q4=new THREE.Vector4;const n=new THREE.Vector3(0,1,0),mirrorPos=new THREE.Vector3,view=new THREE.Vector3,target=new THREE.Vector3;const look=new THREE.Vector3,rot=new THREE.Matrix4;return{group,mesh,rt,splashAt(x,z){if(wetness<.3)return false;for(const p of puddles)if((p.x-x)**2+(p.z-z)**2<(p.r*(.25+.75*wetness))**2){ripple(x,z,.3,.045);ripple(x,z,.16,.045);return true}return false},update(t,dt,w){const flat=w.flat,p=geo.attributes.position.array,amp=flat?0:.6+w.wind*1.4;for(let i=0;i<p.length;i+=3){const x=base[i],z=base[i+2];p[i+1]=amp*(.045*Math.sin(z*2.1-t*1.3+Math.sin(x*.35+t*.2)*1.5)+.022*Math.sin(z*4.3+x*.5+t*2.1)+.01*Math.sin(x*1.9-t*.7))}geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();mat.uniforms.bend.value=flat?0:.03+w.wind*.05;mat.uniforms.streak.value=flat?0:.008+w.wind*.01;const c=Math.max(0,Math.min(1,((w.cover||0)-.2)/.4));wetness=(w.wet??wetness)*(1-c*c*(3-2*c));puddleMat.uniforms.wet.value=wetness;for(const p2 of puddles){const s=p2.r*(.25+.75*wetness);p2.m.scale.set(s,1,s);p2.m.visible=wetness>.04}if(wetness>.3&&w.rain>0)for(let k=0;k<(Math.random()<w.rain*dt*12?1:0);k++){const p2=puddles[Math.floor(Math.random()*puddles.length)];if(p2)ripple(p2.x+(Math.random()-.5)*p2.r,p2.z+(Math.random()-.5)*p2.r,.12+Math.random()*.12,.045)}const drops=w.rain*60*dt;for(let k=0;k<Math.floor(drops)+(Math.random()<drops%1?1:0);k++){const[X,Z]=wet[Math.floor(Math.random()*wet.length)];ripple(X+(Math.random()-.5),Z+(Math.random()-.5)*2,.25+Math.random()*.25)}nextFish-=dt;if(nextFish<0&&leap.t>1.2){const[X,Z]=wet[Math.floor(Math.random()*wet.length)];if(isWet(X-1,Z)&&isWet(X+1,Z))Object.assign(leap,{t:0,x:X,z:Z,dir:Math.random()<.5?-1:1});nextFish=4+Math.random()*10}if(leap.t<=1.2){const was=leap.t;leap.t+=dt;const k=Math.min(1,leap.t/.9);fish.visible=k<1;fish.position.set(leap.x+leap.dir*(k-.5)*1.4,WATER_Y+Math.sin(k*Math.PI)*.7,leap.z);fish.rotation.set(0,0,leap.dir*(Math.PI/2-(k-.5)*2.4));if(was===0)ripple(leap.x-leap.dir*.7,leap.z,.6);if(was<.9&&leap.t>=.9){ripple(leap.x+leap.dir*.7,leap.z,.9);ripple(leap.x+leap.dir*.7,leap.z,.45)}}live.forEach((r,i)=>{r.age+=dt;const k=r.age/1.4,on=k<1;d.position.set(r.x,r.y??WATER_Y+.07,r.z);d.scale.setScalar(on?r.size*(.15+k*1.1):1e-4);d.updateMatrix();rings.setMatrixAt(i,d.matrix)});rings.instanceMatrix.needsUpdate=true;ringMat.opacity=.5},reflect(renderer,scene,camera){mesh.updateMatrixWorld();camera.updateMatrixWorld();mirrorPos.setFromMatrixPosition(mesh.matrixWorld);view.setFromMatrixPosition(camera.matrixWorld);view.subVectors(mirrorPos,view);if(view.dot(n)>0)return;view.reflect(n).negate().add(mirrorPos);rot.extractRotation(camera.matrixWorld);look.set(0,0,-1).applyMatrix4(rot).add(camera.position);target.subVectors(mirrorPos,look).reflect(n).negate().add(mirrorPos);virtual.position.copy(view);virtual.up.set(0,1,0).applyMatrix4(rot).reflect(n);virtual.lookAt(target);virtual.far=camera.far;virtual.fov=camera.fov;virtual.aspect=camera.aspect;virtual.near=camera.near;virtual.layers.mask=1|1<<2;virtual.updateMatrixWorld();virtual.projectionMatrix.copy(camera.projectionMatrix);textureMatrix.set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);textureMatrix.multiply(virtual.projectionMatrix).multiply(virtual.matrixWorldInverse);plane.setFromNormalAndCoplanarPoint(n,mirrorPos).applyMatrix4(virtual.matrixWorldInverse);clip.set(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);const pm=virtual.projectionMatrix.elements;q4.set((Math.sign(clip.x)+pm[8])/pm[0],(Math.sign(clip.y)+pm[9])/pm[5],-1,(1+pm[10])/pm[14]);clip.multiplyScalar(2/clip.dot(q4));pm[2]=clip.x;pm[6]=clip.y;pm[10]=clip.z+1-.003;pm[14]=clip.w;mat.uniforms.camPos.value.copy(camera.position);const keep=renderer.getRenderTarget();group.visible=false;renderer.setRenderTarget(rt);renderer.setClearColor(0,1);renderer.clear();renderer.render(scene,virtual);renderer.setClearColor(0,0);group.visible=true;renderer.setRenderTarget(keep)}}}export{makeWater};

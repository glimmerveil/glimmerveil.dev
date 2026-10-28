import*as THREE from"../../vendor/three/three.module.js";import{cutaway}from"./cutaway.js";const VERT=`varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;function pass(frag,uniforms){return new THREE.ShaderMaterial({vertexShader:VERT,fragmentShader:frag,uniforms,depthTest:false,depthWrite:false})}const BRIGHT=`
uniform sampler2D tSrc; uniform float threshold, knee; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tSrc, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float soft = clamp(l - threshold + knee, 0.0, 2.0 * knee); soft = soft * soft / (4.0 * knee + 1e-4);
  float w = max(soft, l - threshold) / max(l, 1e-4);
  gl_FragColor = vec4(min(c * w, vec3(40.0)), 1.0);
}`;const DOWN=`
uniform sampler2D tSrc; uniform vec2 texel; varying vec2 vUv;
void main() {
  vec3 s = texture2D(tSrc, vUv).rgb * 4.0;
  s += texture2D(tSrc, vUv + vec2(-1.0, -1.0) * texel).rgb; s += texture2D(tSrc, vUv + vec2(1.0, -1.0) * texel).rgb;
  s += texture2D(tSrc, vUv + vec2(-1.0, 1.0) * texel).rgb; s += texture2D(tSrc, vUv + vec2(1.0, 1.0) * texel).rgb;
  gl_FragColor = vec4(s / 8.0, 1.0);
}`;const UP=`
uniform sampler2D tSrc, tAdd; uniform vec2 texel; uniform float addK; varying vec2 vUv;
void main() {
  vec3 s = vec3(0.0);
  s += texture2D(tSrc, vUv + vec2(-2.0, 0.0) * texel).rgb; s += texture2D(tSrc, vUv + vec2(2.0, 0.0) * texel).rgb;
  s += texture2D(tSrc, vUv + vec2(0.0, -2.0) * texel).rgb; s += texture2D(tSrc, vUv + vec2(0.0, 2.0) * texel).rgb;
  s += texture2D(tSrc, vUv + vec2(-1.0, 1.0) * texel).rgb * 2.0; s += texture2D(tSrc, vUv + vec2(1.0, 1.0) * texel).rgb * 2.0;
  s += texture2D(tSrc, vUv + vec2(-1.0, -1.0) * texel).rgb * 2.0; s += texture2D(tSrc, vUv + vec2(1.0, -1.0) * texel).rgb * 2.0;
  gl_FragColor = vec4(s / 12.0 + texture2D(tAdd, vUv).rgb * addK, 1.0);
}`;const GRADE_FN=`
vec3 aces(vec3 x) { // Narkowicz
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec3 grade(vec3 hdr, vec3 bloom, vec2 uv) {
  vec3 c = hdr + bloom * bloomK;
  c *= exposure;
  // the act's colour lifts the shadows, warmth in the lights
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c += shadowTint * smoothstep(0.0, 0.02, l) * (1.0 - smoothstep(0.02, 0.25, l)) * 0.02;
  c = aces(c);
  c = mix(vec3(dot(c, vec3(0.299, 0.587, 0.114))), c, saturation);
  c *= mix(vec3(1.0), highTint, smoothstep(0.35, 1.0, l) * 0.25);
  // vignette
  vec2 d = uv - 0.5; d.x *= aspect;
  c *= 1.0 - smoothstep(0.35, 1.05, length(d)) * vignette;
  return c;
}`;const COMPOSITE=`
uniform sampler2D tSrc, tBloom; uniform float bloomK, exposure, saturation, vignette, aspect, grain, time; uniform vec3 shadowTint, highTint; varying vec2 vUv;
${GRADE_FN}
void main() {
  // a breath of chromatic fringe toward the corners
  vec2 off = (vUv - 0.5) * 0.0016;
  vec3 hdr = vec3(texture2D(tSrc, vUv + off).r, texture2D(tSrc, vUv).g, texture2D(tSrc, vUv - off).b);
  vec3 c = grade(hdr, texture2D(tBloom, vUv).rgb, vUv);
  c = toSRGB(c);
  c += (hash12(gl_FragCoord.xy + fract(time) * 1000.0) - 0.5) * grain;
  gl_FragColor = vec4(c, 1.0);
}`;const CELLS=`
uniform sampler2D tSrc, tBloom; uniform vec2 cellUV; uniform float bloomK, exposure, saturation, vignette, aspect; uniform vec3 shadowTint, highTint;
${GRADE_FN}
void main() {
  vec2 base = floor(gl_FragCoord.xy) * cellUV;
  vec3 sum = vec3(0.0);
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++) { vec2 q = min(base + (vec2(float(i), float(j)) + 0.5) * cellUV * 0.25, vec2(0.999)); sum += grade(texture2D(tSrc, q).rgb, texture2D(tBloom, q).rgb, q); }
  vec3 c = sum / 16.0;
  gl_FragColor = vec4(c, dot(c, vec3(0.299, 0.587, 0.114)));
}`;const EXPO=`
uniform sampler2D tCells, tPrev; uniform float ease;
void main() {
  float s = 0.0, hi = 0.0, n = 0.0;
  for (int j = 0; j < 9; j++) for (int i = 0; i < 16; i++) s += pow(max(texture2D(tCells, (vec2(float(i), float(j)) + 0.5) / vec2(16.0, 9.0)).a, 0.0), 1.0 / 2.2);
  float m = s / 144.0;
  for (int j = 0; j < 9; j++) for (int i = 0; i < 16; i++) { float l = pow(max(texture2D(tCells, (vec2(float(i), float(j)) + 0.5) / vec2(16.0, 9.0)).a, 0.0), 1.0 / 2.2); if (l > m) { hi += l; n += 1.0; } }
  float key = clamp((n > 0.0 ? hi / n : m) * 1.05, 0.22, 0.95), prev = texture2D(tPrev, vec2(0.5)).r;
  gl_FragColor = vec4(prev > 0.0 ? mix(prev, key, ease) : key, 0.0, 0.0, 1.0);
}`;const GLYPHS=`
uniform sampler2D tCells, tInfo, tMask, tAtlas, tBloom, tExpo; uniform vec2 cellPx, res, cells, atlasN; uniform vec4 famA, famB;
uniform mat3 viewToWorld; uniform mat4 invPV; uniform float groundY, time, glowK, wash, grain; varying vec2 vUv;
vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), f.x), mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), f.x), f.y); }
vec4 cellAt(vec2 ci) { return texture2D(tCells, (ci + 0.5) / cells); }
vec4 infoAt(vec2 ci) { return texture2D(tInfo, (ci + 0.5) / cells); }
float famN(float f) { return f < 0.5 ? famA.x : f < 1.5 ? famA.y : f < 2.5 ? famA.z : f < 3.5 ? famA.w : f < 4.5 ? famB.x : f < 5.5 ? famB.y : f < 6.5 ? famB.z : famB.w; }
float ink(float fam, float k, vec2 inC) { return texture2D(tAtlas, vec2((k + inC.x) / atlasN.x, 1.0 - (fam + 1.0 - inC.y) / atlasN.y)).r; }
void main() {
  vec2 px = gl_FragCoord.xy, ci = floor(px / cellPx), inC = (floor(px - ci * cellPx) + 0.5) / cellPx;
  vec4 C = cellAt(ci), I = infoAt(ci), mk = texture2D(tMask, (ci + 0.5) / cells);
  vec3 c = C.rgb;
  vec2 suv = min((ci + 0.5) * cellPx / res, vec2(1.0));
  // where on the ground the cell looks: what's pinned to the world (the jitter, the grass's lean) doesn't swim as you walk
  vec4 p0 = invPV * vec4(suv * 2.0 - 1.0, -1.0, 1.0), p1 = invPV * vec4(suv * 2.0 - 1.0, 1.0, 1.0); p0 /= p0.w; p1 /= p1.w;
  vec3 wp = mix(p0.xyz, p1.xyz, clamp((groundY - p0.y) / (p1.y - p0.y), 0.0, 1.0));
  float jit = hash12(floor(wp.xz * 7.0) + 17.0);
  // the light, in the eye's terms, against the exposure and against what's round it: a flat lit surface sits at the middle
  // of the ramp and only what stands out from its surroundings gets the dense letters; on a hard curve, so most of the
  // world sits in the dark and lamps make pools
  float expo = texture2D(tExpo, vec2(0.5)).r, l = pow(max(C.a, 0.0), 1.0 / 2.2);
  float wide = 0.0;
  for (int i = 0; i < 8; i++) { float a = float(i) * 0.785398; wide += pow(max(cellAt(ci + floor(vec2(cos(a), sin(a) * 0.5) * 5.0 + 0.5)).a, 0.0), 1.0 / 2.2); }
  wide /= 8.0;
  float light = pow(clamp(l / expo * (0.62 + 0.75 * clamp((l - wide) / max(wide, 0.06), -0.8, 1.2)), 0.0, 1.3), 1.5);
  // edges: across the light, and across the surfaces (their normals, and where something solid ends)
  float tl = cellAt(ci + vec2(-1.0, 1.0)).a, t = cellAt(ci + vec2(0.0, 1.0)).a, tr = cellAt(ci + vec2(1.0, 1.0)).a, lf = cellAt(ci - vec2(1.0, 0.0)).a, rt = cellAt(ci + vec2(1.0, 0.0)).a, bl = cellAt(ci - vec2(1.0, 1.0)).a, b = cellAt(ci - vec2(0.0, 1.0)).a, br = cellAt(ci + vec2(1.0, -1.0)).a;
  float gx = (tr + 2.0 * rt + br) - (tl + 2.0 * lf + bl), gy = (tl + 2.0 * t + tr) - (bl + 2.0 * b + br);
  float lumE = length(vec2(gx, gy)) / max(0.05, C.a + 0.06);
  vec4 Il = infoAt(ci - vec2(1.0, 0.0)), Ir = infoAt(ci + vec2(1.0, 0.0)), Ib = infoAt(ci - vec2(0.0, 1.0)), It = infoAt(ci + vec2(0.0, 1.0));
  float nE = (abs(I.a - Il.a) + abs(I.a - Ir.a) + abs(I.a - Ib.a) + abs(I.a - It.a)) * 0.5 + (length(I.rgb - Il.rgb) * Il.a + length(I.rgb - Ir.rgb) * Ir.a + length(I.rgb - Ib.rgb) * Ib.a + length(I.rgb - It.rgb) * It.a) * I.a * 0.55;
  vec2 ng = vec2(Ir.a - Il.a + (Ir.b - Il.b) + (Ir.r - Il.r), It.a - Ib.a + (It.b - Ib.b) + (It.g - Ib.g));
  vec2 eg = lumE * 0.6 > nE ? vec2(gx, gy) : ng;
  float dir = mod(floor((atan(eg.y, eg.x) + 3.14159265 / 8.0) / (3.14159265 / 4.0)), 4.0);
  // what the cell is
  vec3 nw = normalize(viewToWorld * (I.rgb * 2.0 - 1.0));
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b)), sat = (mx - mn) / max(mx, 1e-4);
  vec3 hue = c / max(mx, 1e-4);
  vec3 bloom = texture2D(tBloom, suv).rgb;
  float glow = dot(bloom, vec3(0.3, 0.5, 0.2));
  float fam = 0.0, bright = 1.0; vec3 tint = hue;
  bool solid = I.a > 0.5;
  // the hero: his form from his own surfaces (his lantern lights him flat from above, so the light alone would give
  // every cell of him the same letter), lit from the upper left so he has a front and a back, and his outline and limbs
  // drawn as strokes
  if (mk.g > 0.5) {
    float shade = clamp(dot(I.rgb * 2.0 - 1.0, normalize(vec3(-0.45, 0.55, 0.7))), 0.0, 1.0);
    light = clamp(0.24 + 0.72 * shade * (0.6 + 0.5 * light), 0.22, 0.95);
    fam = nE > 0.75 ? 4.0 : 3.0; tint = mix(hue, vec3(1.0, 0.93, 0.8), 0.35); bright = 1.25;
  }
  else if (mk.r > 0.5) { fam = 3.0; light = clamp(light, 0.22, 0.9); tint = mix(vec3(dot(hue, vec3(0.333))), hue, 1.3); bright = 1.15; }
  else if ((glow > 0.4 && light > 0.7) || (light > 1.05 && sat > 0.5)) { fam = 5.0; bright = 1.3; }
  else if ((nE > 0.9 && solid && light > 0.03) || (lumE > 2.6 && light > 0.06)) { fam = 4.0; bright = 1.2; }
  else if (solid && nw.y > 0.5 && c.g >= c.r * 0.98 && c.g > c.b * 1.08 && sat > 0.12) fam = 7.0;
  else if (solid && nw.y > 0.7 && c.b > c.r * 1.2 && c.b >= c.g && sat > 0.3) { fam = 6.0; bright = 1.1; }
  else if (solid && nw.y > 0.72) { fam = 1.0; bright = 0.85; }
  else if (solid && nw.y < 0.45) { fam = 2.0; bright = 0.95; }
  float N = famN(fam), k;
  if (fam > 3.5 && fam < 4.5) k = dir;
  else if (fam > 6.5) {
    // growing things: five leans from a flow over the ground, swaying a little, and three weights by the light
    float lean = (vnoise(wp.xz * 0.5) - 0.5) * 2.6 + sin(time * 1.2 + wp.x * 0.6 + wp.z * 0.4) * 0.15;
    k = clamp(floor((lean + 1.3) / 2.6 * 5.0), 0.0, 4.0) * 3.0 + (light < 0.12 ? 0.0 : light < 0.4 ? 1.0 : 2.0);
  }
  else k = clamp(floor(light * (N - 1.0) + (jit - 0.5) * 2.2 + 0.35), 0.0, N - 1.0);
  float shape = light > 0.02 || fam > 2.5 && fam < 3.5 ? ink(fam, k, inC) : 0.0;
  // the colour on a harder curve than the letters, in the eye's terms: the middle goes dim, the bright stays bright
  vec3 fg = toSRGB(clamp(tint, 0.0, 1.0)) * (0.05 + 1.1 * light * light) * bright;
  // a creature or the hero stands out of a little dark round it
  if (mk.r + mk.g < 0.5) { vec2 cs = 1.0 / cells, cu = (ci + 0.5) * cs; vec4 m4 = texture2D(tMask, cu + vec2(cs.x, 0.0)) + texture2D(tMask, cu - vec2(cs.x, 0.0)) + texture2D(tMask, cu + vec2(0.0, cs.y)) + texture2D(tMask, cu - vec2(0.0, cs.y)); if (m4.r + m4.g > 0.5) fg *= 0.2; }
  vec3 col = fg * shape + toSRGB(clamp(c * wash + bloom * glowK, 0.0, 1.0));
  col += (hash12(gl_FragCoord.xy + fract(time) * 1000.0) - 0.5) * grain;
  gl_FragColor = vec4(col, 1.0);
}`;const FAMILIES=[{chars:" .'`,:;-~_^\"!il|/\\()[]{}?+<>=*1rtfjcvxznuJLCYTZXoaeswmpqdbkhUOQ0#MW&8%B@$",sort:true},{chars:" .,:;-~ocaesuvoOQ0DG8@",sort:true},{chars:" .:-=+|[]{}#HNEMW%B@",sort:true},{chars:" .,:;!i+=?xXYVJCOZmwqpdbkhMW&8%B@",sort:true},{chars:"|\\-/",sort:false},{chars:" .`'+*ox*",sort:true},{chars:" .-~=~",sort:true},{chars:".`\\.`(.'|,'),,/",sort:false}];const GLYPH_SIZES={tiny:[4,8],fine:[5,10],medium:[7,14],coarse:[10,20]};function atlasTexture(cw,ch){const N=Math.max(...FAMILIES.map(f=>f.chars.length)),rows=FAMILIES.length;const c=document.createElement("canvas");c.width=cw*N;c.height=ch*rows;const g=c.getContext("2d",{willReadFrequently:true});const fontPx=Math.round(ch*.9),font=w=>`${w} ${fontPx}px Consolas, "DejaVu Sans Mono", Menlo, "Liberation Mono", "Courier New", monospace`;g.font=font(ch<=13?600:400);const sx=Math.min(1,cw/Math.max(1,g.measureText("M").width));const counts=[];FAMILIES.forEach((f,r)=>{const cells=[...f.chars].map(k=>{const t2=document.createElement("canvas");t2.width=cw;t2.height=ch;const q=t2.getContext("2d",{willReadFrequently:true});q.font=g.font;q.fillStyle="#fff";q.textAlign="center";q.textBaseline="middle";q.setTransform(sx,0,0,1,cw/2,ch/2+ch*.04);q.fillText(k,0,0);const d=q.getImageData(0,0,cw,ch).data;let s=0;for(let i=3;i<d.length;i+=4)s+=d[i];return{k,t:t2,ink:s/(255*cw*ch)}});if(f.sort)cells.sort((a,b)=>a.ink-b.ink);cells.forEach((e,i)=>g.drawImage(e.t,i*cw,r*ch));counts.push(cells.length)});const t=new THREE.CanvasTexture(c);t.minFilter=THREE.NearestFilter;t.magFilter=THREE.NearestFilter;t.generateMipmaps=false;return{tex:t,cw,ch,N,rows,counts}}class Post{constructor(renderer,quality="high"){this.r=renderer;this.quality=quality;this.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2));this.scene=new THREE.Scene;this.scene.add(this.quad);this.cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);const rt=(w,h,o={})=>new THREE.WebGLRenderTarget(w,h,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false,...o});this.rt=rt;this.main=null;this.mips=[];this.ups=[];this.u={bloomK:{value:.9},exposure:{value:1.25},saturation:{value:1.05},vignette:{value:.85},aspect:{value:1},grain:{value:.035},time:{value:0},shadowTint:{value:new THREE.Color(.2,.35,.7)},highTint:{value:new THREE.Color(1.05,.95,.8)}};this.mBright=pass(BRIGHT,{tSrc:{value:null},threshold:{value:1},knee:{value:.5}});this.mDown=pass(DOWN,{tSrc:{value:null},texel:{value:new THREE.Vector2}});this.mUp=pass(UP,{tSrc:{value:null},tAdd:{value:null},texel:{value:new THREE.Vector2},addK:{value:1}});this.mComp=pass(COMPOSITE,{tSrc:{value:null},tBloom:{value:null},...this.u});this.mCells=pass(CELLS,{tSrc:{value:null},tBloom:{value:null},cellUV:{value:new THREE.Vector2},...this.u});this.maskMat=new THREE.MeshBasicMaterial({color:16777215});this.normalMat=cutaway(new THREE.MeshNormalMaterial);this.mGlyphs=pass(GLYPHS,{tCells:{value:null},tInfo:{value:null},tMask:{value:null},tAtlas:{value:null},tBloom:{value:null},cellPx:{value:new THREE.Vector2},res:{value:new THREE.Vector2},cells:{value:new THREE.Vector2},atlasN:{value:new THREE.Vector2},famA:{value:new THREE.Vector4},famB:{value:new THREE.Vector4},viewToWorld:{value:new THREE.Matrix3},invPV:{value:new THREE.Matrix4},groundY:{value:0},tExpo:{value:null},wash:{value:.04},glowK:{value:.22},time:this.u.time,grain:this.u.grain});this.mExpo=pass(EXPO,{tCells:{value:null},tPrev:{value:null},ease:{value:.06}});this.expoRT=[0,1].map(()=>new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:false}));this.ascii=false;this.glyph="fine";this.groundY=0}setSize(w,h,dpr){this.w=Math.floor(w*dpr);this.h=Math.floor(h*dpr);this.main?.dispose();this.mips.forEach(m=>m.dispose());this.ups.forEach(m=>m.dispose());this.cellsRT?.dispose();this.maskRT?.dispose();this.infoRT?.dispose();const k=this.ascii?.5:1,sw=Math.max(4,Math.floor(this.w*k)),sh=Math.max(4,Math.floor(this.h*k));this.main=this.rt(sw,sh,{depthBuffer:true,samples:this.quality==="ultra"&&!this.ascii?4:0});this.mips=[];this.ups=[];let mw=sw>>1,mh=sh>>1;for(let i=0;i<6&&mw>4&&mh>4;i++){this.mips.push(this.rt(mw,mh));this.ups.push(this.rt(mw,mh));mw>>=1;mh>>=1}this.u.aspect.value=w/h;const G=GLYPH_SIZES[this.glyph]||GLYPH_SIZES.fine,f=Math.sqrt(Math.max(1,dpr)),cw=Math.round(G[0]*f),ch=Math.round(G[1]*f);this.cellPx=[cw,ch];this.cellsW=Math.ceil(this.w/cw);this.cellsH=Math.ceil(this.h/ch);const near={minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter};this.cellsRT=new THREE.WebGLRenderTarget(this.cellsW,this.cellsH,{type:THREE.HalfFloatType,...near,depthBuffer:false});this.maskRT=new THREE.WebGLRenderTarget(this.cellsW,this.cellsH,{...near,depthBuffer:true});this.infoRT=new THREE.WebGLRenderTarget(this.cellsW,this.cellsH,{...near,depthBuffer:true});if(!this.atlas||this.atlas.cw!==cw||this.atlas.ch!==ch){this.atlas?.tex.dispose();this.atlas=atlasTexture(cw,ch)}const U=this.mGlyphs.uniforms,A=this.atlas;U.tAtlas.value=A.tex;U.atlasN.value.set(A.N,A.rows);U.famA.value.set(...A.counts.slice(0,4));U.famB.value.set(...A.counts.slice(4,8));U.cellPx.value.set(cw,ch);U.res.value.set(this.w,this.h);U.cells.value.set(this.cellsW,this.cellsH);this.mCells.uniforms.cellUV.value.set(cw/this.w,ch/this.h)}blit(mat,target){this.quad.material=mat;this.r.setRenderTarget(target);this.r.render(this.scene,this.cam)}render(scene,camera,time){const r=this.r;this.u.time.value=time;r.setRenderTarget(this.main);r.render(scene,camera);this.mBright.uniforms.tSrc.value=this.main.texture;this.blit(this.mBright,this.mips[0]);for(let i=1;i<this.mips.length;i++){this.mDown.uniforms.tSrc.value=this.mips[i-1].texture;this.mDown.uniforms.texel.value.set(1/this.mips[i-1].width,1/this.mips[i-1].height);this.blit(this.mDown,this.mips[i])}let src=this.mips[this.mips.length-1];for(let i=this.mips.length-2;i>=0;i--){this.mUp.uniforms.tSrc.value=src.texture;this.mUp.uniforms.tAdd.value=this.mips[i].texture;this.mUp.uniforms.texel.value.set(.5/src.width,.5/src.height);this.blit(this.mUp,this.ups[i]);src=this.ups[i]}const bloom=src.texture;if(!this.ascii){this.mComp.uniforms.tSrc.value=this.main.texture;this.mComp.uniforms.tBloom.value=bloom;this.blit(this.mComp,null)}else{this.mCells.uniforms.tSrc.value=this.main.texture;this.mCells.uniforms.tBloom.value=bloom;this.blit(this.mCells,this.cellsRT);this.expoRT.reverse();this.mExpo.uniforms.tCells.value=this.cellsRT.texture;this.mExpo.uniforms.tPrev.value=this.expoRT[1].texture;this.blit(this.mExpo,this.expoRT[0]);const was=scene.overrideMaterial,bg=scene.background,fog=scene.fog,layers=camera.layers.mask;scene.background=null;scene.fog=null;const airy=[];scene.traverseVisible(o=>{const m=o.material;if(o.isPoints||o.isLine||o.isSprite||m&&!Array.isArray(m)&&(m.transparent||m.blending===THREE.AdditiveBlending))airy.push(o)});for(const o of airy)o.visible=false;scene.overrideMaterial=this.normalMat;r.setRenderTarget(this.infoRT);r.setClearColor(0,0);r.clear();r.render(scene,camera);for(const o of airy)o.visible=true;scene.overrideMaterial=this.maskMat;r.setRenderTarget(this.maskRT);r.setClearColor(0,1);r.clear();r.autoClear=false;camera.layers.set(1);this.maskMat.color.setRGB(1,0,0);r.render(scene,camera);r.clearDepth();camera.layers.set(2);this.maskMat.color.setRGB(0,1,0);r.render(scene,camera);r.autoClear=true;camera.layers.mask=layers;scene.overrideMaterial=was;scene.background=bg;scene.fog=fog;const U=this.mGlyphs.uniforms;U.tCells.value=this.cellsRT.texture;U.tBloom.value=bloom;U.tMask.value=this.maskRT.texture;U.tInfo.value=this.infoRT.texture;U.tExpo.value=this.expoRT[0].texture;U.viewToWorld.value.setFromMatrix4(camera.matrixWorld);U.invPV.value.multiplyMatrices(camera.matrixWorld,camera.projectionMatrixInverse);U.groundY.value=this.groundY;this.blit(this.mGlyphs,null)}}setLook(look){const c=new THREE.Color().setHSL(look.ambient.h,Math.min(1,look.ambient.s+.2),.5);this.u.shadowTint.value.copy(c)}}export{Post};

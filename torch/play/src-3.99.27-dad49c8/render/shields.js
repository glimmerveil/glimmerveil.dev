import*as THREE from"three";import{SIDE_LOOK,lookOf}from"./ships.js";import{sees}from"../sim/sensors.js";import{midOf}from"../sim/ship.js";import{PARTS}from"../sim/parts.js";import{Q}from"./quality.js";const NI=8,NB=3;const TYPE={kinetic:0,explosive:1,energy:2,shrapnel:3,emp:4};const HOT={us:16732026,them:16734778};const VS=`
  uniform vec4 uImp[${NI}]; uniform vec4 uImpK[${NI}]; uniform vec4 uBeam[${NB}]; uniform float uR, uHitK, uT, uVH; uniform vec3 uScale;
  varying vec3 vDir, vNw, vW; varying float vUpp;
  void main() {
    vec3 d = normalize(position), p = position;
    // (how much of the world one pixel covers at this shield: High's lattice keeps its cells readable at any zoom)
    vUpp = length(cameraPosition - modelMatrix[3].xyz) * 2.0 / (projectionMatrix[1][1] * max(uVH, 1.0));
    // each hit dents the shell, and a swell runs out from it (a jelly of light, not a pane of glass)
    float dent = 0.0;
    for (int i = 0; i < ${NI}; i++) {
      float age = uImp[i].w; if (age > 2.0) continue;
      float k = uImpK[i].x, ty = uImpK[i].y, heavy = ty == 1.0 ? 1.7 : ty == 6.0 ? 2.0 : ty == 5.0 ? 1.3 : ty == 3.0 ? 0.3 : 1.0;
      float a = acos(clamp(dot(d, uImp[i].xyz), -1.0, 1.0)) * uR / uHitK;
      dent += k * heavy * exp(-a * a / (1.0 + 2.0 * k * heavy)) * cos(age * 26.0) * exp(-age * 6.5);
      float q = a - age * (ty == 1.0 ? 13.0 : 22.0);                 // (never pow() a number that can go negative: GLSL makes it NaN)
      dent -= k * heavy * exp(-q * q / 1.4) * exp(-age * 3.5) * 0.35;
    }
    // a held beam presses in where it burns, the shell trembling round it (pass 3c)
    for (int i = 0; i < ${NB}; i++) {
      float I = uBeam[i].w; if (I <= 0.0) continue;
      float a = acos(clamp(dot(d, uBeam[i].xyz), -1.0, 1.0)) * uR / uHitK;
      dent += I * 0.55 * exp(-a * a / 1.6) * (0.85 + 0.15 * sin(uT * 37.0 + a * 3.0));
    }
    p -= normal * dent * (0.55 * uHitK / uR);
    vDir = d;
    vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz;
    vNw = normalize(mat3(modelMatrix) * (normal / (uScale * uScale)));
    gl_Position = projectionMatrix * viewMatrix * w;
  }`;const FS=`
  #define PI 3.14159265
  uniform vec3 uCol, uHot; uniform float uR, uHy, uArc, uUp, uT, uHeat, uPw, uBuf, uCollapse, uSeed, uCell, uHitK, uFlat; uniform vec3 uLay[8];   // (uLay: a layer's middle as an angle in the dome's own frame, its half width, its best emitter's mark (1-3); half 0 = none)
  uniform vec4 uImp[${NI}], uImpK[${NI}], uBeam[${NB}]; uniform vec3 uBeamC[${NB}]; uniform vec4 uSun; uniform vec3 uSunC;
  varying vec3 vDir, vNw, vW; varying float vUpp;
  #ifdef HI
  const float CF = 0.1, WF = 0.03, HK = 1.6;       // (High: a struck cell lights whole, not only its edges, and the flash runs brighter against a lattice that is lit)
  #else
  const float CF = 0.06, WF = 0.0, HK = 1.5;
  #endif
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  // a hex lattice: x = how far inside its cell (0 at the edge), yz = the cell
  vec3 hex(vec2 p) {
    const vec2 s = vec2(1.0, 1.7320508);
    vec4 hC = floor(vec4(p, p - vec2(0.5, 1.0)) / s.xyxy) + 0.5;
    vec4 h = vec4(p - hC.xy * s, p - (hC.zw + 0.5) * s);
    vec4 c = dot(h.xy, h.xy) < dot(h.zw, h.zw) ? vec4(h.xy, hC.xy) : vec4(h.zw, hC.zw + 0.5);
    vec2 a = abs(c.xy); return vec3(0.5 - max(dot(a, s * 0.5), a.x), c.zw);
  }
  void main() {
    vec3 d = normalize(vDir);
    float az = atan(d.x, -d.z);                                   // 0 = the way the shield faces
    float el = asin(clamp(d.y, 0.0, 1.0)) / (PI * 0.5);           // 0 at the base ring, 1 at the top
    bool bubble = uArc > 6.2;
    float up = max(uUp, uCollapse > 0.0 ? 1.0 : 0.0);
    float half_ = uArc * 0.5 * (bubble ? 1.0 : up);
    // THE LAYERS (3.50): how many layers cover this pixel (lays), how far inside the nearest edge of their cover it is (sd), and
    // how near it is to the end of any layer (ends): each layer where its emitter faces
    bool layered = uLay[0].y > 0.0; float lays = 0.0, sd = -9.0, endD = 9.0, mk = 0.0;
    if (layered) for (int i = 0; i < 8; i++) { float lh = uLay[i].y; if (lh <= 0.0) continue;
      float da = abs(mod(az - uLay[i].x + PI, 2.0 * PI) - PI), hh = lh > 3.1 ? 9.0 : lh * (bubble ? 1.0 : up);
      lays += lh > 3.1 ? 1.0 : smoothstep(hh + 0.012, hh - 0.05, da); sd = max(sd, hh - da); if (lh <= 3.1) endD = min(endD, abs(da - hh)); if (lh > 3.1 || da < hh) mk = max(mk, uLay[i].z); }
    float wall = layered ? smoothstep(-0.012, 0.05, sd) : smoothstep(half_ + 0.012, half_ - 0.05, abs(az));
    float mask = bubble ? smoothstep(up * 1.12, up * 1.12 - 0.07, el) : wall * smoothstep(0.66, 0.28, el);
    if (mask < 0.003) discard;
  #ifdef HI
    // HIGH (shields bright and always visible, the grid everywhere the shield is): ONE lattice
    // over the whole shell, laid out from the crown (equal-area: every cell the same size on the glass, drawing together
    // toward the rim as a dome's do seen from above), with no seam in it. And it keeps its cells readable at any zoom: as
    // the camera pulls back the lattice steps up to cells twice the size, and again, never fewer than a handful across.
    float wt = 1.0, th0 = acos(clamp(d.y, 0.0, 1.0)), cs = uCell * 0.72;   // (cells a little bigger than a deck tile: the ship reads through them)
    vec2 mp = d.xz / max(1e-5, length(d.xz)) * mix(1.41421356 * sin(th0 * 0.5), sin(th0), uFlat) * uR * cs;
    float lod = clamp(log2(max(1.0, 12.0 * vUpp * cs)), 0.0, max(0.0, floor(log2(uR * cs / 3.2))));
    float l0 = floor(lod), lf = smoothstep(0.72, 1.0, lod - l0), s0 = exp2(-l0), s1 = s0 * 0.5;
    vec3 hA = hex(mp * s0), hB = hex(mp * s1);
    float fpx = 0.7 * length(fwidth(mp)), fA = max(fpx * s0, 0.004), fB = max(fpx * s1, 0.004);   // (lattice units under one pixel: a line stays a line, never a shimmer)
    float wA = clamp(0.95 * fA, 0.012, 0.045), wB = clamp(0.95 * fB, 0.012, 0.045);             // (a line is a pixel or two wide at any zoom, never a fat bar close up)
    float lA = mix(1.0 - smoothstep(wA - fA, wA + fA, hA.x), 0.17, smoothstep(0.12, 0.4, fA));
    float lB = mix(1.0 - smoothstep(wB - fB, wB + fB, hB.x), 0.17, smoothstep(0.12, 0.4, fB));
    float gl = mix(smoothstep(0.17, 0.0, hA.x), smoothstep(0.17, 0.0, hB.x), lf);               // (and the glass glows a little beside each line)
    vec3 hx = lf < 0.5 ? hA : hB; float sc = lf < 0.5 ? s0 : s1;   // (the cells a hit lights: the lattice that leads)
    float edge = hx.x, cr = h21(hx.yz + uSeed + sc * 7.0);
    float line = mix(lA, lB, lf), inner = mix(smoothstep(0.0, 0.25, hA.x), smoothstep(0.0, 0.25, hB.x), lf);
    vec2 mc = hx.yz * vec2(1.0, 1.7320508) / (uR * cs * sc); float rc = min(length(mc), 1.0), thc = uFlat > 0.5 ? asin(rc) : 2.0 * asin(rc * 0.70710678);
    vec2 mcn = mc / max(1e-5, length(mc));
    vec3 dc = vec3(mcn.x * sin(thc), cos(thc), mcn.y * sin(thc));  // (the middle of this pixel's cell, as a direction on the dome)
  #else
    // the cells: on the walls laid out by angle and height, on the top by plan
    float wt = max(step(0.62, el), uFlat);                       // (a flat dome, a station's field, is all one plan lattice)
    vec3 hx = wt < 0.5 ? hex(vec2(az * uR, el * uHy * 1.7) * uCell) : hex(d.xz * uR * uCell);
    float edge = hx.x, cr = h21(hx.yz + wt * 17.0 + uSeed);
    // the middle of this pixel's cell, as a direction on the dome: a hit lights whole cells, never a smear across them
    vec2 pc = hx.yz * vec2(1.0, 1.7320508);
    vec3 dc;
    if (wt < 0.5) { float azc = pc.x / (uR * uCell), elc = clamp(pc.y / (uHy * 1.7 * uCell), 0.0, 1.0) * PI * 0.5; dc = vec3(sin(azc) * cos(elc), sin(elc), -cos(azc) * cos(elc)); }
    else { vec2 xz = pc / (uR * uCell); dc = vec3(xz.x, sqrt(max(0.0, 1.0 - dot(xz, xz))), xz.y); }
    float line = smoothstep(0.06, 0.0, edge) * max(uFlat, smoothstep(0.0, 0.05, abs(el - 0.62))), inner = smoothstep(0.0, 0.25, edge);   // (the two lattices meet at a soft seam)
  #endif
    // the glass: bright at its edges, clear where you look straight through it; the far wall dimmer
    vec3 V = normalize(cameraPosition - vW), N = normalize(vNw);
    float fres = pow(max(0.0, 1.0 - abs(dot(N, V))), 2.3);
    float back = gl_FrontFacing ? 1.0 : 0.5;
    // HEAT: toward white, then the warning colour; it boils
    vec3 col = mix(uCol, vec3(1.0), smoothstep(0.35, 0.75, uHeat) * 0.42);
    col = mix(col, uHot, smoothstep(0.72, 1.0, uHeat));
    float hot = smoothstep(0.5, 1.0, uHeat);
    float boil = hot * pow(max(0.0, 0.5 + 0.5 * sin(uT * (7.0 + 9.0 * hot) + cr * 40.0 + el * 14.0)), 3.0);
    // which cells are lit: raising/lowering brings them in and out one by one; starved of power, they stutter
    float tick = floor(uT * 13.0);
    // RAISING (pass 3): a bright front climbs from the base ring (a bubble) or opens out from the middle (an arc), and the cells
    // crystallise in a ragged band just behind it, glowing as they form; lowering runs it back (the front sinks, cells go out)
    float raising = 1.0 - step(0.999, up);
    float behind = bubble ? up * 1.12 - 0.035 - el : ((layered ? sd : half_ - abs(az)) - 0.03) * 0.55;
    float present = raising > 0.5 ? step(cr * 0.16, behind) : 1.0;
    float front = raising * exp(-behind * behind / 0.0011);
    float forming = raising * present * exp(-max(behind, 0.0) / 0.09);
    float starved = uPw < 0.999 ? step(h21(hx.yz + tick * 0.37 + uSeed), 0.3 + 0.7 * uPw) * (0.55 + 0.45 * h21(vec2(tick, uSeed))) : 1.0;
  #ifdef HI
    // High: the glass gathers its light toward the ring it stands on, the same from wherever you look (one edge), and the
    // lattice is lit over the whole shell, brightest toward that ring; here and there a cell glints, slowly, on its own
    float rimG = exp(-el * el * 9.0);
    float a = (0.02 + rimG * rimG * 0.34) * (0.9 + 0.1 * sin(uT * 2.6 + el * 5.0 + az));
    // (A STATION'S FIELD, seen 11-11 on a new campaign's first screen: you start in port, under a dome 650 across, and even a
    // faint lattice over all of it papered the whole view with honeycomb. A flat dome's lattice stands in a band at its rim,
    // about the outer tenth of it, and inside that the glass is clear but for a cell glinting here and there and the cells a
    // hit lights. A ship's own shield keeps its grid everywhere, his note 39.)
    float see = max(mix(0.42, 0.0, uFlat), mix(rimG, rimG * rimG * rimG, uFlat));
    float tw = pow(0.5 + 0.5 * sin(uT * (0.5 + cr * 1.1) + cr * 43.0), 8.0);
    // (a flat dome, seen with its field truly up, 11-11: a fifth of its cells glinting at any moment speckled the whole port;
    // thinned to a few, they were lone hexagons adrift beside the station, a thing to wonder at ("mystery ... needs explaining
    // or removing"). A flat dome's cells glint in its rim band, where its lattice is; inside it is clear until it is struck.)
    tw *= mix(1.0, min(1.0, see * 3.0), uFlat);
    // (a station's field is hundreds across and you fly inside it: its lattice is there over the whole dome but faint, bright
    // only toward its rim, or the whole screen is a honeycomb whenever you are in port; seen 11-11 with a station in view)
    a += line * (mix(0.14, 0.003, uFlat) + 0.36 * see + 0.3 * tw * mix(1.0, 0.3, uFlat)) * (1.0 + uBuf * 2.2 * (0.55 + 0.45 * sin(uT * 7.0 - el * 9.0 + cr * 3.0))) + inner * tw * 0.03 + gl * 0.075 * see;
  #else
    float a = (0.012 + fres * fres * 0.5) * (0.9 + 0.1 * sin(uT * 2.6 + el * 5.0 + az));
    float see = fres * sqrt(fres);                                 // (the cells show where the glass turns away; over the ship it's clear)
    a += line * (0.008 + 0.34 * see) * (1.0 + uBuf * 2.2 * (0.55 + 0.45 * sin(uT * 7.0 - el * 9.0 + cr * 3.0)));
  #endif
    if (layered) {                                                 // (one layer more over this pixel: its lattice brighter, its glass thicker; and a line at every layer's end)
      // (seen from above a dome's wall is a thin band at its rim: on a dome the wedge and its lines run up to near the crown)
      float e1 = bubble ? smoothstep(up * 1.12, up * 1.12 - 0.07, el) * smoothstep(0.97, 0.72, el) * up : 1.0;
      a += max(0.0, lays - 1.0) * (line * 0.8 + 0.07) * e1;
      if (bubble) { float q1 = endD * uR * cos(el * 1.5708) / (0.2 * uHitK); a += exp(-q1 * q1) * 0.85 * e1; }
    }
    a += (line * 0.5 + inner * 0.04) * boil * (0.3 + fres);
    float baseLine = exp(-el * el * 700.0) * (0.75 + 0.5 * uFlat) + exp(-el * el * 60.0) * 0.1 * (1.0 - 0.6 * uFlat);   // (a flat field: a hard bright rim, a faint body)
    // A RING FOR EVERY MARK (levels L1: each time a station upgrades it gets a new shield ring): over the base
    // ring, a hoop a third of the way up for Mk 2 and another three fifths up for Mk 3, where a layer of that mark covers
    float rings = 0.0; if (layered && mk > 1.5) { float e2 = bubble ? up : 1.0, h2 = el - 0.34 * e2, h3 = el - 0.62 * e2;   // (a third and three fifths up: from above, rings well inside the rim's glare (a quarter up merged with it), each apart)
      rings = exp(-h2 * h2 * 900.0) + exp(-h2 * h2 * 120.0) * 0.12 + (mk > 2.5 ? exp(-h3 * h3 * 900.0) + exp(-h3 * h3 * 120.0) * 0.12 : 0.0); }
    float pq = (layered ? endD : abs(az) - half_) * uR / (0.2 * uHitK);
    float pins = bubble ? 0.0 : exp(-pq * pq) * 0.9 * smoothstep(0.66, 0.2, el);
    vec3 c = col * (a + baseLine * (1.0 + raising * 1.6) + pins);
  #ifdef HI
    c += mix(col, vec3(1.0), 0.5) * rings * 1.25;                   // (the mark rings: their own light, whiter than the glass)
  #else
    c += mix(col, vec3(1.0), 0.3) * rings * 0.45;                   // (below High: no lattice and no bloom to hold them, and over white is a blank band)
  #endif
    c += mix(col, vec3(1.0), 0.45) * (front * (0.9 + line * 1.4) + forming * (line * 1.1 + inner * 0.07));   // (the front, and the cells as they form)
    // HITS, by what struck (summed apart and soft-clipped, so a storm of hits stays a storm of hits, not a white smear)
    vec3 hc = vec3(0.0);
    for (int i = 0; i < NLOOP; i++) {
      float age = uImp[i].w; if (age > 3.0) continue;
      float k = uImpK[i].x, ty = uImpK[i].y;
      float dist = acos(clamp(dot(d, uImp[i].xyz), -1.0, 1.0)) * uR / uHitK;
      float ex = (ty == 1.0 || ty == 5.0 || ty == 6.0) ? 1.0 : 0.0, sh = ty == 3.0 ? 1.0 : 0.0, en = ty == 2.0 ? 1.0 : 0.0, emp = ty == 4.0 ? 1.0 : 0.0, inc = ty == 5.0 ? 1.0 : 0.0, atm = ty == 6.0 ? 1.0 : 0.0;
      float fw = mix(mix(0.45, 1.8, ex), 0.3, sh);
      vec3 fc = mix(mix(mix(vec3(1.0, 0.97, 0.9), vec3(1.0, 0.55, 0.18), ex), mix(col, vec3(1.0), 0.55), en), vec3(0.75, 0.85, 1.0), emp);
      fc = mix(mix(fc, vec3(1.0, 0.34, 0.08), inc), vec3(0.62, 1.0, 0.48), atm);   // (incendiary burns red-orange; atomic flashes green-white)
      float flash = k * exp(-dist * dist / (fw * (0.3 + 0.7 * k))) * exp(-age * mix(mix(11.0, 5.0, ex), 2.2, inc)) * mix(1.5, 1.15, ex) * (1.0 + 0.4 * atm);
      float sp = mix(26.0, 13.0, ex);
      float rq = (dist - age * sp) / (0.3 + age * mix(1.2, 2.6, ex));
      float ring = k * exp(-rq * rq) * exp(-age * mix(2.4, 1.6, ex));
      // the cells round a hit: kinetic cracks them white in a tight star; the rest light a softer field
      float reach = mix(0.7 + 1.1 * k, 1.3 + 1.8 * k, ex);
      // WHOLE CELLS (pass 2): the wave lights each cell as it passes its middle; the cells round the hit hold it and shed it,
      // flickering, nearest last; nothing lights out of turn far from the hit
      float cdist = acos(clamp(dot(dc, uImp[i].xyz), -1.0, 1.0)) * uR / uHitK;
      float cw = (cdist - age * sp * 0.92) / (0.5 + age * mix(0.9, 2.0, ex));
      float wave = k * exp(-cw * cw) * exp(-age * mix(2.6, 1.7, ex)) * exp(-cdist / (reach * 4.0)) * (0.75 + 0.25 * h21(hx.yz + float(i)));   // (fading as it goes: a storm of hits never veils the deck)
      float hold = exp(-cdist / reach) * exp(-age * mix(3.4, 2.1, ex));
      float cells = k * step(cr * 0.85, hold * 1.25) * smoothstep(0.03, 0.09, hold) * (0.55 + 0.45 * h21(hx.yz + floor(uT * 26.0) + float(i)));   // (a floor: never a stray cell lit across the dome, as pass 1 had)
      // RAYS: thin bright lines cracking out across the glass from where a round struck (kinetic; faint for an explosion, which
      // blooms and pushes a wave instead, and for energy, which splashes), a few, turned at random
      vec3 n0 = uImp[i].xyz, t1 = normalize(cross(abs(n0.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), n0)), t2 = cross(n0, t1);
      float th = atan(dot(d, t2), dot(d, t1));
      float rays = (1.0 - sh) * (1.0 - emp) * mix(1.0, 0.3, max(ex, en)) * k * pow(abs(cos(th * mix(2.5, 1.5, ex) + uImpK[i].z)), mix(46.0, 22.0, ex)) * exp(-dist / (0.5 + 1.3 * k)) * exp(-age * mix(10.0, 6.0, ex)) * smoothstep(0.0, 0.25, dist);
      float shiver = k * exp(-age * 7.0) * 0.05 * (0.3 + fres);   // (the whole shell answers a hit, faintly)
      float crack = (1.0 - ex) * (1.0 - sh) * k * line * exp(-dist / (0.8 + k)) * exp(-age * 4.0) * 3.0;
      float glint = sh * step(0.93, h21(hx.yz + floor(age * 30.0))) * exp(-dist * 0.6) * exp(-age * 5.0) * 3.0;
      float arcs = emp * line * step(0.6, h21(hx.yz + floor(uT * 20.0))) * exp(-dist / 3.0) * exp(-age * 1.5) * 2.5;
      vec3 rc = mix(col, fc, 0.7 * (inc + atm));                   // (an incendiary or atomic hit tints its own wave)
      hc += fc * (flash + crack * 0.45 + glint + rays * 1.3) + rc * (ring * (0.1 + line * 0.75) + (cells * (0.05 + line * 0.6 + inner * CF) + wave * (line * 0.7 + inner * WF)) * (0.45 + 0.55 * see) + shiver) + vec3(0.7, 0.85, 1.0) * arcs;
    }
    c += hc * HK / (1.0 + max(hc.r, max(hc.g, hc.b)));
    // BEAMS held on it: a burning spot that crawls, the cells round it buzzing
    for (int i = 0; i < ${NB}; i++) {
      float I = uBeam[i].w; if (I <= 0.0) continue;
      float dist = acos(clamp(dot(d, uBeam[i].xyz), -1.0, 1.0)) * uR;
      float n = 0.55 + 0.45 * sin(uT * 47.0 + dist * 8.0 + cr * 6.0);
      float buzz = step(cr, 0.55 + 0.45 * sin(uT * 31.0 + cr * 23.0)) * exp(-dist * 1.1);
      float ripple = pow(max(0.0, 0.5 + 0.5 * sin(dist * 5.0 - uT * 22.0)), 4.0) * exp(-dist * 0.8);
      vec3 b0 = uBeam[i].xyz, e1 = normalize(cross(abs(b0.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), b0)), e2 = cross(b0, e1);
      float th = atan(dot(d, e2), dot(d, e1));
      float swirl = pow(max(0.0, sin(th * 3.0 + uT * 9.0 - dist * 2.2)), 6.0) * exp(-dist * 0.75) * smoothstep(0.1, 0.6, dist);   // (the energy it can't pass, wheeling off round it)
      float halo = exp(-dist * dist * 0.45) * (0.85 + 0.15 * sin(uT * 23.0));
      float held = clamp(I - 1.0, 0.0, 1.0);                       // (held longer: the burn grows and goes whiter)
      c += I * (mix(uBeamC[i], vec3(1.0), 0.45 + 0.3 * held) * exp(-dist * dist * mix(4.0, 2.2, held)) * 1.7 * n + uBeamC[i] * (line * buzz * 0.75 + ripple * 0.22 + swirl * (0.35 + 0.35 * line) + halo * 0.12));
    }
    // THE SUN on it (3.28: inside a star's burn zone). The side of the shell that faces the star flares in the star's own
    // colour, its lattice burning white there and each cell flickering by itself; the deeper she is, the more of the shell
    if (uSun.w > 0.0) { float f = max(dot(d, uSun.xyz), 0.0), fl = 0.7 + 0.3 * sin(uT * 9.0 + cr * 17.0);
      float sg = pow(f, mix(3.0, 1.1, uSun.w)) * (0.3 + 0.7 * uSun.w);
      c += mix(uSunC, vec3(1.0, 0.82, 0.5), 0.5) * sg * (0.5 + line * 1.7 * fl + inner * 0.3 * fl); }   // (seen 11-11 at 0.2 / 0.95 / 0.06: too faint to read as the sun on her)
    float alive = present * starved;
    // OVERLOAD: every cell flares, then they fall away one by one
    // OVERLOAD (pass 3b): it breaks from where it was last struck, the break running round the shell with cells falling in a
    // ragged front, their edges cracking white-hot just before they go; what's left still flares
    if (uCollapse > 0.0) {
      float cd0 = acos(clamp(dot(dc, uImp[0].xyz), -1.0, 1.0)) / PI;
      float gone = (1.0 - uCollapse) * 1.4, fall = cd0 * 0.85 + cr * 0.4, fq = (fall - gone) / 0.07;
      alive = step(gone, fall);
      float brk = exp(-fq * fq);
      c += mix(col, vec3(1.0), 0.55) * (line * (1.1 + 3.0 * brk) + 0.1 + inner * brk * 0.5) * (0.45 + 0.55 * uCollapse) * (0.65 + 0.35 * sin(uT * 60.0 + cr * 30.0));
    }
    c *= mask * alive * back;
    // (11-16, the art list's 18 for a shield: zoomed in to the crew the camera stands a few steps from the shell and looks
    // THROUGH it: a ship's lattice ran across every close view of her decks, and a station's flat field, a few steps over
    // its port, washed the port milky. The shell fades where it is within a few steps of the eye, and only there: from play
    // zoom outward every part of it is further off than that and nothing changes, "bright and always visible".)
    c *= smoothstep(4.0, 13.0, distance(cameraPosition, vW));
    gl_FragColor = vec4(c, 1.0);
  }`;const MARKS=new WeakMap;function layerMarks(s){let m=s.stats&&MARKS.get(s.stats);if(m)return m;m={};for(const t of s.tiles||[]){if(!t||!t.alive)continue;const p=PARTS[t.part];if(!p||!p.shield)continue;const deg=p.sarc||180,k=deg*4+(deg>=360?0:(t.rot||0)&3);m[k]=Math.max(m[k]||1,p.mark||1)}if(s.stats)MARKS.set(s.stats,m);return m}function createShields(scene,sparks){const geo=new THREE.SphereGeometry(1,72,18,0,Math.PI*2,0,Math.PI/2);const S=new Map;const tmp=new THREE.Vector3,c=new THREE.Color,vp=new THREE.Vector4;function stateOf(s,key=s.id){let o=S.get(key);if(o)return o;const L=lookOf(s.side);const u={uCol:{value:new THREE.Color(L.shield)},uHot:{value:new THREE.Color(HOT[s.side]??HOT.them)},uR:{value:1},uHy:{value:1},uScale:{value:new THREE.Vector3(1,1,1)},uArc:{value:1},uUp:{value:0},uT:{value:0},uHeat:{value:0},uPw:{value:1},uBuf:{value:0},uCollapse:{value:0},uSeed:{value:s.id*.6180339%1*50},uCell:{value:1.25},uHitK:{value:1},uFlat:{value:0},uLay:{value:Array.from({length:8},()=>new THREE.Vector3)},uVH:{value:900},uImp:{value:Array.from({length:NI},()=>new THREE.Vector4(0,1,0,9))},uImpK:{value:Array.from({length:NI},()=>new THREE.Vector4)},uBeam:{value:Array.from({length:NB},()=>new THREE.Vector4)},uBeamC:{value:Array.from({length:NB},()=>new THREE.Color)},uSun:{value:new THREE.Vector4(0,1,0,0)},uSunC:{value:new THREE.Color(16769712)}};const mesh=new THREE.Mesh(geo,new THREE.ShaderMaterial({uniforms:u,vertexShader:VS,fragmentShader:FS,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,side:Q.low?THREE.FrontSide:THREE.DoubleSide,defines:Q.high?{NLOOP:NI,HI:1}:{NLOOP:Q.low?4:NI},extensions:{derivatives:true}}));mesh.frustumCulled=false;mesh.renderOrder=4;scene.add(mesh);mesh.onBeforeRender=r=>{u.uVH.value=r.getCurrentViewport(vp).w};o={mesh,u,imps:[],collapse:0,side:s.side,lv:Q.level};S.set(key,o);return o}function retier(s,key,o){scene.remove(o.mesh);o.mesh.material.dispose();S.delete(key);const n=stateOf(s,key);n.imps=o.imps;n.collapse=o.collapse;n.up=o.up;n.hold=o.hold;return n}const dGeo=new THREE.IcosahedronGeometry(1,2),dCap=300;const drones=new THREE.InstancedMesh(dGeo,new THREE.ShaderMaterial({vertexShader:"varying vec3 vN, vW; varying vec3 vC; void main() { vC = instanceColor; vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix * instanceMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }",fragmentShader:"varying vec3 vN, vW; varying vec3 vC; void main() { vec3 V = normalize(cameraPosition - vW); float f = pow(max(0.0, 1.0 - abs(dot(normalize(vN), V))), 2.0); gl_FragColor = vec4(vC * (0.04 + f * 0.9), 1.0); }",transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}),dCap);drones.count=0;drones.frustumCulled=false;drones.renderOrder=4;drones.setColorAt(0,new THREE.Color);scene.add(drones);const dm=new THREE.Matrix4,dq=new THREE.Quaternion,dp=new THREE.Vector3,ds=new THREE.Vector3;function droneShields(world){let n=0;for(const f of world.fighters||[]){if(n>=dCap||!(f.sh>0))continue;const L=lookOf(f.side),hit=Math.max(0,1-(world.t-(f.hitAt??-9))/.35),hold=Math.min(1,f.sh/90);dp.set(f.x,.95,-f.y);ds.set(1.25,.9,1.25);dm.compose(dp,dq,ds);drones.setMatrixAt(n,dm);c.setHex(L.shield).multiplyScalar(.35+.65*hold+2.2*hit);drones.setColorAt(n++,c)}drones.count=n;drones.instanceMatrix.needsUpdate=true;if(drones.instanceColor)drones.instanceColor.needsUpdate=true}const sizeOf=s=>{const R=s.radius+.5;return[R,Math.max(1.4,Math.min(7,R*.42))]};function domeDir(s,x,y,lift=.28,th=s.shieldDir){const dx=x-s.x,wz=-(y-s.y),cs=Math.cos(th),sn=Math.sin(th);let lx=dx*cs-wz*sn,lz=dx*sn+wz*cs;const h=Math.hypot(lx,lz)||1;lx/=h;lz/=h;const k=Math.sqrt(1-lift*lift);return tmp.set(lx*k,lift,lz*k)}return{hit(world,e,t){const s=world.ships.find(o2=>o2.id===e.id);if(!s||!s.stats?.shieldN)return;if(e.ammo==="beam")return;const type=e.ammo==="emp"?4:e.ammo==="inc"?5:e.ammo==="atom"?6:TYPE[e.type]??0;if(e.amt<.04&&type!==3)return;const o=stateOf(s),amt=Math.min(1.3,.35+e.amt*1.1);o.imps.unshift({dir:domeDir(s,e.x,e.y,.18+Math.random()*.22).clone(),t0:t,amt:type===4?Math.min(1.4,amt*1.35):amt,type,turn:Math.random()*6.283});if(o.imps.length>NI)o.imps.length=NI;const L=lookOf(s.side);c.setHex(L.shield);const nx=e.x-s.x,ny=e.y-s.y,nh=Math.hypot(nx,ny)||1,tx=-ny/nh,ty=nx/nh,ox=nx/nh,oy=ny/nh;if(type===5){for(let i=0;i<9;i++){const a=Math.atan2(oy,ox)+(Math.random()-.5)*1.8,sp=2+Math.random()*5;sparks.add({x:e.x,z:-e.y,y:1.2,vx:Math.cos(a)*sp,vz:-Math.sin(a)*sp,life:.8+Math.random()*.6,max:1.4,s0:.9,s1:.2,r:2.2,g:.7,b:.15,drag:2})}}else if(type===6){sparks.add({x:e.x,z:-e.y,y:1.2,life:.25,max:.25,s0:3+3*amt,s1:8,r:1.8,g:2.6,b:1.6});for(let i=0;i<14;i++){const a=i/14*6.28,sp=9;sparks.add({x:e.x,z:-e.y,y:1.2,vx:Math.cos(a)*sp,vz:Math.sin(a)*sp,life:.35,max:.35,s0:.6,s1:.1,r:.6,g:2,b:.5,drag:2})}}else if(type===1){sparks.add({x:e.x,z:-e.y,y:1.2,life:.32,max:.32,s0:2.5+3*amt,s1:6+4*amt,r:2.2,g:1.1,b:.35});for(let i=0;i<12;i++){const a=Math.atan2(oy,ox)+(Math.random()-.5)*2.4,sp=6+Math.random()*12;sparks.add({x:e.x,z:-e.y,y:1.2,vx:Math.cos(a)*sp,vz:-Math.sin(a)*sp,life:.5+Math.random()*.4,max:.9,s0:.7,s1:.1,r:2.2,g:.9+Math.random()*.4,b:.25,drag:2.5})}}else if(type===3){for(let i=0;i<4;i++)sparks.add({x:e.x+(Math.random()-.5),z:-e.y+(Math.random()-.5),y:1.2,life:.1,max:.1,s0:.5,s1:.1,r:2,g:2,b:2})}else{sparks.add({x:e.x,z:-e.y,y:1.3,life:.12,max:.12,s0:1.4+2.2*amt,s1:.4,r:2.6,g:2.6,b:2.6});const n=5+Math.round(8*amt);for(let i=0;i<n;i++){const side=Math.random()<.5?1:-1,sp=10+Math.random()*18,k=Math.random()*.5;const vx=(tx*side+ox*k)*sp,vy=(ty*side+oy*k)*sp;sparks.add({x:e.x,z:-e.y,y:1.2,vx,vz:-vy,life:.18+Math.random()*.2,max:.4,s0:.45,s1:.05,r:c.r*1.2+1,g:c.g*1.2+1,b:c.b*1.2+1,drag:3})}if(type===4)for(let i=0;i<10;i++){const a=Math.random()*6.28,r=Math.random()*2.5;sparks.add({x:e.x+Math.cos(a)*r,z:-e.y-Math.sin(a)*r,y:1.3,life:.35,max:.35,s0:.8,s1:.1,r:1.4,g:1.8,b:2.6})}}},fieldHit(world,e,t){const s=world.ships.find(o2=>o2.id===e.id);if(!s?.stats?.field)return;const o=stateOf(s,"f"+s.id),amt=Math.min(1.4,.5+e.amt*1.2);o.imps.unshift({dir:domeDir(s,e.x,e.y,.08,0).clone(),t0:t,amt,type:e.ammo==="emp"?4:TYPE[e.type]??0});if(o.imps.length>NI)o.imps.length=NI;const L=lookOf(s.side);c.setHex(L.shield);sparks.add({x:e.x,z:-e.y,y:2,life:.18,max:.18,s0:2+3*amt,s1:1,r:c.r*1.5+1,g:c.g*1.5+1,b:c.b*1.5+1})},fieldDown(world,e,t){const s=world.ships.find(o2=>o2.id===e.id);if(!s?.stats?.field)return;const o=stateOf(s,"f"+s.id);o.collapse=1;const L=lookOf(s.side);c.setHex(L.shield);const R=e.r||s.stats.field.r;for(let i=0;i<160;i++){const a=Math.random()*6.283,sp=6+Math.random()*14;sparks.add({x:s.x+Math.cos(a)*R,z:-(s.y+Math.sin(a)*R),y:2+Math.random()*6,vx:Math.cos(a)*sp,vz:-Math.sin(a)*sp,life:.8+Math.random()*.8,max:1.6,s0:1.2+Math.random(),s1:.1,r:c.r*1.8,g:c.g*1.8,b:c.b*1.8,drag:1.2})}},overload(world,e,t){const s=world.ships.find(o2=>o2.id===e.id);if(!s||!s.stats?.shieldN)return;const o=stateOf(s);o.collapse=1;const L=lookOf(s.side);c.setHex(L.shield);const[R]=sizeOf(s),arc=s.stats.shieldArc,n=Math.round(30+20*arc/6.28);sparks.add({x:s.x,z:-s.y,y:1,life:.35,max:.35,s0:R*1.2,s1:R*3,r:c.r*1.6+.4,g:c.g*1.6+.4,b:c.b*1.6+.4});for(let i=0;i<n;i++){const a=s.shieldDir+Math.PI/2+(Math.random()-.5)*Math.min(arc,6.28),x=s.x+Math.cos(a)*R,y=s.y+Math.sin(a)*R,sp=4+Math.random()*10;sparks.add({x,z:-y,y:1+Math.random()*2,vx:Math.cos(a)*sp,vz:-Math.sin(a)*sp,life:.5+Math.random()*.7,max:1.2,s0:.5+Math.random()*.5,s1:.05,r:c.r*1.8,g:c.g*1.8,b:c.b*1.8,drag:1.6,spin:(Math.random()-.5)*10})}},update(world,dt,t){droneShields(world);const held=new Map;for(const b of world.beams){if(!b.hit)continue;for(const s of world.ships){if(!s.shieldOn||s.shieldUp<.98||!s.stats?.shieldN||s.id===b.owner)continue;const R=s.radius+.5,dd=Math.hypot(b.ex-s.x,b.ey-s.y);if(Math.abs(dd-R)>.9)continue;const list=held.get(s.id)||[];if(list.length<NB)list.push(b);held.set(s.id,list);break}}const seen=new Set;for(const s of world.ships){if(!s.stats?.shieldN||s.debris)continue;let o=S.get(s.id);if(o&&o.lv!==Q.level)o=retier(s,s.id,o);if(!o&&s.shieldUp>.01)o=stateOf(s);if(!o)continue;seen.add(s.id);o.collapse=Math.max(0,o.collapse-dt/.7);if(o.collapse>.12&&!s.wreck)shardsOff(s,o.collapse);const vis=!s.wreck&&(s.shieldUp>.01||o.collapse>0)&&(!world.view||sees(world,world.view,s));o.mesh.visible=vis;if(!s.wreck&&(s.overload>0||s.venting)&&(!world.view||sees(world,world.view,s)))heatOff(s,dt);if(!vis)continue;const[R,Hy]=sizeOf(s),u=o.u;o.mesh.position.set(s.x,.22,-s.y);o.mesh.rotation.y=s.shieldDir;o.mesh.scale.set(R,Hy,R);u.uR.value=R;u.uHy.value=Hy;u.uScale.value.set(R,Hy,R);u.uArc.value=s.stats.shieldArc;u.uUp.value=s.shieldUp;u.uT.value=t;{const SL=s.stats.shieldLayers,on=!!(SL&&SL.length&&SL[0].face!==void 0);let MK=null;for(let i=0;i<8;i++){const Ly=on?SL[i]:null;if(Ly){let az=(s.shieldDir-s.a-Ly.face)%(2*Math.PI);if(az>Math.PI)az-=2*Math.PI;else if(az<-Math.PI)az+=2*Math.PI;u.uLay.value[i].set(az,Ly.deg>=360?3.2:Ly.half,(MK??=layerMarks(s))[Ly.deg*4+(Ly.deg>=360?0:Ly.rot)]||1)}else u.uLay.value[i].set(0,0,0)}}u.uHeat.value=Math.min(1,(s.heat+s.hard)/(s.stats.heatCap||1));u.uPw.value=s.shieldPw??1;u.uBuf.value=s.stats.bufferCap?Math.min(1,(s.buffer||0)/s.stats.bufferCap):0;u.uCollapse.value=o.collapse;{const k=s.sun||0;let st=null;if(k>0){for(const b of world.bodies||[])if(b.burn&&Math.hypot(s.x-b.x,s.y-b.y)<b.burn){st=b;break}}if(st){const dd=domeDir(s,st.x,st.y,.3);u.uSun.value.set(dd.x,dd.y,dd.z,Math.min(1,.25+k));u.uSunC.value.set(st.color||16769712)}else u.uSun.value.w=0}for(let i=0;i<NI;i++){const h=o.imps[i];if(h){u.uImp.value[i].set(h.dir.x,h.dir.y,h.dir.z,t-h.t0);u.uImpK.value[i].set(h.amt,h.type,h.turn||0,0)}else u.uImp.value[i].w=9}const bl=held.get(s.id)||[];o.hold=o.hold||new Map;const now=new Set;for(let i=0;i<NB;i++){const b=bl[i];if(b){const h=(o.hold.get(b.owner)||0)+dt;o.hold.set(b.owner,h);now.add(b.owner);const d=domeDir(s,b.ex,b.ey,.22);u.uBeam.value[i].set(d.x,d.y,d.z,1+Math.min(1,h/2));u.uBeamC.value[i].setHex(b.color);beamSpray(b,s)}else u.uBeam.value[i].w=0}for(const k of o.hold.keys())if(!now.has(k))o.hold.delete(k)}for(const s of world.ships){const F=s.field,R=s.stats?.field?.r;if(!F||!R||s.debris)continue;const key="f"+s.id;let o=S.get(key);if(o&&o.lv!==Q.level)o=retier(s,key,o);if(!o){o=stateOf(s,key);if(o.up===void 0)o.up=F.down>0?0:1}seen.add(key);o.collapse=Math.max(0,o.collapse-dt/1.2);o.up=Math.max(0,Math.min(1,(o.up??0)+(F.down>0||s.wreck?-dt/.3:dt/1.5)));const vis=(o.up>.01||o.collapse>0)&&(!world.view||sees(world,world.view,s));o.mesh.visible=vis;if(!vis)continue;const Hy=Math.min(16,R*.06),u=o.u;o.mesh.position.set(s.x,.15,-s.y);o.mesh.rotation.y=0;o.mesh.scale.set(R,Hy,R);u.uR.value=R;u.uHy.value=Hy;u.uScale.value.set(R,Hy,R);u.uArc.value=Math.PI*2;u.uUp.value=o.up;u.uT.value=t;u.uHeat.value=Math.min(.92,1-F.hp/Math.max(1,F.max));u.uPw.value=1;u.uBuf.value=0;u.uCollapse.value=o.collapse;u.uCell.value=.16;u.uHitK.value=8;u.uFlat.value=1;for(let i=0;i<NI;i++){const h=o.imps[i];if(h){u.uImp.value[i].set(h.dir.x,h.dir.y,h.dir.z,t-h.t0);u.uImpK.value[i].set(h.amt,h.type,0,0)}else u.uImp.value[i].w=9}for(let i=0;i<NB;i++)u.uBeam.value[i].w=0}for(const[id,o]of S)if(!seen.has(id)){scene.remove(o.mesh);o.mesh.material.dispose();S.delete(id)}}};function shardsOff(s,k){if(Math.random()>.35+.4*k)return;const L=lookOf(s.side);c.setHex(L.shield);const[R,Hy]=sizeOf(s),arc=Math.min(s.stats.shieldArc,6.283);const a=s.shieldDir+Math.PI/2+(Math.random()-.5)*arc,h=Math.random()*.8,rr=R*Math.sqrt(1-h*h),sp=2+Math.random()*6;sparks.add({x:s.x+Math.cos(a)*rr,z:-(s.y+Math.sin(a)*rr),y:.3+h*Hy,vx:Math.cos(a)*sp+(s.vx||0)*.5,vz:-Math.sin(a)*sp-(s.vy||0)*.5,vy:-.5-Math.random(),life:.5+Math.random()*.6,max:1.1,s0:.5+Math.random()*.6,s1:.05,r:c.r*1.6+.5,g:c.g*1.6+.5,b:c.b*1.6+.5,drag:1.4,spin:(Math.random()-.5)*12})}function beamSpray(b,s){if(Math.random()>.5)return;c.setHex(b.color);const nx=b.ex-s.x,ny=b.ey-s.y,h=Math.hypot(nx,ny)||1,a=Math.atan2(ny/h,nx/h)+(Math.random()-.5)*2.2,sp=5+Math.random()*10;sparks.add({x:b.ex,z:-b.ey,y:1.2,vx:Math.cos(a)*sp,vz:-Math.sin(a)*sp,life:.22,max:.22,s0:.4,s1:.05,r:c.r+1.2,g:c.g+1.2,b:c.b+1.2,drag:3})}function heatOff(s,dt){const tiles=s.tiles,cos=Math.cos(s.a),sin=Math.sin(s.a),n=s.overload>0?3:2;for(let k=0;k<n;k++){const tile=tiles[Math.floor(Math.random()*tiles.length)];if(!tile?.alive)continue;const[mx,my]=midOf(tile),rx=mx-s.com.x,ry=-my-s.com.y,x=s.x+rx*cos-ry*sin,y=s.y+rx*sin+ry*cos;if(s.overload>0){sparks.add({x:x+(Math.random()-.5)*.8,z:-y+(Math.random()-.5)*.8,y:1,life:.07+Math.random()*.08,max:.15,s0:.6+Math.random()*.9,s1:.1,r:1.3,g:1.7,b:2.6});if(Math.random()<.3){const a=Math.random()*6.28,sp=6+Math.random()*8;sparks.add({x,z:-y,y:1,vx:Math.cos(a)*sp,vz:Math.sin(a)*sp,life:.2,max:.2,s0:.25,s1:.04,r:1.6,g:2,b:2.6,drag:4})}}else{const a=Math.random()*6.28,sp=.8+Math.random()*1.6;sparks.add({x,z:-y,y:1.1,vx:Math.cos(a)*sp+s.vx*.6,vz:Math.sin(a)*sp-s.vy*.6,vy:1.5,life:.9+Math.random()*.5,max:1.4,s0:.6,s1:2.2,r:.9,g:.28,b:.1,drag:.6})}}}}export{createShields,layerMarks};

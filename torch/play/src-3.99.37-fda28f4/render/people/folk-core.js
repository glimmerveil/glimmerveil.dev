import*as THREE from"three";import{mergeGeometries,mergeVertices}from"./bgu.js";import{SEASON_U,rhash,CLOUD_GLSL,KINGDOM_RGB}from"./env.js";const BODY=0,THIGH_L=1,THIGH_R=2,SHIN_L=3,SHIN_R=4,UPPER_L=5,UPPER_R=6,FORE_L=7,FORE_R=8,HEAD=9,HAIR_FULL=10,HAIR=11,HAIR_LONG=12,BUN=13,TAIL=14,FRINGE=15,BEARD=16,MUSTACHE=17,HOOD=18,COIF=19,STRAW=20,WOOLCAP=21,CLOAK=22,DRESS=23,APRON=24,AXE=25,HOE=26,HAMMER=27,SKIRT=28,NOSE=29,EARS=30,SHAGGY=31,SCYTHE=32,SPADE=33,BOW=34,PICK=35,SWORD=36,SHIELD=37,HELM=38,WIZHAT=39,ANTLERS=40,STAFF=41,STAFF_GLOW=42,WAND=43,WAND_GLOW=44,RHAM=45,RHAM_GLOW=46,RHAM_S=47,RHAM_S_GLOW=48,PLATE=49,RUNES=50,WITCHHAT=51,CIRCLET=52,CIRCLET_GEM=53,MITRE=54,WOLFHOOD=55,PENDANT=56,CROWN=57,CROWN_GLOW=58,HARDHAT=59,HIVIS=60;const PITCHFORK=26;const FIXED=0,SKIN=1,TUNIC=2,CLOTH=3,HAIRC=4,GLOW=5;const GLOWS=[[.62,.82,1],[1,.86,.45],[.72,1,.42],[.8,.5,1],[1,.62,.22],[.78,.9,1],[.5,.7,1],[1,.5,.82]];const CASTERS=new Set(["wizard","druid","runesmith","witch"]);const P_NONE=0,P_AXE=1,P_DIG=2,P_HAMMER=3,P_CARRY=4,P_RUN=5,P_DANCE=6,P_REAP=7,P_SHOVEL=8,P_LIMP=9,P_COVER=10,P_BOW=11,P_PICK=12,P_SWORD=13,P_SWORDSHIELD=14,P_RIDE=15,P_BLIND=16,P_LONGBOW=17,P_GREAT=18,P_CHANNEL=19,P_CHANNEL_UP=20,P_EAT=21;const SOLDIERS=new Set(["footman","warden","serjeant","knight","bowman","crossbowman","archer","guard","picket"]);const CONTENT=0,NEUTRAL=1,TIRED=2,SAD=3,SCARED=4,FOCUSED=5,HAPPY=6,COLD=7;const FACES=16;const CELL=96;const HAND={u:0,v:0,y:null,on:false};const FOLK_U={uSimTime:{value:0},uRes:{value:new THREE.Vector2(1280,800)},uOutlinePx:{value:1},uFaces:{value:null},uBrows:{value:null}};function piece(g,partId,slot,rgb=[1,1,1]){const n=g.attributes.position.count;const col=new Float32Array(n*3),ps=new Float32Array(n);const lin=c2=>c2<=.04045?c2/12.92:Math.pow((c2+.055)/1.055,2.4);const c=rgb.map(lin);for(let i=0;i<n;i++){col[i*3]=c[0];col[i*3+1]=c[1];col[i*3+2]=c[2];ps[i]=partId+64*slot}g.setAttribute("color",new THREE.BufferAttribute(col,3));g.setAttribute("ps",new THREE.BufferAttribute(ps,1));if(g.attributes.uv)g.deleteAttribute("uv");return g}function loft(rings,seg,{capTop=false,capBottom=false,t0=0,tl=Math.PI*2}={}){const pos=[],idx=[];const full=tl>=Math.PI*2-1e-6,cols=full?seg:seg+1;for(const[y,rx,rz,cx=0,cz=0]of rings){for(let i=0;i<cols;i++){const a=t0+i/seg*tl;pos.push(cx+Math.sin(a)*rx,y,cz+Math.cos(a)*rz)}}for(let r=0;r<rings.length-1;r++){for(let i=0;i<seg;i++){const a=r*cols+i,b=r*cols+(i+1)%cols,c=a+cols,d=b+cols;if(rings[r][0]>rings[r+1][0])idx.push(a,c,b,b,c,d);else idx.push(a,b,c,b,d,c)}}const capAt=(r,up)=>{const[y,,,cx=0,cz=0]=rings[r];const ci=pos.length/3;pos.push(cx,y,cz);for(let i=0;i<seg;i++){const a=r*cols+i,b=r*cols+(i+1)%cols;if(up)idx.push(ci,a,b);else idx.push(ci,b,a)}};const top=rings[0][0]>rings[rings.length-1][0]?0:rings.length-1;if(capTop)capAt(top,true);if(capBottom)capAt(top===0?rings.length-1:0,false);const g=new THREE.BufferGeometry;g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g}const ell=(rx,ry,rz,w,h,p0,pl,t0,tl)=>new THREE.SphereGeometry(1,w,h,p0,pl,t0,tl).scale(rx,ry,rz);const HY=.925,HZ=.012,HRX=.053,HRY=.076,HRZ=.07;const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};const hh=(x,y,z)=>{const v=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return v-Math.floor(v)};function skullAt(dx,dy,dz,out){let x=dx,y=dy,z=dz;if(z<0){z*=1.15;y+=.06*-z*Math.max(0,y+.3)}if(z>.45)z=.45+(z-.45)*.55;const low=sm(-.05,-.95,y),front=sm(-.2,.6,dz);x*=1-.33*low*front-.1*low*(1-front);if(z<0&&y<-.3)z*=1-.38*sm(-.3,-.95,y);z+=.1*Math.exp(-((y+.86)**2)/.03-x*x/.08)*front;z+=.06*Math.exp(-((y-.3)**2)/.008)*sm(.3,.75,dz)*(1-sm(.5,.9,Math.abs(x)));for(const s of[-1,1])z-=.055*Math.exp(-((x-s*.42)**2)/.03-(y-.13)**2/.012)*front;x+=Math.sign(x)*.05*Math.exp(-((y+.05)**2)/.04)*sm(.2,.7,dz);z+=.03*Math.exp(-((y+.52)**2)/.02-x*x/.06)*front;out[0]=x;out[1]=y;out[2]=z;return out}function skull(seg,rings,shell=0,keep=null,bump=0){const pos=[],ok=[],idx=[],p=[0,0,0];for(let r=0;r<=rings;r++){const phi=r/rings*Math.PI;for(let i=0;i<=seg;i++){const th=Math.PI+i/seg*Math.PI*2;const dx=Math.sin(phi)*Math.sin(th),dy=Math.cos(phi),dz=Math.sin(phi)*Math.cos(th);skullAt(dx,dy,dz,p);let k=1+shell;if(bump)k+=bump*(hh(Math.round(dx*5),Math.round(dy*5),Math.round(dz*5))-.5);pos.push(p[0]*k*HRX,HY+p[1]*k*HRY,HZ+p[2]*k*HRZ);ok.push(!keep||keep(dx,dy,dz))}}const W=seg+1;for(let r=0;r<rings;r++)for(let i=0;i<seg;i++){const a=r*W+i,b=a+1,c=a+W,d=c+1;if(ok[a]&&ok[b]&&ok[c])idx.push(a,c,b);if(ok[b]&&ok[c]&&ok[d])idx.push(b,c,d)}let g=new THREE.BufferGeometry;g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g=mergeVertices(g);g.computeVertexNormals();return g}function hull(pts,tris,inside){const pos=[],v=(i,k)=>pts[i][k];for(const t of tris){const[a,b,c]=t;const ux=v(b,0)-v(a,0),uy=v(b,1)-v(a,1),uz=v(b,2)-v(a,2);const wx=v(c,0)-v(a,0),wy=v(c,1)-v(a,1),wz=v(c,2)-v(a,2);const nx=uy*wz-uz*wy,ny=uz*wx-ux*wz,nz=ux*wy-uy*wx;const out=(v(a,0)-inside[0])*nx+(v(a,1)-inside[1])*ny+(v(a,2)-inside[2])*nz;for(const i of out>=0?[a,b,c]:[a,c,b])pos.push(...pts[i])}let g=new THREE.BufferGeometry;g.setAttribute("position",new THREE.Float32BufferAttribute(pos,3));g=mergeVertices(g);g.computeVertexNormals();return g}const H=(x,y,z)=>[x*HRX,HY+y*HRY,HZ+z*HRZ];function figure(detail){const P=[];const f=[1,.55,.34][detail];const sg=n=>Math.max(4,Math.round(n*f));const E=(rx,ry,rz,w,h,...rest)=>ell(rx,ry,rz,Math.max(4,Math.round(w*f)),Math.max(3,Math.round(h*f)),...rest);const far=detail===2,close=detail===0;const rod=(r,len)=>new THREE.CylinderGeometry(r,r,len,far?3:5,1,far);const BOOT=[.2,.22,.26],SOLE=[.06,.06,.07],CAP=[.55,.58,.62],BAND=[.82,.86,.9],DARK=[.2,.14,.09],WOOD=[.5,.36,.22],IRON=[.6,.62,.66],STRAWC=[.84,.71,.42],LINEN=[.9,.87,.79];for(const s of[1,-1]){const L=s>0;const hx=.052*s;P.push(piece(loft([[.535,.05,.05,hx],[.42,.045,.047,hx],[.29,.034,.037,hx]],sg(12),{capTop:!far}),L?THIGH_L:THIGH_R,CLOTH));if(!far)P.push(piece(E(.034,.034,.036,10,6).translate(hx,.275,0),L?SHIN_L:SHIN_R,CLOTH));P.push(piece(loft([[.29,.033,.036,hx],[.17,.026,.03,hx]],sg(12)),L?SHIN_L:SHIN_R,CLOTH));P.push(piece(loft([[.18,.031,.034,hx],[.05,.032,.037,hx,.004]],sg(12),{capBottom:true}),L?SHIN_L:SHIN_R,FIXED,BOOT));P.push(piece(E(.032,.026,.07,10,6).translate(hx,.028,.032),L?SHIN_L:SHIN_R,FIXED,BOOT));if(close){P.push(piece(E(.036,.009,.075,10,4).translate(hx,.007,.033),L?SHIN_L:SHIN_R,FIXED,SOLE));P.push(piece(E(.026,.018,.026,8,5).translate(hx,.03,.082),L?SHIN_L:SHIN_R,FIXED,CAP));P.push(piece(loft([[.17,.0335,.0365,hx],[.15,.0335,.0365,hx]],sg(12)),L?SHIN_L:SHIN_R,FIXED,BAND))}const ax=.118*s,ex=.126*s,wx=.129*s;P.push(piece(E(.031,.026,.035,12,7).translate(.108*s,.786,0),L?UPPER_L:UPPER_R,TUNIC));P.push(piece(loft([[.8,.035,.035,ax],[.64,.029,.029,ex]],sg(12)),L?UPPER_L:UPPER_R,TUNIC));if(!far)P.push(piece(E(.028,.028,.028,10,6).translate(ex,.637,.002),L?FORE_L:FORE_R,TUNIC));P.push(piece(loft([[far?.66:.64,.028,.028,ex],[.49,.023,.023,wx]],sg(12),{capBottom:true}),L?FORE_L:FORE_R,TUNIC));if(close){const fore=L?FORE_L:FORE_R;P.push(piece(ell(.013,.022,.021,8,6).translate(wx,.463,.004),fore,SKIN));P.push(piece(loft([[.512,.017,.018,wx],[.488,.0155,.0165,wx],[.468,.0125,.015,wx]],sg(10)),fore,SKIN));const finger=(a,b,r)=>{const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),d=B.clone().sub(A),len=d.length();const g=new THREE.CapsuleGeometry(r,len,2,5);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate((A.x+B.x)/2,(A.y+B.y)/2,(A.z+B.z)/2);return piece(g,fore,SKIN)};[-.012,-.004,.004,.012].forEach((z,k)=>{const len=k===0?.019:k===3?.021:.026;P.push(finger([wx,.445,.004+z],[wx-s*.006,.445-len,.008+z*1.1],.0042))});P.push(finger([wx-s*.004,.458,.02],[wx-s*.009,.437,.033],.0046))}else P.push(piece(E(.019,.035,.027,8,6).translate(wx,.455,.004),L?FORE_L:FORE_R,SKIN));if(!far)P.push(piece(ell(.0065,.0165,.011,close?7:4,close?5:3).rotateZ(-s*.12).translate(s*HRX*1,HY+.004,HZ-.012),EARS,SKIN))}P.push(piece(loft([[.835,.045,.036],[.818,.094,.058],[.775,.108,.066],[.7,.1,.066],[.62,.088,.06],[.56,.084,.058],[.5,.086,.06]],sg(14),{capTop:true,capBottom:!far}),BODY,TUNIC));P.push(piece(loft([[.6,.092,.064],[.5,.102,.072],[.37,.118,.088]],sg(14)),SKIRT,TUNIC));if(!far)P.push(piece(loft([[.618,.093,.065],[.594,.093,.065]],sg(14)),BODY,FIXED,DARK));P.push(piece(loft([[.875,.025,.026,0,.002],[.815,.029,.029]],sg(8)),BODY,SKIN));const[hs,hr]=[[28,20],[14,10],[8,6]][detail];P.push(piece(skull(hs,hr),HEAD,SKIN));if(!far){const n=[H(0,.24,.77),H(0,-.27,1.06),H(-.17,-.31,.8),H(.17,-.31,.8),H(0,-.37,.87),H(-.07,.08,.76),H(.07,.08,.76)];P.push(piece(hull(n,[[0,1,6],[0,5,1],[6,1,3],[5,2,1],[1,4,3],[1,2,4]],H(0,-.1,.55)),NOSE,SKIN))}const hairline=(dx,dy,dz)=>dy>-.55+1.03*sm(-.25,.55,dz)||Math.abs(dx)>.8&&dz>-.2&&dz<.35&&dy>-.12;const[cs,cr]=[[24,16],[12,8],[8,5]][detail];P.push(piece(skull(cs,cr,.07,hairline),HAIR,HAIRC));const full=(dx,dy,dz)=>dy>-.85+1.27*sm(-.1,.6,dz)&&!(dz>.35&&dy<.42&&Math.abs(dx)<.75);P.push(piece(skull(cs,cr,.15,full),HAIR_FULL,HAIRC));P.push(piece(skull(cs,cr,.13,(dx,dy,dz)=>dy>-.62+1*sm(-.25,.55,dz)||Math.abs(dx)>.8&&dz>-.2&&dz<.35&&dy>-.3,.28),SHAGGY,HAIRC));if(!far)P.push(piece(skull(cs,cr,.06,(dx,dy,dz)=>hairline(dx,dy,dz)&&dy<.3&&dz<.4),FRINGE,HAIRC));P.push(piece(loft([[HY+.035,.058,.074,0,HZ-.012],[HY-.05,.062,.07,0,HZ-.03],[HY-.13,.068,.05,0,HZ-.04]],sg(12),{t0:Math.PI-1.5,tl:3}),HAIR_LONG,HAIRC));if(!far)P.push(piece(E(.028,.026,.028,10,6).translate(0,HY+.062,HZ-.07),BUN,HAIRC));if(!far)P.push(piece(loft([[HY+.02,.015,.015,0,HZ-.078],[HY-.09,.009,.009,0,HZ-.095]],sg(8),{capBottom:true}),TAIL,HAIRC));P.push(piece(skull(cs,cr,.07,(dx,dy,dz)=>dy<-.12&&dz>-.35&&!(Math.abs(dx)<.3&&dy>-.66&&dy<-.4&&dz>.5)),BEARD,HAIRC));if(!far)P.push(piece(ell(.016,.0042,.0075,6,3).translate(...H(0,-.43,.86)),MUSTACHE,HAIRC));P.push(piece(skull(cs,cr,.32,(dx,dy,dz)=>dy>-.8&&!(dz>.15&&dy<.6&&Math.abs(dx)<.82)),HOOD,CLOTH));P.push(piece(loft([[.875,.064,.066],[.8,.12,.088],[.75,.13,.092]],sg(14)),HOOD,CLOTH));P.push(piece(skull(cs,cr,.13,(dx,dy,dz)=>dy>-.72&&!(dz>.25&&dy<.62&&Math.abs(dx)<.86)),COIF,FIXED,LINEN));P.push(piece(loft([[HY+.045,.125,.125],[HY+.04,.125,.125]],sg(16),{capTop:true,capBottom:!far}),STRAW,FIXED,STRAWC));P.push(piece(loft([[HY+.108,.046,.05],[HY+.045,.06,.068]],sg(10),{capTop:true}),STRAW,FIXED,STRAWC));P.push(piece(skull(cs,cr,.13,(dx,dy,dz)=>dy>.28),WOOLCAP,CLOTH));P.push(piece(loft([[HY+.052,.13,.13],[HY+.044,.13,.13]],sg(16),{capTop:true,capBottom:!far}),WIZHAT,CLOTH));P.push(piece(loft([[HY+.29,.004,.004,0,-.05],[HY+.21,.022,.024,0,-.025],[HY+.13,.046,.05,0,-.006],[HY+.05,.064,.072]],sg(12),{capTop:true}),WIZHAT,CLOTH));{const ANT=[.62,.55,.42],seg=(a,b,r)=>{const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),d=B.clone().sub(A),g=new THREE.CylinderGeometry(r*.7,r,d.length(),far?3:4,1);g.translate(0,d.length()/2,0);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));g.translate(A.x,A.y,A.z);return g};P.push(piece(loft([[HY+.05,.068,.072],[HY+.035,.07,.074]],sg(14),{}),ANTLERS,FIXED,[.36,.28,.18]));for(const s of[-1,1]){const b0=[s*.035,HY+.05,HZ-.01],b1=[s*.075,HY+.12,HZ-.03],b2=[s*.11,HY+.19,HZ-.07],b3=[s*.12,HY+.25,HZ-.12];P.push(piece(mergeGeometries([seg(b0,b1,.009),seg(b1,b2,.008),seg(b2,b3,.006),seg(b1,[s*.085,HY+.17,HZ+.03],.005),seg(b2,[s*.14,HY+.24,HZ-.01],.005),seg(b2,[s*.09,HY+.25,HZ-.06],.004)]),ANTLERS,FIXED,ANT))}}{const BLK=[.09,.08,.1];const brim=new THREE.LatheGeometry([[.062,.006],[.12,.004],[.19,-.01],[.245,-.032],[.248,-.04],[.19,-.019],[.12,-.004],[.062,-.002]].map(([r,y])=>new THREE.Vector2(r,y)),far?10:close?28:16);const bp=brim.attributes.position;for(let i=0;i<bp.count;i++){const x=bp.getX(i),z=bp.getZ(i),r=Math.hypot(x,z);if(r>.09)bp.setY(i,bp.getY(i)+(Math.sin(Math.atan2(x,z)*3+1)*.026-(z<0?.016:0))*((r-.09)/.155))}brim.computeVertexNormals();P.push(piece(brim.translate(0,HY+.05,0),WITCHHAT,FIXED,BLK));P.push(piece(loft([[HY+.27,.004,.004,0,-.17],[HY+.265,.014,.014,0,-.12],[HY+.22,.03,.032,0,-.055],[HY+.15,.05,.053,0,-.02],[HY+.05,.074,.078]],sg(12),{capTop:true}),WITCHHAT,FIXED,BLK));if(!far)P.push(piece(loft([[HY+.075,.07,.074],[HY+.055,.075,.079]],sg(12)),WITCHHAT,FIXED,[.3,.16,.36]))}{const GOLD=[.86,.7,.32];P.push(piece(loft([[HY+.05,.074,.08],[HY+.036,.075,.081]],sg(16),{}),CIRCLET,FIXED,GOLD));if(!far)for(const s of[-1,1])for(let k=0;k<3;k++)P.push(piece(new THREE.SphereGeometry(.011,5,3).scale(1.6,.6,.5).rotateZ(s*(.5+k*.25)).translate(s*(.022+k*.022),HY+.05+k*.004,.079-k*.01),CIRCLET,FIXED,k%2?[.62,.72,.3]:GOLD));P.push(piece(mergeVertices(new THREE.OctahedronGeometry(.013,0)).scale(.8,1.2,.6).translate(0,HY+.046,.084),CIRCLET_GEM,GLOW))}{const W=[.93,.91,.86],G=[.86,.68,.28];P.push(piece(loft([[HY+.2,.012,.06],[HY+.15,.05,.066],[HY+.08,.07,.075],[HY+.04,.072,.077]],sg(12),{capTop:true}),MITRE,FIXED,W));P.push(piece(loft([[HY+.062,.074,.079],[HY+.04,.075,.08]],sg(12)),MITRE,FIXED,G));if(!far)P.push(piece(new THREE.BoxGeometry(.012,.14,.004).translate(0,HY+.12,.074),MITRE,FIXED,G))}{const FUR=[.46,.45,.43];P.push(piece(skull(cs,cr,.24,(dx,dy,dz)=>dy>-.35&&!(dz>.3&&dy<.45&&Math.abs(dx)<.86)),WOLFHOOD,FIXED,FUR));P.push(piece(loft([[.9,.05,.05,0,-.02],[.82,.1,.08,0,-.03]],sg(12),{t0:Math.PI-1.6,tl:3.2}),WOLFHOOD,FIXED,FUR));if(!far){for(const s of[-1,1])P.push(piece(new THREE.ConeGeometry(.018,.045,4).translate(s*.042,HY+.1,-.005),WOLFHOOD,FIXED,[.38,.36,.34]));P.push(piece(new THREE.SphereGeometry(.03,8,5).scale(.85,.6,1.4).translate(0,HY+.068,.07),WOLFHOOD,FIXED,FUR));P.push(piece(new THREE.SphereGeometry(.008,6,4).translate(0,HY+.07,.11),WOLFHOOD,FIXED,[.08,.07,.07]))}}{P.push(piece(loft([[HY+.052,.073,.079],[HY+.034,.074,.08]],sg(16),{}),CROWN,FIXED,[.82,.84,.9]));for(let k=0;k<5;k++){const a=(k-2)*.62,hgt=k===2?.075:k%2?.05:.036;P.push(piece(mergeVertices(new THREE.OctahedronGeometry(.012,0)).scale(.8,hgt/.024,.6).translate(Math.sin(a)*.075,HY+.05+hgt*.5,Math.cos(a)*.08),CROWN_GLOW,GLOW))}}P.push(piece(skull(cs,cr,.17,(dx,dy,dz)=>dy>.2||dz<.25&&dy>-.45),HELM,FIXED,[.22,.25,.31]));if(!far){P.push(piece(skull(cs,cr,.2,(dx,dy,dz)=>dz>.18&&dy<=.24&&dy>-.3),HELM,FIXED,[.05,.09,.15]));P.push(piece(new THREE.BoxGeometry(.046,.006,.004).translate(...H(0,.32,1)),HELM,FIXED,[.6,.85,1]))}{const HAT=[.95,.95,.92];P.push(piece(skull(cs,cr,.24,(dx,dy,dz)=>dy>.3),HARDHAT,FIXED,HAT));if(!far){P.push(piece(loft([[HY+.05,.058,.074,0,-.004],[HY+.036,.063,.081,0,-.003],[HY+.029,.072,.094,0,.005],[HY+.024,.071,.093,0,.005]],sg(16),{capBottom:true}),HARDHAT,FIXED,HAT));P.push(piece(new THREE.BoxGeometry(.016,.008,.07).translate(0,HY+HRY*1.24,-.004),HARDHAT,FIXED,[.84,.85,.84]))}if(close)P.push(piece(new THREE.BoxGeometry(.022,.014,.012).translate(0,HY+.054,.08),HARDHAT,FIXED,[.2,.22,.26]),piece(new THREE.BoxGeometry(.014,.008,.004).translate(0,HY+.054,.087),HARDHAT,FIXED,[1,.96,.8]))}if(!far){const REFL=[.9,.93,.96];P.push(piece(loft([[.722,.1052,.0692],[.694,.1022,.0692]],sg(14)),HIVIS,FIXED,REFL));P.push(piece(loft([[.664,.0972,.0655],[.638,.0932,.0638]],sg(14)),HIVIS,FIXED,REFL))}P.push(piece(ell(.016,.016,.016,6,4).translate(0,HY+HRY*1.12,HZ-.01),WOOLCAP,FIXED,[.92,.9,.84]));P.push(piece(loft([[.83,.1,.07,0,-.004],[.6,.13,.09,0,-.01],[.3,.16,.11,0,-.02]],sg(14),{t0:Math.PI-1.4,tl:2.8}),CLOAK,CLOTH));P.push(piece(loft([[.84,.07,.06],[.77,.122,.082]],sg(14)),CLOAK,CLOTH));P.push(piece(loft([[.62,.091,.063],[.45,.12,.086],[.06,.165,.135]],sg(16)),DRESS,TUNIC));if(!far)P.push(piece(loft([[.6,.097,.07,0,.004],[.45,.127,.095,0,.005],[.16,.158,.13,0,.008]],sg(10),{t0:-.9,tl:1.8}),APRON,FIXED,LINEN));const hand=g=>g.translate(-.129,.455,.006);const head=(x,y,z)=>new THREE.BoxGeometry(x,y,z);P.push(piece(hand(rod(.0058,.42).rotateX(Math.PI/2).translate(0,0,.17)),AXE,FIXED,WOOD));if(!far){P.push(piece(hand(head(.007,.062,.032).translate(0,-.022,.36)),AXE,FIXED,IRON));P.push(piece(hand(head(.012,.022,.03).translate(0,.012,.36)),AXE,FIXED,[.42,.42,.44]))}P.push(piece(hand(rod(.005,.56).rotateX(Math.PI/2).translate(0,0,.22)),PITCHFORK,FIXED,WOOD));if(!far){P.push(piece(hand(head(.07,.008,.01).translate(0,0,.5)),PITCHFORK,FIXED,IRON));for(const x of[-.03,0,.03])P.push(piece(hand(rod(.0028,.11).rotateX(Math.PI/2).translate(x,0,.555)),PITCHFORK,FIXED,IRON))}P.push(piece(hand(rod(.005,.11).rotateX(Math.PI/2).translate(0,0,.035)),HAMMER,FIXED,WOOD));if(!far)P.push(piece(hand(head(.036,.018,.018).translate(0,0,.088)),HAMMER,FIXED,IRON));P.push(piece(hand(rod(.0055,.64).rotateX(Math.PI/2).translate(0,0,.26)),SCYTHE,FIXED,WOOD));if(!far){P.push(piece(hand(rod(.004,.07).rotateZ(Math.PI/2).translate(-.03,0,.12)),SCYTHE,FIXED,WOOD));const blade=new THREE.BoxGeometry(.3,.005,.028).translate(-.15,0,0).rotateY(-.25).translate(0,-.01,.58);P.push(piece(hand(blade),SCYTHE,FIXED,[.7,.72,.76]))}P.push(piece(hand(rod(.0055,.44).rotateX(Math.PI/2).translate(0,0,.18)),SPADE,FIXED,WOOD));if(!far){P.push(piece(hand(rod(.004,.08).rotateZ(Math.PI/2).translate(0,0,-.04)),SPADE,FIXED,WOOD));P.push(piece(hand(head(.075,.006,.1).translate(0,0,.44)),SPADE,FIXED,IRON))}P.push(piece(hand(rod(.0058,.42).rotateX(Math.PI/2).translate(0,0,.17)),PICK,FIXED,WOOD));if(!far){P.push(piece(hand(head(.008,.16,.014).translate(0,0,.37)),PICK,FIXED,IRON));for(const y of[-.085,.085])P.push(piece(hand(new THREE.ConeGeometry(.007,.03,4).rotateX(y>0?0:Math.PI).translate(0,y,.37)),PICK,FIXED,IRON))}P.push(piece(hand(rod(.0085,.085).rotateX(Math.PI/2).translate(0,0,.012)),SWORD,FIXED,[.08,.09,.11]));if(!far)P.push(piece(hand(head(.03,.03,.008).translate(0,0,.06)),SWORD,FIXED,[.32,.35,.4]));P.push(piece(hand(rod(.0065,.2).rotateX(Math.PI/2).translate(0,0,.165)),SWORD,FIXED,[.2,.22,.27]));if(!far)for(const z of[.2,.232])P.push(piece(hand(rod(.0095,.012).rotateX(Math.PI/2).translate(0,0,z)),SWORD,GLOW));P.push(piece(hand(rod(.0095,.034).rotateX(Math.PI/2).translate(0,0,.281)),SWORD,GLOW));{const cx=.129,cy=.398,cz=.02,EDGE=[.7,.76,.84];P.push(piece(new THREE.BoxGeometry(.135,.012,.22).translate(cx,cy,cz),SHIELD,FIXED,[.13,.16,.22]));P.push(piece(new THREE.BoxGeometry(.016,.05,.016).translate(cx,cy+.03,.006),SHIELD,FIXED,[.3,.33,.38]));if(!far){P.push(piece(new THREE.BoxGeometry(.085,.003,.03).translate(cx,cy-.0075,cz+.066),SHIELD,FIXED,[.55,.8,.95]));for(const z of[-.11,.11])P.push(piece(new THREE.BoxGeometry(.139,.014,.006).translate(cx,cy,cz+z),SHIELD,FIXED,EDGE));for(const x of[-.0675,.0675])P.push(piece(new THREE.BoxGeometry(.006,.014,.22).translate(cx+x,cy,cz),SHIELD,FIXED,EDGE))}}P.push(piece(hand(rod(.0045,.23).rotateX(Math.PI/2-.16).translate(0,-.018,.112)),BOW,FIXED,[.4,.27,.15]));P.push(piece(hand(rod(.0045,.23).rotateX(Math.PI/2+.16).translate(0,-.018,-.112)),BOW,FIXED,[.4,.27,.15]));if(!far)P.push(piece(hand(rod(.0012,.44).rotateX(Math.PI/2).translate(0,-.036,0)),BOW,FIXED,[.85,.82,.75]));P.push(piece(hand(new THREE.CylinderGeometry(.0065,.0085,1,far?3:6,1).translate(0,.08,.012)),STAFF,FIXED,[.36,.25,.15]));if(!far)for(let k=0;k<3;k++){const a=k*2.09;P.push(piece(hand(new THREE.CylinderGeometry(.0022,.0035,.06,3,1).rotateZ(.5).rotateY(a).translate(Math.sin(a)*.012,.6,.012+Math.cos(a)*.012)),STAFF,FIXED,[.36,.25,.15]))}P.push(piece(hand(mergeVertices(new THREE.IcosahedronGeometry(.026,far?0:1)).translate(0,.625,.012)),STAFF_GLOW,GLOW));{const d=[0,Math.sin(.5),Math.cos(.5)];P.push(piece(hand(new THREE.CylinderGeometry(.0025,.004,.17,far?3:5,1).rotateX(Math.PI/2-.5).translate(0,d[1]*.085,d[2]*.085)),WAND,FIXED,[.18,.12,.1]));P.push(piece(hand(mergeVertices(new THREE.IcosahedronGeometry(.012,0)).translate(0,d[1]*.175,d[2]*.175)),WAND_GLOW,GLOW))}const runeFace=(x,y,z,sc,rz=0,ry=0)=>{const Q=[];for(const[a,b]of[[[0,-1],[0,1]],[[0,.2],[-.7,1]],[[0,.2],[.7,1]],[[0,-.4],[.6,-1]]]){const dx=(b[0]-a[0])*sc,dy=(b[1]-a[1])*sc,L=Math.hypot(dx,dy);Q.push(new THREE.BoxGeometry(.0035,L,.002).rotateZ(-Math.atan2(dx,dy)).translate((a[0]+b[0])/2*sc,(a[1]+b[1])/2*sc,0))}return mergeGeometries(Q).rotateZ(rz).rotateY(ry).translate(x,y,z)};const HAM=[.4,.42,.46];P.push(piece(hand(new THREE.CylinderGeometry(.008,.009,.72,far?3:6,1).translate(0,.06,.012)),RHAM,FIXED,[.3,.2,.12]));P.push(piece(hand(new THREE.BoxGeometry(.05,.058,.14).translate(0,.44,.012)),RHAM,FIXED,HAM));for(const yb of[.16,0])P.push(piece(hand(new THREE.CylinderGeometry(.0098,.0098,.012,far?3:8,1).translate(0,yb,.012)),RHAM_GLOW,GLOW));if(!far)for(const sx of[-1,1])P.push(piece(hand(runeFace(0,0,0,.018,0,Math.PI/2*sx).translate(sx*.0265,.44,.012)),RHAM_GLOW,GLOW));P.push(piece(hand(rod(.0075,.34).rotateX(Math.PI/2).translate(0,0,.13)),RHAM_S,FIXED,[.3,.2,.12]));P.push(piece(hand(new THREE.BoxGeometry(.05,.14,.058).translate(0,0,.3)),RHAM_S,FIXED,HAM));P.push(piece(hand(new THREE.CylinderGeometry(.0088,.0088,.012,far?3:8,1).rotateX(Math.PI/2).translate(0,0,.16)),RHAM_S_GLOW,GLOW));if(!far)for(const sx of[-1,1])P.push(piece(hand(runeFace(0,0,0,.018,0,Math.PI/2*sx).translate(sx*.0265,0,.3)),RHAM_S_GLOW,GLOW));{const ST=[.45,.47,.51];P.push(piece(loft([[.852,.04,.036],[.83,.08,.056],[.81,.106,.069],[.775,.116,.075],[.7,.108,.075],[.62,.097,.069],[.575,.096,.071]],sg(14)),PLATE,FIXED,ST));P.push(piece(loft([[.58,.098,.072],[.54,.104,.077],[.535,.106,.079],[.5,.11,.082]],sg(14)),PLATE,FIXED,[.38,.4,.44]));for(const s of[-1,1])P.push(piece(new THREE.SphereGeometry(.044,far?6:10,far?3:5,0,Math.PI*2,0,Math.PI/2).scale(1,.75,1.05).translate(s*.112,.785,0),PLATE,FIXED,ST));if(!far){for(const[x0,y0]of[[-.045,.705],[0,.72],[.045,.705]]){const a=Math.asin(x0/.108),z0=.075*Math.cos(a)+.0025;P.push(piece(runeFace(0,0,0,.016,0,0).rotateY(a).translate(x0,y0,z0),RUNES,GLOW))}P.push(piece(runeFace(0,0,0,.026,0,Math.PI).translate(0,.71,-.0775),RUNES,GLOW));for(const s of[-1,1])P.push(piece(new THREE.BoxGeometry(.004,.003,.05).translate(s*.112,.818,0),RUNES,GLOW))}}P.push(piece(mergeVertices(new THREE.OctahedronGeometry(.012,0)).scale(1,1.3,.5).translate(0,.735,.072),PENDANT,GLOW));return mergeGeometries(P)}const great=(R,p)=>{if(!R||typeof R.greatsword!=="function")return false;try{return!!R.greatsword(p)}catch{return false}};const LIMBS=`
attribute float ps;
attribute vec4 iAnim;
attribute vec4 iMisc;
attribute vec4 iShape;
attribute vec4 iFace;
attribute vec4 iHair;
attribute vec4 iBody;
attribute vec4 iCols;
uniform float uSimTime;
uniform vec2 uWind;
varying vec3 vHeadU; varying float vFace; varying float vFx; varying vec3 vObj; varying float vSlot; varying vec2 vWXZ; varying vec3 vHairCol;

int fPart() { return int(mod(ps, 64.0) + 0.5); }
int fSlot() { return int(floor((ps + 0.5) / 64.0)); }
bool isTool(int p) { return (p >= 25 && p <= 27) || (p >= 32 && p <= 36) || (p >= 41 && p <= 48); }
mat3 folkRotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
mat3 folkRotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
float folkCycle(float speed) { float c = fract((uSimTime + iMisc.x) * speed); float k = c < 0.7 ? c / 0.7 : 1.0 - (c - 0.7) / 0.3; return k * k * (3.0 - 2.0 * k); }
mat3 folkRot(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
float kitBits(float div, float n) { return mod(floor(iMisc.z / div + 0.001), n); }
vec3 glowCol() {
  float i = floor(iMisc.z / 64.0 + 0.001);
  vec3 c = ${GLOWS.slice(0,-1).map((c,k)=>`i < ${k+.5} ? vec3(${c.map(x=>x.toFixed(3)).join(", ")})`).join(" : ")} : vec3(${GLOWS[GLOWS.length-1].map(x=>x.toFixed(3)).join(", ")});
  return pow(c, vec3(2.2));
}
vec3 unpackCol(float f) {
  float r = floor(f / 65536.0), g = floor((f - r * 65536.0) / 256.0), b = f - r * 65536.0 - g * 256.0;
  return pow(vec3(r, g, b) / 255.0, vec3(2.2));
}

float folkVis(int p) {
  int hs = int(iHair.x + 0.5), hat = int(iMisc.w + 0.5), dr = int(iBody.w + 0.5);
  bool hood = kitBits(1.0, 4.0) > 1.5, covered = hood || hat == 3 || hat == 4 || hat == 5 || hat == 7 || hat == 9 || hat == 10;
  int held = int(kitBits(4.0, 4.0) + 0.5), pz = int(iAnim.w + 0.5);
  if (p >= 41 && p <= 48) {
    bool busy = pz == 1 || pz == 2 || pz == 3 || pz == 4 || pz == 7 || pz == 8 || pz == 11 || pz == 12 || pz == 13 || pz == 14 || pz == 17 || pz == 18;
    if (p <= 42) return held == 1 && !busy ? 1.0 : 0.0;
    if (p <= 44) return held == 2 && !busy ? 1.0 : 0.0;
    if (p <= 46) return held == 3 && !busy ? 1.0 : 0.0;
    return held == 3 && (pz == 3 || pz == 13 || pz == 14 || pz == 18) ? 1.0 : 0.0;
  }
  if (held == 3 && (p == 27 || p == 36)) return 0.0;
  if (p == 49 || p == 50) return kitBits(16.0, 2.0) > 0.5 ? 1.0 : 0.0;
  if (p == 51) return (!hood && hat == 7) ? 1.0 : 0.0;
  if (p == 52 || p == 53) return (!hood && hat == 8) ? 1.0 : 0.0;
  if (p == 54) return (!hood && hat == 9) ? 1.0 : 0.0;
  if (p == 55) return (!hood && hat == 10) ? 1.0 : 0.0;
  if (p == 56) return kitBits(32.0, 2.0) > 0.5 ? 1.0 : 0.0;
  if (p == 57 || p == 58) return (!hood && hat == 11) ? 1.0 : 0.0;
  if (p == 59) return (!hood && hat == 12) ? 1.0 : 0.0;
  if (p == 60) return (hat == 12 || hat == 13) ? 1.0 : 0.0;
  bool hatted = !hood && hat == 12;
  if (p == 11) return (!covered && (hs == 0 || hs == 2 || hs == 3)) ? 1.0 : 0.0;
  if (p == 10) return (!covered && (hs == 1 || hs == 7 || (hatted && hs == 6))) ? 1.0 : 0.0;
  if (p == 31) return (!covered && !hatted && hs == 6) ? 1.0 : 0.0;
  if (p == 12) return (!hood && hs == 1) ? 1.0 : 0.0;
  if (p == 13) return (!covered && !hatted && hs == 2) ? 1.0 : 0.0;
  if (p == 14) return (!covered && hs == 3) ? 1.0 : 0.0;
  if (p == 15) return (!covered && hs == 4) ? 1.0 : 0.0;
  if (p == 16) return iHair.z > 0.01 ? 1.0 : 0.0;
  if (p == 17) return iHair.w;
  if (p == 18) return hood ? 1.0 : 0.0;
  if (p == 19) return (!hood && hat == 3) ? 1.0 : 0.0;
  if (p == 20) return (!covered && hat == 1) ? 1.0 : 0.0;
  if (p == 21) return (!covered && hat == 2) ? 1.0 : 0.0;
  if (p == 22) return kitBits(1.0, 4.0) > 0.5 ? 1.0 : 0.0;
  if (p == 23) return dr == 1 || dr == 2 ? 1.0 : 0.0;
  if (p == 24) return dr >= 2 ? 1.0 : 0.0;
  if (isTool(p)) { int ps2 = int(iAnim.w + 0.5); return ((p == 25 && ps2 == 1) || (p == 26 && ps2 == 2) || (p == 27 && ps2 == 3) || (p == 32 && ps2 == 7) || (p == 33 && ps2 == 8) || (p == 34 && (ps2 == 11 || ps2 == 17)) || (p == 35 && ps2 == 12) || (p == 36 && (ps2 == 13 || ps2 == 14 || ps2 == 18))) ? 1.0 : 0.0; }
  if (p == 37) return int(iAnim.w + 0.5) == 14 ? 1.0 : 0.0;
  if (p == 38) return hat == 4 ? 1.0 : 0.0;
  if (p == 39) return (!hood && hat == 5) ? 1.0 : 0.0;
  if (p == 40) return (!hood && hat == 6) ? 1.0 : 0.0;
  if (p == 28) return dr == 0 || dr == 3 ? 1.0 : 0.0;
  if (p == 30) return (hood || hat == 3) ? 0.0 : 1.0;
  return 1.0;
}

void folkJoints(int p, out vec3 P1, out float a1, out vec3 P2, out float a2, out float aT, out float roll) {
  P1 = vec3(0.0); P2 = vec3(0.0); a1 = 0.0; a2 = 0.0; aT = 0.0; roll = 0.0;
  int pose = int(iAnim.w + 0.5);
  if (pose == 12) pose = 1;
  if (pose == 13 || pose == 14 || pose == 18) pose = 3;
  if (pose == 17) pose = 11;
  float walk = iAnim.y, work = iAnim.z, b = iBody.x;
  float run = pose == 5 || pose == 10 ? 1.0 : 0.0;
  float sw = sin(iAnim.x), cw = cos(iAnim.x);
  float t = uSimTime + iMisc.x;
  bool leg = p >= 1 && p <= 4;
  bool arm = (p >= 5 && p <= 8) || isTool(p) || p == 37;
  if (leg) {
    float side = (p == 1 || p == 3) ? 1.0 : -1.0;
    float hx = (0.052 + (b - 1.0) * 0.035) * side;
    P1 = vec3(hx, 0.5, 0.0); P2 = vec3(hx, 0.275, 0.0);
    a1 = -sw * side * (0.42 + 0.3 * run) * walk;
    a2 = (max(0.0, cw * side) * (0.85 + 0.5 * run) + 0.05) * walk + 0.03;
    if (pose == 9) { a1 = sin(t * 4.3 + side * 1.3) * 0.28 + iAnim.y * 0.4 * side; a2 = 0.25 + 0.15 * sin(t * 5.1 + side); }
    if (pose == 1 || pose == 7) { a1 += side * 0.12 * work; a2 += 0.15 * work; }
    if (pose == 15) { a1 = -1.45 + sin(iAnim.x * 0.5) * 0.04 * walk; a2 = 1.32; roll = side * 0.1; }
    return;
  }
  if (arm) {
    float side = (p == 5 || p == 7 || p == 37) ? 1.0 : -1.0;
    bool right = side < 0.0;
    float sx = (0.118 + (b - 1.0) * 0.1) * side;
    P1 = vec3(sx, 0.795, 0.0); P2 = vec3(sx + 0.008 * side, 0.637, 0.002);
    float sh = sw * side * (0.36 + 0.55 * run) * walk + sin(t * 1.7 + side) * 0.035 * (1.0 - walk) * (1.0 - work);
    float el = -0.22 - 0.18 * walk - 1.15 * run;
    bool tool = pose == 1 || pose == 2 || pose == 3 || pose == 7 || pose == 8 || pose == 11;
    if (right && tool) { sh = -0.12 + sw * 0.05 * walk; el = -2.15; }
    float sW = sh, eW = el, tW = -2.55, rW = 0.0;
    if (pose == 1) {
      float k = folkCycle(0.85);
      sW = mix(-0.55, -3.0, k); eW = mix(-0.12, -0.55, k); tW = mix(0.45, -3.25, k); rW = 0.3;
    } else if (pose == 2) {
      float k = folkCycle(0.7);
      sW = right ? mix(-1.0, -1.45, k) : mix(-0.6, -0.95, k); eW = -0.55; tW = mix(1.2, 0.7, k); rW = 0.24;
    } else if (pose == 3) {
      float k = folkCycle(1.1);
      if (right) { sW = mix(-0.8, -1.9, k); eW = mix(-0.45, -1.35, k); tW = mix(0.55, -1.3, k); } else { sW = -0.7; eW = -0.95; }
    } else if (pose == 7) {
      sW = -0.85 + 0.12 * sin(t * 2.0); eW = -0.32; tW = 1.3; rW = 0.32;
    } else if (pose == 11) {
      if (right) { sW = -1.5; eW = -0.06; tW = -1.5; } else { sW = -1.45; eW = -1.95; }
      rW = 0.18;
    } else if (pose == 8) {
      float k = folkCycle(0.8);
      sW = mix(-0.75, -1.55, k); eW = -0.5; tW = mix(1.25, -0.1, k); rW = 0.25;
    }
    sh = mix(sh, sW, work); el = mix(el, eW, work);
    roll = -side * rW * work;
    if (pose == 4) { sh = -0.42 + sw * 0.04 * walk; el = -1.18; }
    if (pose == 9) { sh = sin(t * 3.7 + side * 2.1) * 0.35 - iAnim.y * 0.6; el = -0.25 - 0.2 * sin(t * 4.4 + side); }
    if (pose == 10) { sh = -2.75 + sw * 0.08; el = -1.75; }
    if (pose == 6) { sh = -2.3 + sin(t * 3.2 + side * 1.6) * 0.5; el = -0.35 - 0.25 * sin(t * 3.2 + side); }
    if (pose == 15) { sh = right ? -0.55 : -0.5; el = right ? -1.1 : -1.15; roll = 0.0; }
    if (pose == 16) { sh = -1.55 + sin(t * 2.3 + side) * 0.06; el = -2.25 + sin(t * 5.0 + side * 2.0) * 0.08; roll = side * 0.55; }
    if (pose == 19) { sh = -1.0 + sin(t * 1.3 + side * 0.5) * 0.08; el = -0.18 - 0.06 * sin(t * 1.3); roll = side * 0.42; }
    if (pose == 20) { sh = -1.5 + sin(t * 1.8 + side * 0.4) * 0.07; el = -0.1 - 0.05 * sin(t * 1.8); roll = side * 0.22; }
    if (pose == 21) {
      float bite = 0.5 + 0.5 * sin(t * 4.6);
      sh = right ? -1.1 : -0.64;
      el = right ? mix(-0.3, -1.5, bite) : -0.84;
      roll = right ? 0.62 : -0.16;
    }
    a1 = sh; a2 = el;
    aT = mix(-2.55, tW, work);
    if (pose == 15) aT = -2.2;
  }
}

vec3 folkShape(vec3 v, int p) {
  float walk = iAnim.y, b = iBody.x;
  if (p == 34 && int(iAnim.w + 0.5) == 17) { vec3 g = vec3(-0.129, 0.437, 0.006); v = g + (v - g) * vec3(1.0, 1.1, 1.75); }
  if (p == 36 && int(iAnim.w + 0.5) == 18) { vec3 g = vec3(-0.129, 0.455, 0.006); v = g + (v - g) * vec3(1.5, 1.4, 1.85); }
  vec3 lw = transpose(mat3(instanceMatrix)) * vec3(uWind.x, 0.0, uWind.y) / dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz);
  float gust = 0.7 + 0.3 * sin(uSimTime * 3.1 + iMisc.x);
  vec3 hc = vec3(0.0, ${HY}, ${HZ});
  float hTop = ${HY+.035};
  if (p == 12) {
    v.y = hTop - (hTop - v.y) * (0.45 + 2.6 * iHair.y);
    v.xz += lw.xz * gust * 0.25 * (hTop - v.y);
    v.z -= walk * 0.06 * (hTop - v.y);
  }
  if (p == 14) { v.xz += lw.xz * gust * 0.4 * (hTop - v.y); v.z -= (hTop - v.y) * (0.2 + 0.8 * walk * abs(sin(iAnim.x))); }
  if (p == 16 && v.y < 0.895) v.y = 0.895 - (0.895 - v.y) * (0.55 + 2.2 * iHair.z);
  if (p == 22) { v.xz += lw.xz * gust * 0.35 * (0.83 - v.y); v.z -= (walk * 0.12 + 0.02 * sin(uSimTime * 2.0 + iMisc.x)) * (0.83 - v.y); }
  if ((p == 23 || p == 24 || p == 28) && v.y < 0.45) {
    float k = (0.45 - v.y);
    v.z += sin(iAnim.x) * 0.05 * walk * k;
    v.xz += lw.xz * gust * 0.12 * k;
  }
  if (p == 30 && mod(floor(iMisc.y / 1024.0), 2.0) > 0.5) {
    float up = max(0.0, v.y - ${HY+.002}), sd = v.x > 0.0 ? 1.0 : -1.0;
    v.y += up * 2.8; v.x += sd * up * 1.9; v.z -= up * 1.3;
  }
  if (p == 29) { vec3 nr = hc + vec3(0.0, 0.15 * ${HRY}, 0.76 * ${HRZ}); v = nr + (v - nr) * iShape.w; }
  if ((p >= 9 && p <= 21) || (p >= 29 && p <= 31) || (p >= 38 && p <= 40) || (p >= 51 && p <= 55) || p == 57 || p == 58 || p == 59) {
    vec3 hu = (v - hc) / vec3(${HRX}, ${HRY}, ${HRZ});
    float low = smoothstep(-0.1, -0.95, hu.y), front = smoothstep(-0.2, 0.5, hu.z);
    hu.x *= 1.0 + (iShape.z - 0.5) * 0.42 * low * front;
    hu.z += iFace.x * 0.11 * exp(-pow(hu.y + 0.85, 2.0) / 0.03) * front * (1.0 - smoothstep(0.3, 0.7, abs(hu.x)));
    hu.y -= iFace.x * 0.05 * low * front;
    hu.z += iFace.y * 0.08 * exp(-pow(hu.y - 0.3, 2.0) / 0.01) * smoothstep(0.3, 0.7, hu.z);
    hu.x += sign(hu.x) * iFace.z * 0.08 * exp(-pow(hu.y + 0.2, 2.0) / 0.08) * smoothstep(0.0, 0.5, hu.z) * smoothstep(0.1, 0.5, abs(hu.x));
    if (hu.z < 0.0) hu.z *= 1.0 + iFace.w * 0.12;
    v = hc + hu * vec3(${HRX} * iShape.x, ${HRY} * iShape.y, ${HRZ} * (0.5 + 0.5 * iShape.x));
  }
  if ((p == 0 || p == 22 || p == 23 || p == 24 || p == 28 || p == 49 || p == 50 || p == 56 || p == 60) && v.y > 0.33 && v.y < 0.82) {
    float bump = clamp(1.0 - abs(v.y - 0.64) / 0.14, 0.0, 1.0);
    v.x *= b;
    v.z = v.z * (1.0 + (b - 1.0) * 0.5) + max(0.0, v.z) * (iBody.y - 1.0) * bump;
  }
  if (p == 5 || p == 7 || p == 37) v.x += (b - 1.0) * 0.1;
  if (p == 6 || p == 8 || isTool(p)) v.x -= (b - 1.0) * 0.1;
  if (p == 1 || p == 3) v.x += (b - 1.0) * 0.035;
  if (p == 2 || p == 4) v.x -= (b - 1.0) * 0.035;
  return v;
}
`;const SETUP=`
  int fp = fPart();
  vec3 fP1, fP2; float fA1, fA2, fAT, fRoll;
  folkJoints(fp, fP1, fA1, fP2, fA2, fAT, fRoll);
  bool fDistal = fp == 3 || fp == 4 || fp == 7 || fp == 8 || isTool(fp) || fp == 37;
  mat3 fR1 = folkRot(fA1) * folkRotZ(fRoll), fR2 = fDistal ? folkRot(fA2) : mat3(1.0);
  bool fTool = isTool(fp);
  vec3 fHand = vec3(-0.129 - (iBody.x - 1.0) * 0.1, 0.455, 0.006);
  mat3 fT = fTool ? folkRot((fp >= 41 && fp <= 46 ? 0.0 : fAT) - fA1 - fA2) : mat3(1.0);
  int fPose = int(iAnim.w + 0.5);
  if (fPose == 12) fPose = 1;
  if (fPose == 13 || fPose == 14) fPose = 3;
  float fK = folkCycle(fPose == 1 ? 0.85 : 0.75);
  float fLean = iAnim.z * (fPose == 2 ? 0.3 : fPose == 1 ? 0.08 + 0.2 * (1.0 - fK) : fPose == 7 ? 0.3 : fPose == 8 ? 0.22 + 0.15 * (1.0 - fK) : 0.08) + iBody.z + (fPose == 5 ? 0.16 : 0.0);
  bool fUpper = !(fp >= 1 && fp <= 4) && fp != 23 && fp != 24 && fp != 28;
  float fTwist = fPose == 7 ? sin((uSimTime + iMisc.x) * 2.0) * 0.6 * iAnim.z : 0.0;
  mat3 fRL = fUpper ? folkRot(fLean) * folkRotY(fTwist) : mat3(1.0);
`;const POSE=`
  vec3 fRest = transformed;
  transformed = folkShape(transformed, fp);
  if (fTool) transformed = fHand + fT * (transformed - fHand);
  transformed = fP2 + fR2 * (transformed - fP2);
  transformed = fP1 + fR1 * (transformed - fP1);
  transformed = vec3(0.0, 0.52, 0.0) + fRL * (transformed - vec3(0.0, 0.52, 0.0));
  transformed.y += (abs(cos(iAnim.x)) - 0.5) * 0.016 * iAnim.y;
  if (folkVis(fp) < 0.5) transformed = vec3(0.0, 0.6, 0.0);
`;const VARY=`
  vObj = transformed; vSlot = float(fSlot());
  vHeadU = fp == 9 ? (fRest - vec3(0.0, ${HY}, ${HZ})) / vec3(${HRX}, ${HRY}, ${HRZ}) : vec3(-9.0);
  vHairCol = unpackCol(iCols.w);
  vFace = mod(iMisc.y, 128.0); vFx = floor(iMisc.y / 128.0);
  vWXZ = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xz;
`;const FACE_GLSL=`
float fHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
vec3 paintFace(vec3 skin, vec3 hu, float cell, float fx, vec3 hair) {
  vec3 col = skin;
  float front = smoothstep(0.05, 0.45, hu.z);
  float freck = mod(fx, 2.0), stub = mod(floor(fx / 2.0), 2.0), old = mod(floor(fx / 4.0), 2.0);
  if (stub > 0.5 && hu.y < -0.28 && hu.z > -0.2) col *= 0.84 + 0.1 * fHash(vec3(floor(hu * 70.0)));
  if (freck > 0.5 && hu.y > -0.35 && hu.y < 0.08 && abs(hu.x) < 0.7 && hu.z > 0.2 && fHash(vec3(floor(hu * 55.0)) + 2.0) > 0.86) col *= 0.82;
  if (old > 0.5) {
    float fl = abs(fract(hu.y * 30.0) - 0.5);
    if (hu.y > 0.42 && hu.y < 0.62 && abs(hu.x) < 0.45 && hu.z > 0.4 && fl < 0.1) col *= 0.88;
    if (hu.y > 0.02 && hu.y < 0.22 && abs(abs(hu.x) - 0.66) < 0.07 && fl < 0.14) col *= 0.9;
  }
  if (front <= 0.0) return col;
  vec2 uv = vec2((hu.x + 1.1) / 2.2, (hu.y + 1.05) / 2.0);
  if (uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) return col;
  float cx = mod(cell, 8.0), cy = floor(cell / 8.0 + 0.01);
  vec2 t = vec2((cx + uv.x) / 8.0, (${FACES-1}.0 - cy + uv.y) / ${FACES}.0);
  vec4 f = texture2D(uFaces, t);
  float br = texture2D(uBrows, t).r;
  col = mix(col, col * vec3(1.0, 0.7, 0.66), f.g * 0.7 * front);
  col = mix(col, vec3(0.9, 0.88, 0.84), f.b * front);
  col *= mix(1.0, f.r, front);
  col = mix(col, hair * 0.8, br * front);
  return col;
}
`;function bodyMaterial(quality){const mat=quality.name==="low"?new THREE.MeshLambertMaterial({vertexColors:true}):new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82,metalness:0});mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,FOLK_U,{uTint:SEASON_U.uTint,uWind:SEASON_U.uWind,uClouds:SEASON_U.uClouds,uCloudN:SEASON_U.uCloudN});sh.vertexShader=LIMBS+sh.vertexShader.replace("#include <beginnormal_vertex>",`#include <beginnormal_vertex>
        ${SETUP}
        objectNormal = fRL * (fR1 * (fR2 * (fT * objectNormal)));`).replace("#include <begin_vertex>","#include <begin_vertex>\n"+POSE+VARY).replace("#include <color_vertex>",`#include <color_vertex>
        { int s = fSlot();
          if (s == 1) vColor.rgb *= unpackCol(iCols.x);
          else if (s == 2) vColor.rgb *= unpackCol(iCols.y);
          else if (s == 3) vColor.rgb *= unpackCol(iCols.z);
          else if (s == 4) vColor.rgb *= unpackCol(iCols.w);
          else if (s == 5) vColor.rgb = glowCol() * (0.88 + 0.12 * sin(uSimTime * 3.0 + iMisc.x * 7.0));
          if (fPart() == 24 && int(iBody.w + 0.5) == 3) vColor.rgb = unpackCol(iCols.z) * 0.9; }`);sh.fragmentShader="uniform vec3 uTint;\nuniform sampler2D uFaces;\nuniform sampler2D uBrows;\nvarying vec3 vHeadU; varying float vFace; varying float vFx; varying vec3 vObj; varying float vSlot; varying vec2 vWXZ; varying vec3 vHairCol;\n"+CLOUD_GLSL+FACE_GLSL+sh.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
          float fW = 1.0 - smoothstep(0.0015, 0.004, length(fwidth(vObj)));
          if (vSlot > 1.5 && vSlot < 3.5) diffuseColor.rgb *= 1.0 + (fHash(floor(vObj * 260.0)) - 0.5) * 0.12 * fW;
          diffuseColor.rgb *= mix(0.8, 1.0, smoothstep(0.0, 0.55, vObj.y));
          if (vHeadU.x > -5.0) diffuseColor.rgb = paintFace(diffuseColor.rgb, vHeadU, vFace, vFx, vHairCol);
          if (abs(vSlot - 4.0) < 0.5) {
            float fa = atan(vObj.x, vObj.z - ${HZ});
            diffuseColor.rgb *= 1.0 + (fHash(vec3(floor(fa * 70.0), floor(vObj.y * 40.0), 3.0)) - 0.5) * 0.3 * fW;
          }
          diffuseColor.rgb *= uTint;`).replace("#include <emissivemap_fragment>",`#include <emissivemap_fragment>
          if (abs(vSlot - 5.0) < 0.5) totalEmissiveRadiance += diffuseColor.rgb * 1.6;`).replace("#include <lights_fragment_end>",`#include <lights_fragment_end>
          float fCloud = cloudShade(vWXZ);
          reflectedLight.directDiffuse *= fCloud;
          reflectedLight.directSpecular *= fCloud;`)};mat.customProgramCacheKey=()=>"folk5-body-"+quality.name;return mat}function outlineMaterial(){const mat=new THREE.MeshBasicMaterial({color:1905935,side:THREE.BackSide});mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,FOLK_U,{uWind:SEASON_U.uWind});sh.vertexShader=LIMBS+"uniform vec2 uRes;\nuniform float uOutlinePx;\n"+sh.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
        ${SETUP}
        ${POSE}
        if (fp == 17 || fp == 29 || fp == 30 || fSlot() == 5) transformed = vec3(0.0, 0.6, 0.0);`).replace("#include <project_vertex>",`#include <project_vertex>
        vec3 fN = normalMatrix * (mat3(instanceMatrix) * (fRL * (fR1 * (fR2 * (fT * normal)))));
        vec2 fC = (projectionMatrix * vec4(fN, 0.0)).xy;
        float fL = length(fC);
        float fW0 = (projectionMatrix * modelViewMatrix * instanceMatrix * vec4(0.0, 0.5, 0.0, 1.0)).w;
        float fPx = length(instanceMatrix[0].xyz) * projectionMatrix[1][1] * uRes.y * 0.5 / fW0;
        float fWide = uOutlinePx * smoothstep(16.0, 60.0, fPx);
        if (fWide < 0.05) gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
        else if (fL > 1e-5) gl_Position.xy += fC / fL * fWide * 2.0 / uRes * gl_Position.w;`)};mat.customProgramCacheKey=()=>"folk5-outline";return mat}function depthMaterial(){const mat=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});mat.onBeforeCompile=sh=>{Object.assign(sh.uniforms,FOLK_U,{uWind:SEASON_U.uWind});sh.vertexShader=LIMBS+sh.vertexShader.replace("#include <begin_vertex>",`#include <begin_vertex>
      ${SETUP}
      ${POSE}`)};mat.customProgramCacheKey=()=>"folk5-depth";return mat}function makeFaces(){const S=CELL,W=S*8,Hh=S*FACES;const mk=()=>{const c=document.createElement("canvas");c.width=W;c.height=Hh;return c};const ca=mk(),cb=mk(),g=ca.getContext("2d"),gb=cb.getContext("2d");g.fillStyle="rgb(255,0,0)";g.fillRect(0,0,W,Hh);gb.fillStyle="#000";gb.fillRect(0,0,W,Hh);const kx=S/2.2,ky=S/2;const ink=a=>`rgb(${Math.round(255*(1-a))},0,0)`,WHITE="rgb(255,0,255)";for(let row=0;row<FACES;row++){const r=k=>rhash(row*97+5,k);const ex=.38+r(1)*.08;const ew=.15+r(2)*.05,eh=.035+r(3)*.02;const lid=r(4),tilt=(r(5)-.5)*.12;const bw=1.6+r(6)*2.2,barch=r(7)*.06,by0=.29+r(8)*.04;const mw=.2+r(9)*.1,lip=.02+r(10)*.03;const folds=r(11)>.55;for(let m=0;m<8;m++){const ox=m*S,oy=row*S;const X=u=>ox+(u+1.1)*kx,Y=u=>oy+(.95-u)*ky;for(const c of[g,gb]){c.save();c.beginPath();c.rect(ox,oy,S,S);c.clip()}const curve=(c,pts,w,style)=>{c.beginPath();c.moveTo(X(pts[0]),Y(pts[1]));for(let i=2;i<pts.length;i+=4)c.quadraticCurveTo(X(pts[i]),Y(pts[i+1]),X(pts[i+2]),Y(pts[i+3]));c.strokeStyle=style;c.lineWidth=w;c.lineCap="round";c.stroke()};const blob=(c,x,y,rx,ry,fill)=>{c.beginPath();c.ellipse(X(x),Y(y),rx*kx,ry*ky,0,0,Math.PI*2);c.fillStyle=fill;c.fill()};const warm=m===HAPPY?140:m===COLD?220:60;for(const sx of[-1,1]){const gr=g.createRadialGradient(X(sx*.5),Y(-.18),0,X(sx*.5),Y(-.18),.28*kx);gr.addColorStop(0,`rgba(255,${warm},0,1)`);gr.addColorStop(1,"rgba(255,0,0,0)");g.fillStyle=gr;g.fillRect(X(sx*.5)-.3*kx,Y(-.18)-.3*ky,.6*kx,.6*ky)}for(const sx of[-1,1])blob(g,sx*.08,-.34,.035,.018,ink(.55));for(const sx of[-1,1]){const cxe=sx*ex,cye=.13;let h=eh;if(m===TIRED)h*=.55;if(m===SCARED)h*=1.6;if(m===FOCUSED)h*=.75;if(m===HAPPY){curve(g,[cxe-ew,cye-.005,cxe,cye+.045,cxe+ew,cye-.005],2.2,ink(.85))}else{g.beginPath();g.moveTo(X(cxe-ew),Y(cye+tilt*sx*-.5));g.quadraticCurveTo(X(cxe),Y(cye+h*1.6),X(cxe+ew),Y(cye-tilt*sx*-.5));g.quadraticCurveTo(X(cxe),Y(cye-h*1.3),X(cxe-ew),Y(cye+tilt*sx*-.5));g.fillStyle=WHITE;g.fill();const ir=Math.min(.075,h*1.9);blob(g,cxe-sx*.01,cye-.004,ir,ir*.66,ink(.9));curve(g,[cxe-ew-.02,cye+tilt*sx*-.5,cxe,cye+h*1.6+.012,cxe+ew+.02,cye-tilt*sx*-.5],1.6+lid,ink(.92));curve(g,[cxe-ew*.8,cye+h*1.6+.05+lid*.02,cxe,cye+h*1.6+.07+lid*.02,cxe+ew*.8,cye+h*1.6+.04],.9,ink(.25))}const inner=sx*.12,outer=sx*(ex+ew+.05);let iy=by0,oyb=by0-.01,my2=by0+barch;if(m===SAD||m===COLD){iy+=.05;oyb-=.03}if(m===SCARED){iy+=.06;oyb+=.05;my2+=.06}if(m===FOCUSED){iy-=.05;oyb+=.01}if(m===TIRED){iy-=.015;oyb-=.03}if(m===HAPPY)my2+=.025;curve(gb,[inner,iy,(inner+outer)/2,my2,outer,oyb],bw,"#fff")}if(folds)for(const sx of[-1,1])curve(g,[sx*.2,-.3,sx*.3,-.4,sx*.3,-.56],1,ink(.2));const my=-.52;if(m===HAPPY){g.beginPath();g.moveTo(X(-mw-.03),Y(my+.03));g.quadraticCurveTo(X(0),Y(my-.12),X(mw+.03),Y(my+.03));g.quadraticCurveTo(X(0),Y(my-.02),X(-mw-.03),Y(my+.03));g.fillStyle=WHITE;g.fill();curve(g,[-mw-.03,my+.03,0,my-.12,mw+.03,my+.03],1.6,ink(.75))}else if(m===SCARED){blob(g,0,my-.02,mw*.45,.07,"rgb(70,190,0)")}else{const lift=m===CONTENT?.035:m===SAD?-.05:m===COLD?-.015:0;const w=m===FOCUSED?mw*.85:mw;g.fillStyle=`rgb(255,${m===COLD?70:160},0)`;g.beginPath();g.ellipse(X(0),Y(my-.02),w*.75*kx,(lip+.012)*ky,0,0,Math.PI);g.fill();g.beginPath();g.ellipse(X(0),Y(my+.012),w*.8*kx,.018*ky,0,Math.PI,Math.PI*2);g.fill();curve(g,[-w,my+lift,0,my-(m===CONTENT?.02:.005),w,my+lift],m===FOCUSED?1.8:1.4,ink(.7))}for(const c of[g,gb])c.restore()}}const tex=c=>{const t=new THREE.CanvasTexture(c);t.anisotropy=4;return t};return[tex(ca),tex(cb)]}const SKINS=[[.96,.82,.7],[.92,.75,.6],[.84,.64,.48],[.72,.52,.37],[.58,.4,.28],[.44,.3,.21]];const TUNICS=[[.58,.2,.15],[.32,.4,.22],[.5,.38,.24],[.24,.33,.5],[.76,.67,.47],[.48,.21,.32],[.6,.48,.17],[.38,.35,.31],[.21,.4,.4],[.68,.43,.22],[.42,.48,.58],[.54,.56,.38]];const CLOTHS=[[.33,.26,.19],[.25,.23,.21],[.41,.34,.25],[.23,.27,.21],[.3,.3,.35],[.46,.41,.31],[.37,.23,.19]];const HAIRS=[[.08,.06,.05],[.2,.12,.07],[.32,.2,.1],[.46,.28,.13],[.58,.26,.11],[.74,.57,.31],[.86,.75,.5]];const GREY=[.8,.79,.77];const mixc=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];const pack=c=>Math.round(c[0]*255)*65536+Math.round(c[1]*255)*256+Math.round(c[2]*255);const HELD={staff:1,wand:2,hammer:3};const HERIT={2:0,3:1,11:2,12:3,13:4,14:5,31:6,32:7,33:8,34:9,18:10,19:11,15:12,16:13};function genome(p,years,kc=-1,look=null){const r0=k=>rhash(p.id*7919+p.look*31+17,k),G=p.genes;const r=G?k=>HERIT[k]!==void 0?G[HERIT[k]]:r0(k):r0;const pick=(list,k)=>list[Math.min(list.length-1,r(k)*list.length|0)];const a=p.sex?p.sex==="m":r(0)<.5;const yrs=years??18+r(1)*50;const age=Math.min(1,Math.max(0,(yrs-15)/55)),elder=yrs>56,child=yrs<15;let hair=pick(HAIRS,3);if(yrs>40)hair=mixc(hair,GREY,Math.min(1,(yrs-40)/24)*(.6+r(4)*.4));const s=r(6);const style=a?elder&&s<.45?s<.15?5:4:s<.48?0:s<.7?6:s<.82?7:s<.92?1:3:s<.38?1:s<.62?2:s<.76?3:s<.9?7:6;const beard=a&&yrs>=17&&r(8)<(elder?.75:.42)?.06+r(9)*(elder?.94:.55):0;const dress=a?r(5)<.06:r(5)<.82;const skin=pick(SKINS,2);const fx=(r(27)<(skin[0]>.85?.22:child?.3:.06)?1:0)+(a&&!beard&&yrs>=17&&r(28)<.35?2:0)+(yrs>50?4:0);const g={cols:[pack(skin),pack(p.role==="priest"?p.high?[.86,.68,.3]:[.92,.9,.84]:p.kit&&p.kit.armour==="mail"?[.56,.58,.62]:p.kit&&p.kit.armour==="leather"?[.42,.28,.16]:p.kit&&p.kit.padded?[.7,.6,.42]:pick(TUNICS,20)),pack(p.role==="priest"?p.high?[.92,.9,.84]:[.86,.68,.3]:kc>=0?KINGDOM_RGB[kc%KINGDOM_RGB.length]:pick(CLOTHS,21)),pack(hair)],shape:[.9+r(11)*.2,.92+r(12)*.16,a?.35+r(13)*.65:r(13)*.6,(elder?.95:.75)+r(14)*.55],facev:[r(31)*2-1,(a?.3:0)+r(32)*.7,elder?-.4-r(33)*.6:r(33)*2-1,r(34)*2-1],hairv:[style,.15+r(7)*.85,beard,a&&(beard>0?r(10)<.65:r(10)<.16)?1:0],body:[.88+r(15)*.3,.92+r(16)*(a?.6:.35),elder?.06+r(17)*.12:0,p.role==="priest"?2:dress?r(29)<.45?2:1:0],face:(r(18)*FACES|0)*8,fx,height:child?.5+.5*Math.max(0,yrs)/15:(a?1:.95)+r(19)*.1-(elder?.03:0),years:yrs,hatty:r(22)<.3,coif:!a&&dress&&r(30)<.38,cloaky:r(23),hoody:r(24)<.05,sunny:r(25),t0:r(26)*13};if(p.role==="wizard"){g.cols[1]=pack([.2,.26,.56]);g.cols[2]=pack([.17,.15,.38]);g.body[3]=1;g.hatAll=5;g.cloakAll=true;g.hoody=false;g.coif=false;g.held="staff";g.glow=pack([.62,.82,1]);if(a&&yrs>=20){g.hairv[2]=Math.max(g.hairv[2],.85);g.hairv[3]=1}}if(p.role==="priest"&&!look){g.hatAll=9;g.held="staff";g.glow=pack(p.high?[1,.78,.3]:[1,.88,.5]);g.cloakAll=true;g.hoody=false;g.coif=false;g.body[3]=1}if(look)try{look(g,{r,male:a,years:yrs,child,elder,soldier:kc>=0||!!(p.kit&&p.kit.armour),priest:p.role==="priest",id:p.id,role:p.role,vet:p.vet||0,pack,mixc,GREY})}catch(e){if(!look.warned){look.warned=true;console.warn("a people's looks",e)}}g.held=HELD[g.held]??Math.max(0,Math.min(3,g.held|0));let gi=0;if(g.glow){const f=g.glow|0;g.glowRGB=[(f>>16&255)/255,(f>>8&255)/255,(f&255)/255];let bd=9;GLOWS.forEach((c,k)=>{const d=(c[0]-g.glowRGB[0])**2+(c[1]-g.glowRGB[1])**2+(c[2]-g.glowRGB[2])**2;if(d<bd){bd=d;gi=k}})}g.kitz=4*g.held+16*(g.plate?1:0)+32*(g.pendant?1:0)+64*gi;return g}function mood(p,gm){if(p.state==="dance")return HAPPY;if(p.state==="flee"||p.fear>.55)return SCARED;if(p.health<.55||p.hunger>.8||(p.mood??.6)<.25)return SAD;if(p.cold>.45)return COLD;if(p.fatigue>.8)return TIRED;if(p.state==="work")return FOCUSED;if((p.mood??.6)>.85||p.hunger<.2&&p.fatigue<.3&&gm.sunny>.55)return HAPPY;return gm.sunny>.3?CONTENT:NEUTRAL}function logBundle(){const parts=[];for(const[y,z]of[[0,-.024],[0,.024],[.04,0]])parts.push(new THREE.CylinderGeometry(.022,.022,.27,7).rotateZ(Math.PI/2).translate(0,y,z));return mergeGeometries(parts)}function sack(){return mergeGeometries([new THREE.SphereGeometry(.075,9,7).scale(1,1.1,.8),new THREE.CylinderGeometry(.02,.032,.04,6).translate(0,.085,0)])}const C=new THREE.Color;const roomAt=i=>Math.ceil((i+1)*1.25/256)*256;function grown(a,cap){const b=new THREE.InstancedBufferAttribute(new Float32Array(cap*a.itemSize),a.itemSize);b.array.set(a.array);b.setUsage(a.usage);return b}function roomFor(mesh,i){if(i<mesh.instanceMatrix.count)return;const cap=roomAt(i);mesh.instanceMatrix=grown(mesh.instanceMatrix,cap);if(mesh.instanceColor)mesh.instanceColor=grown(mesh.instanceColor,cap)}const ATTR={anim:"iAnim",misc:"iMisc",shape:"iShape",face:"iFace",hair:"iHair",body:"iBody",cols:"iCols"};function roomForLod(L,i){if(i<L.cap)return;const cap=roomAt(i),geo=L.body.geometry;for(const[k,a]of Object.entries(L.a)){const b=grown(a,cap);geo.setAttribute(ATTR[k],b);L.a[k]=b}L.body.instanceMatrix=L.outline.instanceMatrix=grown(L.body.instanceMatrix,cap);L.cap=cap}const POSES={P_EAT,P_RIDE,P_NONE,P_AXE,P_DIG,P_HAMMER,P_CARRY,P_RUN,P_DANCE,P_REAP,P_SHOVEL,P_LIMP,P_COVER,P_BOW,P_PICK,P_SWORD,P_SWORDSHIELD};const MOODS={CONTENT,NEUTRAL,TIRED,SAD,SCARED,FOCUSED,HAPPY,COLD};export{FACES,FOLK_U,HAND,MOODS,POSES,bodyMaterial,figure,genome,makeFaces,mood,outlineMaterial,pack};

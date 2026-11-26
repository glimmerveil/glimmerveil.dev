import*as THREE from"three";const SEASON_U={uTint:{value:new THREE.Color(1,1,1)},uWind:{value:new THREE.Vector2},uClouds:{value:Array.from({length:16},()=>new THREE.Vector4)},uCloudN:{value:0}};const CLOUD_GLSL=`
uniform vec4 uClouds[16];
uniform int uCloudN;
float cloudShade(vec2 p) { return 1.0; }
`;function rhash(i,k=0){let h=Math.imul(i^2654435769,2246822507)^Math.imul(k+668265261,3266489909);h=Math.imul(h^h>>>15,739982445);h^=h>>>13;return(h>>>0)/4294967296}const KINGDOM_HEX=["#d9a530","#c0392b","#2e86de","#27ae60","#8e44ad","#e67e22","#16a085","#d35480"];const KINGDOM_RGB=KINGDOM_HEX.map(h=>[1,3,5].map(k=>parseInt(h.slice(k,k+2),16)/255));export{CLOUD_GLSL,KINGDOM_RGB,SEASON_U,rhash};

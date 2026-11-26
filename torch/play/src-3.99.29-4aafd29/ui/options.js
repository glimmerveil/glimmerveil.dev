function createOptions({el,get,set,actions,version,packs=null}){const pick=(label,key,vals,cur)=>`<div class="opt"><span>${label}</span><div>${vals.map(([v,name])=>`<button class="tb ${String(cur)===String(v)?"main":""}" data-k="${key}" data-v="${v}">${name}</button>`).join("")}</div></div>`;const step=(label,key,shown)=>`<div class="opt"><span>${label}</span><div><button class="tb" data-k="${key}" data-v="-1" title="Less">\u2212</button><b class="opt-n">${shown}</b><button class="tb" data-k="${key}" data-v="1" title="More">+</button></div></div>`;const pct=v=>`${Math.round(v*100)}%`;function render(){const o=get(),A=actions();el.innerHTML=`<h2>OPTIONS</h2>
      <h3>Graphics</h3>
      ${pick("Quality","gfx",[["lite","Lite"],["low","Low"],["high","High"]],o.gfx)}
      <p class="dim small">Lite is the lightest on the machine (phones): simpler shields and worlds, no glow. Low is the whole look, glow and full shields. High adds the detail: every gun, pod and engine sculpted.</p>
      ${pick("Frame rate","fps",[[0,"Hidden"],[1,"Shown"]],o.fps?1:0)}
      ${pick("Full screen","full",[[1,"On"],[0,"Off"]],o.full?1:0)}
      <p class="dim small">Alt+Enter goes into full screen and out of it. Esc stays the game's key there (in Chrome and Edge; hold Esc down for the browser's own way out).</p>
      ${pick("Ships","view",[["inside","Inside: decks and crew"],["roof","Roof on"]],o.view)}
      <h3>Controls</h3>
      ${pick("Flying","style",[["relaxed","Relaxed"],["direct","Direct"]],o.style)}
      <p class="dim small">Relaxed: its captain flies, you give orders (double-click or right-click). Direct: you fly it with WASD and the mouse.</p>
      <h3>Sound</h3>
      ${pick("Music","musicOn",[[1,"On"],[0,"Off"]],o.musicOn?1:0)}
      ${step("Music volume","music",pct(o.music))}
      ${pick("Sounds","sfxOn",[[1,"On"],[0,"Off"]],o.sfxOn?1:0)}
      ${step("Sounds volume","sfx",pct(o.sfx))}
      <h3>Size</h3>
      ${step("Windows and text","ui",pct(o.ui))}
      <h3>Campaign</h3>
      <div class="mbtns">${A.canSave?'<button class="tb" data-a="save">Save</button>':""}<button class="tb" data-a="load">Load</button></div>
      ${packs?packs.html():""}
      <p class="dim small">Esc options \xB7 Alt+Enter full screen \xB7 Space pause \xB7 M the sector \xB7 B drydock \xB7 Tab fleet command \xB7 I roof off \xB7 H controls and keys \xB7 [ ] speed</p>
      <div class="mbtns"><button class="tb main" data-a="close">${A.inFight?"Back to the fight":"Close"}</button><button class="tb" data-a="help">Controls and keys</button>${A.canTitle?'<button class="tb" data-a="title">Title menu</button>':""}${window.GK_SHELL?.quit?'<button class="tb" data-a="quit">Quit</button>':""}</div>
      <p class="dim small">Project Torch ${version} \xB7 \xA9 2026 Glimmerveil. All rights reserved. three.js (MIT), Trystero (MIT).</p>`;packs?.bind(el,()=>{if(el.parentElement.classList.contains("show"))render()})}el.addEventListener("click",e=>{const b=e.target.closest("button");if(!b||b.dataset.pk)return;if(b.dataset.a){actions().run(b.dataset.a);return}const k=b.dataset.k,v=b.dataset.v,o=get();if(k==="music"||k==="sfx"||k==="ui")set(k,Math.round((o[k]+Number(v)*.1)*100)/100);else if(k==="fps"||k==="full"||k==="musicOn"||k==="sfxOn")set(k,v==="1");else set(k,v);setTimeout(render,k==="full"?300:0)});return{show(){render();el.parentElement.classList.add("show")},hide(){el.parentElement.classList.remove("show")},refresh(){if(this.open)render()},get open(){return el.parentElement.classList.contains("show")}}}export{createOptions};

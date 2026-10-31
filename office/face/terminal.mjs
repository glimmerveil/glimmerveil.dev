// THE TERMINAL (Bishop, 10-31: "a smaller version that can log in… that lets someone with a slow phone log into the world
// without needing to run pixie and the main juice of it all… terminal phone is key, this replace remote"). The room as words:
// who is here, what is said, one line to type (the phone's own keyboard is his voice). No Pixie, no 3D, no kernel: the house
// checks every line; this page only signs its own and shows everyone's.
//   ?seed=office&place=park            over the house's own address (the tailnet), or
//   #room=<code>                       browser to browser through the room's code (no address, no app: face/p2p.mjs). The
//                                      code rides after the #, which is never sent to any server; this page never stores it:
//                                      the bookmark is the key (Haiku, deploy review: ?room= reached the site's logs)
// Its key is made HERE, once, and never leaves this browser: WebCrypto Ed25519 with the private half NOT extractable, kept in
// this browser's IndexedDB. Paired once (the house's owners list), its words move the seats; unpaired it can only talk.
import { houseRemote, peerGuest } from './remote.mjs';
import { canonical, keyId, pubOf } from '../engine/keys.mjs';

const $ = s => document.querySelector(s), q = new URLSearchParams(location.search);
const PLACE = q.get('place') || 'park', MOST_SAY = 400;
const store = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
try { localStorage.removeItem('dream-terminal-room'); } catch {}          // (a code kept by an older page: never kept now)
// a page served by the house itself talks to it over its address; a page served anywhere else (glimmerveil.dev/office) finds
// the house only by the room's code, from the address after # (or asked for, then put there, so a bookmark keeps it)
const AT_HOUSE = q.get('seed') || /^\/face\//.test(location.pathname);
const clean = c => { const x = String(c || '').toLowerCase().replace(/[^a-z0-9]/g, ''); return x.length >= 8 && x.length <= 64 ? x : null; };
let ROOM = null;
if (!AT_HOUSE) {
  const fromUrl = new URLSearchParams(location.hash.slice(1)).get('room') || q.get('room');   // (?room= still taken, once, then moved after the #)
  ROOM = clean(fromUrl);
  for (let i = 0; !ROOM && i < 2; i++) ROOM = clean(prompt(fromUrl ? 'That room code does not look right. The room code?' : 'The room code?'));
  if (ROOM) { q.delete('room'); history.replaceState(null, '', `${location.pathname}${[...q].length ? `?${q}` : ''}#room=${ROOM}`); }
}
// who this phone says it is, asked once (Haiku 10-31: every phone arrived as "Bishop"); a name is shown, never trusted: the key is who
function nameOf() {                                                      // asked twice at most; a browser that will not ask gets a guest's name (Haiku r3: it spun)
  let n = (q.get('name') || store.get('dream-terminal-name') || '').trim().slice(0, 32);
  for (let i = 0; !n && i < 2; i++) n = (prompt('Your name in the room?') || '').trim().slice(0, 32);
  if (!n) n = `guest ${Math.random().toString(36).slice(2, 6)}`; store.set('dream-terminal-name', n); return n;
}
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));

// ---- this phone's key: made once, kept here, the private half never readable (not even by this page) ----
function idb() { return new Promise((res, rej) => { const r = indexedDB.open('dream-terminal', 1); r.onupgradeneeded = () => r.result.createObjectStore('keys'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
const idbGet = (db, k) => new Promise((res, rej) => { const r = db.transaction('keys').objectStore('keys').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const idbPut = (db, k, v) => new Promise((res, rej) => { const t = db.transaction('keys', 'readwrite'); t.objectStore('keys').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); });
async function myKey() {
  const db = await idb(); let k = await idbGet(db, 'me');
  if (!k) {
    const pair = await crypto.subtle.generateKey({ name: 'Ed25519' }, false, ['sign', 'verify']);   // false: the private key is never exported
    const pub = b64(await crypto.subtle.exportKey('raw', pair.publicKey));
    k = { id: keyId(pub), pub, privateKey: pair.privateKey }; await idbPut(db, 'me', k);
  }
  return k;
}
async function signed(key, line) {
  const l = { ...line, by: key.id };
  const sig = await crypto.subtle.sign({ name: 'Ed25519' }, key.privateKey, new TextEncoder().encode(canonical(l)));
  return { ...l, sig: b64(sig) };
}

// ---- the room as words ----
const names = new Map(), seen = new Set();
// two counts, never one (Haiku 10-31: one count doing both skipped lines and looped): `seq` is how far this page has
// RECEIVED the room (it moves only as lines arrive, shown or not); `houseAt` is the house's own count, to number a new line
let seq = 0, houseAt = 0, seed = q.get('seed') || 'glimmerveil', recheck = () => {};
const log = $('#log');
function show(who, text, cls = '') {
  const near = log.scrollTop + log.clientHeight >= log.scrollHeight - 40;
  const p = document.createElement('p'); p.className = cls;
  const b = document.createElement('b'); b.textContent = who; p.append(b, document.createTextNode(` ${text}`));   // text, never HTML: nobody's words run here
  log.append(p); while (log.children.length > 600) log.firstChild.remove();
  if (near) log.scrollTop = log.scrollHeight;
}
const pubs = new Map();                                                 // each key imported once (Haiku r3: a long room took seconds a line)
async function signedBy(l) {
  try {
    let k = pubs.get(l.by);
    if (!k) { const p = pubOf(l.by); if (!p) return false; k = await crypto.subtle.importKey('raw', Uint8Array.from(atob(p), c => c.charCodeAt(0)), { name: 'Ed25519' }, false, ['verify']); pubs.set(l.by, k); }
    return typeof l.sig === 'string' && await crypto.subtle.verify({ name: 'Ed25519' }, k, Uint8Array.from(atob(l.sig), c => c.charCodeAt(0)), new TextEncoder().encode(canonical(l)));
  } catch { return false; }
}
let taking = Promise.resolve();
const take = (lines, me) => { const run = () => takeNow(lines, me); taking = taking.then(run, run); return taking; };   // one at a time: a line is never shown twice
const sigAt = new Map();                                                 // each received line's signature by its seq (the last 200): a restored house is a different history
const bad = new Set();                                                   // lines that failed their signature: never checked again
async function takeNow(lines, me) {
  const many = lines.length > 50; let i = 0, fresh = 0;
  for (const l of lines) {
    if (many && ++i % 200 === 0) $('#status').textContent = `reading the room… ${i} of ${lines.length}`;
    if (!l || !Number.isInteger(l.seq) || l.seq < 1 || seen.has(l.seq) || typeof l.by !== 'string' || bad.has(`${l.seq}:${l.sig}`)) continue;
    if (!(await signedBy(l))) { bad.add(`${l.seq}:${l.sig}`); continue; }   // signed first, THEN counted (Haiku: a forged line marked first could hide the real one)
    if (seen.has(l.seq)) continue;                                       // (taken meanwhile: takes are one at a time, but be sure)
    seen.add(l.seq); seq = Math.max(seq, l.seq); houseAt = Math.max(houseAt, l.seq); fresh++;
    sigAt.set(l.seq, l.sig); if (sigAt.size > 200) sigAt.delete(sigAt.keys().next().value);
    const d = l.data || {};
    if (l.act === 'arrive') { names.set(l.by, d.name || 'someone'); if (l.by !== me.id) show(d.name || 'someone', 'is here.', 'quiet'); }
    else if (l.act === 'say') show(names.get(l.by) || 'someone', d.text, l.by === me.id ? 'mine' : '');
    else if (l.act === 'leave') show(names.get(l.by) || 'someone', 'left.', 'quiet');
  }
  if (lines.length && !fresh) await new Promise(res => setTimeout(res, 2000));   // nothing new in a non-empty batch: a breath, never a spin
}

async function main() {
  $('#forget').onclick = () => { history.replaceState(null, '', location.pathname); location.reload(); };   // the code leaves the address; the bookmark is his to delete
  if (!AT_HOUSE && !ROOM) { $('#status').textContent = 'no room code: open the link you were given (it ends #room=…)'; return; }   // (no key is made for a page with no room)
  const me = await myKey();
  $('#key').textContent = me.id; $('#copy').onclick = () => navigator.clipboard?.writeText(me.id);
  let remote;
  if (ROOM) {
    $('#status').textContent = 'finding the house through the room…';
    let g; try { g = await peerGuest(ROOM, { wait: 45000, onLost: () => { $('#status').textContent = 'the house dropped away: waiting for it…'; }, onBack: () => { $('#status').textContent = 'here'; setTimeout(() => recheck(), 3000); } }); }
    catch { $('#status').textContent = 'could not find the house: a wrong code, the house asleep, or this network blocks it (on cellular, try Wi-Fi)'; return; }
    seed = g.seed; remote = g;
  } else {
    remote = houseRemote(seed);
    const h = await fetch(`/host?seed=${encodeURIComponent(seed)}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({}));
    if (h.doorway && h.doorway !== 'open') show('the house', `the doorway is ${h.doorway}: words here reach nobody until it opens`, 'quiet');
  }
  await take(await remote.lines(0), me);
  const send = async (act, data) => {
    for (let i = 0; i < 20; i++) {
      const want = Math.max(seq, houseAt) + 1;                            // the line's own number (Bishop 10-31: the room's echo came first and it was counted twice)
      const r = await remote.send(await signed(me, { world: seed, seq: want, act, data }));
      if (r.status === 200) { houseAt = Math.max(houseAt, want); return r; }   // its echo moves what this page has received, not this
      if (r.status === 409) {                                             // out of step: the house says where the world is
        const at = /world is at (\d+)/.exec(r.why || '') || (Number.isInteger(r.seq) ? [0, r.seq] : null);
        // the house is behind what this page has seen, or its history is not the one this page saw (restored, then grown back
        // past this page's count): read the room again (whatever is in the box is kept for after)
        const theirs = at && +at[1] >= seq && seq > 0 && sigAt.has(seq) ? (await remote.lines(seq - 1)).find(l => l && l.seq === seq) : null;
        if ((at && +at[1] < seq) || (theirs && theirs.sig !== sigAt.get(seq))) {
          show('the house', 'the house went back in time (restored): reading the room again', 'quiet');
          try { sessionStorage.setItem('dream-terminal-unsent', $('#say').value || data.text || ''); } catch {}
          setTimeout(() => location.reload(), 1500);
          return { status: 409, why: 'the house was restored: the room is being read again' };
        }
        if (at && +at[1] <= seq + 100000) houseAt = +at[1];               // (a count that leaps past all reason is not taken)
        await take(await remote.lines(seq), me);                          // from what this page has received, so the line that came first is shown too
        await new Promise(res => setTimeout(res, 50 + Math.random() * 250));   // a busy room: a breath before the next try
        continue;
      }
      return r;
    }
    return { status: 409, why: 'the room kept moving' };
  };
  let inRoom = names.has(me.id);
  if (!inRoom) { const r = await send('arrive', { name: nameOf(), place: PLACE }); inRoom = r.status === 200; if (!inRoom) show('the house', `you could not come in: ${r.why}`, 'quiet'); }
  $('#status').textContent = inRoom ? 'here' : 'not in the room';
  remote.listen(lines => take(lines, me), () => seq);
  // the room's history, checked once a minute and when the house comes back (Haiku 10-31: a house restored and grown back to
  // exactly this page's count was never noticed): the house's line at this page's count must be the one this page saw
  let checking = false;
  const sameHistory = async () => {
    if (checking || !seq || !sigAt.has(seq)) return; checking = true;
    try { const theirs = (await remote.lines(seq - 1)).find(l => l && l.seq === seq);
      // over the house's own address the house can be asked its count: shorter than this page has seen is a restore too
      const shorter = !theirs && remote.kind === 'house' && await fetch(`/w/${encodeURIComponent(seed)}/lines?after=999999999`, { cache: 'no-store' }).then(r => r.json()).then(r => Number.isInteger(r.seq) && r.seq < seq).catch(() => false);
      if ((theirs && theirs.sig !== sigAt.get(seq)) || shorter) { show('the house', 'the house went back in time (restored): reading the room again', 'quiet');
        try { sessionStorage.setItem('dream-terminal-unsent', $('#say').value || ''); } catch {} setTimeout(() => location.reload(), 1500); } }
    catch {} finally { checking = false; }
  };
  setInterval(sameHistory, 60000); recheck = sameHistory;
  const box = $('#say');
  try { const u = sessionStorage.getItem('dream-terminal-unsent'); if (u) { box.value = u; sessionStorage.removeItem('dream-terminal-unsent'); } } catch {}
  // the phone's keyboard (Bishop 10-31, from the office: "it is hard to see while I type"): the room fits above it, the newest
  // lines stay in view, and the box grows with what he writes
  const vv = window.visualViewport;
  const fit = () => { if (vv) document.body.style.height = `${Math.round(vv.height)}px`; log.scrollTop = log.scrollHeight; };
  if (vv) { vv.addEventListener('resize', fit); vv.addEventListener('scroll', () => { if (window.scrollY) window.scrollTo(0, 0); }); }
  const grow = () => { box.style.height = 'auto'; box.style.height = `${Math.min(box.scrollHeight, Math.round((vv ? vv.height : innerHeight) * 0.4))}px`; };
  box.addEventListener('focus', () => setTimeout(fit, 250));
  box.addEventListener('input', () => { grow(); log.scrollTop = log.scrollHeight; });
  for (const b of document.querySelectorAll('[data-seat]')) b.onclick = () => { box.value = `${b.dataset.seat}, ${box.value.replace(/^(?:(?:Office|Game|Art|Matt|Opus|Everyone)\b(?:\s*(?:,|and)\s*)?)+/i, '')}`; box.focus(); };
  $('#form').onsubmit = async e => {
    e.preventDefault();
    const text = box.value.replace(/\s+/g, ' ').trim(); if (!text) return;
    box.value = ''; box.disabled = true; grow();
    try {
      for (let rest = text; rest; ) {                                       // a long message in breaths: the first carries who it is for
        let cut = rest.length <= MOST_SAY ? rest.length : Math.max(rest.lastIndexOf('. ', MOST_SAY - 1) + 1, rest.lastIndexOf(' ', MOST_SAY));
        if (cut < MOST_SAY * 0.4) cut = MOST_SAY;
        const r = await send('say', { text: rest.slice(0, cut).trim(), ...(rest !== text ? { more: true } : {}) });   // the rest of one message: marked, so it follows the first breath to the same seats
        if (r.status !== 200) { show('the house', `not said${rest !== text ? ' (the rest of your message: start it with the seat again)' : ''}: ${r.why}`, 'quiet'); box.value = rest; break; }
        rest = rest.slice(cut).trim();
      }
    } finally { box.disabled = false; box.focus(); }
  };
}
main().catch(e => { $('#status').textContent = `could not start: ${e.message}`; });

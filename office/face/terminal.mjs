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
let seq = 0, seed = q.get('seed') || 'glimmerveil';
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
async function take(lines, me) {
  const many = lines.length > 50; let i = 0;
  for (const l of lines) {
    if (many && ++i % 200 === 0) $('#status').textContent = `reading the room… ${i} of ${lines.length}`;
    if (!l || !Number.isInteger(l.seq) || seen.has(l.seq) || typeof l.by !== 'string' || !(await signedBy(l))) continue;
    seen.add(l.seq); seq = Math.max(seq, l.seq);
    const d = l.data || {};
    if (l.act === 'arrive') { names.set(l.by, d.name || 'someone'); if (l.by !== me.id) show(d.name || 'someone', 'is here.', 'quiet'); }
    else if (l.act === 'say') show(names.get(l.by) || 'someone', d.text, l.by === me.id ? 'mine' : '');
    else if (l.act === 'leave') show(names.get(l.by) || 'someone', 'left.', 'quiet');
  }
}

async function main() {
  $('#forget').onclick = () => { history.replaceState(null, '', location.pathname); location.reload(); };   // the code leaves the address; the bookmark is his to delete
  if (!AT_HOUSE && !ROOM) { $('#status').textContent = 'no room code: open the link you were given (it ends #room=…)'; return; }   // (no key is made for a page with no room)
  const me = await myKey();
  $('#key').textContent = me.id; $('#copy').onclick = () => navigator.clipboard?.writeText(me.id);
  let remote;
  if (ROOM) {
    $('#status').textContent = 'finding the house through the room…';
    let g; try { g = await peerGuest(ROOM, { wait: 45000, onLost: () => { $('#status').textContent = 'the house dropped away: waiting for it…'; }, onBack: () => { $('#status').textContent = 'here'; } }); }
    catch { $('#status').textContent = 'could not find the house: a wrong code, the house asleep, or this network blocks it (on cellular, try Wi-Fi)'; return; }
    seed = g.seed; remote = g;
  } else {
    remote = houseRemote(seed);
    const h = await fetch(`/host?seed=${encodeURIComponent(seed)}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({}));
    if (h.doorway && h.doorway !== 'open') show('the house', `the doorway is ${h.doorway}: words here reach nobody until it opens`, 'quiet');
  }
  await take(await remote.lines(0), me);
  const send = async (act, data) => {
    for (let i = 0; i < 8; i++) {
      const r = await remote.send(await signed(me, { world: seed, seq: seq + 1, act, data }));
      if (r.status === 200) { seq = Math.max(seq, r.seq || seq + 1); return r; }
      if (r.status === 409) { await take(await remote.lines(seq), me); continue; }  // someone spoke first: catch up, try again
      return r;
    }
    return { status: 409, why: 'the room kept moving' };
  };
  let inRoom = names.has(me.id);
  if (!inRoom) { const r = await send('arrive', { name: nameOf(), place: PLACE }); inRoom = r.status === 200; if (!inRoom) show('the house', `you could not come in: ${r.why}`, 'quiet'); }
  $('#status').textContent = inRoom ? 'here' : 'not in the room';
  remote.listen(lines => take(lines, me), () => seq);
  const box = $('#say');
  for (const b of document.querySelectorAll('[data-seat]')) b.onclick = () => { box.value = `${b.dataset.seat}, ${box.value.replace(/^(?:(?:Office|Game|Art|Matt|Opus|Everyone)\b(?:\s*(?:,|and)\s*)?)+/i, '')}`; box.focus(); };
  $('#form').onsubmit = async e => {
    e.preventDefault();
    const text = box.value.replace(/\s+/g, ' ').trim(); if (!text) return;
    box.value = ''; box.disabled = true;
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

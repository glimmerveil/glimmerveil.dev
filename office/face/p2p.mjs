// Browser to browser (Bishop, 10-23: "like bit torrent? can we let people connect browser to browser?… is there a way we
// can avoid the small server?"). Two pages find each other the way BitTorrent's web peers do: each announces the same room
// to public WebTorrent trackers, which pass connection offers between them, and then the two talk directly (WebRTC, its
// own encryption). We run no server. What the trackers carry is sealed with the room's code (AES-GCM): they see only that
// two browsers met, never what they said or where they are. No relay (TURN): two people behind the strictest home
// networks may not reach each other; most do.
//
//   const room = await joinRoom(code, { onPeer(peer), onLeave(id) })   // peer: { id, send(obj), onMessage(fn) }
//   room.leave()
const TRACKERS = ['wss://tracker.openwebtorrent.com', 'wss://tracker.webtorrent.dev'];
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun.cloudflare.com:3478' }];
const OFFERS = 3, ANNOUNCE_EVERY = 15000;                               // (a joiner meets the host at its next announce: 15 s at most)
const enc = new TextEncoder(), dec = new TextDecoder();
const rand = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => (b % 36).toString(36)).join('');
const latin = bytes => String.fromCharCode(...bytes);
const b64 = u8 => btoa(latin(u8)), unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
export const newCode = () => rand(10);

async function roomKeys(code) {
  const id = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-1', enc.encode(`glimmerveil-dream-engine:${code}`))), b => b.toString(16).padStart(2, '0')).join('');
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(`glimmerveil-dream-engine-seal:${code}`));
  return { infoHash: id.slice(0, 20), key: await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']) };
}
async function seal(key, obj) { const iv = crypto.getRandomValues(new Uint8Array(12)); const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)))); return `${b64(iv)}.${b64(ct)}`; }
async function unseal(key, s) { const [iv, ct] = String(s).split('.'); return JSON.parse(dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, key, unb64(ct)))); }
// a connection's whole offer or answer, its candidates gathered (no trickle: a tracker passes one message each way)
const gathered = pc => new Promise(res => { if (pc.iceGatheringState === 'complete') return res(); const t = setTimeout(res, 4000); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); res(); } }); });

export async function joinRoom(code, { onPeer = () => {}, onLeave = () => {} } = {}) {
  const { infoHash, key } = await roomKeys(code), me = rand(20), peers = new Map(), pending = new Map(), sockets = [], answering = new Set();
  let closed = false;
  const seen = globalThis.__p2p = { trackers: 0, announced: 0, heard: 0, offers: 0, answers: 0, linked: 0, errors: [] };   // for the bench: how far a meeting got
  // two links to one browser (each answered the other's offer): both sides keep the one the LOWER id offered, the same
  // choice on both; the friend stays one and the same (only the link under them changes), and is met once
  function wire(id, pc, channel, offerer) {
    const keep = me < id ? me : id;
    let peer = peers.get(id);
    if (peer) {
      if (peer.offerer === keep || offerer !== keep) { pc.close(); return; }
      const old = peer.pc; Object.assign(peer, { pc, channel, offerer }); attach(peer); old.close();   // (said again on the kept link: onRelink)
      return;
    }
    seen.linked++;
    peer = { id, offerer, pc, channel, met: false, handlers: new Set(), relinks: new Set(),
      send(o) { if (this.channel.readyState === 'open') this.channel.send(JSON.stringify(o)); }, onMessage(f) { this.handlers.add(f); }, onRelink(f) { this.relinks.add(f); }, close() { this.pc.close(); } };
    peers.set(id, peer); attach(peer);
  }
  function attach(peer) {
    const { channel, pc } = peer;
    channel.addEventListener('message', e => { if (peer.channel !== channel) return; let m; try { m = JSON.parse(e.data); } catch { return; } for (const f of peer.handlers) f(m); });
    const gone = () => { if (peers.get(peer.id) === peer && peer.channel === channel) { peers.delete(peer.id); onLeave(peer.id); } };
    // "disconnected" is often a moment (a busy page, a wifi blink, the tower held to two cores: 10-26) and comes back by
    // itself: it gets 12 s. failed or closed is final at once
    let blink = 0;
    channel.addEventListener('close', () => { clearTimeout(blink); gone(); });
    pc.addEventListener('connectionstatechange', () => {
      const s = pc.connectionState;
      if (s === 'failed' || s === 'closed') { clearTimeout(blink); gone(); }
      else if (s === 'disconnected') { clearTimeout(blink); blink = setTimeout(() => { if (pc.connectionState !== 'connected') gone(); }, 12000); }
      else if (s === 'connected') clearTimeout(blink);
    });
    // met once; a link swapped in later says so (what was said on the lost one may not have arrived: Haiku 10-23)
    const meet = () => { if (peer.channel !== channel) return; if (!peer.met) { peer.met = true; onPeer(peer); } else for (const f of peer.relinks) f(); };
    if (channel.readyState === 'open') meet(); else channel.addEventListener('open', meet, { once: true });
  }
  async function makeOffers() {
    const offers = [];
    for (let i = 0; i < OFFERS; i++) {
      const pc = new RTCPeerConnection({ iceServers: ICE }), channel = pc.createDataChannel('dream'), offerId = latin(crypto.getRandomValues(new Uint8Array(20)));
      await pc.setLocalDescription(await pc.createOffer()); await gathered(pc);
      pending.set(offerId, { pc, channel, at: Date.now() });
      offers.push({ offer_id: offerId, offer: { type: 'offer', sdp: await seal(key, pc.localDescription.sdp) } });
    }
    for (const [k, v] of pending) if (Date.now() - v.at > 45000) { v.pc.close(); pending.delete(k); }   // offers nobody took (Haiku 10-23: they piled up)
    return offers;
  }
  async function announce(ws) { seen.announced++; if (ws.readyState === 1 && !closed) ws.send(JSON.stringify({ action: 'announce', info_hash: infoHash, peer_id: me, numwant: OFFERS, offers: await makeOffers() })); }
  async function onTracker(ws, m) {
    seen.heard++; if (m['failure reason']) seen.errors.push(String(m['failure reason']).slice(0, 80));
    if (m.info_hash !== infoHash || m.peer_id === me) return;
    if (m.offer && m.offer_id) {                                       // someone's offer: answer it
      seen.offers++;
      if (peers.has(m.peer_id) && peers.get(m.peer_id).offerer === (me < m.peer_id ? me : m.peer_id)) return;   // already linked the kept way
      if (answering.has(m.peer_id)) return; answering.add(m.peer_id);   // one answer a browser at a time
      let sdp; try { sdp = await unseal(key, m.offer.sdp); } catch { return; }   // not of this room's code
      const pc = new RTCPeerConnection({ iceServers: ICE });
      setTimeout(() => { answering.delete(m.peer_id); if (peers.get(m.peer_id)?.pc !== pc) pc.close(); }, 30000);   // never opened: closed
      pc.addEventListener('datachannel', e => wire(m.peer_id, pc, e.channel, m.peer_id), { once: true });
      await pc.setRemoteDescription({ type: 'offer', sdp }); await pc.setLocalDescription(await pc.createAnswer()); await gathered(pc);
      ws.send(JSON.stringify({ action: 'announce', info_hash: infoHash, peer_id: me, to_peer_id: m.peer_id, offer_id: m.offer_id, answer: { type: 'answer', sdp: await seal(key, pc.localDescription.sdp) } }));
    } else if (m.answer && m.offer_id && pending.has(m.offer_id)) {  // an answer to one of ours
      seen.answers++;
      const p = pending.get(m.offer_id); pending.delete(m.offer_id);
      let sdp; try { sdp = await unseal(key, m.answer.sdp); } catch { return; }
      if (peers.has(m.peer_id) && peers.get(m.peer_id).offerer === (me < m.peer_id ? me : m.peer_id)) { p.pc.close(); return; }
      await p.pc.setRemoteDescription({ type: 'answer', sdp }); wire(m.peer_id, p.pc, p.channel, me);
    }
  }
  for (const url of TRACKERS) {
    const open = () => {
      if (closed) return;
      let ws; try { ws = new WebSocket(url); } catch { return; }
      sockets.push(ws);
      let timer = 0;
      ws.addEventListener('open', () => { seen.trackers++; announce(ws); timer = setInterval(() => announce(ws), ANNOUNCE_EVERY); });
      ws.addEventListener('message', e => { let m; try { m = JSON.parse(e.data); } catch { return; } onTracker(ws, m).catch(() => {}); });
      ws.addEventListener('close', () => { clearInterval(timer); if (!closed) setTimeout(open, 10000); });   // a tracker that drops: tried again
      ws.addEventListener('error', () => {});
    };
    open();
  }
  return {
    code, peers,
    leave() { closed = true; for (const ws of sockets) try { ws.close(); } catch {} for (const p of peers.values()) p.close(); for (const v of pending.values()) v.pc.close(); },
  };
}

// A world kept somewhere else, the same to the page wherever it is: the house's (host/host.mjs, over HTTP) or a friend's
// browser (p2p.mjs, browser to browser). The page reads its lines, sends its own (checked first by its kernel), and hears
// everyone else's:
//   lines(after) → Promise<line[]>    send(line) → Promise<{ status, why }>    listen(onLines)
// And the other side of a friend's visit: a player's page HOSTING its own world for the friends it invites (hostWorld).
import { joinRoom } from './p2p.mjs';
import { verify, pubOf } from '../engine/keys.mjs';

const sleep = ms => new Promise(r => setTimeout(r, ms));

export function houseRemote(seed) {
  const url = (after, wait = false) => new URL(`/w/${encodeURIComponent(seed)}/lines?after=${after}${wait ? '&wait=1' : ''}`, location.href);
  return {
    kind: 'house',
    lines: after => fetch(url(after), { cache: 'no-store' }).then(r => r.json()).then(r => r.lines || []).catch(() => []),
    send: line => fetch(url(0), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ line }) })
      .then(async x => ({ status: x.status, ...(await x.json().catch(() => ({}))) })).catch(() => ({ status: 0, why: 'the house is not answering' })),
    async listen(onLines, at) {                                         // the host answers when there is a line after ours (or after 25 s)
      for (;;) {
        const r = await fetch(url(at(), true), { cache: 'no-store' }).then(x => x.json()).catch(() => null);
        if (!r || !Array.isArray(r.lines)) { await sleep(3000); continue; }   // (an error body too: never a spin)
        if (r.lines.length) await onLines(r.lines);
      }
    },
  };
}

// a visitor in a friend's world: found through the room's code, given the world's seed and every line so far, then each
// new line as it lands. A line sent is the host's to keep or refuse (its kernel, its seq), as the house's is.
// A host that drops away (a link that failed, its page reloaded, the house restarting) is waited for: onLost at once,
// onBack when it welcomes again, onGone only after REJOIN_MS without it (Bishop 10-26: "keep building"; the tower's page
// was told "closed" at 52 s and was back at 59 s). A line sent in the gap waits for the host instead of failing.
const REJOIN_MS = 60000;
export async function peerGuest(code, { wait = 60000, onGone = () => {}, onLost = () => {}, onBack = () => {} } = {}) {
  const got = new Map();                                                // seq → line, all the host has sent (each signature checked)
  let host = null, seed = null, synced = false, hears = null, nextId = 1, checking = Promise.resolve(), told = { patches: [], hosts: [] };
  let missing = false, lost = 0;                                        // the host dropped away; waited for (REJOIN_MS)
  const replies = new Map();
  // a line from the host is taken only if its own key signed it (anyone with the code is in the room: Haiku 10-23)
  const take = lines => { checking = checking.then(async () => { const ok = []; for (const l of lines) if (l && Number.isInteger(l.seq) && typeof l.by === 'string' && await verify(pubOf(l.by), l)) { got.set(l.seq, l); ok.push(l); } if (ok.length && synced && hears) await hears(ok); }); return checking; };
  const room = await joinRoom(code, {
    onPeer(peer) {
      peer.onMessage(m => {
        if (!m || typeof m !== 'object') return;
        if (m.t === 'welcome' && !host) {                               // the host is whoever welcomes (never just whoever came first)
          host = peer; seed = String(m.seed);
          // a world that holds homes (the house's own, opened by its code): the homes' folders and the hosts, as /host tells a
          // house face, so this page grows the same world (Bishop 10-26: "our world opens the same as anyone else's")
          told = { patches: Array.isArray(m.patches) ? m.patches.slice(0, 16) : [], hosts: Array.isArray(m.hosts) ? m.hosts.slice(0, 64).map(String) : [] };
          if (missing) { missing = false; clearTimeout(lost); onBack(); }   // the same world, welcoming again: its lines follow (seen ones are kept once)
          return;
        }
        if (peer !== host) return;
        if (m.t === 'lines' && Array.isArray(m.lines)) take(m.lines.slice(0, 500));
        else if (m.t === 'synced') checking.then(() => { synced = true; });
        else if (m.t === 're' && replies.has(m.id)) { replies.get(m.id)(m); replies.delete(m.id); }
      });
      peer.onRelink(() => { if (!host || host === peer) peer.send({ t: 'hello' }); });   // said again on the kept link
      peer.send({ t: 'hello' });
    },
    onLeave(id) {
      if (!host || host.id !== id) return;
      host = null; missing = true; onLost();
      clearTimeout(lost); lost = setTimeout(() => { if (!host) onGone(); }, REJOIN_MS);
      // a host that came back under a new id (the house restarted) may have linked and welcomed us while the old link was
      // still dying, and that welcome was not taken (we had a host then): hello again to everyone linked, till one welcomes
      const again = setInterval(() => { if (!missing || host) return clearInterval(again); for (const p of room.peers.values()) p.send({ t: 'hello' }); }, 3000);
    },
  });
  const t0 = Date.now();
  while (!(seed && synced) && Date.now() - t0 < wait) await sleep(250);
  if (!(seed && synced)) { room.leave(); throw new Error('could not reach your friend\'s world (is their page open?)'); }
  const after = n => [...got.values()].filter(l => l.seq > n).sort((a, b) => a.seq - b.seq);
  return {
    kind: 'peer', seed, room, patches: told.patches, hosts: told.hosts,
    lines: async n => { await checking; return after(n); },
    send: line => new Promise(async res => {
      for (let i = 0; i < 60 && !host && missing; i++) await sleep(250);  // a gap (the link coming back): waited for, up to 15 s
      if (!host) return res({ status: 0, why: missing ? 'your friend\'s world is not answering yet: try again in a moment' : 'your friend\'s world has closed' });
      const id = nextId++; replies.set(id, r => res({ status: r.status, why: r.why }));
      host.send({ t: 'line', id, line });
      setTimeout(() => { if (replies.has(id)) { replies.delete(id); res({ status: 0, why: 'your friend\'s world did not answer' }); } }, 15000);
    }),
    listen(onLines, at) { hears = lines => onLines(lines); const missed = after(at()); if (missed.length) onLines(missed); },   // what came between loading and listening
  };
}

// hosting: friends who come with the room's code get the world's seed and its lines, and send theirs, each taken (or
// refused) by take(line) → { status, why } (the page's own kernel and queue); every line that lands goes to all of them
// (`welcome`: more to tell a guest as they come in, for a world that holds homes: { patches, hosts }, as /host tells a face)
export async function hostWorld(code, { seed, history, take, welcome = {} }) {
  const guests = new Set();
  const room = await joinRoom(code, {
    onPeer(peer) {
      peer.onMessage(async m => {
        if (!m || typeof m !== 'object') return;
        if (m.t === 'hello') {
          guests.add(peer);
          peer.send({ ...(typeof welcome === 'function' ? welcome() : welcome), t: 'welcome', seed });
          const all = history();
          for (let i = 0; i < all.length; i += 200) peer.send({ t: 'lines', lines: all.slice(i, i + 200) });
          peer.send({ t: 'synced' });
        } else if (m.t === 'line' && guests.has(peer) && m.line && typeof m.line === 'object') {
          const r = await take(m.line).catch(e => ({ status: 500, why: e.message }));
          peer.send({ t: 're', id: m.id, status: r.status, why: r.why });
        }
      });
    },
    onLeave(id) { for (const g of guests) if (g.id === id) guests.delete(g); },
  });
  return {
    code, room, guests,
    broadcast(lines) { for (const g of guests) g.send({ t: 'lines', lines }); },
    leave() { room.leave(); guests.clear(); },
  };
}

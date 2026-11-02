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
// rejoin() starts afresh in the room: the old room is left (its trackers and links can be dead without a word, a phone
// asleep: Bishop 11-02, his page left open across the power cut never came back) and the room is joined again; the lines
// already seen are kept. The page calls it when it wakes (terminal-help.mjs needsRejoin); a send that finds the link
// closed calls it too, and that line, which never left, goes again once the host is back. alive() says whether the link
// to the host is open. `join` is the room to use (p2p.mjs joinRoom; a test's own); answerMs, how long a sent line waits
// for the host's answer.
const REJOIN_MS = 60000, BACK_WAIT = 80;                                // (BACK_WAIT: quarter seconds a send waits for the host)
export async function peerGuest(code, { wait = 60000, onGone = () => {}, onLost = () => {}, onBack = () => {}, join = joinRoom, answerMs = 15000 } = {}) {
  const got = new Map();                                                // seq → line, all the host has sent (each signature checked)
  let host = null, seed = null, synced = false, hears = null, nextId = 1, checking = Promise.resolve(), told = { patches: [], hosts: [] };
  let missing = false, lost = 0, again = 0;                             // the host dropped away; waited for (REJOIN_MS)
  let room = null, gen = 0, rejoining = null;                           // gen: the room joined last (a room left says nothing more)
  const replies = new Map();
  // a line from the host is taken only if its own key signed it (anyone with the code is in the room: Haiku 10-23)
  const take = lines => { checking = checking.then(async () => { const ok = []; for (const l of lines) if (l && Number.isInteger(l.seq) && typeof l.by === 'string' && await verify(pubOf(l.by), l)) { got.set(l.seq, l); ok.push(l); } if (ok.length && synced && hears) await hears(ok); }); return checking; };
  const lose = () => {
    if (!host) return;
    host = null; missing = true; onLost();
    clearTimeout(lost); lost = setTimeout(() => { if (!host) { clearInterval(again); onGone(); } }, REJOIN_MS);   // (past it, hellos are the rejoin's)
    // a host that came back under a new id (the house restarted) may have linked and welcomed us while the old link was
    // still dying, and that welcome was not taken (we had a host then): hello again to everyone linked, till one welcomes
    clearInterval(again);
    again = setInterval(() => { if (!missing || host) return clearInterval(again); for (const p of room.peers.values()) p.send({ t: 'hello' }); }, 3000);
  };
  const handlers = g => ({
    onPeer(peer) {
      if (g !== gen) return;                                            // (a room this page has left)
      peer.onMessage(m => {
        if (g !== gen || !m || typeof m !== 'object') return;
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
      peer.onRelink(() => { if (g === gen && (!host || host === peer)) peer.send({ t: 'hello' }); });   // said again on the kept link
      peer.send({ t: 'hello' });
    },
    onLeave(id) { if (g === gen && host && host.id === id) lose(); },
  });
  const enter = async () => { const g = ++gen; const r = await join(code, handlers(g)); if (g === gen) room = r; else r.leave(); return r; };
  const rejoin = () => rejoining || (rejoining = (async () => {
    const old = room; lose(); gen++;                                    // the old room says nothing more from here
    try { old && old.leave(); } catch {}
    try { await enter(); } catch { setTimeout(() => { if (!host) rejoin().catch(() => {}); }, 10000); }   // (a join that failed: tried again, never a dead end: Haiku 11-02)
  })().finally(() => { rejoining = null; }));
  await enter();
  const t0 = Date.now();
  while (!(seed && synced) && Date.now() - t0 < wait) await sleep(250);
  if (!(seed && synced)) { room.leave(); throw new Error('could not reach your friend\'s world (is their page open?)'); }
  const after = n => [...got.values()].filter(l => l.seq > n).sort((a, b) => a.seq - b.seq);
  return {
    kind: 'peer', seed, get room() { return room; }, patches: told.patches, hosts: told.hosts,
    alive: () => !!host && !!host.channel && host.channel.readyState === 'open',
    rejoin,
    close() { gen++; host = null; missing = false; clearTimeout(lost); clearInterval(again); try { room.leave(); } catch {} },   // done with the room: nothing more runs
    lines: async n => { await checking; return after(n); },
    send: line => new Promise(async res => {
      for (let tries = 0; tries < 3; tries++) {
        for (let i = 0; i < BACK_WAIT && !host && missing; i++) await sleep(250);   // a gap (the link coming back): waited for, up to 20 s
        if (!host) return res({ status: 0, why: missing ? 'your friend\'s world is not answering yet: try again in a moment' : 'your friend\'s world has closed' });
        // a link being swapped (two offers crossed and p2p.mjs keeps one: office 11-02, the first line after coming in fell
        // into it and was lost without a word) opens in a moment: waited for, never taken as the host lost
        const h = host;
        for (let i = 0; i < 20 && host === h && h.channel && h.channel.readyState === 'connecting'; i++) await sleep(250);
        if (host !== h) continue;
        const id = nextId++; replies.set(id, r => res({ status: r.status, why: r.why }));
        if (h.send({ t: 'line', id, line }) !== false) {                // (an older p2p.mjs answers nothing: taken as sent)
          // no answer: a link that says open but carries nothing (a phone asleep) is started afresh for what comes next, but
          // only while that host is still the one (a line sent before a rejoin never tears down the room since: Haiku 11-02).
          // It may still have landed: said so, so it isn't sent twice
          setTimeout(() => { if (!replies.has(id)) return; replies.delete(id); if (host === h) rejoin().catch(() => {});
            res({ status: 0, why: 'your friend\'s world did not answer (it may still have taken it: look before you send it again)' }); }, answerMs);
          return;
        }
        replies.delete(id); rejoin().catch(() => {});                   // the link was closed without a word: the host is lost; this
      }                                                                 // line never left, so it waits for the host and goes again
      res({ status: 0, why: 'your friend\'s world is not answering yet: try again in a moment' });
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

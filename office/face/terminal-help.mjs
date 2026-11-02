// The terminal's small rules, kept apart from the page so they can be tested without one (face/tests/terminal-help.test.mjs).
// Bishop 11-02: his phone's office page stopped reaching the room after the power cut, and said nothing about why.

// When the page wakes, does it start afresh in the room? A phone freezes a page that is locked or in the background, and
// its links (the trackers' sockets, the link to the house) can die there without a word, so a page back from a while away
// joins again even when its link still says open. A link that is not open, a network that changed (`online`) and a page
// restored from the back/forward cache always do.
// Never twice in a row: a page woken by several events at once (pageshow, then visible, then online) starts afresh once
// (QUIET_MS since the last time; Haiku 11-02).
export const WAKE_MS = 15000, QUIET_MS = 5000;
export function needsRejoin({ why, hiddenMs = 0, alive = true, sinceLastMs = Infinity } = {}) {
  if (sinceLastMs < QUIET_MS) return false;
  if (!alive) return true;
  if (why === 'online' || why === 'restored') return true;
  return why === 'visible' && hiddenMs >= WAKE_MS;
}

// The house's words when a line is refused (engine/world.mjs): the name another key already holds, and a key not in the room.
export const takenName = why => { const m = /someone here is already called (.+?)\s*$/i.exec(String(why || '')); return m ? m[1] : null; };
export const notHere = why => /\bis not here\b/i.test(String(why || ''));
export const alreadyHere = why => /\bis already here\b/i.test(String(why || ''));

// Another name for this browser when its own is held by another key (names are 32 characters at most in the room).
export const otherName = (name, n) => `${String(name).trim().slice(0, 29)} ${n}`;

// Never silent (Opus 11-02): a name held by another key is, most often, his own paired browser. Say so, and the way out.
export const lockNote = (name, as) => `someone here is already called ${name}. If that is you, this browser is not your paired one: `
  + 'open the office in the browser you paired, or pair this one (get a code at the PC, then say: pair NNNNNN).'
  + (as ? ` This browser came in as ${as}.` : ' This browser could not come in.');

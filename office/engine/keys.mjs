// Keys: every guest carries a fingerprint, and signs every line it sends (law 6: nobody fakes anybody).
// Ed25519 through WebCrypto, which both Node 24 and the browsers have. This is the only async code in the kernel,
// and the only place that touches crypto. apply() itself is pure and sync: a log is verified first, then applied.

import { canon } from './hash.mjs';

const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

// The canonical text of a line: what gets signed. Keys sorted so every box writes the same bytes. Never the sig.
// The world (its seed) is part of what is signed, so a log signed for one world can never be replayed into another.
export function canonical(line) {
  return canon({ world: line.world, seq: line.seq, by: line.by, act: line.act, data: line.data || {} });
}

// A key id IS the public key (base64url): nothing to collide, nothing to register, and anyone can check a line's
// signature from its own `by`. 'k_' + 43 chars.
export const keyId = pubB64 => 'k_' + String(pubB64).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const pubOf = id => { const s = String(id).startsWith('k_') ? String(id).slice(2) : null; if (!s) return null;
  const b = s.replace(/-/g, '+').replace(/_/g, '/'); return b + '='.repeat((4 - b.length % 4) % 4); };

export async function makeKey() {
  const pair = await subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
  const pub = b64(await subtle.exportKey('raw', pair.publicKey));
  return { id: keyId(pub), pub, privateKey: pair.privateKey };
}

export async function sign(key, line) {
  const l = { ...line, by: key.id };                       // by is part of what is signed: set it first
  const sig = await subtle.sign({ name: 'Ed25519' }, key.privateKey, enc.encode(canonical(l)));
  return { ...l, sig: b64(sig) };
}

export async function verify(pubB64, line) {
  try {
    if (!line || typeof line.sig !== 'string' || typeof pubB64 !== 'string' || line.by !== keyId(pubB64)) return false;
    const pub = await subtle.importKey('raw', unb64(pubB64), { name: 'Ed25519' }, true, ['verify']);
    return await subtle.verify({ name: 'Ed25519' }, pub, unb64(line.sig), enc.encode(canonical(line)));
  } catch { return false; }
}

// Check a whole log against a keyring (Set or Map of admitted key ids: who may be here is the host's call).
// Returns the first refusal, or null if every line holds. The public key comes from the id itself.
export async function verifyLog(lines, keyring) {
  for (const line of lines) {
    const id = line && line.by;
    if (!(keyring instanceof Set ? keyring.has(id) : keyring.has(id))) return { seq: line && line.seq, why: `unknown key ${id}` };
    if (!(await verify(pubOf(id), line))) return { seq: line.seq, why: 'bad signature' };
  }
  return null;
}

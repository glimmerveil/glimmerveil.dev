// The world's fingerprint: FNV-1a, 32-bit, over a canonical text of everything that matters.
// Floats are never hashed (there are none in a world's state: cells are bytes, places are integers).

export function fnv1a(str, h = 0x811c9dc5) {
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function fnvBytes(bytes, h = 0x811c9dc5) {
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export const hex = n => (n >>> 0).toString(16).padStart(8, '0');

// One canonical text for any value: keys sorted, so every box writes the same bytes. Shared by the signature and the
// world hash, so the two can never disagree about what a line is.
export const sortKeys = v => Array.isArray(v) ? v.map(sortKeys)
  : (v && typeof v === 'object') ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])])) : v;
export const canon = v => JSON.stringify(sortKeys(v));

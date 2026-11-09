// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Glimmerveil. This file is free software: you can redistribute it and/or modify it under the terms of the
// GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your
// option) any later version. It is distributed WITHOUT ANY WARRANTY; see the GNU General Public License for more details
// (licenses/GPL-3.0.txt, next to this page).
//
// Pixie's voice, its phonemizer sealed in its own worker (the public Shard's voice opt-in, Bishop 11-08: "sealed-box worker,
// source mirrored"). It runs eSpeak NG's phonemizer (piper-phonemize compiled to WebAssembly: vendor/piper/, GPL-3.0) and
// nothing else. The page and this worker only pass messages: { id, text, lang } in, { id, ids } (plain numbers) or { id, error }
// out. No shared memory, nothing transferred. The exact source of everything this worker runs is offered with the page: see
// source/ next to it, and licenses.html.
importScripts('./vendor/piper/piper_phonemize.js');

const base = new URL('./vendor/piper/', self.location.href).href;

// the phonemes for one text (a fresh module each time: its main runs once, as Piper's own web build does it)
function phonemes(text, lang) {
  return new Promise((resolve, reject) => {
    let got = null;
    self.createPiperPhonemize({
      print: d => { try { got = JSON.parse(d).phoneme_ids; resolve(got); } catch (e) { reject(e); } },
      printErr: m => { if (!got && /error/i.test(m)) reject(new Error(m)); },
      locateFile: u => u.endsWith('.wasm') ? base + 'piper_phonemize.wasm' : u.endsWith('.data') ? base + 'piper_phonemize.data' : u,
    }).then(mod => mod.callMain(['-l', lang, '--input', JSON.stringify([{ text }]), '--espeak_data', '/espeak-ng-data'])).catch(reject);
  });
}

self.onmessage = async e => {
  const { id, text, lang } = e.data || {};
  if (typeof text !== 'string' || typeof lang !== 'string' || !/^[a-z]{2,3}(-[a-z0-9]{2,8})*$/i.test(lang)) { self.postMessage({ id, error: 'not text and a language' }); return; }
  try {
    const ids = await phonemes(text.slice(0, 2000), lang);
    self.postMessage({ id, ids: Array.isArray(ids) ? ids.map(Number).filter(Number.isFinite) : [] });
  } catch (err) { self.postMessage({ id, error: String((err && err.message) || err) }); }
};

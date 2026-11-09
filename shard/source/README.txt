THE SOURCE OF HER VOICE'S PHONEMIZER (glimmerveil.dev/shard/source/)

Pixie's opt-in voice on this page turns text into speech sounds with eSpeak NG, run as piper-phonemize compiled to
WebAssembly. Those parts are free software under the GNU General Public License, version 3 or later (GPL-3.0-or-later;
../licenses/VOICE-GPL-3.0.txt). This folder holds their complete corresponding source, so anyone who receives the page can
study, change and rebuild them. They run only inside face/voice-phonemize-worker.js, a separate program that talks to the
page by messages (text in, phoneme numbers out). That worker is itself GPL-3.0-or-later, and its source is here too.

WHAT THE PAGE SHIPS (face/vendor/piper/), byte for byte the files of the npm package @diffusionstudio/piper-wasm 1.0.0
(build/, published 2024-07-05), unchanged:
  piper_phonemize.js    sha256 fef0c2fc442d24fdef5c...   (the Emscripten loader)
  piper_phonemize.wasm  sha256 b777cd107a91d2bcc6a1...   (piper-phonemize + eSpeak NG, compiled)
  piper_phonemize.data  sha256 29f1025eb23a5b5c192c...   (espeak-ng-data, packed)

HOW THOSE FILES WERE MADE (the steps in piper-wasm's README, as of June 2024; its tarball is below):
  1. Emscripten 3.1.47 (emsdk), with one line of its wchar.h commented out (the README's sed).
  2. eSpeak NG from github.com/rhasspy/espeak-ng, then at commit 8593723f10cfd9befd50de447f14bf0a9d2a14a4 (the repository's
     head since 2023-11-27, before the build), configured and built natively; its espeak-ng-data folder is what
     piper_phonemize.data packs ("--preload-file .../espeak-ng/espeak-ng-data@/espeak-ng-data").
  3. piper-phonemize from github.com/wide-video/piper-phonemize at commit cfff8e52ebaea37c7e953ae2d06b174acb827ac4 (its head
     since 2024-04-02), built with emcmake/emmake and the flags in the README. Its CMakeLists.txt fetches and compiles eSpeak
     NG from github.com/rhasspy/espeak-ng/archive/0f65aa301e0d6bae5e172cc74197d32a6182200f.zip: THAT eSpeak NG is the one
     compiled into piper_phonemize.wasm.
  4. Two build-time edits, made by these two lines of the README after the first build attempt (the tarballs here hold the
     sources BEFORE these edits, as upstream has them; the edits are part of the build, so the compiled eSpeak NG is
     MODIFIED from 0f65aa30):
       sed -i 's+$(MAKE) $(MAKESILENT) -f CMakeFiles/data.dir/build.make CMakeFiles/data.dir/build+#\0+g' /wasm/modules/piper-phonemize/build/e/src/espeak_ng_external-build/CMakeFiles/Makefile2
       sed -i 's/using namespace std/\/\/\0/g' /wasm/modules/piper-phonemize/build/e/src/espeak_ng_external/src/speechPlayer/src/speechWaveGenerator.cpp
     The first skips the external project's own data-building step (the data comes from step 2 instead); the second
     comments out the line "using namespace std;" in src/speechPlayer/src/speechWaveGenerator.cpp. Nothing else changed.

THE FILES (each one checked by its sha256 when this page was built):
FILE espeak-ng-0f65aa30-compiled.tar.gz sha256 37ebbabb010200be8ec26c61b770e93f964f4503a329d7d74c239a1a40051e43
FILE espeak-ng-8593723f-data.tar.gz sha256 41c199da1355deec93eab6065be99d00b938dd452e78f282ab481db91657e4e4
FILE piper-phonemize-cfff8e52.tar.gz sha256 7029b52aabc2512d36f4d98c6ede732c48a0e7128d0cd0e62379dfcee770038e
FILE piper-wasm-022edba0.tar.gz sha256 6e768b69a3843c9ca1484e3dda245f77481b4461fabc65273f7ed0fef39571b5
FILE npm-piper-wasm-1.0.0.tgz sha256 e5be7f15b3ec42b09fca3616db2ce3e2cf83faacc9c291c400ccf48a9d85c803
  - espeak-ng-0f65aa30-compiled.tar.gz: github.com/rhasspy/espeak-ng at 0f65aa301e0d6bae5e172cc74197d32a6182200f (compiled in)
  - espeak-ng-8593723f-data.tar.gz: github.com/rhasspy/espeak-ng at 8593723f10cfd9befd50de447f14bf0a9d2a14a4 (its data)
  - piper-phonemize-cfff8e52.tar.gz: github.com/wide-video/piper-phonemize at cfff8e52ebaea37c7e953ae2d06b174acb827ac4
  - piper-wasm-022edba0.tar.gz: github.com/diffusion-studio/piper-wasm at 022edba0455ef024574747e1134ef893f1d71b76 (the
    README with the exact build steps, and the build/ output)
  - npm-piper-wasm-1.0.0.tgz: the npm package itself, as published (its build/ files are the ones this page ships)
  - voice-phonemize-worker.js: the worker this page runs, as shipped (GPL-3.0-or-later)

LICENCES: eSpeak NG is GPL-3.0-or-later (its COPYING), with some files under Apache-2.0, BSD-2-Clause and the Unicode data
licence (COPYING.APACHE, COPYING.BSD2, COPYING.UCD); piper-phonemize is MIT, and it carries uni-algo (public domain).
All of those texts are in ../licenses/. The voice itself (the speech model, not code) is Piper's libritts "high" voice,
CC BY 4.0: see ../licenses.html.

Glimmerveil, 2026. Questions or a copy on another medium: glimmerveilAI@proton.me

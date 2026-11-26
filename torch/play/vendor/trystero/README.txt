Trystero 0.26.0 (MIT, Dan Motzenbecker): @trystero-p2p/core and @trystero-p2p/torrent from npm, dist files, renamed .mjs to .js (and their imports) so any host serves them as JavaScript; torrent imports core by relative path, so no import map or bundler alias is needed.
Peers find each other through public WebTorrent trackers; then browser to browser over WebRTC. src/net/.

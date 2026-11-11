// Write the eight pack pages: godking/<people>/index.html and spellwrought/<people>/index.html.
// Each says what is in the pack, shows its screenshots, and links to its itch.io page (where it is sold).
// The words come from tools/packs.json (each pack's itch page text, kept word for word); the layout,
// headings and picture descriptions are here. Pictures live in <game>/media/packs/.
// usage: node tools/packs.mjs
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const kit = JSON.parse(readFileSync(join(site, 'tools/packs.json'), 'utf8'));
const NAMES = { nords: 'The Nords', dwarves: 'The Dwarves', elves: 'The Elves', arcane: 'The Arcane' };
const ORDER = ['nords', 'dwarves', 'elves', 'arcane'];
const GEAR = 'New gear, their own look, their own music';

const GAMES = {
  godking: {
    name: 'The God King Problem', kind: 'A people for The God King Problem', price: 5, itch: 'god-king-', freeItch: 'the-god-king-problem',
    fonts: '/godking/fonts/fonts.css', icon: '/favicon.svg', hero: [20, 16, 11],
    vars: '--bg: #14100b; --panel: #1d1710; --line: rgba(227, 181, 90, .22); --text: #f3e7cf; --muted: #c9b896; --gold: #e3b55a; --gold-hi: #ffd98a; --ink: #1a1208;',
    needs: 'Needs The God King Problem (free), v81 or later. The game on this site is always new enough.',
    steps: p => [
      `Get the pack on <a href="${p.itch}" target="_blank" rel="noopener">its itch.io page</a>. You download one file, ${p.id}.godking.`,
      'Open the free game, <a href="/godking/play/">here on this site</a> or on <a href="https://glimmerveil.itch.io/the-god-king-problem" target="_blank" rel="noopener">its itch page</a>.',
      'Go to <b>Saves › Packs › Add a pack…</b> and pick the file.'],
    after: p => [
      'It stays in that browser. On an iPhone, save the file to Files first. If you play in both places, add it in each. You can download it again any time from your itch library.',
      `<b>Updates come in on their own.</b> Fixes and new things for ${p.the} arrive by themselves: the game checks glimmerveil.dev for the pack's newest version (a plain download, nothing about you is sent) and it's in from the next time you play.`,
      "One purchase, yours to keep. Please don't pass the file around: the packs are how we keep the base game free."],
    other: 'spellwrought', otherLine: p => `${p.name} are a people in Spellwrought too, our action RPG.`,
  },
  spellwrought: {
    name: 'Spellwrought', kind: 'A people for Spellwrought', price: 10, itch: 'spellwrought-', freeItch: 'spellwrought',
    fonts: '/spellwrought/play/vendor/fonts/fonts.css', icon: '/spellwrought/play/favicon.svg', hero: [15, 13, 12],
    vars: '--bg: #0f0d0c; --panel: #181412; --line: rgba(201, 162, 74, .22); --text: #e8dcc0; --muted: #b3a688; --gold: #c9a24a; --gold-hi: #f0cf7e; --ink: #140f08;',
    needs: 'Needs Spellwrought (free). The game on this site is always new enough.',
    steps: p => [
      `Get the pack on <a href="${p.itch}" target="_blank" rel="noopener">its itch.io page</a>. You download one file.`,
      'Open Spellwrought, free, <a href="/spellwrought/play/">here on this site</a> or on <a href="https://glimmerveil.itch.io/spellwrought" target="_blank" rel="noopener">its itch page</a>.',
      'Click <b>Add a pack…</b> on the title and pick the file.'],
    after: () => ['It stays in your browser from then on and keeps itself up to date.'],
    other: 'godking', otherLine: p => `${p.name} are a people in The God King Problem too, our god game.`,
  },
};

// feats: a heading, a paragraph of the kit's text (p), a screenshot (shot) and what it shows (alt).
// lift: the paragraph's own first sentence is the heading. gallery: the screenshots left over, with a caption.
const LAYOUT = {
  'godking/nords': {
    feats: [
      { h: 'Longhouses, mead halls and longships', p: 0, shot: 1, alt: 'A Nord town of dark longhouses round a paved square, among autumn woods' },
      { h: 'The hardest people in a fight', p: 1, shot: 5, alt: 'The Nord town seen across its fields, longhouses round the square and red woods behind' },
      { lift: true, p: 2, more: 3, shot: 4, alt: "Thor's Hammer: one great bolt of lightning striking the middle of a Nord town" }],
    gallery: [
      { shot: 2, alt: "A kind god's hand, covered in pale butterflies, resting on a longhouse roof", cap: 'A kind god gets butterflies.' },
      { shot: 3, alt: "A cruel god's hand, black veins up the back of it, over the same longhouse", cap: 'A cruel one gets black veins.' }],
  },
  'godking/dwarves': {
    feats: [
      { h: 'Halls of dressed granite', p: 0, shot: 1, alt: 'A dwarf town of grey stone halls round a paved square, at the edge of a forest' },
      { h: 'Slower on their feet, quicker with a trowel', p: 1, shot: 5, alt: 'Granite halls under slate roofs, close up, with dwarves in the square' },
      { h: "In a war they're the turtle", p: 2, shot: 4, alt: 'A Stone Wall risen in a long line across the fields beside a dwarf town' },
      { lift: true, p: 3, more: 4, shot: 3, alt: 'The Titan, a giant of jagged rock with crystal out of its shoulders, standing among the halls of a dwarf town' }],
    gallery: [
      { shot: 2, alt: "The Earthquake's wave rolling in off the water over a dwarf town's fields, a fissure cracked through the town", cap: "The Earthquake's wave rolls in off the water." }],
  },
  'godking/elves': {
    feats: [
      { h: 'Homes grown, not built', p: 0, shot: 1, alt: 'An elf town of round houses under green leaf roofs round a small square' },
      { h: 'Foragers and hunters', p: 1, shot: 5, alt: 'Leaf-roofed round houses and a house up in a great tree, close up' },
      { h: 'The best archers in the game', p: 2, shot: 4, alt: 'The elf town at dusk, its square glowing under the leaf roofs' },
      { lift: true, p: 3, more: 4, shot: 3, alt: 'The Treant, a walking tree taller than the houses, at the edge of an elf town' }],
    gallery: [
      { shot: 2, alt: 'A great tangle of thorns risen between the forest and an elf town', cap: "Thorns at the town's edge." }],
  },
  'godking/arcane': {
    feats: [
      { h: 'A town of violet twilight', p: 0, shot: 1, alt: 'A Mystic town of violet towers and spires round its moonwell' },
      { h: "They don't farm and they don't eat", p: 1, shot: 5, alt: 'A town of violet towers on the coast, crystal fields behind it and a tall crystal glowing at its edge' },
      { h: 'Charm, glamour and sleep', p: 2, shot: 4, alt: 'The violet town at dusk, its square lit from the moonwell' },
      { lift: true, p: 3, more: 4, shot: 3, alt: 'A great sphere of violet rings standing over the crystal fields' }],
    gallery: [
      { shot: 2, alt: 'Pale rings spreading out round the moonwell of a Mystic town', cap: "The god's power spreads out over the square." }],
  },
  'spellwrought/nords': {
    feats: [
      { lift: true, p: 0, shot: 1, alt: 'The Stormcaller and the Witch, a bolt of lightning and a tornado behind them, in snowy pines' },
      { lift: true, p: 1, shot: 2, alt: "The Stormcaller's tornado in the middle of a crowd of the dead" },
      { h: GEAR, p: 2, shot: 3, alt: "The Witch's Evil Eye over a crowd of the dead" }],
    gallery: [
      { shot: 4, alt: 'A bolt from the storm cloud coming down into the crowd', cap: 'A bolt from the storm cloud.' },
      { shot: 5, alt: 'The storm cloud, the tornado and a lightning strike in the snow, seen from far off', cap: 'The cloud, the tornado and a strike.' }],
  },
  'spellwrought/dwarves': {
    feats: [
      { lift: true, p: 0, shot: 2, alt: 'The Runesmith casting Boulder, the hit flaring on a crowd of monsters' },
      { h: 'Golems that fight beside you', p: 1, shot: 1, alt: 'The Golemancer with her clay, iron and fire golems before a crowd of monsters' },
      { lift: true, p: 2, shot: 3, alt: "Earthquake's ring going out across the ground" },
      { h: GEAR, p: 3, shot: 5, alt: 'The Golemancer casting Stone Spikes' }],
    gallery: [
      { shot: 4, alt: 'The crowd closing round the Runesmith, a hit flaring', cap: 'The Runesmith in the thick of it.' }],
  },
  'spellwrought/elves': {
    feats: [
      { lift: true, p: 0, shot: 1, alt: 'The Ranger casting as a Starfall comes down on wraiths, lava beasts and oozes' },
      { lift: true, p: 1, shot: 2, alt: "The Druid's Living Vines, a green beam into the crowd" },
      { h: GEAR, p: 2, shot: 3, alt: "The Starfall's impact flaring across the crowd" }],
    gallery: [
      { shot: 4, alt: "The Starfall's sparkle among the crowd", cap: 'Starfall.' }],
  },
  'spellwrought/arcane': {
    feats: [
      { lift: true, p: 0, shot: 1, alt: 'The Time Mage casting a Time Bubble over hounds and the Walking Dead, held pale inside it' },
      { lift: true, p: 1, shot: 3, alt: "Stop Time's ring going out, the crowd held in a bubble" },
      { h: GEAR, p: 2, shot: 2, alt: "The Enchanter's Crystal Sentinel standing in its pentagram" }],
    gallery: [
      { shot: 4, alt: 'The Time Bubble glittering over the crowd, seen from far off', cap: 'The bubble, from far off.' },
      { shot: 5, alt: "The Enchanter's Glamour ring", cap: 'Glamour.' }],
  },
};

const esc = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
const plain = s => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
// "First sentence. The rest." or "<b>First sentence.</b> The rest." -> [heading without its full stop, the rest]
function lift(par) {
  const m = par.match(/^<b>(.+?)\.<\/b>\s+(.*)$/s) || par.match(/^(.+?)\.\s+(.*)$/s);
  if (!m) throw new Error('cannot lift a heading from: ' + par.slice(0, 60));
  return [m[1], m[2]];
}

function page(gid, id) {
  const g = GAMES[gid], k = kit[`${gid}/${id}`], lay = LAYOUT[`${gid}/${id}`];
  const p = { id, name: NAMES[id], the: NAMES[id].replace(/^The /, 'the '), itch: `https://glimmerveil.itch.io/${g.itch}${id}` };
  const url = `https://glimmerveil.dev/${gid}/${id}/`, media = `/${gid}/media/packs/${id}`;
  const title = `${p.name} · a people for ${g.name}`;
  const desc = `${k.short.replace(/ A people for Spellwrought\.$/, '')} A pack for ${g.name}, $${g.price} on itch.io.`;
  const [r, gr, b] = g.hero;
  const used = new Set();
  const feats = lay.feats.map(f => {
    let h = f.h, body = k.paras[f.p];
    if (f.lift) [h, body] = lift(body);
    used.add(f.p); if (f.more != null) used.add(f.more);
    return `    <article class="feat">
      <figure class="shot"><img src="${media}-${f.shot}.jpg" width="1440" height="810" loading="lazy" alt="${esc(f.alt)}"></figure>
      <div><h2>${h}</h2>
      <p>${body}</p>${f.more != null ? `\n      <p>${k.paras[f.more]}</p>` : ''}</div>
    </article>`;
  }).join('\n');
  if (used.size !== k.paras.length) throw new Error(`${gid}/${id}: ${k.paras.length - used.size} paragraph(s) of the kit are not on the page`);
  const shots = [...lay.feats, ...lay.gallery].map(x => x.shot).sort().join('');
  if (new Set(shots).size !== shots.length) throw new Error(`${gid}/${id}: a screenshot is used twice`);
  const gallery = lay.gallery.map(s => `    <figure><img src="${media}-${s.shot}.jpg" width="1440" height="810" loading="lazy" alt="${esc(s.alt)}">
      <figcaption>${s.cap}</figcaption></figure>`).join('\n');
  const others = ORDER.filter(o => o !== id).map(o => `    <a class="other" href="/${gid}/${o}/"><img src="/${gid}/media/pack-${o}-t.jpg" width="160" height="127" loading="lazy" alt="">
      <span><b>${NAMES[o]}</b>${plain(kit[`${gid}/${o}`].short.replace(/ A people for Spellwrought\.$/, ''))}</span></a>`).join('\n');
  const ld = { '@context': 'https://schema.org', '@type': 'Product', name: `${g.name}: ${p.name}`, description: plain(desc), url,
    image: `https://glimmerveil.dev${media}-cover.jpg`, category: 'Video game add-on', brand: { '@type': 'Organization', name: 'Glimmerveil', url: 'https://glimmerveil.dev/' },
    isRelatedTo: { '@type': 'VideoGame', name: g.name, url: `https://glimmerveil.dev/${gid}/` },
    offers: { '@type': 'Offer', price: String(g.price), priceCurrency: 'USD', availability: 'https://schema.org/InStock', url: p.itch } };
  const get = `<a class="btn" href="${p.itch}" target="_blank" rel="noopener">Get it on itch.io · $${g.price}</a>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<link rel="canonical" href="${url}">
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(`${g.name}: ${p.name}`)}">
<meta property="og:description" content="${esc(k.short)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="https://glimmerveil.dev${media}-cover.jpg">
<meta property="og:image:width" content="630">
<meta property="og:image:height" content="500">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(`${g.name}: ${p.name}`)}">
<meta name="twitter:description" content="${esc(k.short)}">
<meta name="twitter:image" content="https://glimmerveil.dev${media}-cover.jpg">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<link rel="icon" href="${g.icon}" type="image/svg+xml">
<link href="${g.fonts}" rel="stylesheet">
<style>
  :root {
    color-scheme: dark;
    ${g.vars}
    --serif: 'EB Garamond', Georgia, serif; --display: 'Cinzel', 'Times New Roman', serif;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body { margin: 0; background: var(--bg); color: var(--text); font: 20px/1.55 var(--serif); }
  a { color: var(--gold); }
  img { max-width: 100%; height: auto; display: block; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 0 16px; }

  .hero { background: linear-gradient(90deg, rgba(${r},${gr},${b},.97) 0%, rgba(${r},${gr},${b},.88) 50%, rgba(${r},${gr},${b},.6) 100%),
                      url(${media}-${lay.feats[0].shot}.jpg) center / cover no-repeat;
          border-bottom: 1px solid var(--line); }
  .hero-grid { display: grid; grid-template-columns: 1fr auto; gap: 48px; align-items: center; padding-top: 28px; padding-bottom: 56px; }
  .crumbs { font: 600 13px var(--display); letter-spacing: .22em; text-transform: uppercase; color: var(--muted); }
  .crumbs a { color: var(--muted); text-decoration: none; }
  .crumbs a:hover { color: var(--gold-hi); }
  .kicker { margin: 52px 0 10px; font: 600 14px var(--display); letter-spacing: .18em; text-transform: uppercase; color: var(--gold); }
  h1 { font: 700 clamp(40px, 6.6vw, 72px)/1.04 var(--display); margin: 0 0 18px; color: var(--gold-hi);
       text-shadow: 0 2px 18px rgba(0,0,0,.6); }
  .tag { font: italic 400 clamp(22px, 2.6vw, 28px)/1.35 var(--serif); margin: 0 0 26px; max-width: 560px; }
  .actions { display: flex; flex-wrap: wrap; gap: 12px; }
  .btn { display: inline-block; text-decoration: none; font: 700 15px var(--display); letter-spacing: .06em;
         padding: 14px 22px; border-radius: 10px; background: var(--gold); color: var(--ink); }
  .btn:hover { background: var(--gold-hi); }
  .btn.ghost { background: transparent; color: var(--gold); border: 1px solid var(--gold); }
  .fine { font-size: 16px; color: var(--muted); margin: 14px 0 0; }
  .cover { margin: 0; width: 400px; border-radius: 14px; overflow: hidden; border: 1px solid var(--line);
           box-shadow: 0 18px 48px rgba(0,0,0,.55); }

  .feats { padding: 24px 0 8px; }
  .feat { display: grid; grid-template-columns: 1.25fr 1fr; gap: 40px; align-items: center; padding: 40px 0; border-bottom: 1px solid var(--line); }
  .feat:nth-child(even) .shot { order: 2; }
  .shot { margin: 0; }
  .shot img, .gallery img { border-radius: 12px; border: 1px solid var(--line); }
  h2 { font: 700 clamp(24px, 3vw, 32px)/1.15 var(--display); color: var(--gold-hi); margin: 0 0 12px; }
  .feat p { margin: 0; color: var(--muted); }
  .feat p + p { margin-top: 12px; }
  .feat b, .block b { color: var(--text); }

  .gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; padding: 40px 0; border-bottom: 1px solid var(--line); }
  .gallery figure { margin: 0; }
  .gallery figcaption { font-size: 16px; color: var(--muted); margin-top: 6px; }

  .block { padding: 44px 0; border-bottom: 1px solid var(--line); }
  .block > p { color: var(--muted); max-width: 760px; margin: 0 0 14px; }
  .steps { margin: 0 0 18px; padding-left: 26px; max-width: 760px; }
  .steps li { margin: 0 0 8px; padding-left: 4px; }
  .steps li::marker { font: 700 18px var(--display); color: var(--gold); }
  .others { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 18px; }
  .other { display: grid; grid-template-columns: 96px 1fr; gap: 12px; align-items: start; text-decoration: none;
           background: var(--panel); border: 1px solid var(--line); border-radius: 12px; padding: 12px; color: var(--muted);
           font-size: 16px; line-height: 1.4; }
  .other:hover { border-color: var(--gold); }
  .other img { width: 96px; height: 76px; border-radius: 8px; object-fit: cover; }
  .other b { display: block; font: 700 17px var(--display); color: var(--gold-hi); margin-bottom: 2px; }
  .cta { text-align: center; padding: 56px 0; border-bottom: 1px solid var(--line); }
  .cta .tag { margin: 0 auto 22px; }
  .cta .actions { justify-content: center; }
  footer { padding: 30px 0 56px; color: var(--muted); font-size: 16px; }
  footer a { color: var(--muted); }

  @media (max-width: 820px) {
    body { font-size: 19px; }
    .hero { background: linear-gradient(180deg, rgba(${r},${gr},${b},.84), rgba(${r},${gr},${b},.97) 60%), url(${media}-${lay.feats[0].shot}.jpg) center top / cover no-repeat; }
    .hero-grid { grid-template-columns: 1fr; gap: 32px; padding-bottom: 40px; }
    .kicker { margin-top: 36px; }
    .cover { width: min(400px, 100%); justify-self: center; }
    .feat { grid-template-columns: 1fr; gap: 18px; padding: 30px 0; }
    .feat:nth-child(even) .shot { order: 0; }
    .others { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>

<header class="hero">
  <div class="wrap hero-grid">
    <div>
      <p class="crumbs"><a href="/">Glimmerveil</a> · <a href="/${gid}/">${g.name}</a></p>
      <p class="kicker">${g.kind} · $${g.price}</p>
      <h1>${p.name}</h1>
      <p class="tag">${k.short.replace(/ A people for Spellwrought\.$/, '')}</p>
      <div class="actions">
        ${get}
        <a class="btn ghost" href="/${gid}/play/">Play the free game</a>
      </div>
      <p class="fine">${g.needs}</p>
    </div>
    <figure class="cover"><img src="${media}-cover.jpg" width="630" height="500" alt="${esc(`${p.name}: the pack's cover`)}"></figure>
  </div>
</header>

<main class="wrap">
  <section class="feats">
${feats}
  </section>

  <section class="gallery" aria-label="More screenshots">
${gallery}
  </section>

  <section class="block" id="add">
    <h2>How to add it</h2>
    <ol class="steps">
${g.steps(p).map(s => `      <li>${s}</li>`).join('\n')}
    </ol>
${g.after(p).map(s => `    <p>${s}</p>`).join('\n')}
  </section>

  <section class="block">
    <h2>The other peoples</h2>
    <div class="others">
${others}
    </div>
    <p style="margin: 22px 0 0">${g.otherLine(p)} <a href="/${g.other}/${id}/">See ${p.name} there</a>.</p>
  </section>

  <section class="cta">
    <h2>${p.name}</h2>
    <p class="tag">${k.short.replace(/ A people for Spellwrought\.$/, '')}</p>
    <div class="actions">
      ${get}
      <a class="btn ghost" href="/${gid}/">About ${g.name}</a>
    </div>
  </section>
</main>

<footer class="wrap">
  <div>© 2026 Glimmerveil. All rights reserved. · <a href="/">Glimmerveil</a> ·
  <a href="/${gid}/">${g.name}</a> ·
  <a href="https://ko-fi.com/glimmerveil" target="_blank" rel="noopener">Ko-fi</a> ·
  <a href="https://bsky.app/profile/glimmerveilai.bsky.social" target="_blank" rel="noopener">Bluesky</a></div>
  <div style="margin-top:6px">We collect nothing. This page has no trackers.</div>
</footer>

</body>
</html>
`;
}

for (const gid of Object.keys(GAMES)) for (const id of ORDER) {
  const dir = join(site, gid, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), page(gid, id));
  console.log(`wrote ${gid}/${id}/index.html`);
}

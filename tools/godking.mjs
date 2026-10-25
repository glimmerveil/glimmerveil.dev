// Build The God King Problem into this site: godking/play/index.html (one file, the game
// bundled) plus godking/fonts/ (Cinzel and EB Garamond, served from here, so the game calls
// out to nothing). Builds from a COMMIT of the studio repo, never its working tree: only a
// build Bishop has signed off goes public.
// usage: node tools/godking.mjs <commit> [studio repo] [esbuild dir]
//   defaults: /home/bishop/studio, /root/.local/share/esb (npm i esbuild@0.24.0 --prefix <dir>)
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [commit, studio = '/home/bishop/studio', esb = '/root/.local/share/esb'] = process.argv.slice(2);
if (!commit) { console.log('usage: node tools/godking.mjs <commit> [studio repo] [esbuild dir]'); process.exit(1); }
const site = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const build = join(site, '.build');   // git-ignored scratch (never /tmp: house rule)
const git = (...a) => execFileSync('git', ['-c', `safe.directory=${studio}`, '-C', studio, ...a], { maxBuffer: 1 << 28 });

const sha = git('rev-parse', '--short', commit).toString().trim();
rmSync(build, { recursive: true, force: true });
mkdirSync(join(build, 'src'), { recursive: true });
execFileSync('tar', ['-x', '-C', join(build, 'src')], { input: git('archive', sha, 'games/godking') });
const game = join(build, 'src/games/godking');
execFileSync('node', ['tools/pack.mjs', join(build, 'out')], { cwd: game, env: { ...process.env, ESBUILD: esb }, stdio: 'inherit' });

// the packed page is made for the claude.ai host (no skeleton, fonts from Google): make it a page of its own
let page = readFileSync(join(build, 'out/index.html'), 'utf8');
const google = /<link href="https:\/\/fonts\.googleapis\.com\/[^"]*" rel="stylesheet">/;
if (!google.test(page)) throw new Error('the packer no longer links Google Fonts: check the font swap');
page = page.replace(google, '<link href="../fonts/fonts.css" rel="stylesheet">');
page = `<!doctype html>\n<html lang="en">\n<!-- build ${sha} -->\n` + page;
// the link people share is this page: give it a preview card (title, words, picture) like the landing page's
const card = [
  '<meta property="og:type" content="website">',
  '<meta property="og:site_name" content="Glimmerveil">',
  '<meta property="og:title" content="The God King Problem: play free">',
  '<meta property="og:description" content="A god game where you can raise mountains but can\'t give a single order. Free in your browser, on any device, alone or with friends.">',
  '<meta property="og:url" content="https://glimmerveil.dev/godking/play/">',
  '<meta property="og:image" content="https://glimmerveil.dev/godking/media/og.jpg">',
  '<meta property="og:image:width" content="1200">',
  '<meta property="og:image:height" content="630">',
  '<meta property="og:image:alt" content="The God King Problem: a timber town on a coast under a mountain">',
  '<meta name="twitter:card" content="summary_large_image">',
  '<meta name="twitter:image" content="https://glimmerveil.dev/godking/media/og.jpg">',
].join('\n');
if (!/<\/title>\n/.test(page)) throw new Error('no </title> to hang the preview card on');
page = page.replace(/<\/title>\n/, '</title>\n' + card + '\n');
if (!page.includes('Copyright © 2026 Glimmerveil. All rights reserved.')) throw new Error('copyright notice missing');
const outside = [...page.matchAll(/(?:src|href)=["'](https?:)?\/\/[^"']+/g)].map(m => m[0]);
if (outside.length) throw new Error('the game would call out to: ' + outside.join(', '));

mkdirSync(join(site, 'godking/play'), { recursive: true });
writeFileSync(join(site, 'godking/play/index.html'), page);
const fonts = join(game, 'vendor/fonts');
mkdirSync(join(site, 'godking/fonts'), { recursive: true });
for (const f of readdirSync(fonts)) if (/\.(woff2|css)$/.test(f)) cpSync(join(fonts, f), join(site, 'godking/fonts', f));
writeFileSync(join(site, 'godking/build.json'), JSON.stringify({ commit: sha, built: new Date().toISOString().slice(0, 10) }) + '\n');
rmSync(build, { recursive: true, force: true });
console.log(`godking/play/index.html: build ${sha}, ${Math.round(page.length / 1024)} KB`);

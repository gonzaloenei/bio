#!/usr/bin/env node
/**
 * Renders og.html to a content-hashed og-<hash>.png and points the pages at it.
 *
 * The hash matters: link previews are cached per image URL, so a file that
 * keeps its name keeps its stale preview. Naming by content means any change
 * to the image is a new URL, and every platform refetches on its own.
 *
 * Same Chrome pipeline as the PDFs, and og.html links the site's own
 * stylesheet, so the type and the inline marks match the page exactly.
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DIR = __dirname;
const TMP = path.join(DIR, '.og-tmp.png');
const PAGES = ['index.html', 'resume.html'];

execFileSync(CHROME, [
  '--headless',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=2',   // retina; downscaled below
  '--window-size=1200,630',
  `--screenshot=${TMP}`,
  '--virtual-time-budget=15000',
  `file://${path.join(DIR, 'og.html')}`,
], { stdio: ['ignore', 'ignore', 'ignore'] });

// Back down to the 1200x630 that the og:image tags declare.
execFileSync('/usr/bin/sips', ['-z', '630', '1200', TMP], { stdio: ['ignore', 'ignore', 'ignore'] });

const bytes = fs.readFileSync(TMP);
const hash = crypto.createHash('sha256').update(bytes).digest('hex').slice(0, 8);
const name = `og-${hash}.png`;

for (const f of fs.readdirSync(DIR)) {
  if (/^og-[0-9a-f]{8}\.png$/.test(f) && f !== name) fs.unlinkSync(path.join(DIR, f));
}
fs.renameSync(TMP, path.join(DIR, name));
// Keep the unhashed name alive too: a platform holding an old cached preview
// may refetch just the image, and a 404 there shows nothing at all.
fs.copyFileSync(path.join(DIR, name), path.join(DIR, 'og.png'));

let touched = 0;
for (const page of PAGES) {
  const p = path.join(DIR, page);
  const before = fs.readFileSync(p, 'utf8');
  const after = before.replace(
    /(content="https:\/\/gonzaloenei\.com\/)og(?:-[0-9a-f]{8})?\.png(")/g,
    `$1${name}$2`
  );
  if (after !== before) { fs.writeFileSync(p, after); touched++; }
}

console.log(`wrote ${name} — ${(bytes.length / 1024).toFixed(0)}KB, ${touched} page(s) repointed`);

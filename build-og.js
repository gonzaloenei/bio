#!/usr/bin/env node
/**
 * Renders og.html to og.png — the link-preview image for the site.
 *
 * Same Chrome pipeline as the PDFs, and og.html links the site's own
 * stylesheet, so the type and the inline marks match the page exactly.
 */
const path = require('path');
const { execFileSync } = require('child_process');
const fs = require('fs');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DIR = __dirname;
const OUT = path.join(DIR, 'og.png');

execFileSync(CHROME, [
  '--headless',
  '--disable-gpu',
  '--hide-scrollbars',
  '--force-device-scale-factor=2',   // retina; downscaled below
  '--window-size=1200,630',
  `--screenshot=${OUT}`,
  '--virtual-time-budget=15000',
  `file://${path.join(DIR, 'og.html')}`,
], { stdio: ['ignore', 'ignore', 'ignore'] });

// Back down to the 1200x630 that the og:image tags declare.
execFileSync('/usr/bin/sips', ['-z', '630', '1200', OUT], { stdio: ['ignore', 'ignore', 'ignore'] });
console.log(`wrote og.png — ${(fs.statSync(OUT).size / 1024).toFixed(0)}KB`);

#!/usr/bin/env node
/**
 * Renders the bio and the resume into a single 2-page letter PDF.
 *
 * Both pages are pulled from the live HTML files so there is one source of
 * truth — edit index.html / resume.html, re-run this, and the PDF follows.
 * Chrome's print-to-PDF preserves <a href> as clickable link annotations.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DIR = __dirname;
const OUT = path.join(DIR, 'gonzalo-enei.pdf');
const TMP = path.join(DIR, '.print.html');

const mainOf = (file) => {
  const html = fs.readFileSync(path.join(DIR, file), 'utf8');
  const m = html.match(/<main[\s\S]*?<\/main>/i);
  if (!m) throw new Error(`no <main> found in ${file}`);
  return m[0];
};

const doc = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Gonzalo Enei</title>
  <link rel="stylesheet" href="https://use.typekit.net/hal0ftj.css">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="page">${mainOf('index.html')}</div>
  <div class="page">${mainOf('resume.html')}</div>
</body>
</html>
`;

fs.writeFileSync(TMP, doc);
try {
  execFileSync(CHROME, [
    '--headless',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${OUT}`,
    '--virtual-time-budget=15000',
    `file://${TMP}`,
  ], { stdio: ['ignore', 'ignore', 'ignore'] });
} finally {
  fs.unlinkSync(TMP);
}

const pdf = fs.readFileSync(OUT);
const pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
const links = (pdf.toString('latin1').match(/\/Subtype\s*\/Link/g) || []).length;
console.log(`wrote ${path.basename(OUT)} — ${pages} pages, ${links} links, ${(pdf.length / 1024).toFixed(0)}KB`);

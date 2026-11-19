#!/usr/bin/env node
/**
 * Builds the letter-format PDFs.
 *
 *   gonzalo-enei.pdf   bio + resume   (served at /pdf)
 *   pdf/resume.pdf     resume alone   (served at /pdf/resume)
 *
 * Every page is pulled from the live HTML so there is one source of truth —
 * edit index.html / resume.html, re-run this, and the PDFs follow. Chrome's
 * print-to-PDF preserves <a href> as clickable annotations.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DIR = __dirname;
const OUTDIR = path.join(DIR, 'pdf');

const mainOf = (file) => {
  const html = fs.readFileSync(file, 'utf8');
  const m = html.match(/<main[\s\S]*?<\/main>/i);
  if (!m) throw new Error(`no <main> found in ${path.relative(DIR, file)}`);
  return m[0];
};

const render = (pages, out) => {
  const tmp = path.join(DIR, '.print.html');
  fs.writeFileSync(tmp, `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Gonzalo Enei</title>
  <link rel="stylesheet" href="https://use.typekit.net/hal0ftj.css">
  <link rel="stylesheet" href="style.css">
</head>
<body>
${pages.map((p) => `  <div class="page">${p}</div>`).join('\n')}
</body>
</html>
`);
  try {
    execFileSync(CHROME, [
      '--headless',
      '--disable-gpu',
      '--no-pdf-header-footer',
      `--print-to-pdf=${out}`,
      '--virtual-time-budget=15000',
      `file://${tmp}`,
    ], { stdio: ['ignore', 'ignore', 'ignore'] });
  } finally {
    fs.unlinkSync(tmp);
  }
  const pdf = fs.readFileSync(out);
  const count = (re) => (pdf.toString('latin1').match(re) || []).length;
  console.log(
    `  ${path.relative(DIR, out)} — ${count(/\/Type\s*\/Page[^s]/g)} pages, ` +
    `${count(/\/Subtype\s*\/Link/g)} links, ${(pdf.length / 1024).toFixed(0)}KB`
  );
};

const resume = mainOf(path.join(DIR, 'resume.html'));

render([mainOf(path.join(DIR, 'index.html')), resume], path.join(DIR, 'gonzalo-enei.pdf'));

fs.mkdirSync(OUTDIR, { recursive: true });
// Resume on its own — what an application form's résumé field expects, since
// those are machine-parsed and a cover letter on page one confuses the parser.
render([resume], path.join(OUTDIR, 'resume.pdf'));

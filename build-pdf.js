#!/usr/bin/env node
/**
 * Builds the letter-format PDFs.
 *
 *   gonzalo-enei.pdf   bio      + resume   (served at /pdf)
 *   pdf/<company>.pdf  letter   + resume   (served at /pdf/<company>)
 *
 * Every page is pulled from the live HTML so there is one source of truth —
 * edit index.html / resume.html / letters/*.html, re-run this, and the PDFs
 * follow. Chrome's print-to-PDF preserves <a href> as clickable annotations.
 *
 * Cover letters are deliberately self-contained rather than composed from the
 * bio's paragraphs: a letter that has already been sent should not silently
 * change when the bio is edited later.
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const DIR = __dirname;
const LETTERS = path.join(DIR, 'letters');
const OUTDIR = path.join(DIR, 'pdf');

const mainOf = (file) => {
  const html = fs.readFileSync(file, 'utf8');
  const m = html.match(/<main[\s\S]*?<\/main>/i);
  if (!m) throw new Error(`no <main> found in ${path.relative(DIR, file)}`);
  // Letters live a directory down, so their asset paths are relative to it.
  return m[0].replace(/(src|href)="\.\.\//g, '$1="');
};

/**
 * A letter can drop parts of the resume it shouldn't carry, by naming their
 * class in `<main data-omit="...">`. The Google letter uses this to leave out
 * the Claude Interviews link, which would otherwise still reach the reader on
 * page two after being removed from page one.
 */
const omitOf = (file) =>
  (fs.readFileSync(file, 'utf8').match(/<main[^>]*\sdata-omit="([^"]+)"/i) || [])[1];

const stripClass = (html, cls) => {
  const re = new RegExp(`\\s*<(\\w+)[^>]*class="[^"]*\\b${cls}\\b[^"]*"[^>]*>[\\s\\S]*?<\\/\\1>`, 'gi');
  if (!re.test(html)) throw new Error(`data-omit="${cls}" matched nothing in the resume`);
  return html.replace(re, '');
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

if (fs.existsSync(LETTERS)) {
  for (const file of fs.readdirSync(LETTERS).filter((f) => f.endsWith('.html')).sort()) {
    const slug = path.basename(file, '.html');
    const src = path.join(LETTERS, file);
    const omit = omitOf(src);
    render(
      [mainOf(src), omit ? stripClass(resume, omit) : resume],
      path.join(OUTDIR, `${slug}.pdf`)
    );
  }
}

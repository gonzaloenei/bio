#!/usr/bin/env bash
# Render index.html to a letter-format PDF with live hyperlinks.
# Chrome's print-to-PDF preserves <a href> as clickable annotations.
set -euo pipefail

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$DIR/gonzalo-enei.pdf"

"$CHROME" \
  --headless \
  --disable-gpu \
  --no-pdf-header-footer \
  --print-to-pdf="$OUT" \
  --virtual-time-budget=10000 \
  "file://$DIR/index.html" 2>/dev/null

echo "wrote $OUT ($(du -h "$OUT" | cut -f1))"

#!/usr/bin/env bash
set -euo pipefail
: "${REPO_ROOT:?Set REPO_ROOT to your repository root}"

echo "[*] Building ctags index for $REPO_ROOT"
ctags -R --fields=+n+K+S+language \
  --output-format=json \
  --languages=+Python,+JavaScript,+TypeScript,+Java,+Kotlin \
  --map-JavaScript=+.js --map-JavaScript=+.jsx --map-JavaScript=+.mjs \
  --map-TypeScript=+.ts --map-TypeScript=+.tsx \
  --map-Kotlin=+.kt --map-Kotlin=+.kts \
  -f - "$REPO_ROOT" > /dev/null

echo "[*] ripgrep sanity check"
rg --version
echo "[*] Done."

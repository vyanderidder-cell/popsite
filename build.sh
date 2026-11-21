#!/usr/bin/env sh
# Devanture — construit js/landing.min.js (scène 3D de l'accueil) à partir de src/landing/.
# Il faut esbuild (npx esbuild marche aussi).
set -e
cd "$(dirname "$0")"
ESBUILD=${ESBUILD:-esbuild}
$ESBUILD src/landing/main.js --bundle --format=esm --minify --target=es2020 \
  --alias:three=./src/vendor/three/three.module.js \
  --legal-comments=none --outfile=js/landing.min.js "$@"

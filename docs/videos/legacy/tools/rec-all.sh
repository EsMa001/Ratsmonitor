#!/bin/bash
# Nimmt alle Kapitel auf und baut je Kapitel ein Video: bash rec-all.sh <ordner> <scenes-datei> [Kapitel...]   (im Ordner ~/code/video-tools starten)
O=$1; SC=$2; shift 2; R=${R:-$HOME/code/Ratsmonitor}; T=$R/docs/videos/tools
CH=${@:-$(cd out-web/$O && ls -d c[0-9][0-9] | tr '\n' ' ')}
for c in $CH; do
  echo "== $c"; SCENES=$SC node $T/rec-web.mjs $O/$c && python3 $T/build.py $O/$c 3 $c web
done

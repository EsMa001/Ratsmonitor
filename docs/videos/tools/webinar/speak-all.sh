#!/bin/bash
# Sprache je Kapitel: bash speak-all.sh <out-ordner> (im Ordner ~/code/video-tools starten)
O=$1; R=${R:-$HOME/code/Ratsmonitor}
for f in $O/c*.txt; do n=$(basename $f .txt); mkdir -p $O/$n; python3 $R/docs/videos/tools/speak.py $f $O/$n/audio.wav 0.8 ${COMMA:-0.1} && echo $n; done

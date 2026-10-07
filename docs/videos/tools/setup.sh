#!/bin/bash
# Richtet den Arbeitsordner für die Videos ein (einmalig): bash setup.sh  (Standard ~/code/video-tools oder $VIDEO_TOOLS)
set -e
D=${VIDEO_TOOLS:-$HOME/code/video-tools}; mkdir -p $D && cd $D
[ -f package.json ] || npm init -y >/dev/null
npm ls playwright ffmpeg-static >/dev/null 2>&1 || { npm install playwright ffmpeg-static; npx playwright install chromium; }
[ -d venv ] || { python3 -m venv venv; ./venv/bin/pip install piper-tts; }
mkdir -p voices out out-web out-clips cache/tts
B=https://huggingface.co/rhasspy/piper-voices/resolve/main/de/de_DE/thorsten/high
for f in de_DE-thorsten-high.onnx de_DE-thorsten-high.onnx.json; do [ -f voices/$f ] || curl -L -o voices/$f $B/$f; done
echo "Fertig. Videos bauen: cd $D && node <Repo>/docs/videos/tools/build-video.mjs <skript> <ordner> <name>"
# Prüfwerkzeuge, die Tokens sparen: Texterkennung (tesseract.js) und Bildvergleich (imagehash)
npm install tesseract.js --silent
./venv/bin/pip install -q imagehash pillow

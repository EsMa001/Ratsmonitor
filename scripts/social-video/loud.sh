#!/bin/bash
# usage: loud.sh file  -> Pegel auf -14 LUFS, danach Begrenzer, bis die True-Peak-Spitze nach der AAC-Kodierung höchstens -1,5 dB beträgt
f=$1
src=${f%.mp4}_src.mp4; cp "$f" "$src"
I=$(ffmpeg -hide_banner -nostats -i $src -af ebur128 -f null - 2>&1 | grep -E "^\s+I:" | awk '{print $2}')
G=$(python3 -c "print(round(-14-($I),2))")
L=0.84
for try in 1 2 3 4 5; do
  ffmpeg -y -loglevel error -i $src -c:v copy -af "volume=${G}dB,alimiter=limit=${L}:level=disabled" -c:a aac -b:a 192k ${f%.mp4}_n.mp4
  P=$(ffmpeg -hide_banner -nostats -i ${f%.mp4}_n.mp4 -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+Peak:" | awk '{print $2}')
  python3 -c "import sys; sys.exit(0 if float('$P') <= -1.5 else 1)" && break
  L=$(python3 -c "print(round($L*0.85,3))")
done
mv ${f%.mp4}_n.mp4 $f; rm -f "$src"
ffmpeg -hide_banner -nostats -i $f -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+I:|Peak:"

#!/bin/bash
# usage: loud.sh file  -> gain to -14 LUFS with limiter
f=$1
I=$(ffmpeg -hide_banner -nostats -i $f -af ebur128 -f null - 2>&1 | grep -E "^\s+I:" | awk '{print $2}')
G=$(python3 -c "print(round(-14-($I),2))")
ffmpeg -y -loglevel error -i $f -c:v copy -af "volume=${G}dB,alimiter=limit=0.84:level=disabled" -c:a aac -b:a 192k ${f%.mp4}_n.mp4 && mv ${f%.mp4}_n.mp4 $f
ffmpeg -hide_banner -nostats -i $f -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+I:|Peak:"

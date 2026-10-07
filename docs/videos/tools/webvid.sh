#!/bin/bash
# webvid.sh NN name poster t1 t2 t3 t4 t5 t6 : Web-Video aufnehmen, bauen, Kontaktbogen
cd ~/code/video-tools
NN=$1; NAME=$2; P=$3; shift 3
R=/Users/nico/code/Ratsmonitor/docs/videos/tools
~/.local/bin/node $R/rec-web.mjs $NN 2>&1 | tail -4
python3 $R/build.py $NN $P $NAME web
D=out-web/$NN
echo "Länge: $(afinfo $D/$NAME.mp4 | grep 'estimated duration' | awk '{print int($3)}') s"
rm -f $D/n_*.png
IN=(); L=""; i=0; W=420
for t in "$@"; do node_modules/ffmpeg-static/ffmpeg -loglevel error -y -ss $t -i $D/$NAME.mp4 -frames:v 1 -vf scale=$W:-1 $D/n_$t.png; IN+=(-i $D/n_$t.png); i=$((i+1)); done
node_modules/ffmpeg-static/ffmpeg -loglevel error -y "${IN[@]}" -filter_complex "xstack=inputs=$i:layout=$(python3 -c "
n=$i;cols=3;w=$W
print('|'.join(f'{(k%cols)*w}_{(k//cols)*236}' for k in range(n)))")" $D/sheet.png

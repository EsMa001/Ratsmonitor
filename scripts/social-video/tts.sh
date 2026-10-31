#!/bin/bash
# Sprechdatei erzeugen: tts.sh <Ordner> <Nummer> "<Text>"  -> <Ordner>/v<Nummer>.wav
# Braucht Piper (Linux-Release) unter $SV_WORK/tts/bin/piper und die Stimme de-thorsten-low unter $SV_WORK/tts/voice.
# Tempo wie im Bauplan: atempo 0,86. Schreibweise für die Aussprache: "Plenarra" (siehe Bauplan, Abschnitt Aussprache).
set -e
W=${SV_WORK:-$(cd "$(dirname "$0")/../.." && pwd)/tmp/social-video}
export LD_LIBRARY_PATH=$W/tts/bin/piper
mkdir -p "$1"
echo "$3" | "$W/tts/bin/piper/piper" --model "$W/tts/voice/de-thorsten-low.onnx" --output_file "/tmp/sv_raw_$2.wav" >/dev/null 2>&1
ffmpeg -y -loglevel error -i "/tmp/sv_raw_$2.wav" -filter:a atempo=0.86 "$1/v$2.wav"

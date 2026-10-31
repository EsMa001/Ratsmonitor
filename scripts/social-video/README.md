# Social-Videos bauen (Entwurf, noch ohne Automatik)

Skripte, mit denen die Reels/TikTok/Shorts (1080×1920, 42 bis 65 s) entstanden sind. Wie ein Video aufgebaut sein muss, steht im Bauplan: `docs/social/video-bauplan.md`.

| Datei | Aufgabe |
| --- | --- |
| `videos.py` | Konfiguration je Video (Datenblatt, Sprechtext, Szenenfunktionen), Szenen-Renderer, Zusammenbau. Aufruf: `python3 videos.py <Kennung>` (`h` Halle, `d` Dresden, `b` Billerbeck Starkregen, `o` Oststeinbek, `w` Billerbeck Wirtschaftswege, `p` Billerbeck P&R) |
| `kern.py`, `base.py` | Bausteine: Schrift (IBM Plex Sans aus `public/fonts`), Logo, Hintergrund, Animationen |
| `icons.py` | Selbst gezeichnete Icons (Katalog im Bauplan) |
| `remix.py`, `music.py`, `loud.sh` | Tonkette: Stimmen, Musik mit Ducking, Pegel −14 LUFS |
| `tts.sh` | Sprechdatei mit Piper (lokal, ohne fremden Dienst) |

## Arbeitsordner

`SV_WORK` (Standard `tmp/social-video`, nicht in Git) enthält die Stimmen unter `tts/<Video>/v1.wav` bis `v6.wav` sowie `tts/bin/piper` und `tts/voice/de-thorsten-low.onnx`. Dorthin kommen auch Zwischenstände und das fertige Video. Die Dateinamen der fertigen Videos und die Stimmordner stehen am Ende von `videos.py`.

## Stand

- Datenblatt (`shared/social-video-sheet.mjs`) und Video (`auto.py`) entstehen ohne Handarbeit. Der Server-Job `social-videos` (`scripts/social-videos.mjs`, Betrieb: `docs/betrieb/node-server.md`, „Social-Videos“) baut sie je Vorschlag des Admin-Reiters; `tools.mjs` richtet Python-Pakete, Piper und die Stimme beim ersten Lauf selbst ein. Die handgeschriebenen Konfigurationen in `videos.py` sind die Vorlage der Szenen.
- Die Maschinenprüfung aus dem Bauplan (Abschnitt 13) ist noch nicht eingebaut.
- Ein Video braucht etwa 4,5 Minuten (3 Prozesse).
- Lizenzen von Piper und der Stimme vor einer Veröffentlichung der Videos prüfen.

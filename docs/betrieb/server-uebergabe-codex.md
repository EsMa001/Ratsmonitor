# Server-Übergabe für Codex (Stand 12.10.2026)

Diese Datei erklärt einem weiteren Agenten (Codex) alles, was er für die Arbeit auf dem Produktionsserver von Plenara
braucht. Die ausführliche Betriebsanleitung ist `docs/betrieb/node-server.md`; bei Widerspruch gilt sie.

**Der Server ist die einzige Produktion und hält den einzigen vollständigen Datenbestand.** Es gibt keine
Testumgebung daneben. Jeder Fehler trifft sofort die echte Seite und die echten Daten.

---

## 1. Zugang einrichten (macht Max, einmal)

Codex bekommt einen **eigenen** SSH-Schlüssel. Der Schlüssel von Max oder Nico wird nie weitergegeben.

1. Auf dem Rechner, auf dem Codex läuft, ein Schlüsselpaar ohne Passphrase erzeugen:
   ```bash
   ssh-keygen -t ed25519 -C "codex-ratsmonitor" -f ~/.ssh/id_ed25519_codex_ratsmonitor -N ""
   ```
2. Max trägt den **öffentlichen** Teil (`~/.ssh/id_ed25519_codex_ratsmonitor.pub`) auf dem Server ein, in Git Bash
   (nicht PowerShell, sonst gehen die Anführungszeichen verloren). `<PUB>` durch die ganze Zeile aus der `.pub`-Datei ersetzen:
   ```bash
   ssh ratsmonitor 'cp /root/.ssh/authorized_keys /root/.ssh/authorized_keys.bak-$(date +%F) && printf "\n# Codex, eingetragen %s\n%s\n" "$(date +%F)" "<PUB>" >> /root/.ssh/authorized_keys && grep -c "^ssh-" /root/.ssh/authorized_keys'
   ```
   Die Zahl am Ende muss um eins steigen (heute: 2, danach 3).
3. Auf dem Codex-Rechner in `~/.ssh/config`:
   ```
   Host ratsmonitor
     HostName 187.7.72.52
     User root
     IdentityFile ~/.ssh/id_ed25519_codex_ratsmonitor
     IdentitiesOnly yes
   ```
4. Test: `ssh ratsmonitor "hostname && systemctl is-active ratsmonitor"` muss `active` zeigen.

**Zugang entziehen:** die Zeile `# Codex, eingetragen …` und die Schlüsselzeile darunter aus
`/root/.ssh/authorized_keys` löschen.

---

## 2. Eckdaten

| | |
|---|---|
| Anbieter | Hostinger-VPS |
| Adresse | `187.7.72.52`, SSH-Alias `ratsmonitor`, Benutzer `root` (nur Schlüssel, kein Passwort) |
| System | Ubuntu 24.04, 4 Kerne, 15 GB RAM, 193 GB Platte, Node 24 |
| Firewall | ufw: nur 22, 80, 443 offen |
| Zeitzone | System Europe/Berlin; der Node-Prozess läuft mit `TZ=UTC` (Protokollzeiten im App-Log sind UTC) |
| Repository | GitHub, Branch `main`; nur `main` wird ausgerollt |
| Weitere Personen mit Zugang | Max (Eigentümer), Nico (Mitentwickler), Claude Code |

---

## 3. Aufbau

```
Browser ─▶ SSH-Tunnel ─▶ Caddy 127.0.0.1:8080 ─▶ Node 127.0.0.1:3000 ─▶ SQLite /srv/ratsmonitor/data/ratsmonitor.sqlite
Handy   ─▶ https://187-7-72-52.sslip.io (Caddy, Basic-Auth) ─┘
```

- Ein Node-Prozess (`dist/standalone/serve.mjs`, Einheit `ratsmonitor.service`) liefert Seiten, API und Admin aus.
- Caddy setzt die Admin-Kennung: Wer über den Tunnel oder mit dem Basic-Auth-Passwort kommt, ist Admin.
- Die Datenbank ist eine SQLite-Datei (rund 18 GB, WAL-Modus), angesprochen über `server/node/d1-sqlite.mjs`.

**Website ansehen:** `ssh -N -L 8080:127.0.0.1:8080 ratsmonitor`, dann `http://localhost:8080`.
Schnelltest auf dem Server: `curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" http://127.0.0.1:8080/`

### Ordner

| Pfad | Inhalt |
|---|---|
| `/srv/ratsmonitor/app/releases/<commit>` | ausgerollte Stände; `app/current` zeigt auf den laufenden |
| `/srv/ratsmonitor/data/ratsmonitor.sqlite` | **die Datenbank, einzige echte Kopie** |
| `/srv/ratsmonitor/data/pdf-store` | PDF-Ablage (rund 61 GB, Budget 65 GB): `index.sqlite`, `files/` |
| `/srv/ratsmonitor/data/ocr-cache`, `/srv/ratsmonitor/ocr-tools` | OCR-Sprachdaten und Werkzeuge |
| `/srv/ratsmonitor/backups` | nächtliche Sicherungen der Datenbank (höchstens zwei Stände), Protokolle |
| `/srv/ratsmonitor/ratsmonitor.env` | Umgebung mit **Geheimnissen** (siehe unten) |
| `/etc/caddy/Caddyfile` | Proxy, Basic-Auth-Hash |
| `/etc/systemd/system/ratsmonitor*` | Dienste und Timer |

### Dienste und Zeitpläne

Alle Jobs starten über `scripts/schedule.mjs <job>`; ein- und ausgeschaltet und zeitlich eingestellt werden sie in der
Administration (Reiter „Jobs & Zeitpläne“). Die systemd-Timer bleiben dafür immer an.

| Job | Zeit | Zweck |
|---|---|---|
| `import-nightly` | 01:00 | bundesweiter Abruf der Ratsinformationssysteme, eine Woche zurück (rund 3 h) |
| `backup` | 03:30 | Sicherung der Datenbank (`VACUUM INTO`, nur lesend) |
| `search-words` | 04:20 | Wortliste der Suche nachführen |
| `pdf-nightly` | 05:30 | PDFs laden, Texte, OCR, Zusammenfassungen, Fakten (höchstens 3 h) |
| `import`, `pdf-job` | alle 10 min | von der Admin-Seite angelegte Aufträge abarbeiten |

Übersicht: `systemctl list-timers --no-pager | grep ratsmonitor` und `node scripts/schedule.mjs --list` (im Ordner
`app/current`, als Benutzer `ratsmonitor`).

---

## 4. Häufige Aufgaben

Befehle in der App laufen als Benutzer `ratsmonitor` mit der Dienstumgebung. Sauberster Weg:

```bash
ssh ratsmonitor 'systemd-run -P -q --uid=ratsmonitor --working-directory=/srv/ratsmonitor/app/current -p EnvironmentFile=/srv/ratsmonitor/ratsmonitor.env /usr/bin/node --no-warnings scripts/<skript>.mjs <argumente>'
```

Lange Läufe (über einige Minuten) als eigene Einheit im Hintergrund, mit Protokoll unter `/srv/ratsmonitor/backups/`,
damit sie einen Verbindungsabbruch überleben: `systemd-run --unit=rm-<name> … -p StandardOutput=append:<log> …`.

| Aufgabe | Befehl |
|---|---|
| Protokoll der Website | `journalctl -u ratsmonitor -n 100 --no-pager` |
| Langsame Abfragen | `journalctl -u ratsmonitor --since "-30 min" --no-pager \| grep langsam` |
| Protokoll der Importe | `journalctl -u ratsmonitor-import -u ratsmonitor-import-nightly -n 50 --no-pager` |
| Läuft gerade ein Job? | `systemctl list-units --type=service --state=running --no-pager \| grep -E "ratsmonitor\|rm-"` |
| Laufender Stand | `readlink /srv/ratsmonitor/app/current` |
| Platz | `df -h /` und `du -sh /srv/ratsmonitor/*` |
| Datenbank lesen | `sqlite3 -readonly /srv/ratsmonitor/data/ratsmonitor.sqlite "<SELECT …>"` |
| Fehlende Migrationen | siehe Abschnitt 5 |

### Ausrollen

Im lokalen Repository auf dem aktuellen `main`:

```bash
bash deploy/node/deploy.sh main
```

Das Skript lädt den Stand hoch, baut ihn auf dem Server, prüft die Migrationen und startet den Dienst neu
(einige Sekunden Ausfall). **Fehlen Migrationen, bricht es ab und ändert nichts.**

Vorher prüfen:
- Läuft ein Import oder ein PDF-Job? Dann warten (siehe Tabelle oben).
- Alle Tests grün (`node --test tests/*.test.mjs`).
- Max hat dem Ausrollen zugestimmt.

Danach: die Startseite, `/suche`, `/admin` und `/api/search?q=Windpark` abrufen (alle 200, unter 1 s) und das
Protokoll auf Fehler prüfen.

---

## 5. Migrationen

Ablauf genau nach `docs/betrieb/node-server.md`, Abschnitt „Migrationen“. Kurz:

1. Neue Migrationen zuerst an einer **Kopie der letzten Sicherung** testen und die Dauer messen.
2. Timer der Importe und PDF-Jobs stoppen, laufende Jobs abwarten, dann `systemctl stop ratsmonitor`.
3. `sudo -u ratsmonitor node /tmp/m/scripts/node-migrate.mjs /srv/ratsmonitor/data/ratsmonitor.sqlite`
4. Dienst starten, `deploy.sh main`, Timer wieder an.
5. Hat eine Migration Indizes neu angelegt: `ANALYZE` für die Tabelle und die Abfragepläne der Administration
   prüfen. Nach Migration 0020 wählte der Planer den falschen Index, die Admin-Seite brauchte 15 s statt 0,1 s.
6. Hat eine Migration den Suchtext geändert: Wortliste voll neu aufbauen
   (`scripts/refresh-search-words.mjs --full`, rund 2,5 min).

Die Website ist während der Migration nicht erreichbar (bisher bis 7 min). **Nur nach Zustimmung von Max.**

---

## 6. Regeln

**Ohne ausdrückliche Zustimmung von Max nie:**
- ausrollen, migrieren, den Dienst oder Caddy neu starten;
- Dateien in `/srv/ratsmonitor/data` ändern, verschieben oder löschen (Datenbank, PDF-Ablage);
- Sicherungen löschen;
- Firewall, SSH, Benutzer oder `authorized_keys` ändern;
- Pakete installieren oder das System aktualisieren;
- Zeitpläne ändern oder Jobs anderer stoppen.

**Geheimnisse:** `ratsmonitor.env` enthält Zugangsdaten (`OPENAI_API_KEY`, `IMPORT_TOKEN`, `DATA_EXPORT_TOKEN`,
`PREPARED_ANALYSIS_TOKEN`, `VAPID_PRIVATE_KEY`, `ADMIN_SETUP_HASH`). Die Datei nie ausgeben, kopieren oder in
Chat, Protokoll oder Repository übernehmen. Nur Variablennamen lesen: `grep -oE "^[A-Z_]+=" /srv/ratsmonitor/ratsmonitor.env`.
Dasselbe gilt für den Passwort-Hash in der Caddy-Datei und für alle Schlüssel unter `/root/.ssh`.

**Andere arbeiten gleichzeitig.** Nico und Claude Code arbeiten ebenfalls auf dem Server, oft parallel. Am
11.10.2026 hat ein Agent einen laufenden PDF-Abruf eines anderen gestoppt, um seine Aufbereitung zu starten.
Deshalb vor jedem Eingriff:
- `who` und `systemctl list-units --type=service --state=running | grep -E "ratsmonitor|rm-"` prüfen;
- Sperren in der Datenbank ansehen:
  `sqlite3 -readonly /srv/ratsmonitor/data/ratsmonitor.sqlite "select key from system_state where key like '%lease%' or key like '%lock%' or key like 'import-run:%';"`;
- keine fremden Einheiten stoppen; eigene Einheiten `rm-codex-<zweck>` nennen, damit klar ist, wem sie gehören.

**Schreiben in die Datenbank** nur über die Skripte und Routen der App, nie mit `sqlite3` von Hand. Die Trigger,
Datenstände (`data_revisions`) und vorberechneten Zahlen hängen voneinander ab; ein Schreiben von Hand macht
Zwischenspeicher, Wortliste und Admin-Zahlen unbemerkt falsch.

**Last:** Die Website muss schnell bleiben. Eigene Läufe mit `-p Nice=15 -p IOSchedulingClass=idle` und einer
Speichergrenze (`-p MemoryMax=4G`) starten. Zwischendurch die Antwortzeit der Startseite prüfen (normal unter 0,05 s).

**Fremde Server:** Abrufe bei Ratsinformationssystemen der Kommunen höflich halten (höchstens zwei gleichzeitig je
Server, wie in den Skripten voreingestellt). Die Grenzen nicht erhöhen.

---

## 7. Wo mehr steht

| Thema | Datei |
|---|---|
| Betrieb, Migrationen, Importprozess, PDF-Kette, Zeitplaner | `docs/betrieb/node-server.md` |
| Projektregeln, Suche, Admin-Vorberechnung, PDF-Ablage | `CLAUDE.md` im Repository |
| Oberfläche | `components/ratsmonitor/FRONTEND.md` |
| Laufende Code-Analyse und offene Punkte | `requirements/uebergabe-code-analyse-2026-10.md` |

## 8. Offene Punkte auf dem Server (Stand 12.10.2026)

- Admin-Zugang ist nicht getrennt: Jeder mit Tunnel oder Basic-Auth-Passwort ist Admin.
- Ausgehende Verbindungen des Benutzers `ratsmonitor` ins interne Netz sind noch nicht gesperrt.
- Impressum und Datenschutz fehlen; die Seite ist noch nicht öffentlich.
- PDF-Ablage: rund 30.000 Abrufe sind gescheitert; der Nachtlauf versucht neue Sitzungen und füllt bis 65 GB auf.

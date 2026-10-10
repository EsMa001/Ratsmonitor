# Übergabe: Arbeitspakete aus der Code-Analyse (Stand 10.10.2026)

Für einen neuen Chat. Grundlage ist `requirements/code-analyse-2026-10-10.md`. Die Befunde sind dort nummeriert (A Abrufe,
B Datenbank/Suche, C Frontend, D Altlasten, E Fehler/Sicherheit) und in Abschnitt 5 zu Paketen gebündelt. Die Nummern
bitte beibehalten.

## Stand

- **Paket 1 (Suche und Server entlasten) ist fertig**, auf `main` und auf dem Server (Stand 45bdec0, Doku danach).
  Migration `drizzle/0017` ist lokal (Max) und auf dem Server eingespielt. Messwerte stehen im Bericht unter Paket 1.
- **Nico** muss 0017 lokal noch einspielen, bei beendetem Dev-Server:
  `node scripts/node-migrate.mjs .wrangler/state/v3/d1/miniflare-D1DatabaseObject/<datei>.sqlite`
- **Server** (Hostinger 187.7.72.52, SSH-Alias `ratsmonitor`):
  - Auf den Server kommt nur `main`, mit `bash deploy/node/deploy.sh main`.
  - Fehlen Migrationen, bricht das Skript ab. Ablauf dafür: `docs/betrieb/node-server.md`, Abschnitt „Migrationen“.
  - Nächtliche Läufe: Sicherung 3:30 Uhr, Wortliste 4:15 Uhr.
  - Caddy-Sicherung: `/etc/caddy/Caddyfile.bak-vor-paket1`.
  - Passwortzugang: `https://187-7-72-52.sslip.io`. Der Hash steht nur auf dem Server.
- **Offene Reste aus Paket 1** (gehören zu späteren Paketen):
  - Begriff mit „ohne Formalien“ dauert noch etwa 1,8 s, weil die vorberechneten Zahlen mit Filter nicht gelten (→ Paket 6, B7).
  - Der Datenstand `content` steigt weiter mit jedem Importschritt (→ Paket 2).
  - Der Trigger `revision_search_topics_update` zählt auch Änderungen, die nur die Metadaten betreffen. Das macht den
    Zwischenspeicher zu oft ungültig, zeigt aber nie Veraltetes.
  - Die Planerstatistik (`sqlite_stat1`) veraltet. `PRAGMA optimize` regelmäßig ausführen (→ Paket 2 oder 5).

## Regeln für jedes Paket

1. **Ein Paket je Chat.** Umgesetzt wird nur, was freigegeben ist. Entscheidungen, die nur Max treffen kann, vorher klären
   (Liste unten).
2. **Je Paket ein eigener Branch von `main`**, zum Beispiel `paket-2-abrufe`. Zuerst `git fetch`, Nico arbeitet parallel.
3. **Vor dem Ändern:**
   - `CLAUDE.md` lesen.
   - Für Frontend zusätzlich `components/ratsmonitor/FRONTEND.md`.
   - Den passenden Abschnitt im Bericht gezielt lesen (`grep`), nicht die ganze Datei.
4. **Prüfen vor dem Merge:**
   - `node --test tests/*.test.mjs`
   - `node node_modules/typescript/bin/tsc --noEmit --incremental false`
   - `node scripts/build-node.mjs`; bei Frontend zusätzlich `npm run build` (Cloudflare)
   - Neue Logik bekommt Tests.
5. **Gegenlesen:** vor dem Merge ein unabhängiges Review durch ein stärkeres Modell (Agent mit `model: fable`), nur lesend.
   Berechtigte Befunde einarbeiten.
6. **Messen statt vermuten:**
   - Vorher und nachher an echten Daten messen, lokal oder auf dem Server über `http://127.0.0.1:8080` per SSH.
   - Auf dem Server prüfen, ob der Planer den gewünschten Index nimmt (`EXPLAIN QUERY PLAN`). Dort gibt es Statistiken,
     lokal nicht, die Pläne können sich unterscheiden.
7. **Ausrollen:**
   - `main` vorspulen und pushen.
   - Auf dem Server vorher prüfen, ob gerade ein Import oder Auftrag läuft (`import_runs`, `admin-pipeline-job`), und ob
     die Sicherung von heute da ist.
   - Danach Rauchtest und Messwerte im Bericht unter dem Paket vermerken.
8. **Lokaler Dev-Server:** Er bricht bei Änderungen an `server/` oder `shared/` laufende Importe ab. Vorher fragen oder in
   einem Worktree arbeiten (siehe Memory-Notizen).

## Pakete: Reihenfolge, Modell, Vorgehen

| # | Paket | Umsetzen mit | Gegenlesen | Aufwand |
|---|---|---|---|---|
| 2 | Abrufe robuster und schneller | Opus 5.5 | Fable 5.1 | 1 bis 2 Tage |
| 3 | Fehler und Sicherheit | Opus 5.5 | Fable 5.1 (Pflicht) | etwa 1 Tag |
| 4 | Frontend-Start | Opus 5.5; einfache Teile Sonnet 5.5 | Fable 5.1 für C1/C5 | 2 bis 3 Tage |
| 5 | Aufräumen | Sonnet 5.5 | Opus 5.5 (Diff prüfen) | 1 bis 2 Tage |
| 6 | Größere Umbauten | Planung Fable 5.1, Umsetzung Opus 5.5 | Fable 5.1 | je mehrere Tage |

Begründung der Modellwahl: Nebenläufigkeit, Sperren, Abfragepläne und Sicherheitslücken sind die Stellen, an denen
schwächere Modelle plausible, aber falsche Lösungen bauen. Dort Opus, Gegenlesen mit Fable. Aufräumen ist viel
Fleißarbeit über viele Dateien mit geringem Risiko, das reicht für Sonnet. Haiku nur für reine Suchaufgaben
(Explore-Agent), nicht für Änderungen.

Empfohlene Reihenfolge: **2 → 3 → 4 → 5 → 6**. Paket 3 ist spätestens vor jeder öffentlichen Adresse Pflicht (E4: SSRF
über `/api/dokument` ist auf dem eigenen Server real). Paket 2 zuerst, weil die Importe jetzt auf dem Server laufen.

### Paket 2 · Abrufe (Opus 5.5)

- **Befunde:** A7, A10, A6, A13, A4, A12, A2, A1, A3, A9, `pipeline-jobs.mjs:102`.
- **Dazu aus Paket 1:** Datenstand `content` nicht bei jedem Importschritt erhöhen; `PRAGMA optimize` (zum Beispiel nach
  dem Import oder im nächtlichen Cron).
- **Vorgehen:**
  - Erst A10/A6 (hängende Aufträge), dann Speicher (A13/A4), dann Durchsatz (A2/A1).
  - Vorher einen Import-Lauf auf dem Server messen (Dauer je Gebiet, 409/429-Zahlen aus `import_runs`), nachher erneut.
  - Nur dort testen, wo kein laufender Auftrag gestört wird.

### Paket 3 · Fehler und Sicherheit (Opus 5.5, Fable Pflicht)

- **Befunde:** E1, E3, E4, E5, E6, E7, C9, C11, `regions.ts:15`, `admin-stand.mjs:19`.
- **Tests:**
  - Für E4 Tests mit Weiterleitung auf interne Adressen (127.0.0.1, 169.254.169.254, ::1, 10/8).
  - Für E5 Tests mit langen Eingaben (Laufzeitgrenze).
  - Für E3 ungültige Datumswerte.
- **Server:** Zusätzlich die ausgehende Sperre aus `node-server.md`, „Vor dem Öffnen“, mit Max abstimmen (Firewall auf
  dem Server, also Infrastruktur).

### Paket 4 · Frontend-Start (Opus 5.5, Teile Sonnet 5.5)

- **Befunde:** C1, C4, C5, C8, C7, C10.
- **Nur Frontend:** Backend nicht ändern (CLAUDE.md), außer C5 braucht `initialTopic` serverseitig. Das vorher klären.
- **Vorher und nachher messen:** Größe des Start-JavaScripts und CSS aus dem Produktions-Build, Anzahl der Abrufe der
  Detailseite.
- **Prüfen:** Im Browser (Browser-Pane), Startseite, Suche, Detail, Admin, auf Mobilbreite.
- **Sonnet reicht für:** C8, C7, C10 und die Schrift- und CSS-Teile aus C4.
- **Opus für:** das Lazy-Laden (C1) und die Detailseite (C5).

### Paket 5 · Aufräumen (Sonnet 5.5)

- **Befunde:** D1, D2, D4, D6 bis D14, D17, Doku.
- **Vorher Entscheidung nötig:** D5 (Push) und B10 (Regel-Label-Historie).
- **Entfernen:** Jede Löschung per `grep` auf Verweise prüfen, beide Builds laufen lassen.
  `node scripts/frontend-index.mjs` nach entfernten Dateien.
- **D11 (18 MB Startdaten):** zuerst prüfen, ob der Node-Server sie braucht (der Server startet ohne gültige Datenbank
  ohnehin nicht).

### Paket 6 · Größere Umbauten (je Punkt eigener Chat)

- **A14, eigener Importprozess mit systemd-Timer:** zuerst. Er ist Voraussetzung für Importe ohne offenen Browser und
  berührt die Infrastruktur, also mit dem Infrastruktur-Chat abstimmen.
- **Weitere Punkte:**
  - B6/E4: Tabelle `topic_events`
  - B4/B5: `steps`/`src` als Spalten, Blättern per Schlüssel
  - B7/A11: FTS5. Löst auch die 1,8 s für Begriff plus Filter.
  - A2/B12: Versionen kappen
  - C2b/c, C3, C12
- **Vorgehen je Punkt:**
  - Erst ein Plan mit Fable (Plan-Agent oder eigener Chat).
  - Dann Freigabe durch Max, dann Umsetzung mit Opus.
  - Migrationen mit Dauer auf echten Daten messen; der Server hat 1,43 Mio. Karten, eine 17-GB-Datenbank und 16 GB RAM.

## Entscheidungen, die nur Max treffen kann

- **Preise:** 0/9,99/49,99 € im Code, 149/399/990 € in der Strategie.
- **Push:** behalten oder entfernen (D5).
- **Regel-Label-Historie:** 1,2 Mio. Zeilen; behalten oder löschen (B10).
- **Datenschutz und Impressum** mit Hostinger als Hoster: Pflicht vor dem Öffnen.
- **`/analysen`:** als Umleitung behalten oder nicht.

## Startnachricht für den neuen Chat (Beispiel)

> Lies `requirements/uebergabe-code-analyse-2026-10.md` und im Bericht `requirements/code-analyse-2026-10-10.md` den
> Abschnitt zu Paket 2. Setze Paket 2 auf einem neuen Branch von `main` um, nach den Regeln der Übergabe. Messe vorher
> und nachher auf dem Server. Gegenlesen mit Fable vor dem Merge. Frag mich, bevor du ausrollst.

Modell im neuen Chat vor dem Start auswählen (Opus 5.5 für Paket 2).

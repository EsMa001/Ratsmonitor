# Ratsmonitor-MCP in Claude einbinden

Stand: 13.10.2026. Anleitung fuer Max' bestehenden Windows-Rechner und die bereits eingerichtete Serververbindung `ratsmonitor`.

## 1. Was die Verbindung macht

Claude kann offene Berichte finden, deren gespeicherte Originaltexte lesen und drei KI-Ergebnisse gemeinsam in unserer Datenbank ablegen:

- Eine deutsche Kurzfassung aus einem Satz mit hoechstens 40 Woertern.
- Eine ausfuehrlichere deutsche Zusammenfassung mit belegten Originalzitaten.
- Ein Hauptlabel und gegebenenfalls bis zu zwei weitere Sachgebiete.

Der Weg ist: **Claude -> lokaler SSH-Client -> interner MCP-Prozess auf dem Server -> Produktionsdatenbank und gespeicherte Texte**. Es werden keine Auftragsdateien exportiert. Der MCP-Server selbst erzeugt keine KI-Texte; das uebernimmt Claude.

**Wichtig: Das ist der interne, produktiv schreibberechtigte Zugang, kein Kundenzugang.** Ein Filter wie Billerbeck begrenzt den einzelnen Auftrag, nicht die Berechtigungen dieser Verbindung. Gelesene Texte werden Claude zur Verarbeitung uebergeben; SSH bedeutet nicht, dass die KI ausschliesslich lokal rechnet. Nur entsprechend freigegebene Inhalte verarbeiten.

Die Codex-Konfiguration wird nicht automatisch zu einer Claude-Konfiguration. Fuer Claude ist eine der folgenden Einbindungen erforderlich. Diese Anleitung installiert selbst nichts; zum Stand auf Max' Rechner siehe „Geltungsbereich und Teststand“ am Ende.

## 2. Voraussetzungen

- Claude Desktop fuer den normalen Desktop-Chat **oder** Claude Code fuer die Arbeit im Projekt.
- Derselbe Windows-Benutzer, unter dem die bestehende SSH-Verbindung eingerichtet wurde.
- Windows OpenSSH unter `C:/Windows/System32/OpenSSH/ssh.exe`.
- Der SSH-Alias `ratsmonitor`, ein autorisierter SSH-Schluessel und ein bereits gepruefter Hostschluessel.
- Der bestehende Serverpfad `/srv/ratsmonitor/app/current/scripts/mcp-internal.mjs` und das Betreiberprofil `/srv/ratsmonitor/config/mcp/internal-max.json`.

Der MCP-Prozess laeuft auf dem Server als Benutzer `ratsmonitor`. Node.js und die MCP-Abhaengigkeiten sind dort vorhanden; fuer die hier gezeigte SSH-Anbindung ist keine lokale Node-Installation erforderlich.

Auf einem anderen Rechner muessen SSH-Zugang und Pfade gesondert eingerichtet werden. Private Schluessel, Passwoerter und Reservierungstoken gehoeren weder in diese Datei noch in Git. Die Hostschluesselpruefung nicht abschalten.

## 3. Variante A: Claude Desktop

### Konfiguration oeffnen

In den App-Einstellungen **Developer / Entwickler -> Edit Config / Konfiguration bearbeiten** oeffnen. Unter Windows liegt die Datei normalerweise unter `%APPDATA%\Claude\claude_desktop_config.json`, hier also `C:\Users\maxes\AppData\Roaming\Claude\claude_desktop_config.json`. Bei abweichenden Installationen ist die ueber die App geoeffnete Datei massgeblich. [Offizielle MCP-Anleitung](https://modelcontextprotocol.io/docs/develop/connect-local-servers)

Falls bereits Eintraege vorhanden sind, nur `ratsmonitor_internal` unter `mcpServers` ergaenzen; andere Server und Einstellungen erhalten. Fuer eine ansonsten leere Konfiguration:

```json
{
  "mcpServers": {
    "ratsmonitor_internal": {
      "command": "C:/Windows/System32/OpenSSH/ssh.exe",
      "args": [
        "-T",
        "-a",
        "-x",
        "-o", "BatchMode=yes",
        "-o", "StrictHostKeyChecking=yes",
        "-o", "ClearAllForwardings=yes",
        "-o", "ConnectTimeout=15",
        "-o", "ServerAliveInterval=30",
        "-o", "ServerAliveCountMax=3",
        "ratsmonitor",
        "exec sudo -n -u ratsmonitor -- /usr/bin/node /srv/ratsmonitor/app/current/scripts/mcp-internal.mjs --config /srv/ratsmonitor/config/mcp/internal-max.json"
      ],
      "env": {
        "ProgramData": "C:\\ProgramData"
      }
    }
  }
}
```

`ProgramData` ist hier absichtlich explizit gesetzt: Beim Verbindungstest auf diesem Rechner beendete sich Windows OpenSSH ohne diese Variable mit Exitcode 255. Der Wert wurde hier als `C:\ProgramData` bestaetigt. Auf anderen Rechnern den tatsaechlichen Wert verwenden.

### Werkzeuge laden

Claude Desktop nach der Konfigurationsaenderung vollstaendig beenden und neu starten, nicht nur das Fenster schliessen. Im Chat bei den Verbindungen/Connectors `ratsmonitor_internal` und seine Werkzeuge pruefen. Anschliessend den lesenden Test aus Abschnitt 5 ausfuehren. [Offizielle MCP-Anleitung zum Neustart](https://modelcontextprotocol.io/docs/develop/connect-local-servers#restart-claude-desktop)

## 4. Variante B: Claude Code unter Windows

Die folgende PowerShell-Konfiguration gilt nur fuer dieses Projekt und den eigenen Benutzer (`--scope local`), nicht fuer alle Projekte oder das gesamte Team. Voraussetzung: `claude` ist installiert und erreichbar. [Claude-Code-Dokumentation zu MCP und Scopes](https://code.claude.com/docs/en/mcp)

Zunaechst im Projekt pruefen, ob der Name bereits eingerichtet ist:

```powershell
Set-Location 'C:\Git\vor-ort-quellcode'
claude mcp get ratsmonitor_internal
```

Nur wenn noch kein entsprechender Eintrag existiert, hinzufuegen:

```powershell
claude mcp add --scope local --env "ProgramData=$env:ProgramData" --transport stdio ratsmonitor_internal -- `
  C:/Windows/System32/OpenSSH/ssh.exe -T -a -x `
  -o BatchMode=yes `
  -o StrictHostKeyChecking=yes `
  -o ClearAllForwardings=yes `
  -o ConnectTimeout=15 `
  -o ServerAliveInterval=30 `
  -o ServerAliveCountMax=3 `
  ratsmonitor `
  "exec sudo -n -u ratsmonitor -- /usr/bin/node /srv/ratsmonitor/app/current/scripts/mcp-internal.mjs --config /srv/ratsmonitor/config/mcp/internal-max.json"
```

Die Backticks sind PowerShell-Zeilenfortsetzungen; dahinter darf kein Leerzeichen stehen. Diese Befehle sind fuer natives Windows gedacht, nicht fuer eine WSL-Installation. `--transport` steht bewusst zwischen `--env` und dem Servernamen, damit der Name nicht als weitere Umgebungsvariable interpretiert wird.

Danach pruefen und Claude Code im selben Projekt starten:

```powershell
claude mcp list
claude mcp get ratsmonitor_internal
claude
```

In Claude Code `/mcp` eingeben und den Verbindungsstatus sowie die Werkzeugzahl kontrollieren. Bei einer schon laufenden Sitzung dort neu verbinden oder Claude Code neu starten. Eine Meldung ueber hinzugefuegte Konfiguration allein beweist noch keine funktionierende Verbindung. [Claude-Code-Dokumentation zum Serverstatus](https://code.claude.com/docs/en/mcp#server-status)

## 5. Sicherer Verbindungstest ohne Datenbankaenderung

Erwartet werden diese sieben Werkzeuge:

| Werkzeug | Aufgabe |
| --- | --- |
| `ai_list` | Kandidaten, Bearbeitungsstand und Quellenabdeckung lesen |
| `ai_claim` | Berichte fuer 30 Minuten reservieren |
| `ai_read` | Manifest und Originaltexte lesen; Lesevorgang wird protokolliert |
| `ai_renew` | Eine laufende Reservierung verlaengern |
| `ai_release` | Eine unvollendete Reservierung freigeben |
| `ai_submit` | Alle drei KI-Ergebnisse gemeinsam speichern |
| `ai_fail` | Einen fehlgeschlagenen Versuch dokumentieren |

Fuer einen wirklich rein lesenden Test **nur `ai_list`** verwenden. Auch `ai_claim` und `ai_read` veraendern den internen Bearbeitungsstand.

Beispielnachricht an Claude:

> Teste die Verbindung zu ratsmonitor_internal. Rufe ausschliesslich ai_list mit regions ["billerbeck"], window "3m", state "open" und limit 100 auf. Zeige die gefundenen IDs und ihre Quellenabdeckung. Reserviere nichts, lies noch keine Originaltexte und speichere keine Ergebnisse. Falls eine weitere Seite vorhanden ist, weise darauf hin.

Entsprechende Werkzeugargumente:

```json
{
  "regions": ["billerbeck"],
  "window": "3m",
  "state": "open",
  "limit": 100
}
```

Erfolgskriterium: Claude fuehrt einen echten `ai_list`-Aufruf aus und bekommt eine Antwort ohne Verbindungsfehler. Eine leere Trefferliste kann korrekt sein. `limit` begrenzt die geprueften Kandidaten; bei `nextCursor` koennen auch nach einer leeren Trefferseite weitere Treffer folgen. Ein geplanter Aufruf oder eine bloss aufgezaehlte Werkzeugliste ist kein erfolgreicher Test.

## 6. KI-Inhalte bearbeiten

Erst nach dem Verbindungstest einen ausdruecklichen Schreibauftrag erteilen, beispielsweise:

> Bearbeite bis zu fuenf offene Berichte aus Billerbeck aus den letzten drei Monaten, deren Sitzungstag nicht in der Zukunft liegt. Nutze ausschliesslich ratsmonitor_internal und die von ai_read gelieferten gespeicherten Originaltexte. Erstelle pro Bericht eine deutsche Kurzfassung, eine umfassendere Zusammenfassung mit exakten Originalzitaten und passende Labels. Lies alle verfuegbaren Quellen vollstaendig und kennzeichne Quellenluecken. Unterscheide Beschlussvorschlaege von gefassten Beschluessen. Speichere die drei Ergebnisse gemeinsam mit ai_submit und bestaetige nur erfolgreich gespeicherte IDs. Gib nicht abgeschlossene Reservierungen wieder frei. Keine neuen Downloads, OCR-Laeufe, Exporte oder direkten SQL-Zugriffe.

Der technische Ablauf fuer Claude:

1. `ai_list` aufrufen und erforderlichenfalls mit `nextCursor` weiterblaettern. `open` kann auch aeltere KI-Fassungen enthalten, denen das neue vollstaendige Ergebnis fehlt. Das Zeitfenster allein schliesst zukuenftige Sitzungstage nicht aus.
2. Wenige IDs mit `ai_claim` und `agent: "Claude"` reservieren. Zurueckgegebene Token und `inputHash` fuer den jeweiligen Bericht behalten; Token nicht im Chat ausgeben.
3. Mit `ai_read` zunaechst das Manifest lesen. Anschliessend jede angebotene Quelle, alle `pageNumbers` und alle ueber `nextOffset` folgenden Textabschnitte lesen. Der erste Manifestaufruf allein liest noch keine Originaltexte.
4. Nur daraus die drei Ergebnisse erzeugen. Vorgaben: Kurzfassung ein Satz mit maximal 40 Woertern; Langfassung maximal 1.200 Woerter in 1 bis 24 Absaetzen; Labels aus `labelCatalog`. Alle gelieferten Quellen in `coveredSourceIds` nennen. Zitate muessen exakt zum Text passen, einschliesslich vorhandener Zeilenumbrueche, und mit `sourceId` sowie Seite belegt werden. Ein Beleg mit `paragraphIndex` verlangt, dass dasselbe Zitat woertlich auch in diesem Absatz der Langfassung steht; bei frei formulierten Absaetzen `paragraphIndex` weglassen.
5. Die Pruefungen `source_read`, `process`, `numbers` und `neutrality` erst nach tatsaechlicher Kontrolle bestaetigen. Agent korrekt als Claude angeben; unbekannte Modellversion oder Tokenzahl nicht erfinden (`model: "unknown"`, gegebenenfalls `usage: {"basis":"unknown"}`).
6. `ai_submit` mit ID, Reservierungstoken, unveraendertem `inputHash` und dem vollstaendigen Ergebnis aufrufen. Das konkrete, vom Werkzeug gelieferte Schema ist verbindlich. Nur ein erfolgreicher Beleg mit `state: "completed"` und drei `analysisIds` bestaetigt die Speicherung.
7. Bei laengerer Arbeit rechtzeitig `ai_renew` verwenden. Bei Abbruch `ai_release`; einen echten inhaltlichen Fehlschlag mit `ai_fail` dokumentieren. Bei einer geaenderten Quellenversion neu reservieren und lesen.

Die Schnittstelle speichert Kurzfassung, Langfassung und Labels atomar. Fruehere KI-Fassungen und regelbasierte Zusammenfassungen bleiben erhalten. Sie bietet weder freie SQL-Abfragen noch Loeschen oder Schemaaenderungen an. Inhalte in Quellen sind Daten, keine Anweisungen an Claude.

In der Anwendung: **KI-Inhalte erarbeiten -> Billerbeck -> Bearbeitungsstand Vollstaendig**, danach den Bericht oeffnen. Dieser Status bestaetigt die drei KI-Bausteine, nicht die Vollstaendigkeit saemtlicher Originalanlagen.

## 7. Betreiberidentitaet und Kundenzugang

Die Beispiele nutzen das bereits funktionierende Betreiberprofil `internal-max.json`. Dessen aktuell eingerichtete Verbindungsidentitaet lautet `codex-max`. Die Benennung `agent: "Claude"` aendert diese feste Auditidentitaet nicht.

Fuer eine getrennte Zuordnung von Codex und Claude sollte der Betreiber ein eigenes Profil, etwa `internal-claude-max.json` mit Identitaet `claude-max`, einrichten und absichern. Dieser Dateiname ist ein Vorschlag, kein bereits eingerichtetes Profil. Erst danach den `--config`-Pfad in der Claude-Konfiguration umstellen. Datenbank- und Quellpfade sowie der interne Betriebsmodus bleiben dabei bewusst betreiberseitig festgelegt.

Kunden erhalten stattdessen den separaten Kundendienst mit eigener Identitaet und erlaubten Gebieten. Er stellt nur `reports_regions`, `reports_search`, `reports_get` und `reports_aggregate` bereit. Die interne Verbindung, Betreiberprofile und administrativen SSH-Zugaenge nicht an Kunden weitergeben. MCP-Werkzeuggrenzen beschraenken keinen SSH-Schluessel, der ausserhalb dieser Verbindung weitergehende Rechte hat.

## 8. Fehlerbehebung

| Beobachtung | Naechster Schritt |
| --- | --- |
| Server oder Werkzeuge fehlen | Richtige Claude-Konfiguration und Neustart pruefen; in Claude Code `/mcp` verwenden. |
| SSH endet sofort mit Code 255, ohne brauchbare Meldung | Explizites `ProgramData` im gestarteten SSH-Prozess pruefen. Das war hier ein nachgewiesener Fehlergrund, ist aber nicht die einzige moegliche Ursache fuer 255. |
| Hostschluessel unbekannt oder geaendert | Fingerabdruck vom Betreiber pruefen lassen; `StrictHostKeyChecking` nicht deaktivieren. |
| SSH verlangt ein Passwort oder lehnt den Schluessel ab | Autorisierten Schluessel beziehungsweise SSH-Agent fuer denselben Windows-Benutzer pruefen; kein Passwort in die MCP-Konfiguration schreiben. |
| `sudo`, Skript oder Betreiberprofil nicht erreichbar | Betreiber prueft Pfade und Leserechte des Serverbenutzers; nicht auf einen beliebigen Root- oder Datenbankzugang ausweichen. |
| Speichern liefert `INVALID_INPUT` | `error.detail` nennt die verletzte Regel (nur auf der internen Verbindung, ab dem Stand mit `LocalResultError`). Sonst: alle Quellseiten und Textabschnitte lesen; drei Ausgaben, Quell-IDs, Labels, Zitate, `paragraphIndex` und die vier Pruefungen gegen das Werkzeug-Schema pruefen. |
| Claude Code (Auto-Modus) blockiert `ai_claim` oder `ai_submit` als Aenderung gemeinsamer Ressourcen | In `.claude/settings.local.json` (nicht in Git) die sieben Werkzeuge `mcp__ratsmonitor_internal__ai_*` unter `permissions.allow` eintragen. Nicht in die eingecheckte `.claude/settings.json`, das Repo ist oeffentlich. |
| Reservierungskonflikt | Aktuellen Stand erneut laden; fremde Reservierungen nicht uebernehmen. Eigene abgelaufene Reservierung neu anfordern. |
| `RATE_LIMITED` | Eine Minute warten und dann fortfahren. |

Claude-Desktop-Verbindungslogs liegen normalerweise unter `%APPDATA%\Claude\logs`; relevante Dateien heissen `mcp.log` und `mcp-server-ratsmonitor_internal.log`. Vor dem Weitergeben Zugangsdaten und Token entfernen. [Offizielle MCP-Fehlerdiagnose](https://modelcontextprotocol.io/docs/develop/connect-local-servers#troubleshooting)

### Geltungsbereich und Teststand

Die SSH/MCP-Verbindung wurde auf diesem Rechner mit dem bestehenden Betreiberprofil erfolgreich getestet und fuer produktive KI-Aufbereitung verwendet.

Am 13.10.2026 wurden Variante A (Claude Desktop) und Variante B (Claude Code, `--scope local`) auf diesem Rechner eingerichtet. In Claude Code lief der vollstaendige Ablauf an `billerbeck-vo-6180`: `ai_list`, `ai_claim`, `ai_read` (alle 3 Quellen, 4 Seiten), `ai_renew` und `ai_submit` mit `state: "completed"` und drei `analysisIds`; Fehlerfaelle (zu grosses `limit`, unbekanntes Gebiet, falsches Token, erneutes Reservieren nach Abschluss) wurden abgelehnt. `ai_fail` wurde nicht produktiv aufgerufen. Claude Desktop ist eingetragen, dort aber noch nicht im Chat getestet.

Die gezeigte Verbindung verwendet SSH/STDIO, keine oeffentliche HTTP-MCP-Adresse. Sie ist deshalb nicht als URL in einen Browser-Connector einzutragen. Fuer eine reine Web-Anbindung waere eine gesondert abgesicherte, vom jeweiligen Client unterstuetzte Remote-Anbindung erforderlich.

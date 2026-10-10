/* Lena: regelbasierte Assistentin (Konzept: docs/produkt/lena-konzept.md).
   Reine Funktionen ohne React und ohne Netz: Frage verstehen und einen Plan liefern. Den Plan führt info/LenaPage.tsx aus
   (Suche über /api/search). Lena formuliert nichts frei; jede Antwort ist eine Vorlage mit eingesetzten Werten und Fundstelle. */

export type LenaKind =
  | "gruss"
  | "suche"
  | "stand"
  | "entwicklung"
  | "ausbreitung"
  | "vergleich"
  | "alarm"
  | "abdeckung"
  | "erklaerung"
  | "faq"
  | "rueckfrage"
  | "unbekannt";

export interface LenaLink {
  label: string;
  href: string;
}

export interface LenaPlan {
  kind: LenaKind;
  /** Satz vor den Treffern bzw. die ganze Antwort bei Erklärungen */
  text: string;
  /** Suchtext für /api/search (Thema und Ort) */
  q?: string;
  status?: string;
  /** frühestes Datum (JJJJ-MM-TT) */
  from?: string;
  term?: string;
  place?: string;
  /** Werte für Alarm und „In der Suche öffnen“ */
  searchTerm?: string;
  links?: LenaLink[];
  chips?: string[];
}

export interface LenaFaq {
  q: string;
  a: string | null;
}

export const LENA_INTRO =
  "Guten Tag, ich bin Lena. Ich suche Vorgänge und Beschlüsse für Sie, nenne den Stand, erkläre Begriffe und richte Alarme ein. Jede Antwort verweist auf die Originalquelle.";

export const LENA_EXAMPLES = [
  "Was gibt es zu Photovoltaik in Billerbeck?",
  "Wurde der Haushalt in Coesfeld beschlossen?",
  "Wie entwickelt sich Wärmeplanung?",
  "Was bedeutet Vertagung?",
  "Ist Wesel dabei?",
];

export const STATUS_WORD: Record<string, string> = {
  announced: "Angekündigt",
  consulting: "In Beratung",
  recommended: "Empfohlen",
  approved: "Beschlossen",
  rejected: "Abgelehnt",
  postponed: "Vertagt",
  info: "Zur Kenntnis",
  unknown: "Stand offen",
};

/** Begriffe, die Lena erklärt (kurz und neutral, keine Rechtsberatung) */
export const GLOSSAR: { t: string; keys: string[]; a: string }[] = [
  { t: "Beschlussvorlage", keys: ["beschlussvorlage", "vorlage"], a: "Eine schriftliche Vorlage der Verwaltung oder einer Fraktion, über die ein Gremium abstimmen soll. Sie enthält meist den Sachverhalt und einen Beschlussvorschlag." },
  { t: "Beschlussvorschlag", keys: ["beschlussvorschlag"], a: "Der Text, über den das Gremium abstimmen soll. Er steht in der Vorlage und kann in der Sitzung geändert werden." },
  { t: "Vertagung", keys: ["vertagung", "vertagt", "vertagen"], a: "Ein Punkt wird in dieser Sitzung nicht entschieden und auf eine spätere Sitzung verschoben." },
  { t: "Tagesordnung", keys: ["tagesordnung", "top"], a: "Die Liste der Punkte, die ein Gremium in einer Sitzung behandelt." },
  { t: "Niederschrift", keys: ["niederschrift", "protokoll"], a: "Das Protokoll einer Sitzung mit Beschlüssen und Abstimmungsergebnissen. Es wird meist in der nächsten Sitzung genehmigt." },
  { t: "Gremium", keys: ["gremium", "gremien", "ausschuss"], a: "Ein Organ der Kommune, in dem beraten und entschieden wird, zum Beispiel Rat, Ausschuss, Kreistag oder Bezirksvertretung." },
  { t: "Ratsinformationssystem", keys: ["ratsinformationssystem", "ris", "buergerinformationssystem", "bürgerinformationssystem"], a: "Das System einer Kommune, in dem Sitzungen, Vorlagen und Beschlüsse veröffentlicht werden. Plenara bündelt diese Angaben aus vielen Systemen." },
  { t: "Bebauungsplan", keys: ["bebauungsplan", "b-plan"], a: "Eine Satzung der Gemeinde, die verbindlich festlegt, wie Grundstücke in einem Gebiet bebaut und genutzt werden dürfen." },
  { t: "Flächennutzungsplan", keys: ["flaechennutzungsplan", "flächennutzungsplan", "fnp"], a: "Der vorbereitende Bauleitplan für das ganze Gemeindegebiet. Er zeigt grob, welche Flächen wofür vorgesehen sind." },
  { t: "Aufstellungsbeschluss", keys: ["aufstellungsbeschluss"], a: "Der Beschluss, mit dem ein Planverfahren, etwa für einen Bebauungsplan, förmlich eingeleitet wird." },
  { t: "Fraktion", keys: ["fraktion"], a: "Der Zusammenschluss von Mitgliedern einer Partei oder Wählergruppe im Rat." },
  { t: "Antrag", keys: ["antrag"], a: "Ein Vorschlag aus dem Rat oder der Bürgerschaft, einen Beschluss zu fassen oder etwas zu prüfen." },
  { t: "Anfrage", keys: ["anfrage"], a: "Eine Frage aus dem Rat an die Verwaltung, die diese beantwortet." },
  { t: "Satzung", keys: ["satzung"], a: "Eine von der Kommune beschlossene verbindliche Regelung, zum Beispiel zu Gebühren oder Bebauung." },
  { t: "Haushaltssatzung", keys: ["haushaltssatzung", "haushaltsplan", "haushalt"], a: "Die Satzung, mit der der Rat den Haushaltsplan für ein Jahr oder zwei Jahre festsetzt." },
];

const STOP = new Set(
  ("der die das den dem des ein eine einen einem einer eines und oder mit fuer für zu zum zur in im am an auf aus bei von vom ueber über um ist sind war waren wird wurde wurden werden " +
    "gibt es was wie wo wann welche welcher welches welchen hat haben mir mich uns bitte mal noch schon auch nicht kein keine zeig zeige zeigen suche suchen finde finden sag sage nenne " +
    "aktuell aktuelle aktuellen neu neue neuen neueste neuesten letzte letzten letzter tage tagen woche wochen monat monate monaten dieser diese diesen dieses stadt gemeinde kreis landkreis " +
    "beschlossen genehmigt abgelehnt vertagt verschoben beratung beraten stand status gibts ich sie ihr ihre wir man dort hier dazu darueber darüber zum zur thema themen bescheid neues neuigkeiten aktuelles news gibts sich entwickelt entwickeln entwicklung entwickelte trend trends verlauf ausgebreitet ausbreitung verbreitet vergleich vergleiche alarm alarme benachrichtige benachrichtigung informiere erinnere abonniere haeufiger zunehmend oft").split(" "),
);

const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss");

const clean = (s: string) => s.replace(/[?!.,;:„“"'()]/g, " ").replace(/\s+/g, " ").trim();

function statusOf(f: string): string | undefined {
  if (/(beschlossen|genehmigt|zugestimmt|verabschiedet|angenommen)/.test(f)) return "approved";
  if (/(abgelehnt|abgewiesen)/.test(f)) return "rejected";
  if (/(vertagt|verschoben|zurueckgestellt)/.test(f)) return "postponed";
  if (/(in beratung|wird beraten|berat\w+ wird|beraten)/.test(f)) return "consulting";
  if (/(angekuendigt|geplant|steht an)/.test(f)) return "announced";
  return undefined;
}

/** frühestes Datum aus Angaben wie „letzte 30 Tage“, „diese Woche“, „dieses Jahr“ */
export function fromOf(f: string, now = new Date()): string | undefined {
  const day = (n: number) => new Date(now.getTime() - n * 86400000).toISOString().slice(0, 10);
  const m = f.match(/letzte[nrm]?\s+(\d{1,3})\s+tag/);
  if (m) return day(Number(m[1]));
  if (/(diese|dieser|letzte|letzter)\s+woche|woche/.test(f)) return day(7);
  if (/(diesen|letzten|diesem)\s+monat/.test(f)) return day(31);
  if (/(dieses|diesem)\s+jahr/.test(f)) return `${now.getFullYear()}-01-01`;
  if (/\bheute\b/.test(f)) return day(0);
  const y = f.match(/\b(?:seit|ab)\s+(20\d\d)\b/);
  if (y) return `${y[1]}-01-01`;
  return undefined;
}

const PLACE_RE = /\b(?:in|im|aus|nach)\s+(?:der\s+|dem\s+|den\s+)?(?:(?:Stadt|Gemeinde|Kreis|Landkreis|Samtgemeinde)\s+)?([A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+(?:\s+(?:an der|am)\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+|\s+[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]+)?)/g;

function placeOf(raw: string): string {
  /* der letzte Treffer gilt: „Photovoltaik in Billerbeck“, nicht „in Photovoltaik“ aus einer früheren Wendung */
  const all = [...raw.matchAll(PLACE_RE)];
  return all.length ? all[all.length - 1][1].trim() : "";
}

/** Thema: Frage ohne Füllwörter, Ort, Zeit- und Statusangaben */
function topicOf(raw: string, place: string): string {
  let s = clean(raw);
  if (place) s = s.replace(new RegExp("\\b" + place.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i"), " ");
  const words = s
    .split(" ")
    .filter((w) => w && !STOP.has(fold(w)) && !/^\d{1,3}$/.test(w) && !/^(nach|vom|bis|seit|ab)$/i.test(w));
  return words.join(" ").trim();
}

const hit = (f: string, re: RegExp) => re.test(f);

function glossarFor(f: string) {
  const words = f.split(/[^a-z0-9-]+/).filter(Boolean);
  return GLOSSAR.find((g) => g.keys.some((k) => words.includes(fold(k)) || f.includes(fold(k)) && k.length > 5));
}

function faqFor(f: string, faq: LenaFaq[]): LenaFaq | null {
  const tokens = new Set(f.split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !STOP.has(w)));
  if (!tokens.size) return null;
  let best: LenaFaq | null = null;
  let bestScore = 0;
  for (const qa of faq) {
    if (!qa.a) continue;
    const hay = fold(qa.q + " " + qa.a);
    let score = 0;
    tokens.forEach((t) => {
      if (hay.includes(t)) score += fold(qa.q).includes(t) ? 2 : 1;
    });
    if (score > bestScore) {
      best = qa;
      bestScore = score;
    }
  }
  return bestScore >= 3 ? best : null;
}

const enc = encodeURIComponent;

/** Frage verstehen und Plan erstellen. `faq` sind die Fragen der FAQ-Seite, `now` für Tests. */
export function plan(input: string, faq: LenaFaq[] = [], now = new Date()): LenaPlan {
  const raw = input.trim();
  const f = fold(clean(raw));
  if (!f) return { kind: "unbekannt", text: "Bitte stellen Sie eine Frage, zum Beispiel:", chips: LENA_EXAMPLES };

  if (/^(hallo|hi|hey|guten (tag|morgen|abend)|moin|servus|gruss gott)\b/.test(f) && f.split(" ").length <= 4)
    return { kind: "gruss", text: LENA_INTRO, chips: LENA_EXAMPLES };

  const place = placeOf(raw);
  const status = statusOf(f);
  const from = fromOf(f, now);
  const topic = topicOf(raw, place);

  /* Erklärungen: „Was bedeutet …“, „Was ist …“, „Erkläre …“ */
  if (hit(f, /\b(was bedeutet|was ist ein|was ist eine|was ist|erklaer\w*|bedeutung)\b/)) {
    const g = glossarFor(f);
    if (g) return { kind: "erklaerung", text: `${g.t}: ${g.a}`, links: [{ label: "Häufige Fragen", href: "/faq" }] };
    const q = faqFor(f, faq);
    if (q?.a) return { kind: "faq", text: q.a, links: [{ label: "Häufige Fragen", href: "/faq" }] };
  }

  if (hit(f, /\b(preis\w*|kostet|kosten|tarif\w*|abo|kuendig\w*)\b/) && !place) {
    const q = faqFor(f, faq);
    return {
      kind: "faq",
      text: q?.a ?? "Die Tarife und was sie enthalten stehen auf der Preisseite. Dort können Sie auch jederzeit kündigen.",
      links: [{ label: "Preise", href: "/preise" }],
    };
  }

  /* Abdeckung: „Ist Wesel dabei?“ */
  const dabei = f.match(/\b(?:ist|sind|gibt es|habt ihr|haben sie)\s+(.+?)\s+(?:dabei|enthalten|abgedeckt|angebunden|vorhanden)\b/);
  if (dabei || hit(f, /\b(abdeckung|abgedeckt|welche (staedte|gemeinden|kommunen|orte))\b/)) {
    const ort = (dabei && raw.match(new RegExp(dabei[1].split(" ").map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\W+"), "i"))?.[0]) || place || "";
    if (ort) return { kind: "abdeckung", text: "", place: ort, q: ort, links: [{ label: "Datenabdeckung", href: "/datenabdeckung" }] };
    return { kind: "faq", text: "Welche Gebiete angebunden sind und wie aktuell die Daten sind, zeigt die Datenabdeckung.", links: [{ label: "Datenabdeckung", href: "/datenabdeckung" }] };
  }

  /* Vergleich zweier Orte */
  if (hit(f, /\b(vergleich\w*|gegenueber|versus|vs)\b/)) {
    return {
      kind: "vergleich",
      text: "Den Vergleich zweier Gebiete, mit Themenprofil und Einträgen je 1.000 Einwohner, finden Sie in der Analyse „Gebietsvergleich“ (plenara.X, Enterprise).",
      links: [{ label: "Gebietsvergleich öffnen", href: "/analytics/vergleich" }],
    };
  }

  /* Alarm */
  if (hit(f, /\b(alarm\w*|benachrichtig\w*|bescheid|informier\w*|erinner\w*|abonnier\w*)\b/)) {
    const term = [topic, place].filter(Boolean).join(" ");
    return {
      kind: "alarm",
      text: term
        ? `Ich lege eine Suche nach „${term}“ an. Speichern Sie sie, dann erhalten Sie einen Alarm, sobald es etwas Neues dazu gibt.`
        : "Nennen Sie mir ein Thema und gern einen Ort, zum Beispiel „Sag mir Bescheid bei Windkraft in Coesfeld“.",
      searchTerm: term || undefined,
      chips: term ? undefined : ["Sag mir Bescheid bei Windkraft in Coesfeld"],
      links: [{ label: "So funktionieren Alarme", href: "/funktionen/benachrichtigungen" }],
    };
  }

  /* Ausbreitung und Entwicklung (plenara.X) */
  if (hit(f, /\b(ausbreit\w*|ausgebreitet|breitet sich aus|verbreit\w*|welche (staedte|gemeinden|kommunen) (haben|beraten))\b/) && topic) {
    return {
      kind: "ausbreitung",
      term: topic,
      text: `Wie sich „${topic}“ von Gebiet zu Gebiet ausgebreitet hat, zeigt die Analyse „Ausbreitung“ (plenara.X, Enterprise).`,
      links: [{ label: `Ausbreitung von „${topic}“ öffnen`, href: `/analytics/diffusion?thema=${enc(topic)}` }],
    };
  }
  if (hit(f, /\b(entwick\w*|trend\w*|haeufiger|zunehm\w*|aufkomm\w*|verlauf|wie oft)\b/) && topic) {
    return {
      kind: "entwicklung",
      term: topic,
      text: `Wie sich „${topic}“ in den Räten entwickelt, zeigt die Analyse „Trends und Frühindikatoren“ (plenara.X, Enterprise).`,
      links: [
        { label: `Trend zu „${topic}“ öffnen`, href: `/analytics/trends?thema=${enc(topic)}` },
        { label: "Ausbreitung ansehen", href: `/analytics/diffusion?thema=${enc(topic)}` },
      ],
    };
  }

  /* Stand: „Wurde … beschlossen?“ */
  if (status && topic) {
    return {
      kind: "stand",
      q: [topic, place].filter(Boolean).join(" "),
      status,
      from,
      place,
      term: topic,
      searchTerm: [topic, place].filter(Boolean).join(" "),
      text: `Das habe ich zu „${[topic, place].filter(Boolean).join(" ")}“ mit dem Stand „${STATUS_WORD[status]}“ gefunden:`,
    };
  }

  /* Suche: alles mit einem Thema oder Ort */
  if (topic || place) {
    const q = [topic, place].filter(Boolean).join(" ");
    return {
      kind: "suche",
      q,
      from,
      place,
      term: topic,
      searchTerm: q,
      text: `Das habe ich zu „${q}“ gefunden${from ? " (seit " + from.split("-").reverse().join(".") + ")" : ""}:`,
    };
  }

  const q = faqFor(f, faq);
  if (q?.a) return { kind: "faq", text: q.a, links: [{ label: "Häufige Fragen", href: "/faq" }] };

  return {
    kind: "unbekannt",
    text: "Das habe ich leider nicht verstanden. Nennen Sie mir ein Thema und gern einen Ort. Ich suche dann die passenden Vorgänge. Zum Beispiel:",
    chips: LENA_EXAMPLES,
  };
}

/** Rückfrage, wenn eine Ortsfrage keinen Ort enthält (Version 1 sucht dann gebietsübergreifend) */
export const SEARCH_HINT =
  "Ohne Ortsangabe suche ich in allen Gebieten. Sie können mit „in <Ort>“ eingrenzen, zum Beispiel „Photovoltaik in Billerbeck“.";

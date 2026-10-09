// Regelbasierte Zusammenfassung: wählt nur Originalsätze aus dem Dokumenttext, formuliert nichts neu.
// Aufbau: Beschlussvorschlag (bis zu 2 Sätze), dann je ein Satz für Anlass, Zahlen/Kosten und Begründung.
// Nur für Artikel mit verlinktem Dokument; ohne brauchbaren Text, ohne erkennbare Struktur (Mitteilungen, „Verschiedenes“, Protokollauszüge)
// und für persönliche Schreiben gibt es keine Zusammenfassung (null).
export const RULE_SUMMARY_VERSION = 2;
const ABBR = /(?:^|[\s(])(?:z|d|u|v|bzw|ca|Nr|Abs|Art|Tel|ggf|evtl|inkl|einschl|max|min|vgl|Dr|Prof|St|Str|usw|etc|sog|zzgl|gem|lt|Mio|Mrd|Tsd|ff|Std|ggfls|ggfs|zt|zz|zzt|rd|insb|ehem|bspw|sog|Fa|Hr|Fr|[a-z])\.$/i;
const DOTTED = /^[(„"]?(?:\p{L}\.){2,}$/u;
const ANAPHORIC = /^(Dabei|Hierzu|Hierbei|Hiermit|Dazu|Dies|Diese[rsnm]?|Damit|Daher|Deshalb|Zudem|Außerdem|Ferner|Ebenso|Hinzu|Der Schwerpunkt|Inzwischen|Mittlerweile|Zwischenzeitlich|Nun|Danach|Anschließend|Darüber hinaus|Weiterhin|Ebenfalls|Hierfür|Hiervon|Davon|Dafür|Aufgrund dessen|Daraufhin|Allerdings|Jedoch|Dennoch|Trotzdem|Somit|Es geht (?:dabei|hierbei|hier))\b/;
const LEGAL_ONLY = /^(Gemäß|Nach|Laut|Entsprechend) § /;
const ROUTINE = /^(Die|Der) (Verwaltung|Kämmerin) wird .* (vorlegen|berichten)/;
const AMOUNT = /(\d[\d.,]*\s*(?:Mio\.?|Millionen|Mrd\.?|Milliarden|Tsd\.?|Tausend)?\s*(?:Euro|€)|€\s*\d|\d[\d.,]*\s*%|Prozent)/;
const REASON = /\b(daher|deshalb|aus diesem Grund|damit|empfiehlt|empfohlen|Empfehlung|vorgeschlagen|schlägt .* vor|Ziel|um .* zu|erforderlich|notwendig|Folge|Auswirkung|Ergebnis)\b/i;

// Trennstriche am Zeilenende und Seitenzahlen mitten im Satz entfernen
export function cleanText(text) {
  return String(text || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ')
    .replace(/(\p{L})-\n(?:\d{1,3}\n)?(\p{Ll})/gu, '$1$2')
    .replace(/\n\d{1,3}\n(?=\p{Ll})/gu, '\n')
    // Anrede („Sehr geehrter Herr Oberbürgermeister,“) gehört in keinen Auszug, auch nicht mitten im Satz
    .replace(/\bSehr geehrte[rn]?\s[^,\n]{0,70},\s*/gu, '');
}

// Abschnitte nach Überschriften, zeilenweise: Beschluss (Beschlussvorschlag, Beschlussempfehlung, Antrag …), Sachverhalt (Sachdarstellung,
// Begründung, Sach- und Rechtslage …) und Ende (Anlagen, Finanzielle Auswirkungen, Abstimmungsergebnis …). Eine Marke gilt als Überschrift,
// wenn nach ihr ein Doppelpunkt oder das Zeilenende folgt; die Reihenfolge im Dokument ist egal. Ohne Marken zählt alles als Sachverhalt.
const HEAD_DECISION = /^(Beschlussvorschl[aä]ge?|Vorschlag zum Beschluss|Beschlussempfehlung|Beschlussantrag|Beschlussentwurf|Beschlusstext|Beschluss|Antrag)(?:\s+(?:für|der|des|an)\b[^:\n]*)?\s*(?::\s*(.*)|$)/i;
const HEAD_FACTS = /^((?:Darstellung der |Kurzdarstellung des? )?Sachverhalt(?:sdarstellung)?(?:\s*(?:\/|und)\s*Begründung)?|Begründung(?:\s*\/\s*Sachverhalt)?|Sachstand|Sachdarstellung|(?:Darstellung der )?Sach- und Rechtslage|Problembeschreibung\/Begründung|Erläuterungen?|Ausgangslage|Bericht)\s*(?::\s*(.*)|$)/i;
// Überschrift und Text in derselben Zeile ohne Doppelpunkt („Sachverhalt und Begründung Die Amtszeit …“): nur bei eindeutigen Überschriften
const INLINE_FACTS = /^(Sachverhalt(?:sdarstellung)?(?:\s*(?:\/|und)\s*Begründung)?|Sach- und Rechtslage|Sachdarstellung|Begründung)\s+(\p{Lu}.*)$/u;
const INLINE_DECISION = /^(Beschlussvorschl[aä]ge?|Beschlussempfehlung|Beschlussentwurf)\s+(\p{Lu}.*)$/u;
const HEAD_END = /^(Unterschriften?\b|Einverständnisse?\b|Bearbeiter(?:in)?\b|Sachbearbeiter(?:in)?\b|In Vertretung|gez\.|Mit freundlichen Grüßen|(?:Der|Die) (?:Bürgermeister(?:in)?|Oberbürgermeister(?:in)?|Landrat|Landrätin)$|Anlagen?\b|Finanzielle Auswirkungen|Auswirkungen auf (?:den|die) |Abstimmungsergebnis|Abstimmergebnis|Haushaltsmittel|Jährliche Folgekosten|Verteiler|Zur Veranlassung an|Zur Kenntnis an|Beratungsfolge|Kosten und Finanzierung)/i;
export function sections(text) {
  const lines = cleanText(text).split('\n');
  const segs = [];
  let cur = null;
  for (const line of lines) {
    // Gliederungsziffer vor der Überschrift („II. Sachverhalt und Begründung“, „3) Beschlussvorschlag“) zählt nicht mit
    const raw = line.trim(), l = raw.replace(/^(?:[IVX]{1,4}|[A-Z]|\d{1,2})[.)]\s+(?=\p{Lu})/u, '');
    let m;
    if ((m = l.match(INLINE_DECISION))) cur = { kind: 'decision', text: m[2] };
    else if ((m = l.match(INLINE_FACTS))) cur = { kind: 'facts', text: m[2] };
    else if ((m = l.match(HEAD_DECISION))) cur = { kind: 'decision', text: m[2] || '' };
    else if ((m = l.match(HEAD_FACTS))) cur = { kind: 'facts', text: m[2] || '' };
    else if (HEAD_END.test(l)) cur = { kind: 'end', text: '' };
    else { if (cur) cur.text += '\n' + raw; continue; }
    segs.push(cur);
  }
  // der erste Beschlussabschnitt mit verwertbaren Sätzen (Marken in Kopfzeilen und Formularen führen oft ins Leere)
  const decisions = segs.filter(x => x.kind === 'decision');
  const usableSeg = decisions.find(x => splitSentences(x.text.slice(0, 3000)).some(usableDecision));
  const decision = ((usableSeg || decisions[0])?.text || '').slice(0, 3000);
  const marked = segs.filter(x => x.kind === 'facts').map(x => x.text).join('\n');
  return { decision: decision.replace(/^\s*(Beschlussvorschl[aä]g[^:\n]*:)\s*/i, ''), facts: marked || cleanText(text) };
}

// Kurze Zeilen ohne Satzzeichen zwischen Absätzen sind Zwischenüberschriften und gehören in keinen Satz
function dropHeadings(block) {
  const lines = block.split('\n').map(l => l.trim());
  return lines.map((l, i) => {
    const prev = lines[i - 1] ?? '.', next = lines[i + 1] ?? '';
    const heading = l && l.length < 70 && !/[.!?:;,]$/.test(l) && /^[\p{Lu}\d]/u.test(l)
      && (/[.!?:]$/.test(prev) || prev === '') && /^[\p{Lu}\d]/u.test(next)
      && l.split(' ').length <= 6 && !(/^(Die|Der|Das|Ein|Eine|Es|Wir|Sie|Er|Im|In|Am|Zu|Mit|Für|Auf) /.test(l) && l.split(' ').length >= 4);
    const titleCase = l && l.length < 50 && !/[.!?:;,]$/.test(l) && l.split(' ').length <= 4 && l.split(' ').every(w => /^[\p{Lu}\d]/u.test(w));
    return heading || titleCase ? '\n\n' : l;
  }).join('\n');
}

export function splitSentences(block) {
  const flat = dropHeadings(block).replace(/\n\n+/g, ' ¶ ').replace(/\n/g, ' ').replace(/\s+/g, ' ');
  const out = [];
  let cur = '';
  const toks = flat.split(' ');
  toks.forEach((tok, k) => {
    if (tok === '¶') { if (cur.length > 20) out.push(cur); cur = ''; return; }
    cur += (cur ? ' ' : '') + tok;
    const nextLower = /^\p{Ll}/u.test(toks[k + 1] || '');
    const ends = /[.!?]["“”)]?$/.test(tok) && !nextLower && !ABBR.test(' ' + tok) && !DOTTED.test(tok)
      && !/^\d{1,2}\.$/.test(tok) && !/^\d{1,2}\.\d{1,2}\.?$/.test(tok);
    if (ends) { out.push(cur); cur = ''; }
  });
  if (cur.length > 20) out.push(cur);
  return out.map(s => s.replace(/^\d{1,2}[.)]?\s+(?=\p{Lu})/u, '').replace(/^[•\-–]\s*/, '').trim());
}

// Nur vollständige, lesbare Sätze: Großbuchstabe am Anfang, Satzzeichen am Ende, kaum Zahlen/Tabellenreste
// Tabellenzeilen und Namenslisten bestehen fast nur aus Großgeschriebenem; ein Satz hat genug kleingeschriebene Wörter
// Anrede und Grußformeln gehören nicht in einen Auszug
const SALUTATION = /^(Sehr geehrte|Liebe[rn]? |Guten Tag|Hallo\b)/;
const proseLike = s => { const w = s.match(/\p{L}{3,}/gu) || []; return w.length > 0 && w.filter(x => /^\p{Ll}/u.test(x)).length / w.length >= 0.25; };
// Beschlusssätze enden im PDF oft ohne Punkt; im Beschlussabschnitt genügt ein vollständiger Satz ohne Schlusszeichen
const usableDecision = s => proseLike(s) && !SALUTATION.test(s) && (usable(s) || s.length >= 45 && s.length <= 420 && /^\p{Lu}/u.test(s) && (s.match(/\p{L}{3,}/gu) || []).length >= 6 && /[\p{L}\d)]$/u.test(s) && (s.match(/\d/g) || []).length / s.length < 0.15);
const usable = s => s.length >= 45 && s.length <= 420 && /^\p{Lu}/u.test(s) && /[.!?]$/.test(s)
  && (s.match(/\p{L}{3,}/gu) || []).length >= 6 && (s.match(/\d/g) || []).length / s.length < 0.15 && proseLike(s) && !SALUTATION.test(s);

// Persönliche Schreiben (Einwendungen, Briefe, Beschwerden) haben keinen Beschluss und keinen Sachverhalt: eine Auswahl von Sätzen
// ergäbe Bruchstücke. Merkmale: Anrede oder Grußformel, Ich-Form, Titel eines Schreibens, kein Beschlusstext. Ab drei Merkmalen
// gibt es keine Zusammenfassung. Fraktionsanträge (Wir-Form, mit „Antrag:“) bleiben drin.
// Das Dokument ist selbst ein Sitzungsprotokoll (Niederschrift): eine Satzauswahl ergäbe Tagesordnungspunkte und Wortmeldungen
export const isMinutes = text => /\b(Niederschrift|Protokoll)\b[^\n]{0,80}\b(Sitzung|Versammlung)\b/i.test(String(text).slice(0, 700)) || /Feststellung der (ordnungsgemäßen )?Ladung|Feststellung der Tagesordnung|Anwesend(?:e|heitsliste)?\s*:/i.test(String(text).slice(0, 4000));
const LETTER_SALUTATION = /\bSehr geehrte[rn]?\b|Mit freundlichen Grüßen|Hochachtungsvoll|Freundliche Grüße/i;
const LETTER_TITLE = /\b(Einwendung\w*|Widerspruch|Beschwerde|Schreiben|Brief|Eingabe|Petition|Einspruch)\b/i;
export function letterSignals(text, title, hasDecision) {
  const words = (String(text).match(/\p{L}+/gu) || []).length || 1;
  const firstPerson = (String(text).match(/\b(?:ich|mir|mich|mein|meine|meinen|meiner|meinem)\b/gi) || []).length;
  const signals = [
    LETTER_SALUTATION.test(text),
    firstPerson >= 3 && firstPerson / words > 0.008,
    LETTER_TITLE.test(title || ''),
    !hasDecision,
  ];
  return { count: signals.filter(Boolean).length, signals };
}
export const isLetter = (text, title, hasDecision) => letterSignals(text, title, hasDecision).count >= 3;

const wordCount = s => s.split(' ').length;
const STOP = new Set('der die das und oder den dem des ein eine einer eines einen ist sind wird werden wurde wurden hat haben für von mit auf in im zu zur zum an am bei als auch nicht nur aus nach über unter vor durch sich es sie er dass wie so noch bis dieser diese dieses sowie hier betr stadt'.split(' '));
const stems = s => new Set((String(s).toLowerCase().match(/\p{L}{4,}/gu) || []).filter(w => !STOP.has(w)).map(w => w.slice(0, 7)));
// Rückblick auf eine frühere Beratung: erklärt das Thema nicht, taugt nicht als Einleitung
const PRIOR = /\b(in (?:seiner|ihrer) Sitzung|Sitzung (?:am|vom)|hatte\b.*\bbeschlossen|einstimmig|vorberaten)\b/;
const CONTEXT = /\b(Anlass|Hintergrund|Ausgangslage|Der Rat hat|Der Ausschuss hat|plant|geplant|beabsichtigt|beantragt|Antrag|liegt vor|liegen vor|vorgeschlagen|Vorschlag|bisher|zuletzt|seit)\b/;

// Titel der Vorlage: aus den Optionen, sonst die "Betr.:"-Zeilen des Dokuments
export function titleOf(text, title) {
  if (title) return title;
  const m = cleanText(text).match(/Betr\.?:?\s*([\s\S]{5,300}?)(?:\n(?:Bezug|Höhe|Finanzierung|Beschlussvorschlag)|$)/i);
  return m ? m[1].replace(/\s+/g, ' ') : '';
}

// Einleitung: der Satz, der das Thema der Vorlage am besten benennt (Wörter aus dem Titel, Kontexthinweise, früh im Text)
export function introScores(body, head, title) {
  return pickIntro(body, head, title, true);
}
function pickIntro(body, head, title, debug = false, budget = Infinity) {
  const tw = stems(title);
  const headStems = stems(head.join(' '));
  let best = null;
  const scores = [];
  body.slice(0, 12).forEach((s, i) => {
    if (ANAPHORIC.test(s) || LEGAL_ONLY.test(s) || ROUTINE.test(s) || wordCount(s) > budget) return;
    const sw = stems(s);
    const overlap = [...sw].filter(w => tw.has(w)).length;
    const dup = sw.size && [...sw].filter(w => headStems.has(w)).length / sw.size > 0.7;
    const near = [...sw].filter(w => headStems.has(w)).length;
    const v = (tw.size ? overlap / Math.sqrt(tw.size) : 0) + Math.min(near, 3) * 0.15 + (CONTEXT.test(s) ? 0.4 : 0) + (i < 4 ? 1 - i * 0.25 : 0) - (dup ? 1 : 0)
      - (/^(Entsprechend|Nach der|Gemäß|Laut)\b/.test(s) ? 1 : 0) - (s.includes('§') ? 1.2 : 0) - (PRIOR.test(s) ? 0.9 : 0) - (/^(Insgesamt|Zusammenfassend|Abschließend|Fazit|Im Ergebnis)\b/.test(s) ? 0.8 : 0) - (/^(Am|Im|Seit|Vom) [\d\p{Lu}]/u.test(s) && /^\S+ \d/.test(s) ? 0.5 : 0) - (wordCount(s) > 35 ? 1.2 : wordCount(s) > 25 ? 0.7 : 0);
    scores.push([i, +v.toFixed(2), s.slice(0, 60)]);
    if (!best || v > best.v) best = { i, v };
  });
  if (debug) return scores;
  return best && best.v >= 0.4 ? best : { i: -1, v: best ? best.v : 0 };
}

// Ziel: Länge der KI-Fassung. Kurz etwa 30 Wörter (höchstens 40), lang etwa 100 Wörter (höchstens 140).
// Reihenfolge der Kandidaten: Einleitung, Beschluss, Zahlen, Begründung, dann weitere Sätze nach Gewicht;
// was nicht mehr passt, wird übersprungen, ein kürzerer Satz darf nachrücken. Ausgegeben wird in Dokumentreihenfolge,
// die Einleitung steht immer vorn.
export function ruleSummary(text, { target = 30, max = 40, title = '' } = {}) {
  const { decision, facts } = sections(text);
  const head = splitSentences(decision).filter(usableDecision).slice(0, 2);
  const body = splitSentences(facts).filter(usable);
  if (!head.length && body.length < 2) return null;
  if (isLetter(text, titleOf(text, title), head.length > 0) || isMinutes(text)) return null;
  // Ohne erkennbare Struktur (weder Beschlusstext noch Sachverhalt-Abschnitt) wäre die Auswahl geraten: keine Zusammenfassung
  const hasFacts = facts.length > 0 && facts !== cleanText(text);
  if (!head.length && !hasFacts) return null;
  // Pflichtsätze dürfen das Ziel um höchstens ein Viertel überschreiten: Die Einleitung bekommt, was der Beschluss übrig lässt.
  const room = target <= 40 ? max : Math.round(max * 1.25) - (head[0] ? wordCount(head[0]) : 0);
  const intro = room >= 12 ? pickIntro(body, head, titleOf(text, title), false, room) : { i: -1, v: 0 };
  const introAt = intro.i;
  const slots = [];
  const add = i => { if (i >= 0 && i !== introAt && !slots.includes(i)) slots.push(i); };
  add(body.findIndex((s, i) => AMOUNT.test(s) && i !== introAt));
  add(body.findIndex((s, i) => REASON.test(s) && i !== introAt && !slots.includes(i) && !ANAPHORIC.test(s)));
  const tstems = stems(titleOf(text, title));
  const rest = body.map((s, i) => ({ i, v: Math.min(2, [...stems(s)].filter(w => tstems.has(w)).length) * 0.4 + (AMOUNT.test(s) ? 1 : 0) + (REASON.test(s) ? 1 : 0) + (ANAPHORIC.test(s) ? -1 : 0) - (PRIOR.test(s) ? 1 : 0) - i * 0.02 }))
    .filter(x => x.i !== introAt && !slots.includes(x.i) && !ANAPHORIC.test(body[x.i])).sort((a, b) => b.v - a.v).map(x => x.i);
  const chosen = [];
  let words = 0;
  const same = (a, b) => { const x = a.replace(/\W+/g, '').toLowerCase(), y = b.replace(/\W+/g, '').toLowerCase(); return x === y || x.includes(y) || y.includes(x); };
  const tryAdd = (i, s, must = false) => {
    if (chosen.some(c => same(c.s, s))) return;
    const n = wordCount(s);
    if (!must && target <= 40 && words >= 15) return;
    if (must ? chosen.length && words + n > Math.round(max * 1.25) : chosen.length && (words + n > Math.min(max, Math.round(target * 1.3)) || words >= target)) return;
    words += n;
    chosen.push({ i, s });
  };
  if (target <= 40) {
    // Kurzfassung: ein einzelner Satz. Kandidaten: Beschlusssätze, Einleitung und die titelnächsten Sätze des Sachverhalts; gewählt wird nach
    // Titelnähe und Länge nahe am Ziel (Beschluss und Einleitung bekommen einen kleinen Vorsprung); passt keiner in die Grenze, der kürzeste
    const tw = stems(titleOf(text, title));
    const overlap = x => tw.size ? Math.min(3, [...stems(x)].filter(w => tw.has(w)).length) / Math.min(3, tw.size) : 0;
    const bodyBest = body.map((x, i) => ({ i, s: x, v: overlap(x) })).filter(c => c.i !== introAt && !ANAPHORIC.test(c.s) && !LEGAL_ONLY.test(c.s) && !ROUTINE.test(c.s) && !PRIOR.test(c.s) && c.i < 12)
      .sort((x, y) => y.v - x.v).slice(0, 3);
    const cands = [head[0] && { i: -10, s: head[0], bonus: 0.3 }, head[1] && { i: -9, s: head[1], bonus: 0.1 }, introAt >= 0 && { i: -20, s: body[introAt], bonus: 0.3 }, ...bodyBest.map(c => ({ ...c, bonus: 0 }))].filter(Boolean);
    const value = c => overlap(c.s) + c.bonus + 0.6 * Math.max(0, 1 - Math.abs(wordCount(c.s) - target) / target);
    const fits = cands.filter(c => wordCount(c.s) <= max).sort((x, y) => value(y) - value(x));
    const fit = fits[0] || cands.sort((x, y) => wordCount(x.s) - wordCount(y.s))[0];
    if (fit) tryAdd(fit.i, fit.s, true);
  } else {
    if (head.length) tryAdd(-10, head[0], true);
    if (introAt >= 0) tryAdd(-20, body[introAt], true);
    head.slice(1).forEach((s, k) => tryAdd(-9 + k, s));
  }
  for (const i of [...slots, ...rest]) tryAdd(i, body[i]);
  chosen.sort((a, b) => a.i - b.i);
  const sentences = chosen.map(c => c.s);
  // gaps[k]: Satz k folgt im Dokument nicht unmittelbar auf Satz k-1 (die Anzeige setzt dann „[…]“)
  const loc = c => c.i === -20 ? { k: 'b', p: introAt } : c.i < 0 ? { k: 'd', p: c.i + 10 } : { k: 'b', p: c.i };
  const gaps = chosen.map((c, k) => { if (!k) return false; const a = loc(chosen[k - 1]), b = loc(c); return !(a.k === b.k && b.p === a.p + 1); });
  if (!sentences.length) return null;
  const score = scoreSummary({ compact: target <= 40, text, title: titleOf(text, title), decision, head, intro, sentences, words, target, hasFacts });
  return { sentences, gaps, words, ...score, version: RULE_SUMMARY_VERSION, generatedBy: 'Regelbasierte Zusammenfassung' };
}

// Güte von 0 bis 100: misst, wie verlässlich die Regeln ausgewählt haben, nicht ob der Inhalt stimmt.
// Teile (Summe 100): Struktur 25, Einleitung 20, Titelabdeckung 15, Satzqualität 15, Länge 10, Dokumenttext 10, Betrag 5.
// Formelstand 2: Satzzahl und Betrag werden nur an der langen Fassung geprüft (Stand 1 verlangte sie auch von der einsätzigen kurzen).
function scoreSummary({ compact, text, title, decision, head, intro, sentences, words, target, hasFacts }) {
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const structure = (head.length && hasFacts ? 25 : head.length || hasFacts ? 12 : 0);
  const introPart = intro.i >= 0 ? clamp(intro.v / 1.3) * 20 : head.length ? 12 : 0;
  const tw = stems(title), got = stems(sentences.join(' '));
  const coverage = tw.size ? clamp([...tw].filter(w => got.has(w)).length / Math.min(tw.size, 4)) * 15 : 10;
  const bad = sentences.filter(x => ANAPHORIC.test(x) || LEGAL_ONLY.test(x) || ROUTINE.test(x)).length;
  // Die kurze Fassung besteht absichtlich aus einem Satz: Mindestzahl an Sätzen und Betrag gelten nur für die lange.
  const quality = clamp(1 - bad / sentences.length) * (compact || sentences.length >= 2 ? 15 : 8);
  const length = clamp(1 - Math.abs(words - target) / target) * 10;
  const plain = cleanText(text).replace(/\s/g, '');
  const readable = plain.length ? (plain.match(/[\p{L}.,;:()§€%-]/gu) || []).length / plain.length : 0;
  const docPart = clamp((readable - 0.6) / 0.25) * 10;
  const amount = compact || !AMOUNT.test(text) || sentences.some(x => AMOUNT.test(x)) ? 5 : 0;
  const parts = { structure, intro: introPart, title: coverage, sentences: quality, length, document: docPart, amount };
  return { score: Math.round(Object.values(parts).reduce((a, b) => a + b, 0)), parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, Math.round(v * 10) / 10])) };
}
export const ruleSummaryShort = (text, title) => ruleSummary(text, { target: 30, max: 40, title });
export const ruleSummaryLong = (text, title) => ruleSummary(text, { target: 100, max: 140, title });

// Gespeicherte Fassung je Artikel (Feld `ruleSummary`): kurz und lang mit Güte; null ohne brauchbaren Text
// source: Dokument, aus dem die Sätze stammen ({ url, title }); die Anzeige nennt es als Quelle des Auszugs
// Mindestgüte: darunter ist der Auszug zu schwach für die Anzeige
export const MIN_SCORE = 60;
export function buildRuleSummary(text, title = '', at = new Date().toISOString(), source = null) {
  const short = ruleSummaryShort(text, title), long = ruleSummaryLong(text, title);
  if (!short || !long) return null;
  if (Math.round((short.score + long.score) / 2) < MIN_SCORE) return null;
  const pick = r => ({ sentences: r.sentences, gaps: r.gaps, words: r.words, score: r.score, parts: r.parts });
  return { version: RULE_SUMMARY_VERSION, generatedBy: 'Regelbasierte Zusammenfassung', generatedAt: at, ...(source?.url ? { source: { url: source.url, title: source.title || '' } } : {}), score: Math.round((short.score + long.score) / 2), short: pick(short), long: pick(long) };
}

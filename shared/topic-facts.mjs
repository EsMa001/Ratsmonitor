/**
 * Fakten aus Titel und Volltext eines Berichts für plenara.X (Tabelle topic_facts, drizzle/0025): welche Fraktion einen
 * Antrag oder eine Anfrage stellt (Fraktionsprofil) und welches Förderprogramm genannt wird, bewilligt oder beantragt,
 * Verfahrensschritt und geplante Wohneinheiten eines Bauleitplans, Entscheidungen zu
 * Kita-Elternbeiträgen und neue Kita-Plätze, Hebesätze, Abwasser- und Wassergebühren je m³/m²,
 * Schritt der Wärmeplanung und Zuschüsse an Vereine und Träger; im Atlas über GET /api/x (Werte aus den Unterlagen). Rein regelbasiert; erkannt wird nur, was ausdrücklich dasteht. Gefüllt von scripts/pdf-store/facts.mjs
 * (lokale PDF-Ablage) und im Import, sobald er ein Dokument liest (refreshSummaries in server/services/sync.ts).
 * Neue Regeln: FACTS_VERSION erhöhen und das Skript erneut laufen lassen. Tests: tests/topic-facts.test.mjs.
 */
import {itemKind} from './item-kind.mjs';
export const FACTS_VERSION='facts-v27';
// Satzende: Punkt, Semikolon, Frage- oder Ausrufezeichen, danach ein Großbuchstabe; nicht nach Ziffern („zum 1.8. um 5 %“)
// und nicht nach Abkürzungen aus einem Buchstaben („e. V.“, „z. B.“)
const SENTENCE=/(?<=[^0-9][.;!?])(?<!(?:^|[\s(])\p{L}\.)(?<!\b(?:Mio|Mrd|Tsd)\.)\s+(?=[A-ZÄÖÜ„"])/u;
/* Sammelpunkte (Anfragen, Mitteilungen, Haushalt, Sachstandsberichte …) sprechen über viele Vorhaben und Fraktionen zugleich:
   aus ihnen wird nichts abgeleitet, außer ihr Titel nennt die Förderung selbst (Stichprobe 11.10.2026). */
export const COLLECTIVE=/\bAnfragen\b|Beantwortung|Mitteilung|Informationen|Verschiedenes|Niederschrift|Tagesordnung|Haushalt|Jahresabschluss|Beteiligungsbericht|Lagebericht|Sachstand|Statusbericht|Bericht (der|des|aus)|Berichte\b|Eingänge/i;

/* Parteifamilien. Lokale Wählergruppen heißen überall anders und werden zusammengefasst. */
export const PARTIES=[
 ['CDU/CSU',/\b(CDU|CSU)\b/],
 ['SPD',/\bSPD\b/],
 ['Grüne',/GR[ÜU]NEN?\b|Bündnis\s*90|\bB\s?90\b|\bGrüne\b/i],
 ['FDP',/\bFDP\b|\bFreie Demokraten\b/],
 ['AfD',/\bAfD\b/],
 ['Linke',/\bDIE LINKE\b|\b[Dd]ie Linke\b|\bLinke\b|\bLINKE\b/],
 ['BSW',/\bBSW\b|Bündnis Sahra Wagenknecht/],
 ['Freie Wähler und Wählergruppen',/Freien?\s+Wähler|Freie Liste|\bBfB\b|\bFWG\b|\bUWG\b|\bUBG\b|\bFBI\b|Wählergemeinschaft|Wählergruppe|Bürgerliste|Bürgerforum|Unabhängige/i],
 ['Volt',/\bVolt\b/],
 ['ÖDP',/\bÖDP\b/],
 ['Die PARTEI',/Die PARTEI\b/],
];
// Der Antragsteller steht in einer festen Wendung: „Antrag der SPD-Fraktion“, „Anfrage der Fraktion BÜNDNIS 90/DIE GRÜNEN“,
// „Antrag CDU-Fraktion“, „Fraktion DIE LINKE: Antrag …“. Nur diese Wendung wird nach Parteien abgesucht, nicht der ganze Text.
const KIND='(Antrag|Anträge|Änderungsantrag|Prüfantrag|Haushaltsantrag|Eilantrag|Ergänzungsantrag|Dringlichkeitsantrag|Prüfauftrag|Anfrage|Große Anfrage|Kleine Anfrage|Anregung)';
const WHO='(Fraktion(?:en)?|Ratsfraktion|Kreistagsfraktion|Gruppe|Fraktionsgemeinschaft)';
const APPLICANT=[
 // Nicht mitten im Wort („Haushaltsbegleitantrag zur …“); zusammengesetzte Antragsarten stehen in KIND
 new RegExp(`(?<![a-zäöüß])${KIND}\\s*(?:der|des|von\\s+der|von|:)?\\s*([^\\n.;]{0,90}?${WHO}[^\\n.;]{0,70})`,'i'),
 new RegExp(`([^\\n.;]{0,60}-${WHO}|${WHO}\\s+[^\\n.;]{2,60})\\s*[:,–-]?\\s*${KIND}`,'i'),
 // Partei ohne „Fraktion“: „Antrag LINKE LISTE auf …“, „Antrag der SPD vom …“ (Messung CFA, 14.10.2026)
 new RegExp(`${KIND}\\s+(?:der\\s+|des\\s+)?(?:[\\wäöü]+-)?(?:CDU|CSU|SPD|FDP|AfD|BSW|LINKE|Linken?|GRÜNEN|Grünen|Bündnis 90|Freien Wähler|FWG|UWG|Volt|ÖDP)\\b[^\\n.;:]{0,40}`),
 // „Einreicherin: Maria X, Fraktion DIE LINKE.“
 new RegExp(`Einreicher(?:in)?:[^\\n;]{0,80}?${WHO}[^\\n;]{0,40}`,'i'),
];
/** Fraktionen als Antragsteller: {parties:[...], kind:'antrag'|'anfrage'} oder null. Mehrere bei gemeinsamen Anträgen. */
export function factionsOf(title,head=''){
 // Nennt der Titel selbst den Antragsteller, zählt er auch bei Sammelwörtern („Sachstand … (Anfrage der Fraktion X)“,
 // „Antrag der CDU-Fraktion - Maßnahmen zum Haushaltssicherungskonzept“, „Beantwortung der Anfrage …“; Messung CFA,
 // 14.10.2026). Den Text liest nur, wer kein Sammelpunkt ist.
 if(/\bAnfragen\b|\bAnträge\b|Verschiedenes|Eingänge|Niederschrift|Tagesordnung/i.test(String(title||'')))return null;
 const collective=COLLECTIVE.test(String(title||''));
 for(const source of collective?[String(title||'')]:[String(title||''),String(head||'').slice(0,1500)]){
  for(const re of APPLICANT){
   // Alle Fundstellen: „Haushaltsbegleitantrag zur … (Ergänzungsantrag der Fraktionen CDU, SPD …)“
   for(const m of source.matchAll(new RegExp(re.source,re.flags+'g'))){
    // „Änderungsantrag der SPD zum Antrag der CDU-Fraktion“: nach „zum/zur“ steht der Antrag, auf den er sich bezieht
    const phrase=m[0].split(/\s(?:zum|zur|zu dem|betreffend den)\s/i)[0];
    const parties=PARTIES.filter(([,r])=>r.test(phrase)).map(([n])=>n);
    if(parties.length)return {parties,kind:/anfrage/i.test(phrase)?'anfrage':'antrag'};
   }
  }
 }
 return null;
}


/* Betrag in Euro (auch von anderen Regeln genutzt) und Höchstbeträge davor */
const EURO_NUM=String.raw`(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d+)?)\s*(Mio\.?|Millionen|Mrd\.?|Milliarden|T€|TEUR|Tsd\.?\s*(?:€|Euro|EUR)|Tausend\s*(?:€|Euro))?\s*(€|Euro|EUR)?`;
const LIMIT_BEFORE=/maximal|\bmax\.|möglich|mögl\.|Höchst|höchstens|bis zu|mindestens|Mindest|\bmin\.|Bagatell|Wertgrenze|mehr als|über\s*$|Eigenanteil|Kofinanzierung|ehemals|statt|bisherige|ursprünglich|jährlich|monatlich/i;

/* Bauleitplanung: Plan und Verfahrensschritt aus dem Titel, sonst aus dem Beschlussvorschlag („… beschließt …“), nicht aus dem
   ganzen Text (der Verfahrensübersichten mit allen früheren Schritten enthält). Bei mehreren Schritten zählt der weiteste. */
const PLAN=/Bebauungsplan|B-Plan|Bebauungsplanes|Vorhaben- und Erschließungsplan|vorhabenbezogene[nr]? Bebauungsplan|Flächennutzungsplan|FNP/i;
export const STAGES=[
 ['Aufstellung',/Aufstellungsbeschluss|Aufstellung (des|eines|der)|Einleitung des Verfahrens/i],
 ['Frühzeitige Beteiligung',/frühzeitige|Vorentwurf|§\s*3\s*Abs\.?\s*1|§\s*4\s*Abs\.?\s*1/i],
 ['Offenlage',/Offenlage|öffentliche Auslegung|Offenlegung|Veröffentlichung im Internet|Entwurfsbeschluss|Auslegungsbeschluss|erneute Beteiligung|§\s*3\s*Abs\.?\s*2|§\s*4\s*Abs\.?\s*2/i],
 ['Abwägung',/Abwägung|eingegangenen Stellungnahmen|Behandlung der (?:Stellungnahmen|Anregungen)|Prüfung der Stellungnahmen/i],
 ['Satzungsbeschluss',/Satzungsbeschluss|als Satzung|Feststellungsbeschluss|abschließende[nr]? Beschluss|§\s*10\s*Abs\.?\s*1/i],
];
const REPEAL=/Aufhebung (des|eines|der)\s+(Bebauungsplan|B-Plan|vorhabenbezogenen)|Aufhebungsbeschluss|Aufhebungssatzung/i;
const decision=text=>(String(text||'').replace(/\s+/g,' ').match(/(Beschlussvorschlag|beschließt|Beschluss:)[^]{0,600}/i)||[''])[0];
/** {stage, type, plan} oder null. type: 'Bebauungsplan' oder 'Flächennutzungsplan'; plan: Planbezeichnung (Nummer oder Name) zum Zusammenfassen. */
// Bauanträge im Plangebiet und Sammelberichte nennen den Plan, sind aber kein Planverfahren
// Ebenso Stellungnahmen zu Plänen der Nachbargemeinden (§ 2 Abs. 2 BauGB): dort geht es um fremde Pläne
const NOT_PLAN=/Bauantrag|Bauvoranfrage|Vorbescheid|Einvernehmen|§\s*36\s*BauGB|Befreiung|Nutzungsänderung|Genehmigungsfreistellung|Bauantr[aä]g|Nachbargemeinde|Nachbarkommune|benachbarte|§\s*2\s*Abs\.?\s*2\s*BauGB/i;
const OWN_COMMENTS=/Abwägung|eingegangene|Behandlung|Prüfung der|Würdigung|Stellungnahmen (?:der|aus) (?:Träger|Behörden|Öffentlichkeit|frühzeitigen)/i;
export function planOf(title,text=''){
 const t=String(title||'');if(!PLAN.test(t)||NOT_PLAN.test(t)||COLLECTIVE.test(t)||/Fraktion|Sammelverfahren|Zuwendung/i.test(t)||/Stellungnahme/i.test(t)&&!OWN_COMMENTS.test(t))return null;
 const type=/Flächennutzungsplan|FNP/i.test(t)&&!/Bebauungsplan|B-Plan/i.test(t)?'Flächennutzungsplan':'Bebauungsplan';
 const pick=src=>{if(REPEAL.test(src))return 'Aufhebung';let best=null;for(const [name,re] of STAGES)if(re.test(src))best=name;return best;};
 const stage=pick(t)||pick(decision(text))||'Sonstiger Schritt';
 const no=t.match(/(?:Nr\.?|Nummer)\s*([0-9][0-9A-Za-z./ -]{0,12}?)(?=[\s,:;"„“(]|$)/);
 const name=t.match(/[„"“]([^"“”]{3,60})[”"“]/);
 return {stage,type,plan:(no?'Nr. '+no[1].trim():name?name[1].trim():t.replace(/\s+/g,' ').slice(0,80)).toLowerCase()};
}
/* Art des Plangebiets (Bauleitplanung): aus Titel und Planname, sonst aus dem Beschlussvorschlag. Ein Plan kann mehrere Arten
   haben („Gewerbe- und Industriegebiet“). Abkürzungen der BauNVO (GE, GI, SO, MI, WA) nur als ganze Wörter in Großschreibung. */
export const PLAN_USES=[
 ['Industrie',/Industrie(?!-?\s*und\s*Handelskammer)/i,/\bGI\b/],
 ['Gewerbe',/Gewerbe(?!steuer)|gewerblich|Betriebserweiterung|Betriebsgelände|Firmengelände|Handwerkerhof|Bauhof/i,/\bGE\b/],
 ['Logistik',/Logistik|Distributionszentrum|Verteilzentrum|Güterverkehrszentrum|\bGVZ\b|Speditio/i],
 ['Einzelhandel',/Einzelhandel|Nahversorg|Lebensmittel(markt|discounter|vollsortimenter)|Verbrauchermarkt|Fachmarkt|Supermarkt|Discounter|Einkaufszentrum|Baumarkt|Drogeriemarkt|großflächig|\b(?:EDEKA|REWE|Lidl|Aldi|Netto|Penny|Kaufland|Norma)\b/i],
 ['Energie',/Photovoltaik|Fotovoltaik|Solar|PV-|\bPV\b|Agri-?PV|Windenergie|Windpark|Windkraft|SO Wind|Vorrangfläche für Wind|Konzentrationszone|Batteriespeicher|Energiespeicher|Speicheranlage|Umspannwerk|Biogas|Elektrolyse|Wasserstoff|Energiepark|Erneuerbare|Energiegewinnung/i],
 ['Rechenzentrum',/Rechenzentr|Data ?Cent(er|re)/i],
 ['Batteriespeicher und Wasserstoff',/Batteriespeicher|Energiespeicher|Stromspeicher|Großspeicher|\bBESS\b|Wasserstoff|Elektrolys/i],
 ['Hotel, Camping und Freizeit',/Hotel|Camping|Wohnmobil|Ferienhaus|Ferienhäuser|Ferienwohnanlage|Feriendorf|Ferienpark|Freizeitpark|Freizeitanlage|Tourismus/i],
 ['Mischgebiet',/Mischgebiet|urbane[sn]? Gebiet|\bM[IUD]\b|Dorfgebiet/],
 ['Wohnen',/Wohn(gebiet|bau|baufläche|quartier|anlage|siedlung|park|ungen|en\b)|[\p{L}]-?[Ss]iedlung\b|Einfamilienh|Mehrfamilienh|Neubaugebiet|Baugebiet|Wohnraum/iu,/\bWA\b/],
];
const SINGLE_PLOT=/Ferienwohn|Ausschluss von|Straßenbezeichnung|Straßenname|Handwerk|Nachbargemeinde|isolierte Abweichung|Antrag auf (?:Abweichung|Änderung|Befreiung)|Ausnahmeregelung|Abweichung vom Gestaltung|Errichtung eine[sr] (?:Einfamilien|Mehrfamilien|Doppel|Wohn|Carport|Garage)|Fl\.?\s?-?Nr|Flst|Flurstück|Grundstück [\p{L}-]+(?:straße|weg|str\.) \d/iu;
const INTERCOMMUNAL=/interkommunal|\bIKG\b|\bIGP\b|Zweckverband|gemeinsame[sn]? (Gewerbe|Industrie)/i;
/** {uses:[…], inter} oder null */
export function planUseOf(title,text=''){
 const t=String(title||'');if(!planOf(t,text))return null;
 // Einzelvorhaben in einem bestehenden Plan (ein Grundstück, eine Abweichung) und Aufhebungen sind kein neues Plangebiet
 if(SINGLE_PLOT.test(t)||REPEAL.test(t))return null;
 const find=src=>PLAN_USES.filter(([,re,abbr])=>re.test(src)||abbr?.test(src)).map(([n])=>n);
 let uses=find(t);
 if(!uses.length)uses=find(decision(text).slice(0,400));
 // Weder Titel noch Beschlussvorschlag nennen die Nutzung: Anfang der Vorlage, nur wenn Wohnen klar überwiegt
 if(!uses.length&&text){const head=String(text).replace(/\s+/g,' ').slice(0,3000);
  const wohn=(head.match(/allgemeine[ns]? Wohngebiet|reine[ns]? Wohngebiet|Wohnbaufläche|Wohnbebauung|Wohnbauland|Wohnhäuser|Einfamilienh|Doppelh|Reihenh|Bauplätze|\bWA\b/g)||[]).length;
  const other=(head.match(/Gewerbe|Industrie|Sondergebiet|Photovoltaik|Solar|Wind|Einzelhandel|Logistik|Camping|Ferien/g)||[]).length;
  if(wohn>=2&&wohn>2*other)uses=['Wohnen'];}
 return uses.length?{uses,inter:INTERCOMMUNAL.test(t)}:null;
}
/* plenara.X Signale 2 (Neue Wohnbaugebiete): Art des Vorgangs aus dem Titel */
export const WOHNBAU_ARTS=[
 ['Bauplatzverkauf',/Vergabekriterien|Ausschreibung (?:der|von) [\p{L}-]*grundstücke|Grundstücksverk|Bauplatz|Bauplätze|Baugrundst|Wohnbaugrundst|Grundstücksvergabe|Konzeptvergabe|Vermarktung|Verkauf|Veräußerung|Kaufpreis|Verkaufspreis|Bodenpreis|Baulandpreis|Losverfahren|Vergaberichtlinie|Bieterverfahren/iu],
 ['Erschließung',/Endausbau|Asphalt|Straßenbeleuchtung|Erschließung(?!splan)|Umlegung|Erschließungsvertrag|Ausgleichsmaßnahme/i],
 ['Änderung',/Änderung|Teiländerung|Deckblatt|Ergänzung/i],
 ['Erweiterung',/Erweiterung/i],
 ['Neues Baugebiet',/./],
];
export function wohnbauArtOf(title){return WOHNBAU_ARTS.find(([,re])=>re.test(String(title||'')))[0];}
/** Geplante Wohneinheiten (größte genannte Zahl in einem Satz mit Planungsbezug), sonst null */
export function housingOf(text){
 let best=null;
 for(const s of String(text||'').replace(/\s+/g,' ').split(SENTENCE)){
  if(!/(entsteh|geplant|vorgesehen|errichtet|Errichtung|ermöglich|Bau von|Neubau|realisier|insgesamt|ca\.|rund|bis zu|etwa)/i.test(s))continue;
  // Bestand statt Planung („Die vormals vorhandenen Wohngebäude mit insgesamt 104 Wohneinheiten“)
  if(/vormals|ehemal|abgerissen|zurückgebaut|bestehende[nr]?\s+(Wohn|Gebäude)|vorhandene[nr]?\s+(Wohn|Gebäude)|im Bestand/i.test(s))continue;
  for(const m of s.matchAll(/(\d{1,4}(?:\.\d{3})?)\s*(?:bis\s*\d{1,4}\s*)?(?:neue[n]?\s+)?(Wohneinheiten|WE\b|Wohnungen)/g)){const v=Number(m[1].replace('.',''));if(v>=3&&v<=5000&&!(v>=1990&&v<=2100))best=Math.max(best||0,v);}
 }
 return best;
}

/* plenara.X Signale, Kategorien 4 bis 9 (docs/produkt/plenara-x-signale.md): je Vorgang ein Filterwert aus dem Titel, null wenn der
   Vorgang nicht zur Kategorie gehört. Anfragen, Anträge von Fraktionen, Berichte und Einzelbauanträge Dritter zählen nicht. */
const SIG_NOT=/(?<!Such)Anfrage|Beantwortung|Antrag (?:der|des) (?:Fraktion|Ratsmitglied|Stadtverordnet|Gemeinderat|Kreistag)|Fraktion|Bauantrag|Bauvoranfrage|Baugesuch|Nutzungsänderung/i;
const firstOf=(list,t)=>list.find(([,re])=>re.test(t))?.[0]||null;
/* 4 Windenergie: Art des Verfahrens */
const WIND_TITLE=/Raumordnungsplan Wind|\bROPW\b|Windenergie|Windkraft|Windpark|Windrad|Windräder|\bWEA\b|Windenergieanlage|Windkraftanlage|Repowering(?![^]{0,30}Solar)/i;
const WIND_STEPS=[
 ['Regionalplanung',/Raumordnungsplan|Teilregionalplan|Sachliche[nr]? Teilplan|\bRROP\b|Planungsverband|Raumordnungsprogramm|Regionalplan|Raumentwi?c?klungsprogramm|Raumordnung|Landesentwicklungsplan|Regionales Raumordnungsprogramm/i],
 ['Genehmigungsantrag (BImSchG)',/BImSchG|Errichtung (?:und Betrieb )?(?:von )?(?:\d+|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|insgesamt \d+) (?:Windenergie|Windkraft)|Genehmigungsverfahren|Immissionsschutz|Genehmigungsantrag|Baugenehmigung|Vorbescheid|Antrag auf (?:Errichtung|Genehmigung)|Änderungsgenehmigung/i],
 ['Bauleitplanung',/Bebauungsplan|B-Plan|Fl.{1,2}chennutzungsplan|Sondergebiet|Konzentrationszone|Vorrang|Windenergiegebiet|Teilflächenplan|Positivplanung/i],
 ['Bürger- und Kommunalbeteiligung',/Beteiligung (?:von|der) (?:Bürger|Kommune|Gemeinde)|finanzielle[nr]? Beteiligung|Beteiligung an Wind|Bürgerwind|Bürgerenergie|§\s?6\s*EEG|Akzeptanzabgabe|Beteiligungsgesellschaft|Genossenschaft/i],
 ['Einvernehmen',/Einvernehmen|§\s?36\s*BauGB|Stellungnahme|Beteiligung als Träger|Träger öffentlicher Belange/i],
];
export function windStepOf(title){const t=String(title||'');if(!WIND_TITLE.test(t)||/Kleinwind|Bericht|Sachstand|Gremienbesetzung|Besetzung|Tempo\s?\d|Halteverbot|Arbeitskreis|Jagdvorst/i.test(t)||SIG_NOT.test(t)&&!/BImSchG|Immissionsschutz/i.test(t))return null;return firstOf(WIND_STEPS,t)||'Sonstiges';}
/* 5 Solarenergie */
const SOLAR=[
 ['Agri-PV',/Agri[-\s]?PV|Agri-?Photovoltaik|Agrar-?PV/i],
 ['Batteriespeicher',/Batteriespeicher|Stromspeicher|Energiespeicher|Großspeicher|\bBESS\b/i],
 ['Freiflächen-PV',/Freiflächen|Solarpark|Photovoltaik-?Park|PV-?Park|Solarfeld|Floating|schwimmende|Freiflächenphotovoltaik|Sondergebiet (?:Photovoltaik|Solar|PV)|(?:Bebauungsplan|Flächennutzungsplan|B-Plan|BBP|Bauleitplanung|FNP|Sondergebiet|Sonderbaufläche)[^]{0,120}(?:Photovoltaik|Solar|\bPV\b)|(?:Photovoltaik|Solar|\bPV\b)[^]{0,80}(?:Bebauungsplan|Flächennutzungsplan|Sondergebiet)/iu],
 ['Dach-PV kommunal',/(?:PV|Photovoltaik|Solar)[\p{L}-]*(?:anlage)?\s+(?:auf|für)\s+(?:dem|den|der|das)?\s*(?:Dach|Dächer|Rathaus|Schule|Grundschule|Kita|Kindergarten|Feuerwehr|Feuerwache|Bauhof|Halle|Sporthalle|Turnhalle|Gebäude|Dorfgemeinschaftshaus|DGH|Kläranlage|Freibad)|Dach-?PV|Dachflächen|Gemeindedäch|Balkonkraftwerk|(?:Haus|Halle|Hallenbad|Schule|Kita|Kindergarten|Gebäude|Rathaus|Carport|Dach|Bauhof|Freibad|Klärwerk|Feuer|Dorfladen|Gemeindezentrum|Festsaal|Bürgerhaus|Mehrzweckhalle)[\p{L}]*\b[^]{0,60}(?:Photovoltaik|PV)|(?:Photovoltaik|PV)[^]{0,60}(?:Haus|Halle|Schule|Kita|Kindergarten|Krippe|Bildungshaus|Saal|Gebäude|Rathaus|Dach)/iu],
 ['Sonstige PV',/./],
];
export function solarOf(title){const t=String(title||'');if(!/Photovoltaik|Fotovoltaik|Solar|\bPV\b|PV-|Agri[-\s]?PV|Batteriespeicher|Stromspeicher|Energiespeicher|\bBESS\b/i.test(t)||/Solarium|Solarkataster|Verlustrechnung|Garagendach|Wärmepumpe|Abwasserentsorgung|Einwohnerversammlung|Arbeitskreis|Innentüren|Metallbau|Ausbaustrategie|Bericht|Sachstand|Balkon|Mitgliedschaft|Verband|Baugenehmigung|Bauvorhaben|Befreiung|denkmalschutzrechtliche Erlaubnis|Solarfreibad|Kategorisierung der Dachfläche|Einfamilien|Wohnhaus|Bauort|Fl\.?\s?-?Nr|Flst|Abweichung|Zuschussantrag|e\.\s?V\.|Bündnis|Genehmigungsfreistellung/i.test(t)||SIG_NOT.test(t))return null;return firstOf(SOLAR,t);}
/* 6 Wärme und Energieeffizienz (Wärmeplanung kommt aus heat_plan) */
const ENERGY=[
 ['Konzessionen',/Konzessionsvertr|Konzessionsvergabe|Konzessionsverfahren|Wegenutzungsvertr|(?:Strom|Gas|Wasser)konzession/i],
 ['Wärmenetz und Fernwärme',/Wärmenetz|Nahwärme|Fernwärme|Wärmeverbund|Heizzentrale|Wärmeversorgung|Biomasseheiz|Heizwerk/i],
 ['Heizungstausch',/Heizinstallation|Wärmetauscher|Heizung(?!sbau)|Heizverteilung|Heizhaus|Heiztechnik|Wärmeerzeugung|heizungstechnisch|Wärmepumpe|Heizanlage|Kesselanlage|Pelletheiz|Hackschnitzelheiz|Gasheizung|Ölheizung/i],
 ['LED-Straßenbeleuchtung',/\bLED\b|(?:Straßen)?[Bb]eleuchtung[^]{0,60}(?:Umrüst|Austausch|Modernis|Erneuerung|energieeffizient|stromsparend)|(?:Umrüst|Austausch|Modernis|Erneuerung)[^]{0,60}[Bb]eleuchtung/],
 ['Energetische Sanierung',/energetisch|Energieeffizien|Wärmedämm|Dämmung|Fenstertausch|Fassadendämm|Klimaschutzmaßnahme|Energieeinspar/i],
];
export function energyOf(title){const t=String(title||'');if(/Wärmeplan|Bericht|Sachstand|Befreiung|Bauvorhaben|Gestaltungssatzung|Baugenehmigung|Wartungsvertrag|Vortragsveranstaltung|Wintergarten|Einvernehmen|Grundstück|Wohnhaus|Betriebsleiter|Dunkle|Einfamilien|Zweifamilien|Flurstück|Fl\.?\s?Nr|isolierte Abweichung|e\.\s?V\.|Zuschüssen|Herrnhuter|Fahrradbügel|\bBA \d/i.test(t)||SIG_NOT.test(t))return null;return firstOf(ENERGY,t);}
/* 2 und 3: Entwicklung eines Bau- oder Gewerbegebiets ohne Bebauungsplan im Titel (Erschließung, Vermarktung, Vorkaufsrecht,
   Gesellschaft, Erweiterung); Bebauungspläne kommen über plan_use */
const AREA_DEV=[
 ['Industrie',/Industrie(?:gebiet|park|fläche)/i],
 ['Gewerbe',/Gewerbe(?:gebiet|park|fläche|ansiedlung|grundstück)|interkommunale[sn]? Gewerbe/i],
 ['Wohnen',/Neubaugebiet|Wohn(?:bau)?gebiet|Baugebiet|Wohnbaufläche|Wohnquartier|Bauplätze|Bauplatz|Baugrundstücke|Wohnbaugrundstück/i],
];
const AREA_ACT=/Erschließung|Entwicklung|Erweiterung|Vermarktung|Vergabe|Verkauf|Vorkaufsrecht|Ansiedlung|Ausweisung|Information|Gesellschaft|Zweckverband|neue[sn]?|Grunderwerb|Ankauf|Erwerb|Umlegung|Bauplatzpreis|Kaufpreis|Richtlinie/i;
const AREA_NOT=/Ferienwohn|Straßenbezeichnung|Ausschluss von|Bebauungsplan|B-Plan|Flächennutzungsplan|FNP|Feuerwehr|Regenrückhalt|Widmung|Straßenname|Benennung|Kanal|Befreiung|Bauvorhaben|Baugenehmigung|Spielplatz|Kita|Kindergarten|Schule|Gewerbesteuer|Gewerbe und Meldewesen|Haushaltsplan|Handwerk|eines Baugrundstück|Baugrundstückes Nr|Zuwendung|ÖPNV|Wahl d|Ausgleich|Ersatzmaßnahme|Los \d|Veräußerung des Regen|Ankauf Landwirtschaft/i;
export function areaDevOf(title){const t=String(title||'');if(!(AREA_ACT.test(t)||/^\s*(?:Neu)?[Bb]augebiet\b/.test(t))||AREA_NOT.test(t)||SIG_NOT.test(t))return null;return firstOf(AREA_DEV,t);}
/* 7 Schulen, Kitas und Sportstätten: nur Bauvorhaben */
const SCHOOL_BUILD=/Neubau|Ersatzneubau|Erweiterung|Sanierung|Generalsanierung|Umbau|Anbau|Modulbau|Container|Interim|Errichtung|Bau\s|Baumaßnahme|Neugestaltung|Modernisierung|Ertüchtigung/i;
const SCHOOLS=[
 ['Kita',/Kita|KiTa|Kindertages|Kindergarten|Krippe|Kinderhaus|\bHort\b|Familienzentrum/i],
 ['Grundschule',/Grundschule|Primarschule/i],
 ['Weiterführende Schule',/Gymnasium|Realschule|Gesamtschule|Oberschule|Mittelschule|Sekundarschule|Gemeinschaftsschule|Hauptschule|Berufsschule|Berufskolleg|Förderschule|Stadtteilschule|Schulzentrum|Schule/i],
 ['Sporthalle und Sportplatz',/Sporthalle|Turnhalle|Mehrzweckhalle|Dreifeld|Sportplatz|Kunstrasen|Sportanlage|Stadion|Leichtathletik/i],
 ['Schwimmbad',/Schwimmbad|Hallenbad|Freibad|Lehrschwimm|Kombibad|Naturbad/i],
 ['Spielplatz',/Spielplatz|Spielgerät|Skatepark|Pumptrack|Bolzplatz|Mehrgenerationenpark/i],
];
export function schoolBuildOf(title){const t=String(title||'');if(!SCHOOL_BUILD.test(t)||SIG_NOT.test(t)||/Bericht|Sachstand|Satzung|Gebühr|Entgelt|Beitr[aä]g|Speisung|Verpflegung|Reinigung|Betreuungszeit|Genehmigung zur Errichtung|Schulart/i.test(t))return null;return /Grundschule/i.test(t)?'Grundschule':firstOf(SCHOOLS,t);}
/* Signale Straßen (8), Wasser (9), Breitband (11): Art und Stand des Vorhabens aus dem Titel; detail = Stand */
const PROJECT_STEPS=[
 ['Abschluss',/Abnahme|Fertigstellung|Schlussrechnung|Abrechnung|Widmung|Inbetriebnahme|Einweihung|Verkehrsfreigabe/i],
 ['Vergabe',/Vergabe|Auftrag|Ausschreibung|Submission|Zuschlag|Beauftragung/i],
 ['Bau',/Baubeginn|Bauzeit|Bauarbeiten|Vollsperrung|Sperrung|Umleitung|Bauablauf|Nachtrag|Baufortschritt|Baustelle/i],
 ['Beschluss und Förderung',/Baubeschluss|Ausführungsbeschluss|Maßnahmenbeschluss|Grundsatzbeschluss|Durchführungsbeschluss|Förder|Zuwendung|Finanzierung|Bauprogramm/i],
 ['Planung',/Planung|Entwurf|Vorplanung|Konzept|Machbarkeit|Variante|Studie|Untersuchung|Gutachten|Vorstellung|Bürgerbeteiligung|Geplant/i],
 ['Sachstand',/Sachstand|Information|Stand de[rs]|Bericht|\bInfo\b|aktuell|Zukunft/i],
];
const projectStep=t=>firstOf(PROJECT_STEPS,t)||'Sonstiges';
const PROJECT_NOT=/Gebühr|Satzung|Abgabe|Beitr[aä]g|Kalkulation|Wirtschaftsplan|Jahresabschluss|Entgelt|Sachstandsbericht|Bauantrag|Bauvoranfrage|Baugesuch|Befreiung|Straßenname|Benennung|Umbenennung|Winterdienst|Reinigung|Kehrmaschine|Straßenkehr|Kehrwoche/i;
const STREETS=[
 ['Radweg',/Radweg|Radverkehrsanlage|Fahrradstraße|Radschnellweg|Radverkehrsverbindung/i],
 ['Gehweg und Barrierefreiheit',/Gehweg|Bürgersteig|Fußweg|Bushaltestelle|barrierefrei/i],
 ['Ortsdurchfahrt und Kreisverkehr',/Ortsdurchfahrt|Kreisverkehr|Kreuzung|Knotenpunkt|Lichtsignal|Ampel/i],
 ['Brücke',/(?<!Saar)Brücke(?!nau)|(?<!Saar)Brücken(?!au)|Steg\b|Unterführung|Überführung/i],
 ['Straßenausbau und -sanierung',/Verbreiterung|Neugestaltung|Ausbau|Neubau|Umbau|Sanierung|Erneuerung|Instandsetzung|Deckenerneuerung|Deckensanierung|Fahrbahn|grundhaft|Straßenbau|Endausbau|Umgestaltung/i],
];
const STREET_WORK=/Maßnahme|Vorhaben|Projekt|Variante|Kosten|Förder|Vergabe|Auftrag|Instandhaltung|Ertüchtigung|Verkehrsführung|Fahrradstraße|Qualitätsstandard|Verbreiterung|Neugestaltung|Überführung|Ausbau|Neubau|Umbau|Sanierung|Erneuerung|Instandsetzung|Decke|Fahrbahn|grundhaft|Straßenbau|Endausbau|Umgestaltung|Herstellung|Errichtung|Planung|Bau\b|Brücke|Radweg|Gehweg|Kreisverkehr|Ortsdurchfahrt|Unterführung/i;
export function streetSignalOf(title){const t=String(title||'');if(!ROAD_TITLE.test(t)||!STREET_WORK.test(t)||NOT_ROAD.test(t)||PROJECT_NOT.test(t)||SIG_NOT.test(t)||/Erinnerung|Litfaß|Holzkreuz|Baugenehmigung|Wohnanlage|Pflegeheim|Pflanzung|Spielplatz|Quartierssanierung|Geschwindigkeit|Tempo|Mobilfunk|Funkmast|e\.\s?V\.|Sondermittel|Knöterich|Neophyt|Schulneubau|Schulgebäude|Sanierungsgebiet|Zustand de[sr] (?:Gehweg|Straße)/i.test(t))return null;const a=firstOf(STREETS,t);return a?{value:a,step:projectStep(t)}:null;}
const WATERS=[
 ['Hochwasser und Starkregen',/Hochwasser|Starkregen|Deich|Retention|Rückhaltebecken|Regenrückhalt|Flutmulde|Gewässerausbau|Renaturierung/i],
 ['Kläranlage',/Kläranlage|Klärwerk|Abwasserbehandlung|Faulturm|Belebungsbecken/i],
 ['Kanal und Abwasser',/Kanal|Abwasser|Schmutzwasser|Mischwasser|Regenwasser|Entwässerung|Pumpwerk|Pumpstation|Regenüberlauf/i],
 ['Trinkwasser',/Trinkwasser|Wasserversorgung|Wasserleitung|Hochbehälter|Wasserwerk|Tiefbrunnen|Brunnenanlage|Wasserturm|Löschwasser/i],
];
const WATER_WORK=/Entschlammung|Rückhaltung|Eigenkontroll|Inspektion|Generalentwässerung|Einspeiseleitung|Neustrukturierung|Rückhaltebecken|Neubau|Erweiterung|Sanierung|Erneuerung|Ausbau|Bau\b|Errichtung|Planung|Konzept|Maßnahme|Ertüchtigung|Umbau|Vergabe|Herstellung|Studie|Machbarkeit|Förder|Verlegung|Instandsetzung|Modernisierung|Auftrag/i;
export function waterSignalOf(title){const t=String(title||'');if(!WATER_WORK.test(t)&&!/Hochwasserschutz|Starkregen/i.test(t)||PROJECT_NOT.test(t.replace(/Sachstandsbericht/g,''))||SIG_NOT.test(t)||/Sondervermögen|Gewässerunterhaltung|Wasserverband.*Wahl|Energie|Strom|Vergleich|Bekanntgaben|Laufendes|Mäharbeit|Böschung|Straßenunterhaltung|Wirtschaftsprüf|Transporter|Mietangelegenheit|Brunnenstraße|Abbruch|Wasserschaden|Flst|Fl\.?\s?-?Nr|Pflanz|Zwischenbericht|Jahresergebnis/i.test(t))return null;const a=firstOf(WATERS,t);return a?{value:a,step:projectStep(t)}:null;}
const BROADBANDS=[
 ['Mobilfunk',/Mobilfunk|Funkmast|Sendemast|\b5G\b|Funkturm/i],
 ['Glasfaser und Breitband',/Glasfaser|Breitband|Gigabit|\bFTT[HB]\b|Leerrohr/i],
];
export function broadbandSignalOf(title){const t=String(title||'');if(/Finanzprüfung|Müll|Gebühr|Satzung|Wirtschaftsplan|Jahresabschluss|Beteiligungsbericht|Wärme|Bauantrag/i.test(t)||SIG_NOT.test(t))return null;const a=firstOf(BROADBANDS,t);return a?{value:a,step:projectStep(t)}:null;}
/* 8 Pflege und Gesundheit */
const CARE=[
 ['Pflegeheim',/Pflegeheim|Pflegeeinrichtung|Pflegezentrum|Altenheim|Altenpflegeheim|Seniorenheim|Seniorenzentrum|Pflege-?WG|(?<!Kinder)(?<!Kinder-)Tagespflege|Kurzzeitpflege/i],
 ['Seniorenwohnen',/Seniorenwohn|Betreutes Wohnen|betreuten Wohnen|Servicewohnen|altersgerechte|barrierefreie Wohnungen/i],
 ['Ärztehaus und MVZ',/Ärztehaus|Ärztezentrum|\bMVZ\b|Medizinisches Versorgungszentrum|Gesundheitszentrum|Arztpraxis|Hausarzt|Landarzt|Primärversorgungszentrum|Apotheke/i],
 ['Krankenhaus',/Krankenhaus|Klinikum|(?<![\p{L}])Klinik(?!weg)|Hospital|Notaufnahme/iu],
];
export function careOf(title){const t=String(title||'');if(SIG_NOT.test(t)||/Grünpflege|Landschaftspflege|Pflegevertrag|Pflegearbeiten|Baumpflege|Denkmalpflege|Pflegeplan|Biotoppflege|Kindertages|Großtagespflege|Kita|Elternbeitr|Wahl|Bericht|Berichterstattung|Teddy|Rettungswache|Mietvertrag|Entlassmanagement|Delir|Fußweg|\be\.\s?V\.|Bus|Parken|Aufsichtsrat|Geschäftsführung|Catering|Stromliefer|Essen|Regionalplan|Tagespflegestelle|Hitzeschutz/i.test(t))return null;
 // Signal für Bau und Betrieb: nur mit Vorhaben, Planung oder Standortfrage
 if(!/Neubau|Errichtung|Erweiterung|Umbau|Ausbau|Sanierung|Bebauungsplan|Bauleitplan|Ansiedlung|Versorgungszentrum|Ärztehaus|MVZ|Standort|Nachfolge|Übernahme|Schließung|Bau\b|Gründung|Projekt|Konzept|Besichtigung|Grundstück/i.test(t))return null;
 return firstOf(CARE,t);}
/* 9 Einzelhandel und Nahversorgung */
const RETAIL=[
 ['Supermarkt und Discounter',/Supermarkt|Lebensmittel(?:markt|discounter|vollsortimenter|einzelhandel)|Discounter|Vollsortimenter|Nahversorg|\b(?:Aldi|Lidl|Netto|Penny|Edeka|EDEKA|Rewe|REWE|Kaufland|Norma|Tegut|Globus)\b|Dorfladen/],
 ['Drogerie',/Drogerie|\bdm\b|Rossmann|Müller-Drogerie/],
 ['Fachmarkt',/Fachmarkt|Baumarkt|Gartenmarkt|Gartencenter|Möbelmarkt|Möbelhaus|Fachmarktzentrum|Elektronikmarkt|Sonderposten|Einkaufszentrum|Factory Outlet/i],
 ['Innenstadt und Leerstand',/(?<!Wohnungs)Leerstand(?!simmobilie)|Innenstadt[^]{0,60}(?:Handel|Geschäft|Belebung|Leerstand|Laden|Einkauf)|(?:Handel|Geschäft|Belebung|Laden|Einkauf)[^]{0,60}Innenstadt|Einzelhandelskonzept|Zentrenkonzept|Einzelhandels- und Zentren|Ladenlokal|Citymanagement|Zentrale Versorgungsbereich|Einzelhandel/i],
];
export function retailOf(title){const t=String(title||'');if(SIG_NOT.test(t)||/Wochenmarkt|Weihnachtsmarkt|Flohmarkt|Marktplatz|Bauernmarkt|Ladenschluss|verkaufsoffen|Sonntagsöffnung|Parken|Parkplätze|Lebensmittelausgabe|Statik/i.test(t))return null;return firstOf(RETAIL,t);}

/* Ausschreibungen und Vergaben (plenara.X Signale, Kategorie 1, docs/produkt/plenara-x-signale.md): öffentliche Aufträge der Kommune,
   nur aus dem Titel. Je Vorgang genau ein Filter in fester Reihenfolge (IT vor Planung vor Fahrzeugen vor Wasser vor Tiefbau vor
   Hochbau vor Ausstattung), dazu der Stand: Ausschreibung (Einleitung, Ermächtigung), Nachtrag oder Vergabe. Nicht: Bauplätze,
   Grundstücke, Pacht, Konzessionen, Marktstände, Fördermittel, Haushalt, Anfragen, Wettbewerbe, Personal. */
const TENDER=/Vergabe|vergeben|Auftragsvergabe|Auftragserteilung|Auftrag (?:an|für|zur|über)|Beauftragung|\bbeauftragt\b|Ausschreibung|ausgeschrieben|Beschaffung|Anschaffung|Ersatzbeschaffung|Nachtragsangebot|Nachtragsauftrag|Bauleistung|Gewerk|\bLos\s?\d|Submission|Zuschlag\b(?!e)|Zuschlagserteilung|Rahmenvertrag/i;
const NOT_TENDER=/überplanmäßig|Förderprogramm|Straßen- und Wegenamen|Straßenname|Vergaberecht|Zuständigkeit|Niederschrift|Beschlussfassung zu Vorlagen|Auftrag an das Amt|Vergabeausschuss|Ausschuss für|Antrag (?:der|des|von)|Fraktion|Satzung|Richtlinie|Mittelvergabe|Mitteln?\b|Konzeptvergabe|Bieterverfahren|landwirtschaftliche[rn]? Fläche|Haushaltsmittel|Schutzauftrag|Prüfauftrag|Kriterien|Namensrecht|Vorstellung|Bauplatz|Baugrundst|Grundstück|Pacht|Konzession|Zelt|Weihnachtsmarkt|Markt(?:stand|platz)|Kirmes|Kilwi|Förderantr|Fördermittel|Zuwendung|Zuschuss|Haushalt|Anfrage|Nachfrage|Wettbewerb|Auslobung|\bStelle\b|Stellenbesetzung|Personal|Ehrenamt|Beschaffungsinitiative|Kulturfläche|Wohnung|Kita-Platz|Kitaplatz|Platzvergabe|Vergabekriterien|Vergaberichtlinie|Vergabeordnung|Vergabestelle|Dienstanweisung|Bericht|Sachstand|Information/i;
export const TENDER_KINDS=[
 ['IT und Glasfaser',/\bIT\b|IT-|EDV|Software|Dokumenten-?Management|\bDMS\b|Tafelsystem|digitale Tafel|Hardware|\bServer|Glasfaser|Breitband|WLAN|Digital|Lizenz|Endgerät|Tablet|Laptop|Notebook|Netzwerk|Telefonanlage|Identity|Rechenzentrum/i],
 ['Planungsleistungen',/Planungsleistung|Planerleistung|Beauftragung (?:des |eines )?Planer|Planungsbüro|Palnungsbüro|Vermessung|Ingenieurleistung|Ingenieurbüro|Planungsbüro|Architekt|HOAI|Leistungsphase|Objektplanung|Fachplanung|Tragwerksplanung|Gutachten|Bodenuntersuchung|Baugrund|Voruntersuchung|Projektsteuerung|Planung|Machbarkeitsstudie|Vermessung/i],
 ['Fahrzeuge und Ausstattung',/Fahrzeug(?!halle)|Schneepflug|Spielgerät|Sitzbänk|Sitzbank|Defibrillator|Sirene|Fahrgestell|Löschfahrzeug|Gerätewagen|\bHLF\b|\bTLF\b|\bLF\s?\d|\bMLF\b|\bGW-|Drehleiter|Dienstwagen|Transporter|Geräteträger|Traktor|Schlepper|Unimog|Bagger|Radlader|Kehrmaschine|Kommunalfahrzeug|Bus\b|Mähroboter|Rasenmäher/i],
 ['Wasser und Abwasser',/Flutmulde|Starkregen|Grabenräumung|Kanal(?!isation der Gemeindehalle)|Abwasser|Kläranlage|Klärwerk|Trinkwasser|Wasserleitung|Wasserversorgung|Hochbehälter|Wasserturm|Regenrückhalt|Regenüberlauf|Pumpwerk|Pumpstation|Brauchwasser|Hochwasser|(?<!Dach)[Ee]ntwässerung|Brunnen|Wasserwerk/i],
 ['Tiefbau und Straße',/Straßenbau|Wendehammer|Straßenunterhalt|\b[LKB]\s?\d{2,4}\b|Landstraße|Kreisstraße|Stützmauer|Brücke|Ingenieurbauwerk|(?:Sanierung|Ausbau|Erneuerung|Instandsetzung)\s+(?:von\s+|der\s+)?Straßen\b|Gemeindeverbindungsstraße|Ortsdurchfahrt|(?:Ausbau|Erneuerung|Sanierung|Neubau|Umbau|Herstellung|Instandsetzung)\s+(?:der\s+|des\s+|von\s+)?[\p{L}-]*(?:straße|strasse|weg|wege|gasse|allee)\b(?!\s*\d)|Gehweg|Radweg|Fahrradstraße|Wirtschaftsweg|Feldweg|Brücke(?!nau)|Tiefbau|Fahrbahn|Trockenmauer|Asphalt|Deckschicht|Bushaltestelle|Kreisverkehr|Parkplatz|Erdarbeiten|Straßenbeleuchtung|Erschließung|Pflaster|Winterdienst|Lärmschutz/iu],
 ['Sonstige Leistungen',/Baumkontrolle|Baumpflege|Grünpflege|Gutachten für den|Reinigung|Winterdienst|Sicherheitsdienst|Abschlepp|Essenslieferung|Prüfung der|Prüfung des Jahresabschlusses|Holzernte|Gasliefer|Stromliefer/i],
 ['Hochbau',/Hochbau|Gebäudeautomation|Garage|Elektroarbeiten|Neubau|Umbau|Anbau|Sanierung|Erweiterung|Dach|Fassade|Fenster|Tischler|Schreiner|Trockenbau|Sanitär|Elektro|Heizung|Lüftung|Gewerk|Rohbau|Maler|Estrich|Fliesen|Bodenbelag|Aufzug|Brandschutz|Gerüst|Abbruch|Bauleistung|Baumaßnahme|Bauarbeiten/i],
 ['Fahrzeuge und Ausstattung',/Ausstattung|Möbel|Mobiliar|Beschaffung|Anschaffung|Kleidung|Aggregat|Geräte(?!haus)|Spielgerät|Container|Lieferung/i],
];
/** {value: Filter oder 'Sonstige Leistungen', step: 'Ausschreibung'|'Vergabe'|'Nachtrag'} oder null */
export function tenderOf(title){
 // „Nachtrag: 02.06.2026 Nummer 1 …“ ist ein nachgereichter Tagesordnungspunkt, kein Nachtragsauftrag
 const t=String(title||'').replace(/^\s*Nachtrag:?\s*\d{1,2}\.\d{1,2}\.\d{2,4}\s*(?:Nummer\s*\d+\s*)?/i,'');if(!TENDER.test(t)||NOT_TENDER.test(t))return null;
 const kind=TENDER_KINDS.find(([,re])=>re.test(t))?.[0]||'Sonstige Leistungen';
 const step=/Nachtragsangebot|Nachtragsauftrag|Nachtragsvereinbarung|Nachtrag(?:e?s)?\b(?!:)|Auftragserweiterung/i.test(t)?'Nachtrag':/Abschluss des Vergabeverfahrens|Zuschlag/i.test(t)?'Vergabe':/Einleitung|Ausschreibung|ausgeschrieben|Ermächtigung|Vergabeverfahren|Teilnahme an|Bündelausschreibung|Freigabe/i.test(t)?'Ausschreibung':'Vergabe';
 return {value:kind,step};
}
/* Art der Wohnbebauung eines Plangebiets (Bauen, Bauleitplanung): welche Hausformen entstehen sollen, aus Titel, Vorlage und
   Begründung. Nur Sätze über die Planung („vorgesehen“, „geplant“, „zulässig“, „ermöglicht“, „Festsetzung“, „Bebauung mit“), nicht
   Bestand oder Umgebung („angrenzende“, „vorhandene“, „bestehende“). Mehrere Formen möglich. */
export const HOUSE_TYPES=[
 ['Einfamilienhäuser',/Einfamilienh|Einzelh(?:aus|äuser)|freistehende[nr]? (?:Wohn)?h(?:aus|äuser)|\bEFH\b|Eigenheim/i],
 ['Doppel- und Reihenhäuser',/Doppelh(?:aus|äuser|aushälft)|\bDHH?\b|Reihenh(?:aus|äuser)|Hausgruppe|Kettenh(?:aus|äuser)|Stadthäuser|Townhouse/i],
 ['Mehrfamilienhäuser',/Mehrfamilienh|Geschosswohnungsbau|Geschosswohnung|Mehrparteienh|Wohnblock|\bMFH\b|Stadtvill/i],
 ['Geförderter Wohnungsbau',/geförderte[nr]? Wohn|sozialen? Wohnungsbau|mietpreisgebunden|Sozialwohnung/i],
 ['Seniorenwohnen',/Seniorenwohn|betreutes Wohnen|altersgerecht|barrierefreie[ns]? Wohnungen|Pflegewohn/i],
];
const HOUSE_PLAN=/vorgesehen|geplant|plant|zulässig|zugelassen|ermöglich|Festsetzung|festgesetzt|Bebauung mit|bebaut|entstehen|errichte|Errichtung|Bau von|Neubau|realisier|Bauplätze für|Baugrundstücke für|Grundstücke für|Ziel/i;
const HOUSE_NOT=/angrenzend|vorhandene|bestehende|Bestand|umliegend|Umgebung|benachbart|begrenzt|(?:nord|süd)?(?:öst|west)lich|nördlich|südlich|ehemalig|abgerissen|Abriss|realisiert|entstanden|entstand|errichtet worden|bisher|Ferienwohn|Camping|Caravan|Übernachtung|touris|Wohnungseigentum/i;
// Einzelbauvorhaben (Bauantrag, Voranfrage, Abweichung, Befreiung) sind kein Baugebiet
const HOUSE_SINGLE=/Bauantrag|Bauvoranfrage|Voranfrage|Baugenehmigung|Antrag auf (?:isolierte )?Abweichung|isolierte Abweichung|Befreiung|Baugesuch|Anfrage zur|Teilung eines|Nutzungsänderung|Vorbescheid|Fl\.-?\s?Nr/i;
// „Einfamilien- und Doppelhäuser“: abgekürzte Wortteile ausschreiben
const houseExpand=x=>String(x||'').replace(/(Einfamilien|Doppel|Reihen|Mehrfamilien|Zweifamilien)-\s*(?=(?:und|oder|bzw\.|sowie|,)\s)/g,'$1häuser ');
export function houseTypesOf(title,text){
 const out=new Set(),t=houseExpand(title);text=houseExpand(text);
 if(HOUSE_SINGLE.test(t)||privateBuild(title))return [];
 for(const [name,re] of HOUSE_TYPES)if(re.test(t))out.add(name);
 for(const s of String(text||'').replace(/\s+/g,' ').split(SENTENCE)){
  if(s.length>700)continue;
  // Planungswort und Ausschlüsse nur im Umfeld des Treffers (Inhaltsverzeichnisse, Aufzählungen ohne Satzzeichen)
  for(const [name,re] of HOUSE_TYPES){const m=re.exec(s);if(!m)continue;const w=s.slice(Math.max(0,m.index-120),m.index+m[0].length+80);
   if(!HOUSE_PLAN.test(w)||HOUSE_NOT.test(s.slice(Math.max(0,m.index-70),m.index+m[0].length+30)))continue;out.add(name);}
 }
 return [...out];
}
/* Fläche des Plangebiets in ha (Bauen, Bauleitplanung), aus Vorlage oder Begründung: nur Sätze über das Plangebiet oder den
   Geltungsbereich mit „umfasst“, „Größe“ oder „Fläche von“; die erste Zahl in ha (oder m², umgerechnet). Nicht Gemarkungs-, Schutz-,
   Potenzial- oder Teilflächen („davon überbaubar“), nicht Flächennutzungspläne mit mehreren Änderungsbereichen. */
const AREA_SENT=/(?:Plangebiet|Geltungsbereich|Planbereich|Plangeltungsbereich)\w*[^.;]{0,80}?(?:umfasst|Größe|groß|Fläche von|Gesamtfläche|beträgt|ca\.|rund|etwa)/i;
const AREA_NUM=/(?<![\d.,])(\d{1,3}(?:\.\d{3})*(?:,\d{1,4})?|\d+(?:,\d{1,4})?)\s*(ha|Hektar|m²|qm|m2)(?![\p{L}\d])/u;
const NOT_AREA=/Gemarkung(?:s)?fläche|Gemeindegebiet|Schutzgebiet|Vogelschutz|FFH|Potential|Potenzial|davon|überbaubar|versiegel|Ausgleich|Kompensation|Teilfläche|Änderungsbereich|Bereich\s+\d|Vorbehaltsgebiet|Vorranggebiet|Regionalplan|insgesamt\s+\d+\s+Bereiche/i;
export function planAreaOf(text){
 for(const s of String(text||'').replace(/\s+/g,' ').split(SENTENCE)){
  if(s.length>600)continue;const a=AREA_SENT.exec(s);if(!a)continue;
  const rest=s.slice(a.index,a.index+a[0].length+80);if(NOT_AREA.test(rest))continue;
  const m=AREA_NUM.exec(s.slice(a.index));if(!m||m.index>a[0].length+60)continue;
  let v=Number(m[1].replace(/\./g,'').replace(',','.'));if(/m|qm/.test(m[2]))v/=10000;
  if(v>=0.05&&v<=1500)return Math.round(v*100)/100;
 }
 return null;
}
/* Kita: Beiträge nur in Sätzen mit Kita-Bezug (sonst Straßen-, Abwasser- oder Vereinsbeiträge) */
const KITA=/Kindertages|Kita|KiTa|Kindergarten|Krippe|Kinderkrippe|Tagespflege|Kinderbetreuung|U3|Ü3|Hort\b/;
const FEE=/Elternbeitr|[Kk]ostenfreie[nr]? (?:Kita|Kindergarten)|Kindergartengebühr|Krippengebühr|Hortgebühr|Kindergartenbeitr|Elternentgelt|Kita-Gebühr|Kitagebühr|Kita-Beitr|Kitabeitr|Betreuungsgebühr|Benutzungsgebühr|Gebührensatzung|Beitragssatzung|Beitragstabelle|Beitragsstaffel|Kostenbeitr|Beitragsfreiheit|beitragsfrei|gebührenfrei/i;
const MEAL=/Verpflegung|Essensgeld|Mittagessen|Verpflegungspauschale/i;
const OLD_STEP=/damals|seinerzeit|vertagt|zu vertagen|zurückgestellt|im (Jahr|Jahre) 20\d\d beschlossen/i;
// „Neufassung“ nur, wenn eine Beitrags- oder Gebührenregel selbst beraten wird (nicht Finanzierungsverträge mit Trägern)
const FEE_RULES=/[Ss]atzung|Gebührenordnung|Beitragsordnung|Entgeltordnung|Beitragstabelle|Beitragsstaffel|Elternbeitr|Elternentgelt|Kostenbeitr/;
/** Entscheidung zu Kita-Elternbeiträgen: {direction, euro} oder null. direction: Erhöhung, Senkung, Beitragsfreiheit, Verpflegung, Neufassung. */
export function kitaFeeOf(title,text){
 const t=String(title||''),sents=[t,...String(text||'').replace(/\s+/g,' ').split(SENTENCE).slice(0,400)].filter(x=>FEE.test(x)&&(KITA.test(x)||KITA.test(t)));
 // Essensgeld der Kita (Preis je Mahlzeit oder Monat für Verpflegung) ist kein Elternbeitrag: Art „Verpflegung“, ohne Betrag
 if(KITA.test(t)&&MEAL.test(t)&&/Essensgeld|Eigenanteil|Eigenbeteiligung|Entgelt|Gebühr|Beitr|Kosten|Preis|Erhöhung|Anpassung|Satzung/i.test(t)&&!/Elternbeitr|Betreuungs|Benutzungs|Mittel\b|Vergabe|Ausschreibung|Caterer|Anfrage|Antrag (der|des)/i.test(t)&&!COLLECTIVE.test(t))return {direction:'Verpflegung',euro:''};
 if(!sents.length||COLLECTIVE.test(t))return null;
 // Nur Vorgänge über Kita-Gebühren selbst: Kita und Gebühr (oder Satzung) im Titel; nicht Mittelbereitstellung, Wirtschaftspläne
 // oder Sammelpunkte, deren Text nebenbei Elternbeiträge nennt (Messung 14.10.2026: Digitalisierung, Umsatzsteuer, Bibliothek)
 if(!(KITA.test(t)||/Kindertageseinr|Kinderbetreuungseinr|Tageseinrichtung|Elternbeitr|Kinderhaus/i.test(t))||!(FEE.test(t)||FEE_RULES.test(t)||/[Bb]eitr[aä]g|Gebühr|Entgelt|Mittagsverpflegung|Essen/.test(t))||/Mittel\b|überplanmäßig|außerplanmäßig|Wirtschaftsplan|Bericht|Betriebskosten|Förderung der Kindertagespflege|Geldleistung|Rahmenvereinbarung|^(?:Anfrage|Bekanntgabe)\b/i.test(t))return null;
 // Schulkind- und Ganztagsbetreuung ist keine Kita (eigenes Unterthema)
 if(/Schul|Schüler|OGS|Ganztag|Hort\b|Kernzeit/i.test(t)&&!KITA_PLACES.test(t.replace(/Hort\b/,'')))return null;
 const all=sents.join(' ');
 /* Richtung nur aus Titel und Beschlussvorschlag, nicht aus dem Hintergrund („die Beiträge stiegen 2023“); sächsische
    „Absenkungsbeiträge“ (gesetzliche Beträge bei verkürzter Betreuung) sind keine Senkung. Informationen, Berichte und
    Anfragen bekommen eine Richtung nur aus dem Titel. Der Titel hat Vorrang. */
 const DOWN=/Reduzierung|\bSenkung|Absenkung(?!sbeitr)|Entlastung|Ermäßigung/i;
 const byTitle=/beitragsfrei|Beitragsfreiheit|gebührenfrei|kostenfrei|kostenlos|Abschaffung/i.test(t)?'Beitragsfreiheit':/(?:Rücknahme|Aussetzung|Verzicht auf)\b.{0,30}Erhöhung/i.test(t)?'Senkung':/Erhöhung|Anhebung|Anpassung nach oben/i.test(t)?'Erhöhung':DOWN.test(t)?'Senkung':null;
 const info=/^(Information|Bericht|Sachstand|Mitteilung|Anfrage|Beantwortung)|Bericht zu|Information zu|Maßnahmen zur Bedarfsplanung/i.test(t);
 // Frühere Vorgänge im Beschlussvorschlag („die damals vorliegende Erhöhung … zu vertagen“) geben keine Richtung
 const dec=info?'':[t,...decision(text).split(SENTENCE).filter(x=>!OLD_STEP.test(x))].filter(x=>FEE.test(x)||KITA.test(x)).join(' ');
 const direction=byTitle||(/beitragsfrei|Beitragsfreiheit|gebührenfrei/i.test(dec)?'Beitragsfreiheit':/Erhöhung|erhöht|Anhebung|angehoben|Steigerung/i.test(dec)?'Erhöhung':/\bSenkung|Absenkung(?!sbeitr)|gesenkt|Reduzierung|reduziert|Entlastung|Ermäßigung/i.test(dec)?'Senkung':sents.every(x=>MEAL.test(x))?'Verpflegung':FEE_RULES.test(t+' '+dec)||/[Bb]eitr[aä]g|Gebühr|Entgelt/.test(t)?'Neufassung':null);
 if(!direction)return null;
 // Ganze Zahl („1.000 €“ nicht als „000 €“), Monatsbeiträge bis 4 Stellen
 const eur=all.match(/(?<![\d.,])(\d{1,4}(?:,\d{2})?)\s*(?:€|Euro|EUR)/);
 return {direction,euro:eur?eur[1]:''};
}
/* Abfallgebühren (Umwelt, Abfall): Richtung der Entscheidung über die Gebühren der Gemeinde, aus Titel, sonst Beschlussvorschlag:
   Erhöhung, Senkung, unverändert, sonst festgesetzt (Gebühren für ein Jahr oder neue Satzung ohne Richtung). Betrag nur, wenn
   ausdrücklich die Jahresgebühr eines 120-l-Restabfallbehälters genannt ist. Gebühren je Liter, Tonne, Leerung oder Person sind
   nicht vergleichbar. Nicht: Anfragen, Anträge, Bürgereingaben, Deponie- und Kreisgebühren im Text, Sperrmüll allein. */
const WASTE_TITLE=/(Abfall|Müll|Restabfall)[\p{L}-]{0,30}(gebühr|entgelt)|Abfall(?:wirtschafts|entsorgungs|beseitigungs)?(?:gebühren)?satzung|Müllabfuhrgebühr|Abfallgebühr/iu;
const WASTE_UP=/Erhöhung|Anhebung|erhöht|angehoben|steigen|steigt|Steigerung/i,WASTE_DOWN=/\bSenkung|Absenkung|gesenkt|Reduzierung der Gebühr|reduziert|sinken|sinkt/i,WASTE_SAME=/unverändert|stabil|bleiben gleich|gleichbleibend|keine Erhöhung|Beibehaltung/i;
/** {value, euro} oder null */
export function wasteFeeOf(title,text){
 const t=String(title||'');
 if(!(/Abfall|Müll/i.test(t)&&/Gebühr|Entgelt|Tarif/i.test(t))||/Abschluss|Kostenrechnung|Aufhebung|Jahresabschluss|Überschuss|Unterdeckung/i.test(t)||/Anfrage|Beantwortung|Antrag (der|des)|Änderungsantrag|Fraktion|Bürgereingabe|Eingabe|Petition|Sperrmüll(?!.*Abfall)|Kreistag|Nachkalkulation|Betriebsabrechnung|Ergebnis/i.test(t))return null;
 const dec=decision(text).split(SENTENCE).filter(x=>/Gebühr|Entgelt/i.test(x)&&!/Deponie|Kreis(?:abfall)?gebühr|Landkreis|Vorjahr|damals/i.test(x)).join(' ');
 const pick=x=>WASTE_SAME.test(x)?'unverändert':WASTE_UP.test(x)&&!WASTE_DOWN.test(x)?'Erhöhung':WASTE_DOWN.test(x)&&!WASTE_UP.test(x)?'Senkung':null;
 const value=pick(t)||pick(dec)||'festgesetzt';
 const m=String(text||'').replace(/\s+/g,' ').match(/120\s*(?:l|Liter|-l|-Liter)[\s-]*(?:Rest(?:abfall|müll)\w*)[^.€]{0,40}?(?:jährlich|Jahresgebühr|pro Jahr|im Jahr)\s*(?:von\s*)?(\d{2,3},\d{2})\s*(?:€|Euro|EUR)/i);
 const euro=m&&Number(m[1].replace(',','.'))>=30?m[1]:'';
 return {value,euro};
}
/* Jahresergebnis eines Jahresabschlusses (Finanzen, Jahresabschluss und Prüfung): Überschuss oder Fehlbetrag mit Betrag, zuerst
   aus dem Beschlussvorschlag, sonst aus dem Text. Nur der Abschluss selbst, nicht Vorjahre, Plan- oder Prognosewerte, nicht
   Prüfaufträge, Prüfberichte ohne Feststellung oder Rechnungsprüfungsordnungen. */
const RESULT_TITLE=/Jahresabschlu|Jahresrechnung|Gesamtabschlu|Jahresergebnis|Haushaltsrechnung/i;
const NOT_RESULT_TITLE=/Wirtschaftsprüf|Abschlussprüfer|Rechnungsprüfungsordnung|Prüfungsamt|Prüfbericht|Bestellung|Bestimmung|Beauftragung/i;
const RESULT_NUM=String.raw`(-\s?)?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s*(Mio\.?|Millionen|TEUR|TEuro|T\s?€|Tsd\.?\s*(?:€|EUR|Euro))?\s*(€|EUR|Euro)?`;
const RESULT_RE=new RegExp(String.raw`\b(Jahresüberschuss\w*|Jahresfehlbetrag\w*|Gesamtüberschuss\w*|Gesamtfehlbetrag\w*|Jahresgewinn\w*|Jahresverlust\w*|Jahresergebnis\w*|Bilanzgewinn\w*|Bilanzverlust\w*|(?:mit einem|einen|ein) (?:Überschuss|Fehlbetrag|Gewinn|Verlust)|(?:Überschuss|Fehlbetrag|Defizit)\w* (?:des|im) ordentlichen Ergebnis\w*)\b[^.;]{0,40}?(?:in Höhe von|von|:|betr[aä]g\w*|mit|(?<![\d.,])(?=\s*(?:EUR|€)?\s*-?\s?\d)(?!\s*(?:19|20)\d\d\b))\s*(?:EUR|€)?\s*`+RESULT_NUM,'gi');
const NOT_RESULT_SENT=/Vorjahr|Plan(?:ansatz|wert|ung)?\b|geplant|prognos|erwartet|voraussichtlich|Wirtschaftsplan|Haushaltsplan|Prognose|aus dem Jahr|Vortrag aus|Gewinnvortrag|Verlustvortrag|kumuliert|verbesser|verschlechter|Abweichung|gegenüber|im Vergleich/i;
// Lange „Sätze“ (Kopf der Vorlage ohne Punkt bis in den Beschluss): Fenster um jedes Ergebniswort statt den Satz zu verwerfen
const resultWindows=s=>s.length<=1500?[s]:[...s.matchAll(/Jahresüberschuss|Jahresfehlbetrag|Jahresergebnis|Jahresgewinn|Jahresverlust|Bilanzgewinn|Bilanzverlust/gi)].slice(0,10).map(m=>s.slice(Math.max(0,m.index-150),m.index+250));
/* Haushalt aus der Haushaltssatzung (§ 1, Ergebnishaushalt): Gesamtbetrag der Aufwendungen und Kredite für Investitionen in €.
   Nachtragssatzungen nennen „bisher, Änderung, neu“: dann der neue Betrag. Nur Satzungen der Kommune selbst, keine Ortsgemeinden
   (ohne Einwohnerzahl nicht vergleichbar), Eigenbetriebe, Zweckverbände, Genehmigungen oder Anträge. */
const BUDGET_TITLE=/Haushaltssatzung|Haushaltsplan|Nachtragshaushalt/i;
const NOT_BUDGET_TITLE=/Ortsgemeinde|\bOG\b|Genehmigung|Beanstandung|Widerspruch|Eckpunkte|Antrag|Anfrage|Stellungnahme|Kreisumlage|Zweckverband|Sondervermögen|Eigenbetrieb|Wirtschaftsplan|Stiftung|Schulverband|Bericht|Haushaltssicherung|Vollzug|Ausführung|Sachstand|Fraktion|Teilbudget|Teilhaushalt|Teilplan/i;
const BUDGET_NUM=String.raw`(-?\s?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|-?\d{4,}(?:,\d{1,2})?)`;
const AUFW_RE=new RegExp(String.raw`Gesamtbetrag der (?:ordentlichen )?Aufwendungen(?:\s+(?:auf|von|mit|in Höhe von))?\s*(?:EUR|Euro|€)?\s*`+BUDGET_NUM+String.raw`(?:\s*(?:EUR|Euro|€))?(?:\s+`+BUDGET_NUM+String.raw`(?:\s*(?:EUR|Euro|€))?(?:\s+`+BUDGET_NUM+'(?:\\s*(?:EUR|Euro|€))?)?)?','i');
const CREDIT_RE=new RegExp(String.raw`Kredite für Investitionen(?: und Investitionsförderungsmaßnahmen| und Investitionsfördermaßnahmen)?[^.§]{0,80}?(?:auf|in Höhe von|mit|von)\s*`+BUDGET_NUM+String.raw`\s*(?:EUR|Euro|€)`,'i');
const euroOf=x=>Number(String(x).replace(/\s/g,'').replace(/\./g,'').replace(',','.'));
export function budgetOf(title,text){
 const t=String(title||'');if(!BUDGET_TITLE.test(t)||NOT_BUDGET_TITLE.test(t))return null;
 const src=String(text||'').replace(/\s+/g,' ').replace(/(\d)- (\d)/g,'$1$2').replace(/fest- ?gesetzt/g,'festgesetzt');
 const out=[];
 const a=src.match(AUFW_RE);
 if(a){let v=euroOf(a[1]);
  // Nachtrag: bisher + Änderung = neu
  if(a[3]!==undefined){const b=euroOf(a[2]),c=euroOf(a[3]);if(Math.abs(v+b-c)<=2)v=c;}
  // Nachtrag mit zwei Spalten „von bisher … auf …“: der neue Betrag
  else if(a[2]!==undefined&&/Nachtrag/i.test(t)&&/bisher/i.test(src.slice(Math.max(0,a.index-400),a.index)))v=euroOf(a[2]);
  if(v>=100000&&v<5e10)out.push({value:'Aufwendungen',euro:Math.round(v)});}
 if(/Kredite für Investitionen[^.§]{0,80}?(?:werden )?nicht (?:veranschlagt|vorgesehen|festgesetzt)/i.test(src))out.push({value:'Investitionskredite',euro:0});
 else{const c=src.match(CREDIT_RE);if(c&&!/Verpflichtungsermächtigung/i.test(src.slice(Math.max(0,c.index-80),c.index))){
  // „ändert sich von bisher X auf Y“
  const later=src.slice(c.index,c.index+c[0].length+80).match(new RegExp(String.raw`von bisher\s*`+BUDGET_NUM+String.raw`\s*(?:EUR|Euro|€)?\s*auf\s*`+BUDGET_NUM));
  const v=euroOf(later?later[2]:c[1]);if(v>=0&&v<5e10)out.push({value:'Investitionskredite',euro:Math.round(v)});}}
 return out.length?out:null;
}

/* Steuersätze der Zweitwohnungsteuer (% der Nettokaltmiete) und der Vergnügungssteuer auf Spielgeräte (% vom Spieleinsatz oder
   vom Einspielergebnis), zuerst aus dem Beschlussvorschlag. „von X % auf Y %“: der neue Satz. Keine Vergleiche mit anderen
   Kommunen, Empfehlungen, Spannen oder bisherigen Sätze; keine Anträge und Anfragen von Fraktionen. */
const TAXRATE_NUM=String.raw`(\d{1,2}(?:,\d{1,2})?)\s*(?:%|v\.\s?H\.|vom Hundert|Prozent)`;
const TAXRATE_RES=[new RegExp(String.raw`von\s*(?:bisher\s*)?`+TAXRATE_NUM+String.raw`\s*(?:netto|brutto)?\s*(?:auf|zu)\s*`+TAXRATE_NUM,'gi'),
 new RegExp(String.raw`(?:Steuersatz|Steuer beträgt|Prozentsatz|Steuersätze?|beträgt die Steuer|Steuer wird)[^.;%]{0,80}?(?:auf|beträgt|in Höhe von|von|mit)\s*`+TAXRATE_NUM,'gi')];
// Listen anderer Orte („Konstanz 35 %“), groß geschrieben geprüft
const CITY_RATE=/\p{Lu}\p{Ll}+ \d{1,2}(?:,\d)?\s?%/u;
const NOT_TAXRATE=/Beispiel|Mobilheim|Camping|Wohnwagen|Wohnmobil|Ortschaftsrat|erhebt|vergleichbar|Vergleich|Umfrage|Städte|Kommunen|Gemeinden|Landkreis|Kreis \p{Lu}|empfohlen|empfiehlt|mindestens|höchstens|zwischen|bis zu|derzeit|bisher(?!\s*\d)|aktuell|damals|früher|Durchschnitt|Mittel|z\.\s?B\.|beispielsweise|Variante|Alternativ/iu;
function rateOf(title,text,{titleRe,lo,hi,base}){
 const t=String(title||'');if(!titleRe.test(t)||/Anfrage|Antrag (der|des)|Fraktion|Bericht|Aufkommen|Erlass von|Stundung/i.test(t))return null;
 const pick=src=>{for(const s of String(src||'').replace(/\s+/g,' ').replace(/(\p{Ll})- (\p{Ll})/gu,'$1$2').split(SENTENCE)){if(s.length>1200)continue;
  for(const [i,re] of TAXRATE_RES.entries())for(const m of s.matchAll(re)){
   const near=s.slice(Math.max(0,m.index-120),m.index+m[0].length+40);const before=i===0?s.slice(Math.max(0,m.index-120),m.index):near;if(NOT_TAXRATE.test(before)||CITY_RATE.test(before))continue;
   const v=Number((i===0?m[2]:m[1]).replace(',','.'));if(v<lo||v>hi)continue;
   return {v,base:base?base(near,v):'Steuersatz'};}}
  return null;};
 const r=pick(decision(text))??pick(text);return r&&{value:r.base,rate:String(r.v)};
}
export const secondHomeTaxOf=(title,text)=>rateOf(title,text,{titleRe:/Zweitwohnung/i,lo:3,hi:40});
export const amusementTaxOf=(title,text)=>rateOf(title,text,{titleRe:/Vergnügungssteuer/i,lo:2,hi:40,
 base:(near,v)=>/Einspielergebnis|Bruttokasse/i.test(near)?'vom Einspielergebnis':/Spieleinsatz|Einsatz/i.test(near)?'vom Spieleinsatz':v<=10?'vom Spieleinsatz':'vom Einspielergebnis'});

export function annualResultOf(title,text){
 const t=String(title||'');if(!RESULT_TITLE.test(t)||NOT_RESULT_TITLE.test(t))return null;
 // „i.H.v.“ würde den Satz an der Abkürzung trennen
 const pick=src=>{let fallback=null;for(const s of String(src||'').replace(/\s+/g,' ').replace(/\bi\.\s?H\.\s?v\./g,'in Höhe von').replace(/\s?\((?:[EF]\s?\d+|Zeile\s?\d+|Nr\.\s?\d+)\)/g,'').split(SENTENCE).flatMap(resultWindows)){
  for(const m of s.matchAll(RESULT_RE)){const unit=m[4]||'',cur=m[5]||'';if(!unit&&!cur)continue;
   // Tabellen über mehrere Jahre („2019 2020 2021 … Jahresergebnis 298.923,20 €“) und lose „ein Fehlbetrag“ ohne Abschluss
   if(/(?:(?:19|20)\d\d\s+){3}/.test(s.slice(Math.max(0,m.index-120),m.index)))continue;
   if(/^(?:mit einem|einen|ein)\b/i.test(m[1])&&!/schließt|abgeschlossen|abschließt|Ergebnisrechnung|Wirtschaftsjahr|Geschäftsjahr|Haushaltsjahr/i.test(s.slice(Math.max(0,m.index-120),m.index+m[0].length+30)))continue;
   // Vorjahr, Plan, Prognose nur im Umfeld des Treffers prüfen (lange Sätze aus Tabellen)
   if(NOT_RESULT_SENT.test(s.slice(Math.max(0,m.index-80),m.index+m[0].length))||/^\s*(?:Vorjahr|im Vorjahr|gegenüber|im Vergleich)/i.test(s.slice(m.index+m[0].length,m.index+m[0].length+30)))continue;let v=Number(m[3].replace(/\./g,'').replace(',','.'));
   if(/^(Mio|Millionen)/.test(unit))v*=1e6;else if(/^(TEUR|TEuro|T\s?€|Tsd)/.test(unit))v*=1e3;
   // „Jahresüberschuss/-fehlbetrag 641.626,49 €“: das Vorzeichen entscheidet
   const neg=!!m[2]||/fehlbetrag|verlust|defizit/i.test(m[1])&&!/überschuss|gewinn/i.test(m[1]);if(!v||v>5e9)continue;
   const hit={value:neg?'Fehlbetrag':'Überschuss',euro:Math.round(v)};
   // Überschuss oder Fehlbetrag des ordentlichen Ergebnisses nur, wenn kein Jahresergebnis genannt ist
   if(/ordentlichen/i.test(m[1])){fallback??=hit;continue;}
   return hit;}}
  return fallback;};
 return pick(decision(text))||pick(text);
}

/* Parkgebühr je Stunde (Mobilität, Parken): ausdrücklich genannter Satz in € je Stunde (halbe Stunde verdoppelt), bei Änderungen
   der neue Wert („von 1,00 € auf 1,50 €“, „1,00 €/Stunde → 1,20 €/Stunde“). Nicht Erhöhungsbeträge („um 0,50 €“), Mittelwerte,
   Mindestgebühren der Park-App, Vergleiche mit anderen Städten, Bewohnerparken, Monats- und Tagestickets. */
// „1,20 EUR für eine Stunde“, „0,50 € je angefangene ½ Stunde“, „2 Euro pro Stunde“ (ganze Euro nur mit Euro/EUR ausgeschrieben)
// Umgekehrte Reihenfolge („je angefangene Stunde 1,00 €“, „für jede weitere 30 Minuten 0,50 €“, „bis 1 Stunde 1,00 €“);
// zwei Beträge hintereinander sind Spalten „bisher | neu“, dann gilt der zweite

/* Leistung von Wind- und Solarvorhaben (Umwelt, Erneuerbare): ausdrücklich genannte installierte Leistung oder Nennleistung des
   Vorhabens in MW (kWp umgerechnet). Nicht Strommengen (MWh), Leistung je Anlage, Leistungsklassen, Ziele, Netzanfragen. */
const EE_TITLE=/Wind|Solar|Photovoltaik|\bPV\b|PV-|Agri-?PV|Freifläch/i;
const EE_RE=/(?:\w*[Ll]eistung|installiert\w*)\b[^.;]{0,50}?(?<![\d.,])(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*(MWp|MW|Megawatt(?:peak)?|kWp|kW)\b|(?<![\d.,])(\d{1,3}(?:\.\d{3})*(?:,\d+)?)\s*(MWp|MW|Megawatt(?:peak)?|kWp)\b(?!\s*-?\s*Klasse)/gi;
const NOT_EE_SENT=/BESS|Referenz|Beispiel|besichtig|Inbetriebnahme|\blag\b|bestehende|vorhanden|je Anlage|pro Anlage|Klasse|Ziel|bis (19|20)\d\d|jährlich|bundesweit|Land(es)?\b|Netz\w*\s+(angefragt|anfrage)|Anfrage|Umspannwerk|Elektrolys|Wasserstoff/i;
export function eePowerOf(title,text){
 const t=String(title||'');if(!EE_TITLE.test(t)||/Bericht|Sachstand|Stand des|Anfrage|Balkon|Förderrichtlinie|Kriterien|Leitlinie|Potential|Potenzial|Studie|Konzept/i.test(t))return null;
 const kind=/Wind/i.test(t)?'Wind':'Photovoltaik';
 // Umfeld im ganzen Text prüfen: Aufzählungen („15,9 MWp; BESS …“) trennt SENTENCE am Semikolon
 const all=String(text||'').replace(/\s+/g,' ');let at=0;
 for(const s of all.split(SENTENCE)){const off=all.indexOf(s,at);at=off+s.length;if(s.length>1200)continue;
  for(const m of s.matchAll(EE_RE)){const num=m[1]||m[3],unit=(m[2]||m[4]).toLowerCase(),i=off+m.index;
   if(NOT_EE_SENT.test(all.slice(Math.max(0,i-80),i+m[0].length+30))||/Batterie|Speicher|BESS/i.test(all.slice(Math.max(0,i-25),i)+m[0].replace(/\d.*$/,'')))continue;
   let v=Number(num.replace(/\./g,'').replace(',','.'));if(unit.startsWith('k'))v/=1000;
   if(!v||v>2000)continue;return {value:kind,mw:Math.round(v*1000)/1000};}}
 return null;
}

/* Straßenbau (Mobilität, Straßen): Art der Maßnahme aus dem Titel (Ausbau, Sanierung, Radweg, Gehweg, Brücke) und Kosten aus dem
   Beschlussvorschlag („Vergabe … in Höhe von 412.300,00 € brutto“, „Kosten von rund 1,2 Mio. €“). Nicht Straßenreinigung,
   -benennung, -beleuchtung allein, Beiträge, Widmung, verkehrsrechtliche Anordnungen, Winterdienst. */
const ROAD_TITLE=/Straße|Strasse|Str\.|Weg\b|wege?s?\b|Gehweg|Radweg|(?<!Saar)Brücke(?!nau)|Kreuzung|Kreisverkehr|Ortsdurchfahrt|Fahrbahn/i;
const ROAD_WORK=[
 ['Radweg',/Radweg|Radverkehrsanlage|Fahrradstraße|Radschnellweg/i],
 ['Gehweg',/Gehweg|Bürgersteig|Fußweg/i],
 ['Brücke',/(?<!Saar)Brücke(?!nau)|(?<!Saar)Brücken(?!au)/i],
 ['Sanierung',/Sanierung|Erneuerung|Instandsetzung|Deckenerneuerung|Deckensanierung|Fahrbahndecke|grundhaft/i],
 ['Ausbau oder Neubau',/Ausbau|Neubau|Umbau|Herstellung|Erschließung|Umgestaltung|Kreisverkehr/i],
];
const NOT_ROAD=/Gestattung|Finanzhaushalt|Ergebnishaushalt|Haushaltssatzung|Teilhaushalt|Grünfläche|Mitteilungen und Anfragen|Verschiedenes|Wasserversorgung|Versorgungsleitung|Leitung|Mehrfamilienh|Doppelh|Einfamilienh|Reihenh|Angelegenheiten|Denkmalschutz|(?:straße|str\.|weg)\s+\d|Feuerwehr|Schule|Kita|Kindergarten|Gebäude|Rathaus|Halle\b|Wohnhaus|Bauantrag|Bauvoranfrage|Baugesuch|Nutzungsänderung|Reinigung|Benennung|Umbenennung|Beleuchtung|Beitr[aä]g|Widmung|Einziehung|verkehrsrechtlich|Anordnung|Winterdienst|Parkplatz|Bebauungsplan|Satzung|Anfrage|Antrag (der|des)|Fraktion|Geschwindigkeit|Tempo|Halteverbot|Kanal|Wasserleitung|Breitband|Glasfaser/i;
const ROAD_EUR=/(?:in Höhe von|Höhe von|Auftragssumme|Angebotssumme|Angebotspreis|Kosten(?:\s+von)?|Gesamtkosten|brutto|Betrag von|zum Preis von|i\.\s?H\.\s?v\.)[^.;€]{0,40}?(?<![\d.,])(\d{1,3}(?:\.\d{3})+(?:,\d{2})?|\d+(?:,\d{1,2})?)\s*(Mio\.?|Millionen)?\s*(?:€|Euro|EUR)/i;
export function roadWorkOf(title,text){
 const t=String(title||'');if(!ROAD_TITLE.test(t)||NOT_ROAD.test(t))return null;
 const w=ROAD_WORK.find(([,re])=>re.test(t));if(!w)return null;
 const m=ROAD_EUR.exec(decision(text));let euro='';
 if(m){let v=Number(m[1].replace(/\./g,'').replace(',','.'));if(m[2])v*=1e6;if(v>=5000&&v<=2e8)euro=String(Math.round(v));}
 return {value:w[0],euro};
}
/* Vorhaben aus dem Titel (Mobilität, Digitales, Energie): ob eine Gemeinde über ein bestimmtes Angebot berät. Nur der Titel, nicht der
   Text (dort sind solche Angebote oft nur erwähnt). Wie weit das Vorhaben ist, zeigt „Was geschieht“ (shared/stage.mjs). */
export const PROJECTS=[
 ['Bürgerbus oder Rufbus',/Bürger-?\s?bus|Rufbus|Anrufbus|Anruf-?\s?Sammel-?\s?Taxi|\bAST\b|On-?Demand-?(?:Verkehr|Shuttle|Angebot)|Bedarfsverkehr/i],
 ['Carsharing',/Car-?\s?sharing|Dorfauto|E-?Auto-?Teilen|Autoteilen/i],
 ['Öffentliches WLAN',/WLAN|W-LAN|Wi-?Fi|Freifunk|Internet-?Hotspot|WLAN-?Hotspot/i],
 ['Ladesäulen',/(?<!Bike[- ]?|Fahrrad[- ]?|Rad[- ]?)(?:Ladesäule|Ladeinfrastruktur|Ladestation|Ladepunkt|Schnellladepark|E-Ladesäule)/i],
 ['Mitfahrbank',/Mitfahrbank|Mitfahrbänke|Mitfahrerbank|Mitfahrpunkt/i],
 ['Bike- oder Lastenradverleih',/Lastenrad-?\s?verleih|Bike-?\s?Sharing|Fahrradverleih|Leihrad|Leihfahrr/i],
];
const PROJECT_TITLE_NOT=/Mitteilungen und Anfragen|Verschiedenes|Haushaltssatzung|Teilhaushalt|Finanzhaushalt|Ergebnishaushalt|Gehwegbehinderung|Hecken|parkende/i;
const WLAN_SCHOOL=/Schul|Kindertagesst|Kita\b|Kindergarten|Turnhalle/i;
export function projectsOf(title){const t=String(title||'');if(PROJECT_TITLE_NOT.test(t))return [];return PROJECTS.filter(([name])=>name!=='Öffentliches WLAN'||!WLAN_SCHOOL.test(t)).filter(([,re])=>re.test(t)).map(([name])=>name);}
/* Zahl der Windenergieanlagen eines Vorhabens (Umwelt, Energie): „acht neue Windenergieanlagen“, „3 WEA“, in Sätzen über die
   Errichtung oder Planung. Nicht Bestand, Rückbau, Anlagen anderer Orte, Kreise oder Länder, nicht Abstände („3 H“). */
const WORDNUM={eine:1,einer:1,zwei:2,drei:3,vier:4,fünf:5,sechs:6,sieben:7,acht:8,neun:9,zehn:10,elf:11,zwölf:12};
const WIND_RE=/(?<![\d.,])(\d{1,2}|eine[r]?|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf)\s+(?:neue[n]?\s+|weitere[n]?\s+|moderne[n]?\s+|zusätzliche[n]?\s+)?(?:Windenergieanlage|Windkraftanlage|WEA\b|Windräder|Windrad|Windturbine)/gi;
const WIND_PLAN=/errichte|Errichtung|geplant|plant|vorgesehen|entstehen|Bau\b|bauen|Neubau|beantragt|Antrag|Genehmigung|Vorhaben|Repowering|ersetzt|realisier|Standort/i;
const NOT_WIND=/genehmigt|in Betrieb|auf\s+(?:dem\s+)?\S*\s*Gebiet|Gemeindegebiet|Stadtgebiet|Planungsstadi|unterschiedlichen Planung|\d+\/\d+|maximal|höchstens|bestehende|vorhandene|bereits\s+(?:in Betrieb|errichtet|vorhanden)|Rückbau|abgebaut|zurückgebaut|Landkreis|Kreis\b|Bundesland|Deutschland|bundesweit|Region\b|Nachbar|insgesamt\s+(?:im|in)|Altanlagen|alte[n]?\s/i;
export function windCountOf(title,text){
 const t=String(title||'');if(!/Wind/i.test(t)||/Bürgerbegehren|Bürgerinitiative|Petition|Bericht|Sachstand|Anfrage|Studie|Konzept|Potenzial|Potential|Regionalplan|Raumordnung|Teilfortschreibung|Kleinwind|Aufhebung|Gesellschaft|Beteiligung von Bürgern|finanzielle Beteiligung|§\s?6\s*EEG|Flächennutzungsplan|Vorrangfläche|Standorte für/i.test(t))return null;
 for(const s of [t,...String(text||'').replace(/\s+/g,' ').split(SENTENCE)]){if(s.length>800||!WIND_PLAN.test(s)&&s!==t)continue;
  for(const m of s.matchAll(WIND_RE)){if(NOT_WIND.test(s.slice(Math.max(0,m.index-80),m.index+m[0].length+40)))continue;
   const v=WORDNUM[m[1].toLowerCase()]??Number(m[1]);if(v>=1&&v<=60)return v;}}
 return null;
}
/* Preis für Gewerbegrundstücke (Wirtschaft, Gewerbeflächen): Kauf- oder Verkaufspreis in € je m², den die Kommune festsetzt,
   verlangt oder zahlt, zuerst aus dem Beschlussvorschlag. Nicht Bodenrichtwerte, Rückkaufpreise, Erschließungskosten,
   Spannen, Vergleichspreise anderer Orte, frühere Preise. */
const LAND_TITLE=/Gewerbe|Industrie/i;
const LAND_DEAL=/Verkauf|Veräußer|Kaufpreis|Grundstückspreis|Verkaufspreis|Preis|Erwerb|Ankauf/i;
const LAND_RE=/(Kaufpreis\w*|Grundstückspreis\w*|Verkaufspreis\w*|Bauplatzpreis\w*|Verkaufserlös|Preis|Erwerb|Grundpreis)\b(?:[^.;]|\d\.\d)*?(?<![\d.,])(\d{1,3}(?:,\d{1,2})?)(?:,[-–]+)?\s*(?:€|Euro|EUR)\s*(?:\/|pro|je)\s*(?:m²|qm²?|m2|Quadratmeter)/gi;
const NOT_LAND=/Bodenrichtwert|Rückkauf|Erschließungs|Kostenrahmen|zwischen|bis \d|Vergleich|liegen bei|Jahr (19|20)\d\d|bisher|bislang|damals|Nachzahlung|würde/i;
export function landPriceOf(title,text){
 const t=String(title||'');if(!LAND_TITLE.test(t)||!LAND_DEAL.test(t)||/Vergabekriterien|Richtlinie|Grundsätze|Leitlinie|Nutzungszweck|Sachstand|Status|Auflistung|Konzept/i.test(t))return null;
 const pick=src=>{for(const s of String(src||'').replace(/\s+/g,' ').split(SENTENCE)){if(s.length>1200)continue;
  for(const m of s.matchAll(LAND_RE)){if(NOT_LAND.test(s.slice(Math.max(0,m.index-60),m.index+m[0].length+20)))continue;
   const v=Number(m[2].replace(',','.'));if(v>=1&&v<=1000)return v;}}
  return null;};
 const v=pick(decision(text))??pick(text);if(v===null)return null;
 return {value:v<50?'unter 50 € je m²':v<=100?'50 bis 100 € je m²':'über 100 € je m²',euro:String(v)};
}

/* Preis für Wohnbauplätze (Bauen, Baugebiete): Verkaufspreis in € je m², den die Kommune für ihre Bauplätze festsetzt oder verlangt,
   zuerst aus dem Beschlussvorschlag. Wie bei Gewerbegrundstücken nicht Bodenrichtwerte, Erschließungskosten, Spannen, frühere
   Preise; nicht Gewerbe (land_price), nicht Ausgleich von Mehr- oder Minderflächen, nicht Erbbau. */
const PLOT_TITLE=/Bauplatz|Bauplätze|Baugrundst|Baugebiet|Wohnbau|Wohngebiet|Baulandpreis|Bauland|Parzelle/i;
const PLOT_DEAL=/Verkauf|Veräußer|Kaufpreis|Verkaufspreis|Bauplatzpreis|Baulandpreis|Preis|Vergabe/i;
export function plotPriceOf(title,text){
 const t=String(title||'');if(!PLOT_TITLE.test(t)||!PLOT_DEAL.test(t)||LAND_TITLE.test(t)||/Erbbau|Erbpacht|Kalkulation|Vergabekriterien|Richtlinie|Aufhebung|Ausschreibung|Sachstand/i.test(t))return null;
 const pick=src=>{for(const s of String(src||'').replace(/\s+/g,' ').split(SENTENCE)){if(s.length>1200||/Minderfläche|\bDM\b|angesetzt|[Nn]achlass|Abschlag|Ermäßigung|Rabatt|Kosten|[Aa]ktuell|[Dd]erzeit/.test(s)||/\b(?:19\d\d|20[01]\d|202[0-3])\b/.test(s))continue;
  // Mehrere Preise im Satz sind Vergleiche (andere Baugebiete, sozialer Wohnungsbau, Grund und Boden ohne Erschließung)
  if(new Set([...s.matchAll(/(\d{1,3}(?:,\d{1,2})?)(?:,[-–]+)?\s*(?:€|Euro|EUR)\s*(?:\/|pro|je)\s*(?:m²|qm|m2|Quadratmeter)/g)].map(m=>m[1])).size>1)continue;
  for(const m of s.matchAll(LAND_RE)){if(NOT_LAND.test(s.slice(Math.max(0,m.index-60),m.index+m[0].length+20)))continue;
   const v=Number(m[2].replace(',','.'));if(v>=5&&v<=2000)return v;}}
  return null;};
 const v=pick(decision(text))??pick(text);if(v===null)return null;
 return {value:v<100?'unter 100 € je m²':v<=250?'100 bis 250 € je m²':'über 250 € je m²',euro:String(v)};
}

/* Hundesteuer für den ersten Hund im Jahr (Finanzen, Steuern): neuer Satz bei Änderungen („von 60,00 € auf 96,00 € für den
   Ersthund“), sonst der genannte Satz. Nicht gefährliche Hunde, Ermäßigungen, Erhöhungsbeträge, Aufkommen, Vergleiche. */
const DOG_TITLE=/Hund/i;
const DOG_FIRST=String.raw`(?:Ersthund|erste[nr]?\s+Hund|1\.\s*Hund|für\s+(?:jeden|einen)\s+Hund|ein(?:en)?\s+Hund)`;
const DOG_AMT=String.raw`(?<![\d.,])(\d{2,3})(?:,\d{2})?\s*(?:€|Euro|EUR)`;
const DOG_RES=[
 // von X auf Y … Ersthund / Ersthund … von X auf Y
 new RegExp(String.raw`von\s+(?:derzeit\s+|bisher\s+|aktuell\s+)?`+DOG_AMT+String.raw`(?:\s*\/\s*Jahr)?\s+auf\s+(?:neu\s+)?`+DOG_AMT+String.raw`(?:\s*(?:pro|\/)\s*Jahr)?\s*(?:für\s+)?(?:den\s+)?`+DOG_FIRST,'gi'),
 new RegExp(DOG_FIRST+String.raw`[^.;\d]{0,60}?von\s+(?:derzeit\s+|bisher\s+|aktuell\s+)?`+DOG_AMT+String.raw`(?:\s*\/\s*Jahr)?\s+auf\s+(?:neu\s+|jetzt\s+)?`+DOG_AMT,'gi'),
 // „Erhöhung des Steuersatzes von 70,00 € auf 90,00 €“ (ohne Ersthund; nicht, wenn der Satz weitere Hunde nennt, DOG_ONE)
 new RegExp(String.raw`(?:Steuersatz|Steuersatzes|Hundesteuer|Steuer)[^.;\d]{0,40}?von\s+(?:derzeit\s+|bisher\s+)?`+DOG_AMT+String.raw`\s+auf\s+`+DOG_AMT,'gi'),
 // Tabelle „alt neu“: „Ersthund 72,00 € 108,00 €“ (nur mit „alt … neu“ davor, DOG_TABLE); „bisher 75,00 € ab 2027 83,00 €“;
 // „die Zahl „96,00“ durch die Zahl „120,00““ (HU3, 14.10.2026)
 new RegExp(DOG_FIRST+String.raw`\s*`+DOG_AMT+String.raw`\s*`+DOG_AMT,'gi'),
 new RegExp(String.raw`bisher\s+`+DOG_AMT+String.raw`\s+ab\s+(?:dem\s+)?(?:\d{1,2}\.\d{1,2}\.)?\d{4}\s+`+DOG_AMT,'gi'),
 new RegExp(String.raw`Zahl\s+[„"](\d{2,3})(?:,\d{2})?\s*[“"]\s+durch\s+die\s+Zahl\s+[„"](\d{2,3})`,'gi'),
 // „Ersthund wird ab 01.01.2026 auf 96,00 Euro …“: neuer Satz (Ziffern des Datums dazwischen); zweite Gruppe wie oben
 new RegExp(DOG_FIRST+String.raw`(?:[^.;]|\.\d){0,50}?\bauf\s+()`+DOG_AMT,'gi'),
 new RegExp(DOG_AMT+String.raw`\s*(?:\(\s*)?für\s+den\s+(?:ersten\s+Hund|Ersthund|1\.\s*Hund)`,'gi'),
 new RegExp(DOG_FIRST+String.raw`[^.;\d]{0,40}?`+DOG_AMT,'gi'),
];
// Alte Sätze nur bei bloßen Beträgen ausschließen; „von derzeit X auf Y“ nennt den neuen
const DOG_ONE=/zweite|weitere|jeden weiteren|2\.\s*Hund|dritte|Zweithund/i;
const DOG_TABLE=/\balt\b.{0,80}\bneu\b|bisher.{0,60}\bneu\b|Satzung alt/i;
const DOG_OLD=/\baktuell|derzeit|\bbisher|damals|wurde\b|seitdem|unverändert/i;
const NOT_DOG=/bestimmter Rassen|Kosten\s*(?:\/|je|pro)\s*Hund|zwischen|damals|zuletzt|letztmal|erfolgte|So beträgt|beträgt (?:die Hundesteuer )?in \p{Lu}|\bIn \p{Lu}[\p{L}-]+ beträgt|gefährlich|Kampfhund|ermäßig|Ermäßigung|Rasse|Listenhund|Aufkommen|Mehreinnahm|Mehrertr|erhöht\s+um|um\s*$|Vergleich|Kommunen|Nachbar|höchsten|Durchschnitt|Landkreis|gegenwärtige|bleibt/iu;
export function dogTaxOf(title,text){
 const t=String(title||'');
 // Haushaltssatzungen (§ „Steuersätze“, v. a. Rheinland-Pfalz) nennen die Hundesteuer mit: dort nur Sätze, die „Hundesteuer“ nennen
 const budget=/Haushaltssatzung|Haushaltsplan|Steuers[aä]tze|Hebes[aä]tz/i.test(t)&&!/Hund/i.test(t);
 if(!(DOG_TITLE.test(t)||budget)||!budget&&/Hebesatz|Gewerbesteuer|Grundsteuer/i.test(t)&&!/Hundesteuer/i.test(t)||/gefährlich|Kampfhund|Rückblick|Anfrage|Antrag (der|des)|Fraktion|Anregung|Beschwerde|Hundekot|Hundewiese|Hundeauslauf|Hundetoilett/i.test(t))return null;
 const pick=src=>{for(const s of String(src||'').replace(/\s+/g,' ').replace(/(\p{Ll})- (\p{Ll})/gu,'$1$2').replace(/stever/g,'steuer').split(SENTENCE)){if(s.length>1500||budget&&!/Hundesteuer/i.test(s))continue;
  for(const [i,re] of DOG_RES.entries())for(const m of s.matchAll(re)){
   if(NOT_DOG.test(s.slice(Math.max(0,m.index-60),m.index+m[0].length+15))||i>6&&DOG_OLD.test(s.slice(Math.max(0,m.index-160),m.index+m[0].length)))continue;
   if(i===2&&DOG_ONE.test(s)||i===4&&!DOG_TABLE.test(s.slice(Math.max(0,m.index-300),m.index)))continue;
   const v=Number(i<7?m[2]:m[1]);if(v>=10&&v<=300)return v;}}
  return null;};
 const v=pick(decision(text))??pick(text);if(v===null)return null;
 return {value:v<=60?'bis 60 € im Jahr':v<=100?'61 bis 100 € im Jahr':'über 100 € im Jahr',euro:String(v)};
}

/** Neue Kita-Plätze (größte Zahl in einem Satz mit Kita-Bezug und Ausbau), sonst null */
// Kein Ausbau: Schließung, Abbau, Unterkünfte für Geflüchtete (auch dort ist von Plätzen die Rede)
// Bestand statt neuer Plätze („verfügen derzeit über 100 Betreuungsplätze“)
// Tagespflege zählt nur als Kindertagespflege (sonst Senioren-Tagespflege)
const KITA_PLACES=/Kindertages|Kita|KiTa|Kindergarten|Krippe|Kinderkrippe|Kinderbetreuung|U3|Ü3|Hort\b/;
// Bedarfsplanungen und Berichte nennen den Gesamtbestand, keine neuen Plätze
// Nur Vorgänge, die schon im Titel einen Ausbau nennen; sonst ist die Zahl meist der Bestand (Satzungen, Bedarfsanerkennung)

/** Punkte ohne Sachthema für Begriffs- und Antragsauswertungen: alles, was shared/item-kind.mjs nicht als Sachpunkt einordnet
    (Formalien des Sitzungsbetriebs, Sammelpunkte, Routine wie Besetzungen, Wahlen, Fragestunden und einzeln geführte
    Einwohnerfragen „Tore am Schulstandort - Herr Messing“). Dieselbe Regel wie payload.itemKind und „Ohne Formalien“ der Suche. */
export const routineTitle=t=>itemKind(t)!=='subject';
/** Private Bauanträge (Grundstück, Garage, Einfamilienhaus) sind für Begriffstrends kein Thema der Gemeinde */
export const privateBuild=t=>/Bauantr(a|ä)g|Nutzungsänderung|Baugesuch|Antrag auf Baugenehmigung|Bauvoranfrage|Befreiung von den Festsetzungen|Vorbescheid|Fl\.-?\s?Nr|Flurstück|Gemarkung\s+\S+.{0,20}Flur/i.test(String(t||''));
/** Derselbe Titel je Gebiet (mehrere Gremien) ist ein Vorgang */
export const titleKey=t=>String(t||'').toLowerCase().replace(/[^a-z0-9äöüß]+/g,' ').trim();
/* Hebesätze (Haushalt und Steuern): Steuerart und Satz aus Vorlagen zu Hebesätzen, Realsteuern oder der Haushaltssatzung. Je Steuerart der
   Abschnitt bis zur nächsten Steuerart; darin „von 465 auf 500 v. H.“, „500 v. H. (bisher 465 v. H.)“, „262 v.H. 300 v.H.“ (Tabelle
   bisher/neu) oder nur der Satz („auf 483 v.H.“). Nicht: aufkommensneutrale, empfohlene, Mindest- oder Vergleichssätze, Nivellierung,
   nach Grundstücksart differenzierte Sätze, Grundsteuer C. Im Beschlussvorschlag Genanntes geht vor. */
const TAX_TITLE=/Hebes[aä]tz|Realsteuer|Grundsteuer|Gewerbesteuer|Steuers[aä]tze|Haushaltssatzung/i;
const TAXES=[['Grundsteuer A',/Grundsteuer\s*A\b/g],['Grundsteuer B',/Grundsteuer\s*B\b/g],['Gewerbesteuer',/Gewerbesteuer(?!umlage|einnahme|aufkommen|zahlung|vorauszahlung|messbetr|pflicht)/g]];
const RATE_UNIT=String.raw`(?:v\.\s?H\.?|v\.\s?Hundert|vom Hundert|%|Prozent(?:punkte)?|Punkte)`;
const RATE_NUM=String.raw`(\d\.\d{3}|\d{3,4})`;
const NOT_RATE=/Änderungsantrag|abgelehnt|gefordert|fordert|aufkommensneutral|Nivellierung|Kommunalaufsicht|Aufsichtsbehörde|mindestens|Mindest|Durchschnitt|Vergleich|fiktiv|Spanne|zwischen|empfohl|Empfehlung|Orientierung|Nichtwohn|Wohngrundst|unbebaut|differenziert|Grundsteuer\s*C|Umlage|Landkreis|Nachbar|Kommunen|Gemeinden|Städte/i;
const TAX_RANGE={'Grundsteuer A':[100,3000],'Grundsteuer B':[100,3000],Gewerbesteuer:[200,1000]};
const rateNum=x=>Number(String(x).replace('.',''));
function ratesIn(seg,unitless=false){
 const R=(p,f)=>{const m=seg.match(new RegExp(p,'i'));return m?f(m):null;};
 return R(String.raw`von\s+(?:derzeit\s+|bisher\s+|zuletzt\s+|zuvor\s+)?`+RATE_NUM+String.raw`\s*`+RATE_UNIT+String.raw`?\s+(?:um\s+[\d,]+\s*%?\s*)?auf\s+`+RATE_NUM,m=>({from:m[1],to:m[2]}))
  ||R(RATE_NUM+String.raw`\s*`+RATE_UNIT+String.raw`\s*\(?\s*(?:bisher|vorher|derzeit|alt|vom bisherigen Hebesatz mit)\s*:?\s*`+RATE_NUM,m=>({from:m[2],to:m[1]}))
  ||R(String.raw`auf\s+`+RATE_NUM+String.raw`\s*`+RATE_UNIT+String.raw`\s+(?:vom\s+)?(?:bisherigen Hebesatz mit|bisher)\s+`+RATE_NUM,m=>({from:m[2],to:m[1]}))
  ||R(String.raw`^\W{0,3}`+RATE_NUM+String.raw`\s*`+RATE_UNIT+String.raw`\s+`+RATE_NUM+String.raw`\s*`+RATE_UNIT+String.raw`(?!\s*\d)`,m=>({from:m[1],to:m[2]}))
  ||R(String.raw`auf\s+`+RATE_NUM+String.raw`\s*`+RATE_UNIT,m=>({from:'',to:m[1],set:true}))
  ||R(String.raw`(?:beträgt|betragen|von|mit|in Höhe von|liegt\s+(?:\w+\s+)?bei|:|^\W{0,3})\s*`+RATE_NUM+String.raw`\s*`+RATE_UNIT,m=>({from:'',to:m[1]}))
  // Satzung mit der Einheit im Kopf („Hebesätze für Realsteuern v. H. … (Grundsteuer A) auf 400“)
  ||(unitless?R(String.raw`^\W{0,3}auf\s+`+RATE_NUM+String.raw`(?![\d.,]|\s*(?:€|Euro|EUR|m))`,m=>({from:'',to:m[1],set:true})):null);
}
/** [{tax, from, to}] (Zahlen als Text, from '' wenn nicht genannt) oder [] */
export function hebesatzOf(title,text){
 const t=String(title||'');
 // Briefe, Petitionen, Anfragen und Anregungen nennen Sätze, beschließen aber keine
 if(!TAX_TITLE.test(t)||/Grundsteuer\s*C\b/.test(t)&&!/Grundsteuer\s*[AB]\b|Gewerbesteuer/.test(t)||/Brief|Petition|Anfrage|Beantwortung|Anregung|Einwohnerantrag/i.test(t))return [];
 const budget=/Haushalt/i.test(t),out=new Map();
 const scan=(src,prio)=>{
  // „v.H.“ vor der nächsten Steuerart ist kein Satzende; Satzungen ohne Satzzeichen je Paragraf („§ 4 Steuersätze …“) („Grundsteuer B auf 650 v.H. Gewerbesteuer auf 400 v.H.“)
  for(const s of String(src||'').replace(/\s+/g,' ').replace(/\bv\.\s?H\.(?=\s+(?:Grundsteuer|Gewerbesteuer))/g,'v.H')
   // „auf 595 vom Hundert (Grundsteuer A)“: Steuerart nach dem Satz
   .replace(/(auf\s+(?:\d\.\d{3}|\d{3,4})\s*(?:v\.\s?H\.?|vom Hundert|%))\s*\((Grundsteuer\s*[AB])\)/g,'$2 $1').replace(/stever/g,'steuer').split(SENTENCE).flatMap(x=>x.split(/\s(?=§\s?\d+\s)/))){
   if(s.length>(budget?900:500)||NOT_RATE.test(s)||budget&&!/Hebes|Steuers[aä]tze|Realsteuer/i.test(s))continue;
   // Haushaltsjahr vor dem des Titels („für das Haushaltsjahr 2025“ in der Haushaltssatzung 2026): alter Satz; bei Doppelhaushalten (2026/2027) zählt das erste Jahr
   {const ys=(t.match(/20\d\d/g)||[]).map(Number),ty=ys.length?Math.min(...ys):0,sy=/Haushaltsjahr(?:e)?\s+(20\d\d)/.exec(s);if(ty&&sy&&Number(sy[1])<ty)continue;}
   const marks=TAXES.flatMap(([tax,re])=>[...s.matchAll(re)].map(m=>({tax,at:m.index+m[0].length}))).sort((a,b)=>a.at-b.at);
   // „Grundsteuer A und B von 350 auf 475 v.H.“: A bekommt den Abschnitt von B
   const both=/Grundsteuer\s*A\s*(?:und|sowie|,)\s*B\b/.exec(s);if(both&&!marks.some(x=>x.tax==='Grundsteuer B')){marks.push({tax:'Grundsteuer B',at:both.index+both[0].length});marks.sort((a,b)=>a.at-b.at);}
   const unitless=/Hebes/i.test(s)&&new RegExp(RATE_UNIT).test(s);
   marks.forEach((m,i)=>{
    if(both&&m.tax==='Grundsteuer A'&&m.at<=both.index+both[0].length)m={...m,at:both.index+both[0].length};
    const seg=s.slice(m.at,Math.min(m.at+180,marks[i+1]&&marks[i+1].at>m.at?marks[i+1].at-14:s.length)).replace(/^\s*(\(.{0,60}?\)|für\s+\S+(\s+\S+)?\s+Grundstücke)?/,'');
    // Tabelle mit allen Sätzen am Ende („… Gewerbesteuer auf 642 v.H. 577 v.H. 485 v.H.“): Zuordnung unklar
    if(new RegExp(String.raw`(?:`+RATE_NUM+String.raw`\s*`+RATE_UNIT+String.raw`\s*){3}`).test(seg))return;
    const r=ratesIn(seg,unitless);if(!r)return;
    const eff=prio+(r.from?0.5:r.set?0.25:0);if(out.has(m.tax)&&out.get(m.tax).prio>=eff)return;
    const [lo,hi]=TAX_RANGE[m.tax],to=rateNum(r.to),from=r.from?rateNum(r.from):0;
    if(to<lo||to>hi||from&&(from<lo||from>hi||from===to))return;
    out.set(m.tax,{tax:m.tax,from:from?String(from):'',to:String(to),prio:eff});
   });
  }
 };
 scan(text,1);scan(decision(text),2);
 return [...out.values()].map(({tax,from,to})=>({tax,from,to}));
}

/* Gebührensätze: Schmutzwasser und Trinkwasser je m³, Niederschlagswasser je m² (oder m³) aus Vorlagen zu
   Gebühren, Kalkulationen und Abgabensatzungen. Wie bei den Hebesätzen: je Gebührenart der Abschnitt bis zur nächsten Art,
   „von 1,26 €/m² auf 1,49 €/m²“, „3,38 Euro/m³ (bisher 3,07 Euro/m³)“, „3,47 €/m³ (VJ: 3,34 €/m³)“, sonst nur der Satz.
   Nicht: Beiträge (einmalig je Grundstück), dezentrale Entsorgung (Gruben, Kleinkläranlagen), Vergleiche mit anderen Kommunen,
   Änderungen „um“, Wasserentnahmeentgelt. */
const FEE_TITLE=/Gebühr|Entgelt|Kalkulation|Wasserpreis|Abgabensatzung|Entwässerungssatzung|Wasserversorgungssatzung|Abwassersatzung|Tarif/i;
const FEE_KINDS=[
 ['Niederschlagswasser',/\bNSW\b|Niederschlags\s?wasser|Regenwasser|Oberflächenwasser|Oberflächenentwässerung|versiegelte/gi],
 ['Schmutzwasser',/\bSW-Gebühr|Schmutzwasser|Abwassergebühr|Kanalbenutzungsgebühr|Einleit(?:ungs)?gebühr|Entwässerungsgebühr|Abwasserbeseitigung/gi],
 ['Trinkwasser',/Trinkwasser|Frischwasser(?!maßstab|menge|bezug|verbrauch)|(?<![\wäöüß])Wasser(?:preis|gebühr|verbrauchsgebühr|bezugsgebühr|entgelt|geld)/gi],
];
// Ohne Art im Satz („Die Verbrauchsgebühr beträgt …“) gilt die einzige Art, die der Titel nennt
const FEE_GENERIC=/Verbrauchsgebühr|Mengengebühr|Gebührensatz|Benutzungsgebühr|Arbeitspreis/gi;
// Ohne Art im Satz und im Titel („Die Gebühr beträgt 1,69 € pro m³“): Art aus Einheit und Gegenstand des Titels, m² ist
// Niederschlagswasser, m³ Schmutzwasser (Abwasser, Entwässerung, Kanal) oder Trinkwasser (Wasserversorgung)
const FEE_ANY=/(?<!Grund|Zähler|Bereitstellungs|Verwaltungs)(?:Gebühr(?:ensatz)?|Gebühren)\b/gi;
const SEWER_TITLE=/Abwasser|Entwässerung|Kanal|Schmutzwasser|Niederschlag|Klär/i,WATER_TITLE=/Wasserversorgung|Wasser(?:verbrauch|bezug|lieferung)|Trinkwasser|Wassergebühr|Wasserpreis/i;
const FEE_NUM=String.raw`(\d{1,2},\d{2,4})`;
const FEE_UNIT=String.raw`\s*(?:€|Euro|EUR)?\s*(?:\(?(?:netto|brutto)\)?\s*)?(?:/|je|pro)\s*(m³|m3|Kubikmeter|cbm|m²|m2|Quadratmeter|qm)`;
const NOT_FEE=/\d\.\s*Schritt|Beitr[aä]g|Gruben|Kleinkläranlage|abflusslos|dezentral|Fäkal|Sammelgrube|Grundstücksentwässerungsanlage|Vergleich|Spanne|zwischen|Durchschnitt|Landkreis|Kommunen|Gemeinden|Städte|Wassercent|Entnahmeentgelt|Lippeverband|Emschergenossenschaft|\bLV\b|Verbandsumlage|Umsatzsteuer von|Zuschlag|Gewinn|Abweichung|Differenz|den (?:höchsten|niedrigsten)/i;
const FEE_RANGE={Schmutzwasser:[0.3,12],Trinkwasser:[0.3,9],Niederschlagswasser:[0.05,6]};
const unitOf=u=>/²|2$|Quadrat|qm/.test(u)?'m²':'m³';
const feeNum=x=>Number(x.replace(',','.'));
function feeIn(seg,noPair=false,newFirst=false){
 const R=(p,f)=>{const m=seg.match(new RegExp(p,'i'));return m?f(m):null;};
 return R(String.raw`von\s+(?:derzeit\s+|bisher\s+|zuletzt\s+)?(?:\(?brutto\)?\s*)?`+FEE_NUM+String.raw`(?:\s*(?:€|Euro|EUR))?(?:`+FEE_UNIT+String.raw`)?\s*(?:\(?(?:netto|brutto)\)?\s*)?auf\s+(?:\(?(?:netto|brutto)\)?\s*)?`+FEE_NUM+String.raw`(?:\s*(?:€|Euro|EUR))?(?:`+FEE_UNIT+')?',m=>({from:m[1],to:m[3],unit:m[4]||m[2]||''}))
  ||R(FEE_NUM+FEE_UNIT+String.raw`\s*\(?\s*(?:bisher|bislang|vorher|derzeit|VJ|Vorjahr|alt)\s*:?\s*`+FEE_NUM,m=>({from:m[3],to:m[1],unit:m[2]}))
  ||R(String.raw`auf\s+`+FEE_NUM+FEE_UNIT,m=>({from:'',to:m[1],unit:m[2],set:true}))
  // Tabelle mit zwei Spalten („2025 2026“, „Alt Neu“): „4,89 €/m³ 4,52 €/m³“ ist bisher und neu
  // (nur genau zwei Werte, nicht „netto brutto“)
  ||(noPair?null:R(String.raw`(?<!um\s|(?:m³|m3|m²|m2|cbm|qm)\s*)`+FEE_NUM+FEE_UNIT+String.raw`\s*`+FEE_NUM+FEE_UNIT+String.raw`(?!\s*\d)`,m=>newFirst?{from:m[3],to:m[1],unit:m[2]}:{from:m[1],to:m[3],unit:m[4]}))
  ||R(String.raw`(?<!um\s)`+FEE_NUM+FEE_UNIT,m=>({from:'',to:m[1],unit:m[2]}));
}
// Lange „Sätze“ (Tabellen ohne Punkt): je Gebührenart ein Fenster von 250 Zeichen statt den ganzen Satz zu verwerfen
const feeWindows=s=>s.length<=600?[s]:[...s.matchAll(/Schmutzwasser|Niederschlags\s?wasser|Abwassergebühr|Trinkwasser|Wassergebühr|Verbrauchsgebühr/gi)].slice(0,8).map(m=>s.slice(m.index,m.index+250)).filter(w=>!/(?:\d,\d{2}\s*(?:€|Euro|EUR)?\s*\/\s*(?:m³|m²|m3|m2)\s*){3}/.test(w));
// (Mehrjahrestabellen mit drei und mehr Sätzen hintereinander bleiben draußen: welcher Satz der neue ist, steht nicht fest)
/** [{kind, from, to, unit}] (Euro mit Komma als Text, from '' wenn nicht genannt) oder [] */
export function feeRateOf(title,text){
 const t=String(title||'');
 // Nachkalkulationen nennen den kostendeckenden Satz eines vergangenen Jahres, nicht die erhobene Gebühr
 if(!FEE_TITLE.test(t)||/Nachkalkulation|Betriebsabrechnung|Ergebnis|Kita|Kinder|Friedhof|Bestattung|Abfall|Müll|Parken|Markt|Sondernutzung|Obdach|Unterkunft|Musikschule|Bücherei/i.test(t))return [];
 const out=new Map(),named=FEE_KINDS.filter(([,re])=>t.match(re)),only=named.length===1?named[0][0]:null;
 const sewer=SEWER_TITLE.test(t),water=WATER_TITLE.test(t);
 const scan=(src,prio)=>{
  // Einheit vor dem Satz: „Die Gebühr beträgt je m³ Schmutzwasser jährlich 4,35 €“ → „Schmutzwasser 4,35 €/m³“
  for(const s of String(src||'').replace(/\s+/g,' ').replace(/(?:je|pro)\s*(m³|m3|cbm|m²|m2|qm)\s+(Schmutzwasser|Niederschlagswasser|Abwasser|Frischwasser|Trinkwasser|Wasser)?\s*(?:jährlich\s+)?(\d{1,2},\d{2,4})\s*(?:€|Euro|EUR)/g,'$2 $3 €/$1').split(SENTENCE).flatMap(feeWindows)){
   if(NOT_FEE.test(s))continue;
   // „… €/m³ Frischwasser“ nennt den Maßstab, nicht die Gebührenart
   const marks=[...FEE_KINDS,...(only?[[only,FEE_GENERIC]]:[]),...(!only&&!FEE_KINDS.some(([,re])=>s.search(re)>=0)&&(sewer||water)?[['?',FEE_ANY]]:[])].flatMap(([kind,re])=>[...s.matchAll(re)].filter(m=>kind!=='Trinkwasser'||!/(m³|m3|Kubikmeter)\s*$/.test(s.slice(Math.max(0,m.index-12),m.index))).map(m=>({kind,at:m.index+m[0].length}))).sort((a,b)=>a.at-b.at);
   marks.forEach((m,i)=>{
    const r=feeIn(s.slice(m.at,Math.min(m.at+160,marks[i+1]?.at??s.length)),/brutto|Variante|Alternative/i.test(s),/\bneu\w*\s+(?:\S+\s+){0,2}(?:bisherig|alt)/i.test(s));if(!r||!r.unit)return;
    // Vorrang: Beschlussvorschlag, dann Änderung mit „bisher“, dann neu gesetzter Satz („auf 1,42 €“), dann bloße Nennung
    const eff=prio+(r.from?0.5:r.set?0.25:0);if(out.has(m.kind)&&out.get(m.kind).prio>=eff)return;
    const unit=unitOf(r.unit),kind=m.kind!=='?'?m.kind:unit==='m²'?(sewer?'Niederschlagswasser':null):sewer&&!water?'Schmutzwasser':water&&!sewer?'Trinkwasser':null;
    if(!kind)return;m={...m,kind};if((m.kind==='Niederschlagswasser')!==(unit==='m²'))return;
    const [lo,hi]=FEE_RANGE[m.kind],to=feeNum(r.to),from=r.from?feeNum(r.from):0;
    if(to<lo||to>hi||from&&(from<lo||from>hi||from===to||Math.abs(to/from-1)>1))return;
    out.set(m.kind,{kind:m.kind,from:from?String(from):'',to:String(to),unit,prio:eff});
   });
  }
 };
 scan(text,1);scan(decision(text),2);
 return [...out.values()].map(({kind,from,to,unit})=>({kind,from,to,unit}));
}

/* Kommunale Wärmeplanung: Verfahrensschritt aus dem Titel, sonst aus dem Beschlussvorschlag. Reihenfolge der Prüfung:
   Entwurf vor Beschluss („Entwurf des Endberichts“), Übertragung der Aufgabe vor Umsetzung („Übertragung … Umsetzung der KWP“).
   Anträge und Anfragen aus der Politik zählen nicht als Schritt. */
const HEAT=/Wärmeplan|Wärmeleitplan|\bKWP\b/i;
export const HEAT_STEPS=[
 ['Entwurf und Beteiligung',/Entwurf|vorläufig|Stellungnahme|Auslegung|Offenlage|Einsichtnahme|Öffentlichkeitsbeteiligung|Beteiligung der Öffentlichkeit|Beteiligung gem/i],
 ['Wärmeplan vorgelegt',/Verabschiedung|Fertigstellung|Beschluss(fassung)?\s+((des|über\s+den|über\s+die|zum|der)\s+)?(vorliegenden\s+)?(kommunalen?\s+|kommunaler\s+)?(Wärmepl|KWP|Abschlussbericht)|Festsetzungsbeschluss|Feststellung|Selbstbindungsbeschluss|Abschluss (der\s+)?(kommunalen?\s+)?Wärmeplanung|Billigung|beschließt (den|die)\s+(kommunalen?\s+)?Wärmeplan|Abschlussbericht|Endbericht|finale[nr]? Wärmeplan|Veröffentlichung des Wärmeplan/i],
 ['Start und Beauftragung',/Ablauf|Einführung in|Aufstellungsbeschluss|Aufstellung|Durchführung|Erstellung|Beauftragung|Vergabe|Auftrag|Übertragung|Konvoi|interkommunal|Zusammenarbeit|Förderantrag|Einleitung|Beginn|Zuständigkeit|planungsverantwortliche/i],
 ['Umsetzung und Fortschreibung',/Fortschreibung|Umsetzung|Monitoring|Maßnahmenkatalog|Maßnahmenumsetzung|Wärmenetz/i],
 ['Analyse und Zwischenstand',/Bestandsanalyse|Potenzialanalyse|Potentialanalyse|Zielszenario|Zielgebiet|Eignungsprüfung|Zwischenbericht|Zwischenergebnis|Sachstand|Vorstellung|Ergebnisse|Präsentation|Wärmewendestrategie|Bericht|Information|aktuelle[rn]? Stand|Stand der/i],
];
// Im Beschlussvorschlag: der Beschluss des Plans zuerst; „Umsetzung“ steht dort oft nur als Auftrag und zählt nicht
const HEAT_DECISION=[['Wärmeplan vorgelegt',/beschließt\b[^.]{0,250}(Wärmeplan\b|Wärmeplan\s|Abschlussbericht|Endbericht)|(?:Abschlussbericht|Endbericht|vorliegende[n]?\s+(?:kommunalen?\s+)?Wärmeplan\w*)(?:[^.]|\.\d){0,120}(?:Kenntnis|gebilligt|zugestimmt)|beschließt das Konzept zur (kommunalen\s+)?Wärmeplanung|beschließt (den|die) [„"]?(kommunalen?\s+)?Wärmeplanung\b(?![^.]{0,80}(durchzuführen|aufzustellen|zu erstellen|zu beginnen|einzuleiten|abzubilden))|Wärmeplan[^.]{0,80}(beschlossen|gebilligt)/i],...HEAT_STEPS.filter(([n])=>n!=='Umsetzung und Fortschreibung'&&n!=='Wärmeplan vorgelegt')];
const HEAT_DONE=/beschließt\b(?:[^.]|\.\d|\. ?§){0,120}?\b(?:den|die)\s+(?:vorliegenden?|erstellten?|finalen?|gemäß|gem\.)(?:[^.]|\.\d|\. ?§){0,80}?Wärmeplan|beschließt (?:den|die) (?:kommunalen?\s+)?Wärmeplan\w* (?:in (?:seiner|ihrer) finalen|in der (?:vorgestellten )?Endfassung)|Abschlussbericht\w*(?:[^.]|\.\d){0,120}?Kenntnis|Kenntnisnahme des Abschlussbericht|Verabschiedung der (?:kommunalen )?Wärmeplanung|beschließt\b[^.]{0,200}?\b(?:erarbeitete|vorliegende|erstellte)n?\s+(?:kommunalen?\s+)?Wärmeplan|beschließt (?:den|die) (?:Abschluss|Ergebnis|End)bericht\w* zur (?:kommunalen )?Wärmeplan|beschließt (?:den|die) kommunalen? Wärmeplan(?:ung)? (?:für|der|des)\b(?![^.]{0,80}(?:durchzuführen|aufzustellen|zu erstellen|zu beginnen|einzuleiten|abzubilden|zu übertragen))|(?:vorliegende[n]? )?(?:kommunalen? )?Wärmeplan\w*[^.]{0,120}(?:in der vorliegenden Fassung|als strategische Grundlage)?\s+zu beschließen/i;
/** Verfahrensschritt der kommunalen Wärmeplanung oder null */
// „Umsetzung des Wärmeplanungsgesetzes“ und Grundsatzbeschlüsse beginnen die Planung; Widersprüche und Anträge sind kein Schritt
const HEAT_START=/Umsetzung (des )?(Wärmeplanungsgesetz|WPG)|Grundsatzbeschluss|grundsätzliche[nr]? Beschluss|Planungsvariante/i;
// Der Name des Bundesgesetzes („… zur Dekarbonisierung der Wärmenetze“) ist kein Hinweis auf Wärmenetze oder Umsetzung
const HEAT_LAW=/(Bundes)?[Gg]esetz(es)? für die Wärmeplanung und zur Dekarbonisierung der Wärmenetze(\s*\(WPG\))?/;
export function heatPlanOf(title,text){
 const raw=String(title||''),t=raw.replace(HEAT_LAW,'WPG');
 if(!HEAT.test(t)&&!/Wärmeplanungsgesetz|\bWPG\b/i.test(t)||/\bAnfrage|Antrag (der|des|von)|Antrag Nr|\bAntrag\b[^)]{0,10}\(|Fraktion|Widerspruch|Beanstandung/i.test(t))return null;
 // Titel nach dem Muster „Kommunale Wärmeplanung nach dem Bundesgesetz … - Umsetzung in der Gemeinde X“: Übertragung der Aufgabe
 if(HEAT_START.test(t)||HEAT_LAW.test(raw)&&/Umsetzung|Übertragung|Aufgabe/i.test(t))return 'Start und Beauftragung';
 const dec=decision(text);
 // Beschließt der Beschlussvorschlag den fertigen Plan, gilt das vor dem Titel („Vorstellung der Ergebnisse“, „Beschluss
 // interkommunaler Wärmeplan“); Einsichtnahme und Stellungnahme sind noch der Entwurf
 if(HEAT.test(dec)&&!/Entwurf|Offenlage|Auslegung/i.test(t)){
  if(/Einsichtnahme|Stellungnahme|Offenlage|Auslegung|Öffentlichkeitsbeteiligung/i.test(dec))return 'Entwurf und Beteiligung';
  if(HEAT_DONE.test(dec))return 'Wärmeplan vorgelegt';
 }
 return (HEAT_STEPS.find(([,re])=>re.test(t))||(HEAT.test(dec)?HEAT_DECISION.find(([,re])=>re.test(dec)):null)||[null])[0];
}

/* Zuschüsse der Kommune an Vereine und Träger (Vereine und Soziales): Titel nennt einen Zuschuss an einen Verein oder Träger
   oder die Vereins-, Sport- oder Kulturförderung. Nicht: Fördermittel, die die Kommune selbst bekommt, Zuschüsse an Private
   (Modernisierung), Unternehmen und Wirtschaftsförderung, Sammelpunkte. Zweck aus dem Titel; Betrag nur, wenn er an einem
   Zuschusswort hängt („Zuschuss in Höhe von 2.675,00 €“), zuerst im Beschlussvorschlag; nicht bei Höchstbeträgen, Beträgen je
   Mitglied oder Stunde und in Listen (drei und mehr Beträge). */
const GRANT_TITLE=/(Zuschuss|Zuschüsse|Zuwendung|Förderung|Beihilfe|Unterstützung|Defizitausgleich|Bezuschussung).{0,60}(Verein(?!barung)|e\.\s?V\.|Förderverein|Club|Initiative|Stiftung|Träger|Kirchengemeinde)|(Verein(?!barung)|e\.\s?V\.).{0,60}(Zuschuss|Zuschüsse|Zuwendung|Förderung|Beihilfe|Bezuschussung)|Vereinsförder|Sportförder|Kulturförder|Vereinszuschüss|Zuschussantrag|Antrag auf (Gewährung (eines|von) )?(Zuschuss|Zuwendung)|Antrag (des|der|von)\b.{0,60}\b(auf|zur) (Bezuschussung|Zuschuss|Zuwendung)|Zuschuss[\wäöüß]* an (den|die|das) (?!Gemeinde|Stadt|Kreis|Land)|Gewährung (eines|von) Zuschüss|Investitionszuschuss|Betriebskostenzuschuss|(?:Förderung von Projekten|Projektförderung) durch (?:den|die) (?:Stadtbezirks|Orts|Bezirks)beirat|^Zuschuss (?:für|an|zur|zum) (?!die Gemeinde|die Stadt|den Kreis)/i;
// Keine neuen Zuschüsse: Ausschreibungen, Verwendungsnachweise, Vereinsauflösungen, Landesförderung (Katastrophenschutz)
const NOT_GRANT=/Fraktion.{0,120}(?:Änderung|Einrichtung|Topf)|^Erlass\b|Beitritt|Mitgliedschaft|Aussetzung|Gründung|durch den (Kreis|Landkreis)|Ausschreibung|Rahmenvereinbarung|Vereinbarung|Verwendungsnachweis|Abrechnung|Auflösung|Vermögen|Katastrophenschutz|Spende|spendenähnlich|Entgegennahme|Annahme von|Verzicht|Wahl\b|Bestellung|Vertreter|öffentlich-rechtliche|Bericht|Entwicklungszusammenarbeit|Modernisierung|Fördermittel|Förderprogramm|Landes(mittel|förder|zuschuss)|Bundes(mittel|förder)|LEADER|Städtebauförder|Krankheitskosten|Wirtschaftsförder|Unternehmen|(?<!g)GmbH|Gewerbe|Dienstbarkeit|Fassade|Privat|Eigentümer/i;
export const GRANT_PURPOSES=[
 ['Feuerwehr und Rettung',/Feuerwehr|Rettung|DRK|Rote[sn]? Kreuz|Malteser|Johanniter|THW|DLRG|Wasserwacht|Bergwacht/i],
 ['Kinder und Jugend',/Jugend|Kinder|Kita|KiTa|Kindergarten|Krippe|Spielkreis|(?<!Musik)Schule|Schüler|Hausaufgaben|Ferien|Waldorf|Pädagog/i],
 ['Sport',/[Ss]port|Turn|Schütze|Fußball|fußball|TSG|Tennis|Reit|Schwimm|Kegel|Golf|Handball|Volleyball|Leichtathlet|Biathlon|Eis(zeit|halle|sport)|Taekwondo|Judo|Karate|Kampfsport|\bKSC\b|Boxen|Ringen|Rad(sport|fahr)|Segel|Padel|Soccer|Bolzplatz|Kunstrasen|Athlet|Freizeitmannschaft|Platzpflege|Ruder|Kanu|\b(SV|TSV|TuS|TUS|STK|SC|FC|VfB|VfL|VfR|SG|TV|SSV|FSV|DJK|Spvgg|SpVgg|TC|ASV|TTC|TTV)\b/],
 ['Kultur und Heimat',/Kultur|Kunst|Künstler|Musik|Chor|Gesang|\bMGV\b|Kapelle|Theater|Heimat|Museum|Brauchtum|Karneval|Narren|Fastnacht|Kirmes|Fest\b|Feste|Denkmal|Bücherei|Geschicht|Orchester|Konzert|Jazz|Band\b|Music|Gesang|Sänger|Kerbe|Kirchweih|Maibaum|Maifeier|Mai-Feier|Tanz|Standarte|Fahne|Soldaten|Krieger|Kameradschaft|Dorf|Bürgerverein|Verschönerung|Partnerschaft|Städtepartner/i],
 ['Umwelt und Tiere',/Natur|Umwelt|Tier|Imker|Vogel|Kleingarten|Garten|Angel|Jagd|Obst|Wald/i],
 ['Soziales und Senioren',/Senior|Sozial|Diakon|Caritas|AWO|Tafel|Hospiz|Beratung|Frauen|Familie|Mehrgenerationen|Behindert|Inklusion|Pflege(?!ger)|Wohlfahrt|Selbsthilfe|Lebenshilfe|Hilfe\b|-Hilfe|Blaues Kreuz|in Not\b|Sucht|Obdach|Migra|Integration/i],
 ['Kirche',/Kirche|Pfarr|\bkath\.|\bev\.|evangelisch|katholisch/i],
];
const GRANT_AMOUNT=new RegExp(String.raw`(?:Zuschuss|Zuschüsse|Zuschusses|Zuwendung|Förderbetrag|Förderung|Investitionszuschuss|Zuschussbetrag|Zuschusshöhe|Betriebskostenzuschuss|Bezuschussung|bezuschusst|Betrag)([^.;€]{0,80}?)(?:in Höhe von|i\.\s?H\.\s?v\.|von|über|mit|:)\s*`+EURO_NUM,'g');
const NOT_GRANT_GAP=/Gesamt|Kosten|Eigen|Restmittel|förderfähig|zuwendungsfähig|Anteil|Prozent|%|Haushalt|Ansatz|Budget|Mittel/i;
const grantEuro=(num,unit,cur)=>{
 if(!cur&&!unit)return 0;
 let v=Number(num.replace(/\./g,'').replace(',','.'));
 if(/^(Mio|Millionen)/.test(unit||''))v*=1e6;else if(/^(T€|TEUR|Tsd|Tausend)/.test(unit||''))v*=1e3;else if(/^(Mrd|Milliarden)/.test(unit||''))return 0;
 return v>=50&&v<=5e6?Math.round(v):0;
};
function grantAmount(src){
 for(const s of String(src||'').replace(/\s+/g,' ').split(SENTENCE)){
  if(s.length>500||(s.match(/\d\s*(?:€|Euro|EUR)/g)||[]).length>=3||/Richtlinie|stehen\b.{0,120}zur Verfügung|☐|☒/.test(s))continue;
  for(const m of s.matchAll(GRANT_AMOUNT)){
   const before=s.slice(Math.max(0,m.index-30),m.index),after=s.slice(m.index+m[0].length,m.index+m[0].length+25);
   if(NOT_GRANT_GAP.test(m[1])||LIMIT_BEFORE.test(before)||LIMIT_BEFORE.test(m[1].replace(/über\s*$/,''))||/^\s*(pro|je|monatlich|jährlich je|im Monat|\/)/i.test(after))continue;
   const v=grantEuro(m[2],m[3],m[4]);if(v)return v;
  }
 }
 return 0;
}
/** {purpose, euro} (euro 0, wenn kein Betrag erkannt) oder null */
export function grantOf(title,text){
 const t=String(title||'');
 // Änderungen an Förderrichtlinien sind kein Zuschuss („Zuschuss nach … der Sportförderrichtlinie an den X“ schon)
 if(!GRANT_TITLE.test(t)||NOT_GRANT.test(t)||COLLECTIVE.test(t)||/\bAnfrage\b|(Änderung|Neufassung|Erlass|Fortschreibung|Ergänzung)\w*\s+(der|zur|einer)\s+[\wäöüß]*[Rr]ichtlinie|Richtlinien?\s+(über|zur|für)\b/i.test(t))return null;
 // Der Zweck steht beim Empfänger, nicht im Programm davor („Sportförderung - Zuschuss für die Tierfreunde“, GR4 14.10.2026)
 const who=t.replace(/^(?:Sport|Vereins|Kultur)förderung\s*[-–:;]\s*/i,'');
 const purpose=(GRANT_PURPOSES.find(([,re])=>re.test(who))||GRANT_PURPOSES.find(([,re])=>re.test(t))||['Sonstige Vereine und Träger'])[0];
 return {purpose,euro:/Richtlinie|Satzung/i.test(t)?0:grantAmount(decision(text))||grantAmount(text)};
}

const ADVISE_REJECT=/(Antrag|Anträgen?|Anregung|Vorschlag)[^.]{0,120}\b(nicht\s+zu\s+folgen|nicht\s+zu\s+entsprechen|nicht\s+zuzustimmen|abzulehnen|zurückzuweisen|nicht\s+weiter\s+zu\s+verfolgen)|\b(lehnt|weist)\b[^.]{0,80}(Antrag|Anregung)[^.]{0,40}\b(ab|zurück)\b/i;
/** Zeilen für topic_facts: {kind, value, detail} */
export function factsOf(title,text){
 const rows=[];
 const f=factionsOf(title,text);
 if(f)for(const p of f.parties)rows.push({kind:'faction',value:p,detail:f.kind});
 /* Empfiehlt der Beschlussvorschlag, dem Antrag nicht zu folgen, ist „beschlossen“ kein Erfolg der Fraktion */
 if(f&&f.kind!=='anfrage'&&ADVISE_REJECT.test(decision(text)))rows.push({kind:'faction_advice',value:'ablehnen',detail:''});
 const plan=planOf(title,text);
 if(plan){rows.push({kind:'plan',value:plan.stage,detail:plan.type+'|'+plan.plan});const use=planUseOf(title,text);if(use)for(const u of use.uses)rows.push({kind:'plan_use',value:u,detail:use.inter?'interkommunal':''});const we=housingOf(text);if(we)rows.push({kind:'housing',value:'Wohneinheiten',detail:String(we)});
  // Hausformen nur bei Plänen mit Wohnen (oder Mischgebiet)
  if(use&&use.uses.some(u=>u==='Wohnen'||u==='Mischgebiet'))for(const h of houseTypesOf(title,text))rows.push({kind:'house_type',value:h,detail:''});
  // Flächennutzungspläne haben oft mehrere Änderungsbereiche: Fläche nur bei Bebauungsplänen
  const ha=/Flächennutzungsplan/i.test(plan.type)?null:planAreaOf(text);if(ha)rows.push({kind:'plan_area',value:ha<1?'unter 1 ha':ha<5?'1 bis 5 ha':ha<20?'5 bis 20 ha':'über 20 ha',detail:String(ha)});}
 const fee=kitaFeeOf(title,text);if(fee)rows.push({kind:'kita_fee',value:fee.direction,detail:fee.euro});
 for(const x of hebesatzOf(title,text))rows.push({kind:'hebesatz',value:x.tax,detail:`${x.to}|${x.from}`});
 for(const x of feeRateOf(title,text))rows.push({kind:'fee_rate',value:x.kind,detail:`${x.to}|${x.from}|${x.unit}`});
 for(const p of projectsOf(title))rows.push({kind:'project',value:p,detail:''});
 const tender=tenderOf(title);if(tender)rows.push({kind:'tender',value:tender.value,detail:tender.step});
 // plenara.X Signale 4 bis 9: Filterwert aus dem Titel (Fakten wind_step, solar, energy, school_build, care, retail)
 for(const [kind,fn] of [['wind_step',windStepOf],['area_dev',areaDevOf],['solar',solarOf],['energy',energyOf],['school_build',schoolBuildOf],['care',careOf],['retail',retailOf]]){const v=fn(title);if(v)rows.push({kind,value:v,detail:''});}
 for(const [kind,fn] of [['street',streetSignalOf],['water',waterSignalOf],['broadband',broadbandSignalOf]]){const v=fn(title);if(v)rows.push({kind,value:v.value,detail:v.step});}
 const road=roadWorkOf(title,text);if(road)rows.push({kind:'road',value:road.value,detail:road.euro});
 const wind=windCountOf(title,text);if(wind)rows.push({kind:'wind_count',value:wind===1?'1 Anlage':wind<=4?'2 bis 4 Anlagen':wind<=9?'5 bis 9 Anlagen':'10 und mehr Anlagen',detail:String(wind)});
 const heat=heatPlanOf(title,text);if(heat)rows.push({kind:'heat_plan',value:heat,detail:''});
 for(const [kind,fn] of [['second_home_tax',secondHomeTaxOf],['amusement_tax',amusementTaxOf]]){const r=fn(title,text);if(r)rows.push({kind,value:r.value,detail:r.rate});}
 for(const b of budgetOf(title,text)||[])rows.push({kind:'budget',value:b.value,detail:String(b.euro)});
 const result=annualResultOf(title,text);if(result)rows.push({kind:'annual_result',value:result.value,detail:String(result.euro)});
 const ee=eePowerOf(title,text);if(ee)rows.push({kind:'ee_power',value:ee.value,detail:String(ee.mw)});
 const dog=dogTaxOf(title,text);if(dog)rows.push({kind:'dog_tax',value:dog.value,detail:dog.euro});
 const land=landPriceOf(title,text);if(land)rows.push({kind:'land_price',value:land.value,detail:land.euro});
 const plot=plotPriceOf(title,text);if(plot)rows.push({kind:'plot_price',value:plot.value,detail:plot.euro});
 // Abfallgebühr nur mit Betrag (Jahresgebühr der 120-l-Restmülltonne); die bloße Richtung nutzt niemand
 const waste=wasteFeeOf(title,text);if(waste?.euro)rows.push({kind:'waste_fee',value:'120-l-Restmülltonne',detail:waste.euro});
 const grant=grantOf(title,text);if(grant)rows.push({kind:'grant',value:grant.purpose,detail:grant.euro?String(grant.euro):''});
 // Signale 2: Art bei Wohnbaugebieten (Plan mit Wohnen, Baugebiet ohne Plan, Bauplatzpreis)
 if(rows.some(r=>r.kind==='plan_use'&&(r.value==='Wohnen'||r.value==='Mischgebiet')||r.kind==='area_dev'&&r.value==='Wohnen'||r.kind==='plot_price'))rows.push({kind:'wohnbau_art',value:wohnbauArtOf(title),detail:''});
 return rows;
}

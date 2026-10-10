// Feste Hilfetexte: Begriffe der Ratsarbeit und Bedienung. Lena formuliert nichts frei; jede Antwort ist ein Eintrag hier.
export const GLOSSARY=[
 {keys:['vertagung','vertagt','verschoben'],title:'Vertagung',text:'Vertagt heißt: Das Gremium hat den Punkt nicht entschieden, sondern auf eine spätere Sitzung verschoben. Der Vorgang bleibt offen; der nächste Termin steht meist erst mit der neuen Tagesordnung fest.',link:'/faq'},
 {keys:['beschlossen','beschluss'],title:'Beschluss',text:'Beschlossen heißt: Das zuständige Gremium hat dem Beschlussvorschlag zugestimmt. Maßgeblich ist die Niederschrift der Sitzung in den Originalunterlagen.',link:'/faq'},
 {keys:['abgelehnt','ablehnung'],title:'Ablehnung',text:'Abgelehnt heißt: Das Gremium hat den Beschlussvorschlag mehrheitlich zurückgewiesen. Ein Thema kann später mit neuer Vorlage erneut aufgerufen werden.',link:'/faq'},
 {keys:['empfehlung','empfohlen'],title:'Empfehlung',text:'Eine Empfehlung gibt ein Fachausschuss an das entscheidende Gremium, meist den Rat oder Kreistag. Die endgültige Entscheidung folgt dort.',link:'/faq'},
 {keys:['in beratung','beratung'],title:'In Beratung',text:'In Beratung heißt: Der Punkt stand auf einer Tagesordnung und wird in Gremien behandelt; ein Ergebnis liegt in den Quellen noch nicht vor.',link:'/faq'},
 {keys:['angekündigt','tagesordnung'],title:'Angekündigt',text:'Angekündigt heißt: Die Tagesordnung mit diesem Punkt ist veröffentlicht, die Sitzung hat noch nicht stattgefunden oder ein Ergebnis ist noch nicht veröffentlicht.',link:'/faq'},
 {keys:['zur kenntnis','kenntnisnahme'],title:'Zur Kenntnis',text:'Zur Kenntnis heißt: Das Gremium hat eine Mitteilung oder einen Bericht entgegengenommen, ohne darüber zu beschließen.',link:'/faq'},
 {keys:['vorlage','beschlussvorlage','drucksache'],title:'Vorlage',text:'Eine Vorlage (auch Drucksache) ist das Dokument der Verwaltung oder einer Fraktion, über das ein Gremium berät. Sie enthält meist Sachverhalt und Beschlussvorschlag.',link:'/faq'},
 {keys:['niederschrift','protokoll'],title:'Niederschrift',text:'Die Niederschrift ist das Protokoll einer Sitzung. Sie hält fest, was beraten und beschlossen wurde, und wird in der Folgesitzung genehmigt.',link:'/faq'},
 {keys:['bebauungsplan','b-plan'],title:'Bebauungsplan',text:'Ein Bebauungsplan legt für ein Gebiet verbindlich fest, was und wie gebaut werden darf. Er durchläuft Aufstellungsbeschluss, Beteiligung der Öffentlichkeit und Satzungsbeschluss.',link:'/faq'},
 {keys:['flächennutzungsplan','fnp'],title:'Flächennutzungsplan',text:'Der Flächennutzungsplan stellt für das ganze Gemeindegebiet die beabsichtigte Bodennutzung dar, etwa Wohnen, Gewerbe oder Grünflächen. Er ist Grundlage für Bebauungspläne.',link:'/faq'},
 {keys:['satzung'],title:'Satzung',text:'Eine Satzung ist eine Rechtsvorschrift der Kommune, etwa zu Gebühren, Friedhöfen oder Bebauungsplänen. Sie wird vom Rat beschlossen und öffentlich bekannt gemacht.',link:'/faq'},
 {keys:['gremium','gremien'],title:'Gremium',text:'Gremien sind Rat, Kreistag, Ausschüsse, Bezirksvertretungen und Beiräte. Welche Gremien es gibt, regelt die Hauptsatzung der Kommune.',link:'/faq'},
 {keys:['fraktion'],title:'Fraktion',text:'Eine Fraktion ist der Zusammenschluss von Ratsmitgliedern einer Partei oder Wählergruppe. Fraktionen stellen Anträge und Anfragen.',link:'/faq'},
 {keys:['einwohnerfragestunde','fragestunde'],title:'Einwohnerfragestunde',text:'In der Einwohnerfragestunde können Bürgerinnen und Bürger in der Sitzung Fragen an Rat und Verwaltung stellen. Die Regeln stehen in der Geschäftsordnung.',link:'/faq'},
 {keys:['bürgerantrag','einwohnerantrag','eingabe'],title:'Bürgerantrag',text:'Mit einem Bürger- oder Einwohnerantrag können Einwohner verlangen, dass der Rat ein Thema berät. Die Voraussetzungen regelt die jeweilige Gemeindeordnung.',link:'/faq'},
 {keys:['suche speichern','speichere ich eine suche','suche speichere','gespeicherte suche','alarm','benachrichtigung'],title:'Suche speichern',text:'Sie speichern eine Suche über „Suche speichern“ in der Trefferliste. Danach erhalten Sie neue Treffer als Benachrichtigung, je nach Einstellung sofort, täglich oder wöchentlich.',link:'/funktionen'},
 {keys:['was kostet','preis','preise','tarif','pro','kosten'],title:'Preise',text:'Die Tarife und ihre Preise stehen auf der Preisseite. Der kostenlose Einstieg umfasst die Suche; gespeicherte Suchen, Alarme und Analysen hängen vom Tarif ab.',link:'/preise'},
 {keys:['datenstand','wie aktuell','aktualität'],title:'Datenstand',text:'Die Daten kommen direkt aus den Ratsinformationssystemen der Kommunen. Den Stand sehen Sie in der Suche neben der Trefferzahl; welche Kommunen erfasst sind, zeigt die Datenabdeckung.',link:'/datenabdeckung'},
 {keys:['quelle','originalquelle','originalunterlagen'],title:'Originalquelle',text:'Jeder Vorgang verlinkt auf die Originalunterlagen im Ratsinformationssystem der Kommune. Maßgeblich ist immer die Quelle, nicht die Darstellung hier.',link:'/quellen'},
 {keys:['umkreis','radius'],title:'Umkreissuche',text:'In der Suche wählen Sie einen Ort und dazu einen Umkreis. Dann erscheinen die Vorgänge aller Kommunen in dieser Entfernung.',link:'/funktionen'},
];
/** Findet den Eintrag, dessen Schlüssel in der Frage vorkommt (längster Schlüssel zuerst). */
export function lookupGlossary(text){
 const t=String(text||'').toLowerCase();
 const all=GLOSSARY.flatMap(e=>e.keys.map(k=>[k,e])).sort((a,b)=>b[0].length-a[0].length);
 for(const [k,e] of all)if(new RegExp('(?:^|[^a-zäöüß])'+k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'','i').test(t))return e;
 return null;
}

// Die 10 Themen und 70 Unterthemen (Entwurf, noch nirgends eingebunden). Eine Wortliste je Unterthema dient beidem:
// Das Thema ist das Thema des zuerst genannten starken Begriffs, die Unterthemen sind alle Treffer innerhalb dieses Themas.
// Quelle ist der Titel; nennt er kein Thema (und ist keine Formalie), Betreff und Beschlussvorschlag aus dem Text und die
// Regel-Kurzfassung. Nie der ganze Text. Messen: node scripts/theme-study/measure.mjs --set=theme-dev [--fehler]
import {itemKind} from './item-kind.mjs';

export const THEMES_VERSION='themes-v1';
export const THEMES=[
 {id:'bauen',name:'Bauen & Wohnen'},
 {id:'finanzen',name:'Finanzen & Haushalt'},
 {id:'mobilitaet',name:'Mobilität & Verkehr'},
 {id:'bildung',name:'Bildung & Betreuung'},
 {id:'umwelt',name:'Umwelt, Klima & Energie'},
 {id:'soziales',name:'Soziales & Gesundheit'},
 {id:'kultur',name:'Kultur, Sport & Freizeit'},
 {id:'sicherheit',name:'Sicherheit & Ordnung'},
 {id:'verwaltung',name:'Verwaltung & Digitalisierung'},
 {id:'wirtschaft',name:'Wirtschaft & Arbeit'},
];
export const OPEN='offen';
// Schwache Themen zählen nur, wenn kein anderes Thema einen starken Begriff hat („Haushaltsmittel für den Radweg“).
const WEAK_THEMES=new Set(['finanzen','verwaltung']);

/** Unterthema: id, Thema, Name, Begriffe (Teilmuster, ohne Groß-/Kleinschreibung), Ausschlüsse (not, auf den ganzen
 *  Text), strong (Begriffe, die auch im schwachen Thema stark sind), family/fallback (Standard-Unterthema einer Familie). */
const S=(id,theme,name,words,o={})=>({id,theme,name,words,...o});
export const SUBTOPICS=[
 // Bauen & Wohnen
 S('bauen.plan','bauen','Bauleitplanung und Raumordnung',['bebauungsplan','bebauungs- und','b-plan','bau-?turbo','städtebaurecht','baugesetzbuch','\\bbp\\b','flächennutzungsplan','\\bfnp\\b','bauleitplan','regionalplan','raumordnung','landesentwicklungsplan','veränderungssperre','außenbereichssatzung','klarstellungssatzung','ergänzungssatzung','einbeziehungssatzung','vorhabenbezogen','städtebaulicher vertrag','\\bbaugb\\b','planfeststellung','teilfortschreibung']),
 S('bauen.dritte','bauen','Bauvorhaben Dritter',['bauantr','baugesuch','bauvoranfrage','baugenehmigung','einvernehmen','nutzungsänderung','befreiung von','abweichung von','carport','garage','wintergarten','einfamilienhaus','doppelhaus','mehrfamilienhaus','wohnhaus','werbeanlage','bauvorhaben','vorbescheid','\\banbau an','bausache','abweichung','dachgaube','dachflächenfenster'],{exclusive:true}),
 S('bauen.grund','bauen','Grundstücke und Liegenschaften',['grundstück','flurstück','liegenschaft','grunderwerb','ankauf','verkauf','veräußerung','kaufvertrag','erbbau','grundbesitz','bauplätze','bauplatz','vorkaufsrecht','mietvertrag','pachtvertrag','vermietung','verpachtung','\\btausch','gemarkung'],{not:/bauantr|bauvoranfrage|einvernehmen|baugenehmigung|landwirtschaft|jagd/i}),
 S('bauen.stadt','bauen','Stadtentwicklung, Sanierung und Denkmal',['stadtentwickl','stadtteilentwickl','ortsentwickl','städtebau(?!recht)','\\bisek\\b','entwicklungskonzept','sanierungsgebiet','sanierungssatzung','sanierungsträger','quartier','dorfentwicklung','dorferneuerung','denkmal(?!.{0,5}(krieg|gefallen))','ortskern','ortsmitte','innenentwicklung','soziale stadt','lebendige zentren','rahmenplan','masterplan','gestaltungssatzung','erhaltungssatzung','vitalisierung','historische[nr]? stadtkern','altstadt','stadttor']),
 S('bauen.wohnen','bauen','Wohnungsbau und Wohnraum',['wohnungsbau','wohnraum','wohnung(?!slos|ssteuer)','\\bwohnen\\b','wohnbau','wohneinheit','mietspiegel','sozialwohnung','mietpreis','wohnberechtigung','zweckentfremdung','mietwohn'],{not:/betreute[ns]? wohnen|wohnungslos|wohnmobil/i}),
 S('bauen.erschl','bauen','Erschließung und Baugebiete',['erschließung','erschliessung','baugebiet','wohngebiet','bauland','umlegung','erschließungsbeitr','erschließungsvertrag','baulandentwicklung','neubaugebiet']),
 S('bauen.oeff','bauen','Öffentliche Gebäude und Plätze',['rathaus','dorfgemeinschaftshaus','\\bdgh\\b','bürgerhaus(?!halt)','gemeindehaus','gemeindezentrum','bürgerzentrum','stadthalle','mehrzweckhalle','verwaltungsgebäude','marktplatz','dorfplatz','stadtplatz','kirchplatz','platzgestaltung','öffentliche toilette','toilettenanlage','gebäudemanagement','hochbau','dorfhaus','gemeindesaal','festhalle','(?:städtische|öffentliche|gemeindliche|kommunale|gemeindeeigene|stadteigene)[nrs]? gebäude','gebäudebewirtschaftung','nachnutzung','weiternutzung']),
 // Finanzen & Haushalt (schwaches Thema; Haushalt und Steuern haben Vorrang, siehe themeOf)
 S('finanzen.hh','finanzen','Haushalt und Finanzplanung',['haushalt(?!smittel|sresten?\\b|skonsolid|ssicher|sjahr|sbegleit)','finanzcontrolling','controllingbericht','investition','finanzplanung','finanzplan','investitionsprogramm','investitionsplan','eckwerte','ergebnisplan','stellenplan','teilhaushalt','budget','ermächtigungsübertrag','haushaltsreste?\\b','etat']),
 S('finanzen.abschl','finanzen','Jahresabschluss und Prüfung',['jahresabschluss','gesamtabschluss','jahresrechnung','rechnungsprüf','prüfbericht','entlastung','abschlussprüf','ergebnisverwendung','eröffnungsbilanz','bilanz','kassenprüf']),
 S('finanzen.beteil','finanzen','Beteiligungen und Eigenbetriebe',['beteiligungsbericht','beteiligungsunternehmen','beteiligungen','eigenbetrieb','eigengesellschaft','stadtwerke','gemeindewerke','\\bgmbh\\b','\\bag\\b','\\baör\\b','anstalt des öffentlichen','kommunalunternehmen','gesellschafterversammlung','gesellschaftsvertr','wirtschaftsplan','betriebssatzung','sparkasse','holding']),
 S('finanzen.upl','finanzen','Über- und außerplanmäßige Ausgaben',['überplanmäßig','außerplanmäßig','\\bapl\\.?\\b','\\bupl\\.?\\b','mehrausgabe','mehraufwendung','mehrauszahlung','mittelbereitstellung','bereitstellung von (?:haushalts)?mitteln','nachbewilligung','sperrvermerk','haushaltsmittel']),
 S('finanzen.steuer','finanzen','Steuern und Hebesätze',['hebesatz','hebesätze','grundsteuer','gewerbesteuer','hundesteuer','zweitwohnungs','vergnügungssteuer','bettensteuer','verpackungssteuer','beherbergungssteuer','übernachtungssteuer','steuersatz','\\w*steuer\\b','steuern\\b','steuersatzung'],{not:/steuerung|steuerberat/i,strong:true}),
 S('finanzen.hsk','finanzen','Haushaltssicherung',['haushaltssicherung','\\bhsk\\b','konsolidierung','sparliste','einsparung','sparmaßnahme','schutzschirm','entschuldung','haushaltsausgleich','defizit','fehlbetrag','freiwillige leistungen']),
 S('finanzen.kredit','finanzen','Kredite, Umlagen und Zuweisungen',['kredit','darlehen','bürgschaft','umlage','schlüsselzuweisung','zuweisung','finanzausgleich','\\bkfa\\b','\\bfag\\b','investitionspauschale','sondervermögen','zinsen','schulden','verschuldung','geldanlage','rücklage','infrastrukturgesetz']),
 // Mobilität & Verkehr
 S('mobilitaet.strasse','mobilitaet','Straßen, Brücken und Beleuchtung',['straße','strasse','straßenbau','straßenausbau','fahrbahn','deckensanierung','brücke','straßenbeleuchtung','beleuchtung','kreisstraße','landesstraße','bundesstraße','gemeindestraße','wirtschaftsweg','wegebau','winterdienst','endausbau','ausbaubeitr','bordstein','asphalt','pflaster','kreuzung','kreisverkehr','umgehung','tiefbau','unterführung','widmung','feldweg','radwegebau','kernwege','ländliche[nr]? wege','streugut','streusalz','linksabbieg','abbiegespur','deckenbau','autobahn','\\ba ?\\d{1,3}\\b','(?:sanierung|ausbau|erneuerung|umgestaltung|neugestaltung|fertigstellung|sperrung|vollsperrung|instandsetzung|deckenerneuerung|endausbau|ausbaus?)\\b(?:.{0,40})strname','strname\\s*[-–:,]?\\s*(?:sanierung|ausbau|erneuerung|vollsperrung|sperrung)','\\b[lkb] ?\\d+\\b','verkehrsinfra']),
 S('mobilitaet.oepnv','mobilitaet','Bus und Bahn',['öpnv','nahverkehr','\\bbus\\b','busse\\b','buslinie','bushalte','haltestell','bürgerbus','rufbus','anruf-?sammel','\\blinie \\d','\\bbahn\\b','bahnhof','\\bbhf\\b','bahnverkehr','s-bahn','stadtbahn','straßenbahn','regionalbahn','\\bspnv\\b','deutschlandticket','ticket','fahrplan','verkehrsverbund','\\bvrr\\b','\\bhvv\\b','\\bmvv\\b','\\bvbb\\b','schienen','gleis','\\bodeg\\b','reaktivierung','stadtbus','busverkehr','linienbus','bahnhalt','haltepunkt','bahnstrecke','bahnlinie','bahnsteig','seilbahn','zugverkehr']),
 S('mobilitaet.rad','mobilitaet','Radverkehr',['radverkehr','radweg','fahrrad','radschnell','radroute','veloroute','radfahr','radabstell','lastenrad','\\brad(?:netz|station|verbindung|vorrang|parkhaus|wegenetz)','fahrradstraße','\\bbike'],{not:/fahrradleasing|dienstrad|jobrad|e-bike-leasing/i}),
 S('mobilitaet.sicher','mobilitaet','Verkehrssicherheit und Tempo',['verkehrssicherheit','tempo','geschwindigkeit','verkehrsberuhigung','zebrastreifen','fußgängerüberweg','querungshilfe','querung','ampel','lichtsignal','schulwegsicher','blitzer','verkehrsschau','unfall','verkehrszeichen','poller','durchgangsverkehr','lkw-verkehr','lkw-durchfahrt','verkehrsüberwachung','verkehrsspiegel','spielstraße','verkehrsberuhigt','markierung']),
 S('mobilitaet.park','mobilitaet','Parken',['parken','parkplatz','parkplätz','parkraum','parkhaus','parkgebühr','parkschein','parkausweis','bewohnerpark','stellplatz','stellplätz','halteverbot','parkverbot','parkdeck','parkleitsystem','parkfläch','parksituation','falschpark','parkscheib'],{not:/wohnmobil/i}),
 S('mobilitaet.geh','mobilitaet','Gehwege und Barrierefreiheit',['gehweg','fußweg','fussweg','bürgersteig','fußgänger(?!zone)','fußverkehr','barrierefreie? (?:haltestell|bushalte|gehweg|querung|umbau der (?:bus)?haltestell)','bordsteinabsenkung','absenkung de[sr] bordstein','treppe']),
 S('mobilitaet.plan','mobilitaet','Verkehrsplanung und neue Mobilität',['verkehrskonzept','mobilitätskonzept','verkehrsentwicklung','verkehrsplanung','verkehrsgutachten','mobilität','ladeinfrastruktur','ladesäule','ladestation','ladepunkt','carsharing','e-scooter','mobilstation','verkehrswende','verkehrszählung','verkehrsuntersuchung','verkehrsführung','verkehrsversuch','autoverkehr','kfz-verkehr','autofrei','\\bverkehr\\b','\\bverkehrs(?!sicherungspflicht)\\w*','verkehrs(?:situation|lage|planung|fluss|belastung)']),
 // Bildung & Betreuung
 S('bildung.kitabau','bildung','Kita-Ausbau und Plätze',['(?:kita|kindertages\\w*|kindergarten|kindergärten|krippe|kiga|kinderhaus|familienzentrum)\\b.{0,80}(?:neubau|erweiter|anbau|errichtung|ausbau|plätze|platzzahl|betreuungsplätze|bedarfsplan|gruppe|container|modul|interim|sanier|umbau|bau\\b|baumaßnahme|neue)','(?:neubau|erweiterung|anbau|errichtung|ausbau|sanierung|umbau|bau)\\b.{0,60}(?:kita|kindertages|kindergarten|krippe|kiga)','betreuungsplätze','kita-?bedarfsplan','kindergartenbedarfsplan','bedarfsplan(?:ung)? (?:für )?(?:die )?kinder','kita-?ausbau','(?:standort\\w*|neue[nr]?)\\b.{0,40}kita'],{family:'kita'}),
 S('bildung.kitabetr','bildung','Kita-Betrieb, Träger und Beiträge',['kita\\b','kita-','kindertages','kindergarten','kindergärten','krippe','\\bkiga\\b','kinderbetreuung','elternbeitr','kindertagespflege','tagespflege(?!.{0,30}senior)','tagesmütter','tageseltern','betreuungsgebühr','betreuungsvertrag','betreuungsangebot'],{family:'kita',fallback:true,not:/waldkita$/i}),
 S('bildung.schulbau','bildung','Schulbau und Sanierung',['(?:schul\\w*|gymnasium|grundschule|realschule|gesamtschule|oberschule)\\b.{0,80}(?:neubau|erweiter|anbau|sanier|umbau|errichtung|mensa|turnhalle|sporthalle|\\bdach|fenster|brandschutz|modul|container|interim|baumaßnahme|toilett|heizung|schulhof|lüftung)','(?:neubau|erweiterung|anbau|sanierung|umbau|modernisierung)\\b.{0,60}(?:schul|gymnasium)','schulbau','schulgebäude','schulhof','schulgelände','schulzentrum'],{family:'schule'}),
 S('bildung.schulbetr','bildung','Schulbetrieb und Ausstattung',['\\bschul(?!weg|bezirk|entwicklung|bus|beförderung|träger|standort)','gymnasium','gymnasien','grundschule','realschule','gesamtschule','oberschule','förderschule','\\bggs\\b','\\bkgs\\b','\\bigs\\b','schüler','lehrer','digitalpakt','lehrmittel','klassenfahrt','erasmus'],{family:'schule',fallback:true}),
 S('bildung.ganztag','bildung','Ganztag und Hort',['ganztag','\\bogs\\b','offene ganztags','\\bhort','nachmittagsbetreuung','betreuende grundschule','schulkindbetreuung','ganztägig','mittagsbetreuung','übermittagsbetreuung','ferienbetreuung'],{family:'schule'}),
 S('bildung.schulentw','bildung','Schulentwicklung und Schülerbeförderung',['schulentwicklung','schulbezirk','schuleinzug','schulstandort','schulträger','zügigkeit','anmeldezahl','schülerzahl','schülerbeförderung','schülerverkehr','schulbus','\\bschulweg(?!sicher)','schulform','schulgründung','schulschließung','schulverband','schulnetz','kinderzahlen']),
 S('bildung.beruf','bildung','Berufs- und Erwachsenenbildung',['volkshochschule','berufsbildung','\\bvhs\\b','berufsschule','berufskolleg','berufsbildend','weiterbildung','erwachsenenbildung','bildungswerk','politischen? bildung','bildungszentrum','\\bbbs\\b']),
 // Umwelt, Klima & Energie
 S('umwelt.natur','umwelt','Natur, Bäume und Grünflächen',['\\bbaum\\b','bäume','baumfäll','baumschutz','baumpflanz','baumpflege','baumkataster','pflanzung','grünfläche','grünanlage','grünpflege','grünflächen','(?<!wind|solar|pv-|pv|gewerbe|industrie|technologie|skate|trail|freizeit|wohn|energie|chemie|bike|business|innovations|chemie|frei|auto|lkw|bus|fahrrad|rad|wohnmobil)park\\b','naturschutz','landschaftsschutz','landschaftsplan','artenschutz','biodiversität','insekt','blühwiese','blühstreifen','blühfläche','streuobst','ausgleichsfläche','ausgleichsmaßnahme','ökokonto','entsiegel','begrünung','schottergärt','vorgärten','neophyt','kreuzkraut','umweltschutz','tierschutz','biotop','\\bnatur','moor','\\bheide\\b','wildblume','\\bimker','\\bbienen','grünordnung','\\bwald\\b(?!-)','lärm','hecke','\\bknick','mäharbeit','\\bmahd','\\bmähen']),
 S('umwelt.wasser','umwelt','Wasser und Abwasser',['abwasser','abwässer','kläranlage','kanalisation','kanalsanierung','kanalnetz','\\bkanal','schmutzwasser','niederschlagswasser','regenwasser','trinkwasser','wasserversorg','wasserwerk','wasserleitung','wassergebühr','wasserverband','wasserzweckverband','entwässerung','gewässer','\\bwasser\\b','wasserpreis','brunnen','grundwasser','\\bbach\\b','bachlauf','renaturierung']),
 S('umwelt.abfall','umwelt','Abfall und Entsorgung',['abfall','abfälle','müll','sperrmüll','wertstoff','recycling','altkleider','(?:glas|papier|altkleider|müll|abfall|wertstoff|alttextil)container','grünschnitt','biotonne','gelbe[nr]? (?:sack|säcke|tonne)','entsorgung','deponie','straßenreinigung','vermüllung','ablagerung','littering','papierkörbe','mülleimer','altglas','mehrweg','laub\\b','laubsamm','einweg']),
 S('umwelt.ee','umwelt','Erneuerbare Energien',['photovoltaik','\\bpv\\b','pv-','solar','windkraft','windenergie','windpark','windrad','windräder','\\bwea\\b','bürgerwind','biogas','geothermie','wasserkraft','balkonkraftwerk','energiegenossenschaft','batteriespeicher','freiflächenanlage','erneuerbare','agri-?pv','energiepark']),
 S('umwelt.waerme','umwelt','Wärme und Energieversorgung',['wärmeplan','fernwärme','nahwärme','wärmenetz','wärmeversorg','heizzentrale','stromnetz','gasnetz','konzession','energieversorg','strombezug','energiebeschaffung','gaslieferung','stromlieferung','energieliefer','wasserstoff','umspannwerk','netzbetreiber','stromversorg','gasversorg','wärmepumpe','heizung','wärmeerzeug','\\bwärme\\b']),
 S('umwelt.klimaschutz','umwelt','Klimaschutz und Energieeffizienz',['klimaschutz','klimaneutral','\\bco2','co₂','treibhausgas','energetisch','energieeffizien','energiespar','energieeinspar','led','klimaschutzmanage','energiebericht','energiemanagement','klimabeirat','nachhaltigkeit','\\bklima\\b','klimanotstand','klimawandel','klimabilanz','klimafreundlich','\\benergie\\b','energiedaten','energieverbrauch']),
 S('umwelt.anpass','umwelt','Klimaanpassung, Hochwasser und Starkregen',['klimaanpass','hitze','starkregen','hochwasser','überschwemmung','überflutung','regenrückhalt','rückhaltebecken','\\bdeich','schwammstadt','dürre','trockenheit','sturzflut','\\bflut','klimaresilien']),
 // Soziales & Gesundheit
 S('soziales.senior','soziales','Senioren und Pflege',['senior','\\bpflege(?:heim|dienst|stütz|kräfte|bedürft|einrichtung|kasse|grad|beruf|platz|plätze|bedarfsplan|versicherung|stufe|wohn|kinder|familie)?\\b(?! (?:der|des|von|und unterhaltung))','altenheim','altenhilfe','altenpflege','tagespflege.{0,30}senior','demenz','betreute[ns]? wohnen','ältere[n]? menschen','generationen','älter werden','pflegeausbildung','pflegeschule']),
 S('soziales.jugend','soziales','Kinder, Jugend und Familie',['jugend(?!feuerwehr|musikschule|verkehrsschule|herberge|stil|weihe|vertretung im)','familie','frühe hilfen','kinderschutz','kinderrechte','kinderarmut','streetwork','ferienprogramm','ferienfreizeit','ferienspiel','ferienpass','babybegrüß','unterhaltsvorschuss','kinderfreundlich','spielmobil','\\bhze\\b','sgb viii','hilfen? zur erziehung','inobhutnahme','kinder- und','kinderbeauftragt','kinderparlament','kinderfest(?!spiele)','offene kinder','kinder\\b'],{not:/kindertages|kindergarten|kinderbetreuung|kinderfeuerwehr/i}),
 S('soziales.integ','soziales','Integration und Geflüchtete',['integration','geflüchtet','flüchtling','asyl','migration','zuwanderung','migrant','ausländer','gemeinschaftsunterkunft','unterbringung von','ukrain','bezahlkarte','integrationsrat','interkulturell','einbürgerung','aufnahme von','schutzsuchend']),
 S('soziales.inkl','soziales','Inklusion und Gleichstellung',['inklusion','inklusiv','behinder','barrierefrei','teilhabe','gleichstellung','\\bfrauen','gleichberechtigung','gender','diversität','diversity','lsbti','queer','\\bcsd\\b','christopher street','antidiskriminier','istanbul','gehörlos','gebärden','eingliederungshilfe','frauenhaus','häusliche gewalt','gewaltschutz','chancengleich'],{not:/barrierefrei.{0,40}(haltestell|bushalte|gehweg|querung|straße)/i}),
 S('soziales.gesund','soziales','Gesundheitsversorgung',['gesundheit','\\barzt','ärzt','hausarzt','medizin','\\bmvz\\b','krankenhaus','klinik','hospiz','palliativ','sucht','drogen','apotheke','hebamme','impf','gemeindeschwester','defibrillator','psychiatr','psychosozial','pandem','corona','\\bpflegestützpunkt','primärversorg','gesundheitsamt','stillfreundlich'],{not:/betriebliches gesundheitsmanagement/i}),
 S('soziales.beratung','soziales','Beratung und soziale Träger',['beratungsstelle','schuldnerberatung','erziehungsberatung','sozialberatung','migrationsberatung','verbraucherzentrale','verbraucherberatung','wohlfahrt','caritas','diakonie','\\bawo\\b','paritätisch','sozialstation','\\btafel','freie[nr]? träger','stadtteilzentrum','nachbarschaftshilfe','mehrgenerationenhaus','quartiersmanagement','sozialarbeit','stadtteilarbeit','gemeinwesenarbeit','seelsorge','ombuds']),
 S('soziales.armut','soziales','Armut, Wohnungslosigkeit und Grundsicherung',['armut','obdachlos','wohnungslos','obdach','notunterkunft','grundsicherung','sozialhilfe','bürgergeld','jobcenter','kosten der unterkunft','\\bkdu\\b','bildung und teilhabe','sozialpass','sozialticket','sozialleistung','wohngeld','sgb ii\\b','sgb xii','unterkunftskosten','bedarfe für unterkunft']),
 // Kultur, Sport & Freizeit
 S('kultur.sport','kultur','Sportstätten und Bäder',['sporthalle','turnhalle','sportplatz','sportanlage','sportstätte','kunstrasen','stadion','schwimmbad','hallenbad','freibad','naturbad','waldbad','\\bbäder','badesaison','schwimm','tennis','padel','leichtathletik','sportzentrum','sportheim','umkleide','flutlicht','kleinspielfeld','\\bsport','fußball','dreifachhalle','zweifachhalle','sportentwicklung','sportförder','sportler','baggersee','badesee']),
 S('kultur.kultur','kultur','Kultur und Kunst',['kultur(?!landschaft)','kunst(?!stoff|rasen|eis)','museum','museen','theater','galerie','ausstellung','konzert','künstler','orchester','\\bchor','\\bkino','literatur','\\boper\\b','kulturzentrum','kreativ']),
 S('kultur.feste','kultur','Feste und Veranstaltungen',['\\bfest\\b','feste\\b','stadtfest','dorffest','volksfest','sommerfest','schützenfest','kirmes','\\bkerb','karneval','fasching','fastnacht','weihnachtsmarkt','(?<!informations|info|bürger|dialog|beteiligungs|fortbildungs)veranstaltung','festival','jubiläum','\\bfeier','festakt','neujahrsempfang','martins','osterfeuer','maibaum','\\bumzug','open.?air','kirchweih','markttag','adventsmarkt','(?:kloster|bauern|oster|mittelalter|handwerker|kunsthandwerker|wein|herbst|frühlings|pfingst|kram|töpfer)markt']),
 S('kultur.verein','kultur','Vereinsförderung und Ehrenamt',['\\bvereins?\\b','vereine\\b','vereinen\\b','vereinsförder','\\w+verein\\b','\\w+vereins\\b','ehrenamt','ehrenamtskarte','sportlerehrung','vereinsheim','vereinsförderrichtlinie','zuschüsse an','vereinsunterstütz','\\be\\.\\s?v\\b','sportverband','sportbund','turnverein']),
 S('kultur.spiel','kultur','Spiel- und Freizeitanlagen',['spielplatz','spielplätze','spielgerät','bolzplatz','skate','pumptrack','dirtpark','trailpark','freizeitanlage','freizeitpark','calisthenics','outdoor-?fitness','trimm','grillplatz','minigolf','boule','jugendplatz','mehrgenerationenpark','freizeit','trail','spielfläche','wasserspielplatz','bewegungspark','fitnessparcours']),
 S('kultur.heimat','kultur','Heimat, Partnerschaften und Gedenken',['städtepartnerschaft','partnerstadt','partnergemeinde','partnerschaft(?!svertrag|lich)','heimat','gedenk','stolperstein','ehrenmal','kriegerdenkmal','mahnmal','erinnerung','chronik','ortsgeschichte','ehrenbürger','\\behrung','verleihung','benennung','kapelle','heiligenhäus','wegkreuz','bildstock','wappen','brauchtum','plattdeutsch','mundart','archiv','\\bpatenschaft']),
 S('kultur.bib','kultur','Bibliotheken und Musikschule',['bibliothek','bücherei','mediathek','musikschule','kunstschule','leseförder','\\blesen\\b']),
 // Sicherheit & Ordnung
 S('sicherheit.fwhaus','sicherheit','Feuerwehrhäuser, Bedarfsplan und Organisation',['feuerwehr','gerätehaus','feuerwache','brandschutzbedarf','wehrführ','ortswehr','löschzug','löschgruppe','löscheinheit','löschbezirk','kommandant','brandschutz'],{family:'feuerwehr',fallback:true,not:/brandschutz.{0,40}(schul|kita|gebäude|rathaus|halle)/i}),
 S('sicherheit.fwfz','sicherheit','Feuerwehrfahrzeuge und Ausrüstung',['fahrzeug','löschfahrzeug','\\bhlf','\\blf\\b','\\blf ?\\d','\\bmlf','\\btlf','\\bmtf','\\bmtw','\\bgw\\b','\\bgw-','\\belw','\\bdlk','drehleiter','rüstwagen','einsatzfahrzeug','schutzausrüstung','schutzkleidung','atemschutz','funkgerät','digitalfunk','\\bpsa\\b','feuerwehrtechnik','beschaffung','ersatzbeschaffung','\\bstlf','\\bkdow','\\bmzf','ausrüstung','\\btsf','\\bkef\\b','wechsellader','abrollbehälter','\\bausschreibung'],{family:'feuerwehr',needs:/feuerwehr|lösch|\bhlf|\blf\b|\btlf|\bmlf|drehleiter|\btsf|\bmtf|\bgw\b|\bkdow|rüstwagen|atemschutz|\belw/i}),
 S('sicherheit.rett','sicherheit','Rettungsdienst',['rettungsdienst','rettungswache','notarzt','rettungswagen','\\brtw\\b','notfallsanitäter','krankentransport','leitstelle','luftrettung','rettungshubschrauber','\\bdlrg','wasserrettung','first responder','helfer vor ort']),
 S('sicherheit.kats','sicherheit','Katastrophen- und Bevölkerungsschutz',['katastrophenschutz','bevölkerungsschutz','zivilschutz','sirene','warnung der bevölkerung','notstrom','stromausfall','blackout','krisenstab','krisenmanagement','leuchttürm','notfalltreffpunkt','\\bthw\\b','katastrophe','krisenvorsorge','warnsystem','waldbrand','frühwarn']),
 S('sicherheit.ordnung','sicherheit','Öffentliche Ordnung und Sicherheit',['ordnungsamt','ordnungsbehörden?\\b','gefahrenabwehr','polizei','kriminal','videoüberwachung','ordnungsdienst','\\bkod\\b','alkoholverbot','waffenverbot','böller','feuerwerk','\\bhund','fundtier','tierheim','tauben','ratten','betteln','spielhalle','glücksspiel','prostitution','ordnungswidrig','bußgeld','verwarngeld','sicherheitskonzept','\\bsicherheit(?!sleistung)','sicherheitsgefühl','angsträume','\\bordnungs(?!gemäß|mäßig|-|behördliche verordnung)','ruhestörung','sperrzeit','vandalismus','graffiti','sauberkeit']),
 S('sicherheit.friedhof','sicherheit','Friedhöfe und Bestattung',['friedhof','friedhöfe','bestattung','\\bgrab','urne','beisetz','trauerhalle','leichenhalle','friedwald','ruhewald','ruheforst','aussegnungshalle','kolumbarium','grabstätte']),
 S('sicherheit.markt','sicherheit','Märkte, Sondernutzung und Gewerbeaufsicht',['wochenmarkt','marktsatzung','marktgebühr','marktordnung','jahrmarkt','flohmarkt','sondernutzung','außengastronomie','freischank','gaststätte','gewerbeaufsicht','reisegewerbe','schaustell','plakat','straßenmusik','verkaufsstand','imbiss','kiosk','marktwesen']),
 // Verwaltung & Digitalisierung (schwaches Thema außer Digitalisierung, Breitband, Wahlen)
 S('verwaltung.ortsrecht','verwaltung','Ortsrecht und Satzungen',['hauptsatzung','satzung','verordnung','ortsrecht','geschäftsordnung','zuständigkeitsordnung','richtlinie','benutzungsordnung','entgeltordnung','gebührensatzung','gebührenordnung','dienstanweisung','vergabeordnung','zuständigkeit']),
 S('verwaltung.wahlen','verwaltung','Wahlen',['kommunalwahl','bürgermeisterwahl','landratswahl','landtagswahl','bundestagswahl','europawahl','wahlvorst','wahlbezirk','wahlhelfer','briefwahl','bürgerentscheid','bürgerbegehren','einwohnerantrag','wahlleit','wahlergebnis','wahlvorschl','\\bwahlen\\b','wahlkreis','wahlprüfung','gültigkeit der wahl','wahlschein','wahlraum','wahllokal','oberbürgermeisterwahl','ratswahl','kreistagswahl','\\bwahl zu[mr]','gültigkeit de[rs] \\w*wahl'],{strong:true}),
 S('verwaltung.personal','verwaltung','Personal und Organisation',['personal','stellenbesetz','\\bstellen\\b','tarif','besoldung','beamt','ausbildung','nachwuchs','dienstvereinbarung','arbeitszeit','organisationsuntersuchung','organisation','verwaltungsstruktur','dezernat','fachbereich','bauhof','fuhrpark','dienstwagen','dienstrad','jobrad','fahrradleasing','homeoffice','gesundheitsmanagement','nebentätigkeit','mitarbeitende','beschäftigte','stellenplan','geschäftsverteilung','stellenausschreibung','auszubildend','ausschreibung einer stelle','\\bstelle (?:als|eine[rs]?|de[rs])\\b','\\(m/w/d\\)','schließung de[sr] (?:amt|verwaltung|rathaus)']),
 S('verwaltung.digital','verwaltung','Digitalisierung und IT',['digital','\\bit\\b','\\bit-','\\bedv','software','hardware','\\bserver','cloud','onlinezugang','\\bozg\\b','e-government','e-akte','datenschutz','informationssicherheit','cyber','website','homepage','internetauftritt','\\bapp\\b','ratsinformationssystem','smart.?city','\\bki\\b','künstliche intelligenz','online','elektronisch','open data','\\bdms\\b','videokonferenz','hybride? sitzung'],{strong:true}),
 S('verwaltung.breit','verwaltung','Breitband und Mobilfunk',['breitband','glasfaser','mobilfunk','funkmast','\\b5g\\b','\\blte\\b','gigabit','\\bftth\\b','internetversorgung','weiße flecken','graue flecken','\\bwlan\\b','freifunk','sendemast','funkturm','hotspot'],{strong:true}),
 S('verwaltung.beteil','verwaltung','Bürgerbeteiligung und Beiräte',['bürgerbeteiligung','bürgerhaushalt','bürgerbefragung','einwohnerversammlung','bürgerversammlung','bürgerforum','beirat','petition','bürgerantrag','anregungen und beschwerden','bürgerdialog','beteiligungsverfahren','bürgerrat','einwohnerbefragung','bürgerbeteilig','beteiligungsportal','partizipation']),
 S('verwaltung.zusammen','verwaltung','Zusammenarbeit und Gebietsfragen',['interkommunal','zusammenarbeit','zweckverband','zweckvereinbarung','öffentlich-rechtliche[nr]? vereinbarung','kooperation','gebietsänderung','eingemeindung','zusammenschluss','fusion','grenzänderung','verwaltungsgemeinschaft','gemeindegrenze','aufgabenübertragung','kreisfreiheit','gebietsreform','verbandsversammlung']),
 // Wirtschaft & Arbeit
 S('wirtschaft.foerd','wirtschaft','Wirtschaftsförderung und Ansiedlung',['wirtschaftsförder','ansiedlung','gründer','start-?up','existenzgründ','standortmarketing','standortförder','wirtschaftsentwick','technologiezentrum','innovationszentrum','unternehmer','\\bihk\\b','handwerk','mittelstand','wirtschaft\\b','wirtschaftsstandort','unternehmen(?!sbeteiligung)','betriebe\\b','firmen','gewerbe(?!gebiet|fläche|steuer|park|aufsicht)']),
 S('wirtschaft.gewerbe','wirtschaft','Gewerbegebiete',['gewerbegebiet','industriegebiet','gewerbefläche','gewerbepark','industriepark','gewerbegrundstück','wirtschaftsfläch','gewerbe- und industrie','\\bgi\\b','gewerbeflächen']),
 S('wirtschaft.innen','wirtschaft','Innenstadt, Stadtmarketing und Einzelhandel',['innenstadt','stadtmarketing','citymanag','einzelhandel','leerstand','leerständ','verkaufsoffen','sonntagsöffnung','ladenöffnung','verkaufsstellen','zentrenkonzept','fußgängerzone','gewerbeverein','werbegemeinschaft','händler','gastronomie','nahversorg','dorfladen','supermarkt','lebensmittelmarkt','city','ortsmarketing','edeka','\\brewe\\b','\\baldi\\b','\\blidl\\b','\\bnetto\\b','\\bpenny\\b','kaufland','discounter']),
 S('wirtschaft.tour','wirtschaft','Tourismus',['touris','gästebeitrag','kurbeitrag','kurtaxe','fremdenverkehr','übernachtung','wohnmobil','camping','beherbergung','ferienwohnung','urlaub','wanderweg','tourist','kurort','kurpark','ferienregion','gästeführ','freizeitverkehr','reisemobil']),
 S('wirtschaft.arbeit','wirtschaft','Arbeitsmarkt und Fachkräfte',['arbeitsmarkt','fachkräfte','fachkräftesicherung','beschäftigung','arbeitslos','ausbildungsplatz','ausbildungsmarkt','arbeitsförder','langzeitarbeitslos','qualifizierung','berufsorientierung','mindestlohn','tariftreue','arbeitsagentur','agentur für arbeit','arbeitsplätze','ausbildungsmesse','jobmesse']),
 S('wirtschaft.leader','wirtschaft','Regionalentwicklung und LEADER',['leader','\\blag\\b','lokale aktionsgruppe','regionalentwicklung','regionalmanagement','\\bilek\\b','\\bile\\b','integrierte ländliche','regionalbudget','kleinprojekt','ländliche[nr]? raum','metropolregion','regionalverband','regionalmarke','zukunftsregion','strukturwandel','strukturförder']),
 S('wirtschaft.landforst','wirtschaft','Landwirtschaft und Forst',['landwirtschaft','landwirt','agrar','\\bforst','holzeinschlag','holzverkauf','waldbewirtschaftung','forstwirtschaft','\\bjagd','jagdpacht','jagdgenossenschaft','fischerei','\\bweide','acker','flurbereinigung','weinbau','weinberg','obstbau','\\bwald(?:weg|wirtschaft|pflege|zustand|bericht|umbau)\\b','gemeindewald','stadtwald','kommunalwald','\\bholz\\b','borkenkäfer','\\bdünger','tierhaltung','viehhaltung','\\bvieh']),
];
// Begriffe, die das Thema zeigen, ohne ein Unterthema zu treffen
const THEME_WORDS={bildung:['\\bbildung(?!s?(?:urlaub|ausschuss))','\\bschüler','\\blehr(?:er|kräfte)'],umwelt:['umwelt','ökolog'],soziales:['sozial(?!versicherungs|raum|räume)','demograf'],kultur:['\\bsport\\b'],sicherheit:[],verwaltung:['bürgerservice','bürgerbüro','servicezeiten','öffentlichkeitsarbeit','\\blogo\\b','corporate design','standesamt'],finanzen:['finanz','spende','sponsoring','gebühr'],mobilitaet:[],bauen:[],wirtschaft:[]};

// \\b gilt in JS nur für ASCII („Bahnübergang“ hätte nach „Bahn“ eine Grenze); daher eine Grenze für Buchstaben aller Art.
const B='(?:(?<![\\p{L}\\d])(?=[\\p{L}\\d])|(?<=[\\p{L}\\d])(?![\\p{L}\\d]))';
const reOf=words=>new RegExp(words.join("|").replace(/\\b/g,B),'iu');
for(const s of SUBTOPICS){s.re=reOf(s.words);}
const THEME_RE=Object.fromEntries(Object.entries(THEME_WORDS).filter(([,w])=>w.length).map(([t,w])=>[t,reOf(w)]));
export const subtopicName=id=>SUBTOPICS.find(s=>s.id===id)?.name||'';
export const themeName=id=>THEMES.find(t=>t.id===id)?.name||'noch nicht zugeordnet';

// Straßennamen und Adressen sind kein Thema („Schulstraße 34“, „Am Sportplatz 3“); Straßenarten bleiben.
const KEEP_STREET=/^(?:fahrrad|bundes|kreis|landes|bundes|gemeinde|anlieger|erschließungs|umgehungs|spiel|einbahn|privat|staats|orts|haupterschließungs|wohn|sammel|durchgangs|schul)$/i;
/** Titel oder Betreff für die Begriffe vorbereiten: Personen, Ausschussnamen, Straßennamen, Adressen und Aktenzeichen weg. */
export function prepare(s){
 return String(s||'').normalize('NFKC')
  .replace(/\s+[–—-]\s*(?:Frau|Herrn?)\s+[^;]+$/iu,'')
  .replace(/[\wäöüßÄÖÜ-]*ausschuss(?:es|ses)?\b(?:\s+(?:für|der|des)\s+[^;:()]{0,100}?(?=\s(?:zur|zum|zu|über|betr\.?|betreffend|vom|am|hier|[-–])\s|[;:()]|$))?/giu,' ')
  .replace(/(?:gem\.?|gemäß|nach|lt\.?|i\.\s?V\.\s?m\.?)?\s*§+[^;:]{0,60}?(?:geschäftsordnung|gescho|go nrw|gemo|kverf|nkomvg|hgo|kommunalverfassung|gemeindeordnung)\b[^,;:]{0,80}?(?=\s(?:betr\.?|betreffend|zur|zum|zu|über|hier|[-–])\s|[,;:]|$)/giu,' ')
  .replace(/(?<![\p{L}])([\p{L}.-]+?)-?(straße|strasse|str\.|weg|platz|allee|gasse|ring|damm|ufer|stieg|pfad)\s*\d+\s?[a-z]?(?![\p{L}\d])/giu,(m,p)=>KEEP_STREET.test(p)?m:' Adresse ')
  .replace(/(?<![\p{L}])([\p{L}-]{2,}?)-?(straße|strasse|str\.)(?=$|[\s,;:.)\d"“”])/giu,(m,p)=>KEEP_STREET.test(p)?m:' Strname ')
  .replace(/\s+/g,' ').trim();
}

/** Betreff und Beschlussvorschlag aus der Textfassung eines Hauptdokuments (höchstens etwa 500 Zeichen). */
export function subjectOf(text){
 const t=String(text||'').slice(0,12000).replace(/(\p{Ll})- (\p{Ll})/gu,'$1$2').replace(/\s+/g,' ');
 const out=[];
 const b=t.match(/\bBetreff\s*:?\s*(.{10,220}?)(?=\s(?:Beratungsfolge|Sachverhalt|Beschlussvorschlag|Beschlussempfehlung|Sachdarstellung|Begründung|Anlage|Bezug|Fachbereich|Datum)\b|$)/i);
 if(b)out.push(b[1]);
 const v=t.match(/(?:Beschlussvorschlag|Beschlussempfehlung|Beschlussentwurf|Empfehlung an|Antrag(?:stext)?:|(?:Rat|Stadtrat|Gemeinderat|Kreistag|Ortsbeirat|Ortschaftsrat|Bezirksvertretung|Verbandsgemeinderat|Stadtverordnetenversammlung|Gemeindevertretung|Bürgerschaft)\b[^.]{0,80}\bbeschließt|Die Verwaltung wird (?:beauftragt|gebeten))\s*:?\s*(.{10,300}?)(?=\s(?:Begründung|Sachverhalt|Sachdarstellung|Finanzielle Auswirkung|Erläuterung|Problembeschreibung|Anlage)\b|$)/i);
 if(v)out.push(v[1]);
 return out.join(' | ');
}

// Vorrangregeln vor dem ersten Begriff
const PLAN=/bebauungsplan|bebauungs- und|flächennutzungsplan|bauleitplan|\bfnp\b|\bb-plan/i;
const PLAN_ENERGY=/wind(?:energie|kraft|park|rad)|bürgerwind|photovoltaik|freiflächen|solar|pv-?park|pv-anlage|\bpv\b|agri-?pv/i;
const BUDGET=/haushalts(?:plan|satzung|entwurf|ausführung|rede|beratung|jahr|sicherung|konsolidierung)|(?<![a-zäöüß])haushalt(?:s|es)?\b|nachtragshaushalt|doppelhaushalt|jahresabschl|gesamtabschl|abschlussprüfer|\bwirtschaftsplan|investitionsplan|stellenplan|hebes[aä]tz|grundsteuer|gewerbesteuer|hundesteuer|zweitwohnungssteuer|vergnügungssteuer|steuersatzung/i;
// Annahme von Spenden ist Routine (Konzept 5.2.1); Sammelpunkte ohne einzelnes Thema bleiben offen, auch mit Text.
const ROUTINE=/annahme.{0,60}(?:spende|sponsor|schenkung|zuwendung)|^(?:spenden|zuwendungen)\b|pflichtenbelehrung|^(?:bestellung|benennung|entsendung|wahl|nachwahl|neuwahl|berufung|abberufung|besetzung|neubesetzung|umbesetzung)\b.{0,100}(?:vertret|mitglied|gesellschafterversammlung|aufsichtsrat|verbandsversammlung|beirat|vorstand|schöffen|schiedsperson|stellvertret|vorsitz|delegiert|gremien)|^(?:ausschusssitzung|sitzung de[rs])\b|^angelegenheit(?:en|\/en)?\b|sitzungstermin|sitzungsplan|jahresplanung.{0,30}sitzung|beschlusscontrolling|beschlusskontrolle/i;
const COLLECTION=/^(?:(?:neue |mündliche |schriftliche |allgemeine )?(?:anfragen|mitteilungen|berichte|informationen|bekanntgaben|eingänge|anträge|kenntnisnahmen|verschiedenes|sonstiges|termine)\b(?!\s*(?:zu|zum|zur|über|betr|:))|bericht(?:e)? de[rs] (?:bürgermeister|oberbürgermeister|verwaltung|landrat|ortsvorsteher|amtsdirektor|vorsitzenden)|mitteilungen? de[rs]|einwohnerfragestunde|fragestunde|bürgerfragestunde)/i;

function hitsOf(s){
 const out=[];
 for(const st of SUBTOPICS){
  const m=s.match(st.re);if(!m)continue;
  if(st.not&&st.not.test(s))continue;
  if(st.needs&&!st.needs.test(s))continue;
  out.push({sub:st,i:m.index,word:m[0],strong:st.strong||!WEAK_THEMES.has(st.theme)});
 }
 for(const [t,re] of Object.entries(THEME_RE)){const m=s.match(re);if(m)out.push({sub:null,theme:t,i:m.index,word:m[0],strong:!WEAK_THEMES.has(t)});}
 for(const h of out)h.theme??=h.sub.theme;
 return out;
}
function pickTheme(hits){
 const strong=hits.filter(h=>h.strong),pool=strong.length?strong:hits;
 if(!pool.length)return null;
 return pool.reduce((a,b)=>b.i<a.i?b:a).theme;
}
function subsOf(theme,hits){
 let subs=hits.filter(h=>h.sub&&h.theme===theme).map(h=>h.sub);
 const ex=subs.find(s=>s.exclusive);if(ex)subs=[ex];
 // Familien: das Standard-Unterthema nur, wenn kein anderes derselben Familie trifft
 return [...new Set(subs.filter(s=>!(s.fallback&&subs.some(o=>o!==s&&o.family===s.family))).map(s=>s.id))];
}

/** Alle Themen, deren Begriffe in einem kurzen Text vorkommen (Lena: Thema einer Frage); schwache Themen (Finanzen,
 *  Verwaltung) nur, wenn kein anderes Thema trifft. Reihenfolge wie THEMES. */
export function themesIn(text){
 const h=hitsOf(prepare(text||''));
 const ids=new Set(h.map(x=>x.sub?.theme||x.theme)),strong=[...ids].filter(id=>!WEAK_THEMES.has(id));
 const keep=strong.length?new Set(strong):ids;
 return THEMES.map(t=>t.id).filter(id=>keep.has(id));
}

/** Thema und Unterthemen eines Vorgangs.
 *  @param {{title:string,subject?:string,summary?:string}} x  subject: subjectOf(text), summary: Regel-Kurzfassung
 *  @returns {{theme:string,subs:string[],source:'title'|'text'|'formal'|'none',word?:string}} */
export function themeOf({title,subject='',summary='',long=''}){
 const raw=String(title||'');const t=prepare(raw);
 let theme=null,source='title';
 if(PLAN.test(t.slice(0,120)))theme=PLAN_ENERGY.test(t)?'umwelt':'bauen';
 else if(BUDGET.test(t.slice(0,100)))theme='finanzen';
 else if(/\behem(?:alig\w*|\.)|\bareal\b|umnutzung|konversion/i.test(t)&&hitsOf(t).some(h=>h.theme==='bauen'))theme='bauen';
 else if(itemKind(raw)!=='subject')return {theme:OPEN,subs:[],source:'formal'};
 const th=hitsOf(t);
 theme??=pickTheme(th);
 let subs=theme?subsOf(theme,th):[];
 if(!theme){
  // Stufen: Betreff/Beschlussvorschlag und kurze Fassung, dann (falls übergeben) die lange Fassung
  for(const [part,label] of [[[subject,summary],'text'],[[long],'long']]){
   const more=prepare(part.filter(Boolean).join(' | '));if(!more)continue;
   const mh=hitsOf(more).filter(h=>h.strong);
   theme=pickTheme(mh);if(theme){source=label;subs=subsOf(theme,mh);break;}
  }
  if(!theme)return {theme:OPEN,subs:[],source:'none'};
 }else if(!subs.length&&subject){
  subs=subsOf(theme,hitsOf(prepare(subject)));
 }
 if(theme==='bauen'&&PLAN.test(t.slice(0,120))&&!subs.includes('bauen.plan'))subs.unshift('bauen.plan');
 if(theme==='umwelt'&&PLAN.test(t.slice(0,120))&&!subs.includes('umwelt.ee'))subs.unshift('umwelt.ee');
 return {theme,subs,source};
}

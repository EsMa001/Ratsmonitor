/*
 * Signale aus dem Modell (seit 22.10.2026; Begriffsbuch requirements/begriffsbuch-kern.md Abschnitt 8): nur konkrete Vorhaben,
 * Kategorie aus Unterthema und Unter-Unterthema bzw. Vorgangsart, Filter („Art“) aus Unter-Unterthema, Leistungsart oder
 * Vorgangsart, Stand aus Schritt, sonst Vorgangsart (bei Vergaben der Status). Abfragen über model_labels (Migration 0046) und
 * report_rules.case_key; ersetzt die Fakten-Regeln der Signale (tenderOf, windStepOf, solarOf …). Form wie bisher:
 * cases (Vorgänge: ck), art (Filterwerte: ck, a), phase (Ausdruck über x, Name des Stands).
 */
import {SUBTOPICS} from '../../shared/themes.mjs';
import {SUBSUBS} from '../../shared/model/subsubs.mjs';
import {PROCESS_STAGES} from '../../shared/stage.mjs';

const q=s=>`'${String(s).replace(/'/g,"''")}'`;
const list=a=>`(${a.map(q).join(',')})`;
const ML='model_labels ml JOIN report_rules rr ON rr.topic_id=ml.topic_id';
const hasSub=subs=>`EXISTS(SELECT 1 FROM json_each(ml.subs) j WHERE j.value IN ${list(subs)})`;
const hasSubsub=ids=>`EXISTS(SELECT 1 FROM json_each(ml.subsubs) j WHERE j.value IN ${list(ids)})`;
const caseMap=(expr,pairs,other='NULL')=>`CASE ${expr} ${pairs.map(([k,v])=>`WHEN ${q(k)} THEN ${q(v)}`).join(' ')} ELSE ${other} END`;
const subName=id=>SUBTOPICS.find(s=>s.id===id)?.name||id;
const subsubsOf=parents=>Object.keys(SUBSUBS).filter(k=>parents.some(p=>k.startsWith(p+'.')));

export const STEP_NAMES={start:'Start',frueh:'Frühe Phase',entwurf:'Entwurf',abwaegung:'Abwägung',beschluss:'Beschluss',umsetzung:'Umsetzung',aufhebung:'Aufhebung',sonst:'Sonstiger Schritt'};
export const SERVICE_NAMES={construction:'Bauleistung',planning:'Planung und Ingenieurleistung',supply:'Lieferung und Fahrzeuge',it:'IT und Digitales',service:'Dienstleistung'};
export const STATUS_NAMES={announced:'Angekündigt',consulting:'In Beratung',recommended:'Empfohlen',approved:'Beschlossen',rejected:'Abgelehnt',postponed:'Vertagt',info:'Zur Kenntnis',unknown:'Stand offen'};
const PROCESS_NAMES=Object.fromEntries(PROCESS_STAGES.map(s=>[s.id,s.name]));

/** Vorgänge: konkrete Vorhaben mit Bedingung über die Antworten eines Berichts */
const cases=cond=>`SELECT DISTINCT rr.case_key ck FROM ${ML} WHERE ml.project=1 AND (${cond})`;
/** Filter aus genau diesen Unter-Unterthemen (Name je Kürzel) */
const artIds=ids=>`SELECT rr.case_key ck,${caseMap('u.value',ids.map(k=>[k,SUBSUBS[k]]))} a FROM ${ML},json_each(ml.subsubs) u WHERE ml.project=1 AND u.value IN ${list(ids)}`;
/** Filter aus Unter-Unterthemen der Elternthemen; ein Bericht ohne Unter-Unterthema unter einem dieser Unterthemen zeigt das Unterthema */
const artFrom=(parents,{subs=true}={})=>{
 const a=artIds(subsubsOf(parents));
 if(!subs)return a;
 const b=`SELECT rr.case_key ck,${caseMap('s.value',parents.map(p=>[p,subName(p)]))} a FROM ${ML},json_each(ml.subs) s WHERE ml.project=1 AND s.value IN ${list(parents)} AND NOT EXISTS(SELECT 1 FROM json_each(ml.subsubs) u WHERE u.value LIKE s.value||'.%')`;
 return `${a} UNION ALL ${b}`;
};
/** Stand: Schritt, sonst Vorgangsart, des jüngsten eingeordneten Berichts des Vorgangs */
const STEP_OR_PROCESS=`(SELECT coalesce(${caseMap('ml.step',Object.entries(STEP_NAMES))},${caseMap('ml.process',Object.entries(PROCESS_NAMES))}) FROM ${ML} WHERE rr.case_key=x.case_key AND ml.project=1 ORDER BY ml.at DESC LIMIT 1)`;
const PHASE_TEXT='Schritt des Verfahrens, sonst die Vorgangsart, aus dem Modell.';
const USES=['gewerbe','industrie','logistik','rechenzentrum','handel','freizeit'];

/* Die Kategorien von docs/produkt/plenara-x-signale.md, in dieser Reihenfolge (Begriffsbuch Abschnitt 8) */
export const MODEL_SIGNALS=[
 {id:'vergaben',name:'Ausschreibungen und Vergaben',who:'Bauindustrie, Ingenieurbüros, Lieferanten, IT',
  cases:cases("ml.process='build'"),
  art:`SELECT rr.case_key ck,${caseMap('ml.service',Object.entries(SERVICE_NAMES))} a FROM ${ML} WHERE ml.project=1 AND ml.process='build' AND ml.service IS NOT NULL`,
  artName:'Leistung',phase:caseMap('x.status',Object.entries(STATUS_NAMES),"'Stand offen'"),phaseText:'Status des Vorgangs, aus dem Modell.'},
 {id:'wohnbau',name:'Neue Wohnbaugebiete',who:'Fertighaus, Bauträger, Makler, Banken',
  cases:cases(hasSubsub(['bauen.plan.wohnen','bauen.plan.misch','bauen.erschl.wohnen','bauen.erschl.misch'])),
  art:`${artIds(['bauen.erschl.neu','bauen.erschl.erweiterung','bauen.erschl.erschliessung','bauen.erschl.bauplatz'])} UNION ALL SELECT rr.case_key ck,'Bauleitplanung' a FROM ${ML} WHERE ml.project=1 AND ${hasSub(['bauen.plan'])}`,
  artName:'Vorhaben',phase:STEP_OR_PROCESS,phaseText:PHASE_TEXT},
 {id:'gewerbe',name:'Gewerbe, Industrie und Handel',who:'Projektentwicklung, Logistik, Handel, Wirtschaftsförderung',
  cases:cases(`${hasSubsub(USES.flatMap(u=>[`bauen.plan.${u}`,`bauen.erschl.${u}`]))} OR ${hasSub(['wirtschaft.gewerbe','wirtschaft.innen'])}`),
  art:artIds([...USES.flatMap(u=>[`bauen.plan.${u}`,`bauen.erschl.${u}`]),...subsubsOf(['wirtschaft.gewerbe','wirtschaft.innen'])]),
  artName:'Nutzung',phase:STEP_OR_PROCESS,phaseText:PHASE_TEXT},
 {id:'wind',name:'Windenergie',who:'Projektierer, Stadtwerke, Netzbetreiber, Bürgerenergie',
  cases:cases(hasSubsub(['umwelt.ee.wind'])),
  art:`SELECT rr.case_key ck,${caseMap('ml.process',Object.entries(PROCESS_NAMES))} a FROM ${ML} WHERE ml.project=1 AND ${hasSubsub(['umwelt.ee.wind'])}`,
  artName:'Verfahren',phase:STEP_OR_PROCESS,phaseText:PHASE_TEXT},
 {id:'solar',name:'Solarenergie',who:'Projektierer, Landwirtschaft, Netzbetreiber, Handwerk',
  cases:cases(hasSubsub(['umwelt.ee.pv_frei','umwelt.ee.pv_agri','umwelt.ee.pv_dach','umwelt.ee.speicher'])),
  art:artIds(['umwelt.ee.pv_frei','umwelt.ee.pv_agri','umwelt.ee.pv_dach','umwelt.ee.speicher']),
  artName:'Art',phase:STEP_OR_PROCESS,phaseText:PHASE_TEXT},
 {id:'waerme',name:'Wärme, Energieeffizienz und Netze',who:'Stadtwerke, Energieberatung, Heizungsbranche, Contracting',
  cases:cases(hasSub(['umwelt.waerme','umwelt.klimaschutz'])),art:artFrom(['umwelt.waerme','umwelt.klimaschutz']),artName:'Art',phase:STEP_OR_PROCESS,phaseText:PHASE_TEXT},
 {id:'schulen',name:'Schulen, Kitas und Sportstätten',who:'Bau, Modulbau, Ausstattung, Bäderbau',
  cases:cases(`${hasSub(['bildung.schulbau','bildung.kitabau','kultur.sport','kultur.spiel'])} AND ml.process IN ('build','planning')`),
  art:artFrom(['bildung.schulbau','bildung.kitabau','kultur.sport','kultur.spiel']),artName:'Einrichtung',phase:STEP_OR_PROCESS,phaseText:PHASE_TEXT},
 {id:'strasse',name:'Straßen, Brücken und Radwege',who:'Tiefbau, Ingenieurbüros, Verkehrsplanung',
  cases:cases(hasSub(['mobilitaet.strasse','mobilitaet.rad','mobilitaet.geh'])),art:artFrom(['mobilitaet.strasse','mobilitaet.rad','mobilitaet.geh']),artName:'Vorhaben',phase:STEP_OR_PROCESS,phaseText:PHASE_TEXT},
 {id:'wasser',name:'Wasser, Abwasser und Hochwasserschutz',who:'Ingenieurbüros, Tiefbau, Anlagenbau',
  cases:cases(hasSub(['umwelt.wasser','umwelt.anpass'])),art:artFrom(['umwelt.wasser','umwelt.anpass']),artName:'Vorhaben',phase:STEP_OR_PROCESS,phaseText:PHASE_TEXT},
 {id:'breitband',name:'Breitband und Mobilfunk',who:'Telekommunikation, Tiefbau, Netzbetreiber',
  cases:cases(hasSub(['verwaltung.breit'])),art:artFrom(['verwaltung.breit']),artName:'Vorhaben',phase:STEP_OR_PROCESS,phaseText:PHASE_TEXT},
 {id:'mobil',name:'Mobilität',who:'Mobilitätsanbieter, Ladeinfrastruktur, ÖPNV',
  cases:cases(`${hasSubsub(['mobilitaet.oepnv.buergerbus'])} OR ${hasSub(['mobilitaet.plan'])}`),
  art:`${artFrom(['mobilitaet.plan'])} UNION ALL SELECT rr.case_key ck,${q(SUBSUBS['mobilitaet.oepnv.buergerbus'])} a FROM ${ML} WHERE ml.project=1 AND ${hasSubsub(['mobilitaet.oepnv.buergerbus'])}`,
  artName:'Angebot',phase:STEP_OR_PROCESS,phaseText:PHASE_TEXT},
];

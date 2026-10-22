// Fakten an das Modell binden (seit 22.10.2026): ein Wert aus dem Text zählt nur bei einem Sachpunkt, dessen Unterthema (oder
// Vorgangsart) zur Art des Fakts passt. Eine feste Zuordnung je Fakt-Art, keine Regel je Einzelfall. Heute las readReport jeden
// Sachpunkt und griff dabei auch Vergleichs- und Hintergrundwerte ab (Hebesatz in einer Kita-Vorlage, Wohneinheiten im Haushalt).
// Messung: scripts/model-study/fact-gate.mjs.
export const FACT_SUBS={
 hebesatz:['finanzen.steuer','finanzen.hh'],dog_tax:['finanzen.steuer','finanzen.hh'],second_home_tax:['finanzen.steuer','finanzen.hh'],amusement_tax:['finanzen.steuer','finanzen.hh'],
 budget:['finanzen.hh'],annual_result:['finanzen.abschl','finanzen.beteil','finanzen.hh'],
 fee_rate:['umwelt.wasser'],waste_fee:['umwelt.abfall'],kita_fee:['bildung.kitabetr','bildung.kitabau'],
 land_price:['wirtschaft.gewerbe','bauen.grund'],plot_price:['bauen.grund','bauen.erschl','bauen.wohnen'],
 plan:['bauen.plan','bauen.erschl'],plan_use:['bauen.plan','bauen.erschl'],plan_area:['bauen.plan','bauen.erschl'],housing:['bauen.plan','bauen.erschl','bauen.wohnen'],house_type:['bauen.plan','bauen.erschl','bauen.wohnen'],
 wind_count:['umwelt.ee'],ee_power:['umwelt.ee'],heat_plan:['umwelt.waerme'],road:['mobilitaet.strasse','mobilitaet.rad','mobilitaet.geh','bauen.erschl'],
};
/** Vorgangsarten statt Unterthemen (Zuschüsse an Vereine und Träger: Geld in jedem Thema) */
export const FACT_PROCESS={grant:['money']};
/** Passt der Fakt zu den Antworten des Modells? {kind, subs, process}; ohne Zuordnung immer ja */
export function factFits(fact,{kind,subs=[],process=null}){
 if(FACT_PROCESS[fact])return kind==='subject'&&FACT_PROCESS[fact].includes(process);
 const want=FACT_SUBS[fact];if(!want)return true;
 return kind==='subject'&&subs.some(s=>want.includes(s));
}

/* Fakten, deren Wert eine Einordnung ist (Verfahrensschritt): mit Modell kommt der Wert aus dessen Schritt (Begriffsbuch 4b),
   übersetzt in die Namen, die Atlas, Signale und Fakten-Seite kennen. Planname und Nummer bleiben Werte aus dem Text. */
export const PLAN_STEP_NAME={start:'Aufstellung',frueh:'Frühzeitige Beteiligung',entwurf:'Offenlage',abwaegung:'Abwägung',beschluss:'Satzungsbeschluss',aufhebung:'Aufhebung',umsetzung:'Sonstiger Schritt',sonst:'Sonstiger Schritt'};
export const HEAT_STEP_NAME={start:'Start und Beauftragung',frueh:'Analyse und Zwischenstand',entwurf:'Entwurf und Beteiligung',abwaegung:'Entwurf und Beteiligung',beschluss:'Wärmeplan vorgelegt',umsetzung:'Umsetzung und Fortschreibung'};
/**
 * Fakten mit dem Modell nachziehen: Schritt des Bebauungsplans aus dem Modell; Schritt der Wärmeplanung nur bei Unter-Unterthema
 * kommunale Wärmeplanung und mit Schritt des Modells (sonst kein Fakt).
 * @param {{kind:string,value:string,detail:string}[]} facts @param {{subsubs?:string[],step?:string|null}} model
 */
export function stepFacts(facts,model){
 const out=facts.filter(f=>f.kind!=='heat_plan').map(f=>f.kind==='plan'&&model.step&&PLAN_STEP_NAME[model.step]?{...f,value:PLAN_STEP_NAME[model.step]}:f);
 if((model.subsubs||[]).includes('umwelt.waerme.waermeplan')&&HEAT_STEP_NAME[model.step])out.push({kind:'heat_plan',value:HEAT_STEP_NAME[model.step],detail:''});
 return out;
}

/* Fakten, die eine Einordnung sind und mit dem Modell nicht mehr gelesen werden (seit 22.10.2026): Bausteine der früheren
   Signal-Regeln (jetzt Vorgangsart, Leistungsart, Unter-Unterthemen) und die im Begriffsbuch gestrichenen Hausform und
   Empfehlung. Die Nutzung im Plan (plan_use) bleibt Regel: auf den Prüfberichten 8 von 8 richtig gegen 10 von 14 beim Modell. */
export const MODEL_COVERED=new Set(['tender','street','road','water','broadband','solar','energy','wind_step','school_build','wohnbau_art','area_dev','retail','care','project','house_type','faction_advice']);

// Anzeigenamen der Antworten des Modells (Begriffsbuch requirements/begriffsbuch-kern.md): eine Stelle für Admin, Signale und
// Seiten. Reihenfolge wie die Kataloge in features.mjs.
import {PROCESS_STAGES} from '../stage.mjs';

export const KIND_NAMES={subject:'Sachpunkt',procedure:'Ablauf (Formalien und Sammelpunkte)',personal:'Personalie'};
export const STATUS_NAMES={announced:'Angekündigt',consulting:'In Beratung',recommended:'Empfohlen',approved:'Beschlossen',rejected:'Abgelehnt',postponed:'Vertagt',info:'Zur Kenntnis',unknown:'Stand offen'};
export const PROCESS_NAMES=Object.fromEntries(PROCESS_STAGES.map(s=>[s.id,s.name]));
export const STEP_NAMES={start:'Start',frueh:'Frühe Phase',entwurf:'Entwurf',abwaegung:'Abwägung',beschluss:'Beschluss',umsetzung:'Umsetzung',aufhebung:'Aufhebung',sonst:'Sonstiger Schritt'};
export const SERVICE_NAMES={construction:'Bauleistung',planning:'Planung und Ingenieurleistung',supply:'Lieferung und Fahrzeuge',it:'IT und Digitales',service:'Dienstleistung'};
export const APPLICANT_NAMES={fraction:'Fraktion',member:'Einzelnes Mitglied',body:'Gremium',residents:'Einwohner'};
export const DOCTYPE_NAMES={paper:'Vorlage',bundle:'Sammeldokument',attachment:'Anlage',result:'Ergebnis (Beschlussauszug)',minutes:'Niederschrift',session:'Sitzungsunterlage',other:'Sonstiges'};

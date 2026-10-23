// Stufen, Grenzen und Funktionen: eine Quelle für Server und Oberfläche (requirements/konten-konzept.md, Abschnitt 7).
// docs/produkt/stufen.md wird von Hand mitgezogen; tests/accounts-tiers.test.mjs vergleicht beide.

export const TIERS=['guest','basic','pro','enterprise'];
/** Plus (pro) und Enterprise: gespeicherte Suchen, Artikel und aktive Benachrichtigungen je bis zu 100 */
export const PLAN_MAX=100;
/**
 * Stufe eines angemeldeten Kontos ohne gültige Zeile in plan_grants: „Konto“ (basic, kostenlos; Entscheidung 23.10.2026).
 * Plus (pro) wird über eine Zeile freigeschaltet: in der Testphase vom Admin (source beta/manual), später nach bestätigter
 * Zahlung (source stripe, Abschnitt 9). Enterprise gibt es noch nicht im Angebot (später KI, Team, Schnittstelle).
 */
export const ACCOUNT_DEFAULT_TIER='basic';
const INF=Number.POSITIVE_INFINITY;
export const LIMITS={
 // instant: Mails sofort (Suchen mit Rhythmus „sofort“, gefolgte Vorgänge); ohne kommen sie einmal am Tag (server/accounts/notify.mjs)
 guest:{maxResults:10,filters:true,bookmarks:0,savedSearches:0,notifications:0,emails:0,calendar:false,instant:false},
 basic:{maxResults:20,filters:true,bookmarks:5,savedSearches:5,notifications:5,emails:1,calendar:false,instant:false},
 pro:{maxResults:INF,filters:true,bookmarks:PLAN_MAX,savedSearches:PLAN_MAX,notifications:PLAN_MAX,emails:1,calendar:true,instant:true},
 enterprise:{maxResults:INF,filters:true,bookmarks:PLAN_MAX,savedSearches:PLAN_MAX,notifications:PLAN_MAX,emails:5,calendar:true,instant:true},
};
/** Funktionen je Stufe, die der Server prüft (requireFeature) */
export const FEATURES={
 // KI-Assistenten (Kunden-MCP) gehören zu keiner Stufe: Zugang nur über die Kundendatei des Betreibers (server/accounts/oauth.mjs)
 guest:{analytics:false,calendar:false,lenaPerMin:10},
 basic:{analytics:false,calendar:false,lenaPerMin:30},
 pro:{analytics:true,calendar:true,lenaPerMin:60},
 enterprise:{analytics:true,calendar:true,lenaPerMin:60},
};
export const TIER_LABEL={guest:'Gast',basic:'Konto',pro:'Plus',enterprise:'Enterprise'};
/** Preise: Platzhalter bis zur Entscheidung (konten-konzept.md, Abschnitt 15). null heißt „Preis folgt“. */
export const PRICES={basic:0,pro:2.99,enterprise:null};
export const rank=tier=>TIERS.indexOf(tier);
export const validTier=tier=>TIERS.includes(tier);
/** Grenzen als JSON (Infinity → null) */
export const limitsJson=tier=>Object.fromEntries(Object.entries(LIMITS[tier]||LIMITS.guest).map(([k,v])=>[k,v===INF?null:v]));

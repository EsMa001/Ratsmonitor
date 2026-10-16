// Stufen, Grenzen und Funktionen: eine Quelle für Server und Oberfläche (requirements/konten-konzept.md, Abschnitt 7).
// docs/produkt/stufen.md wird von Hand mitgezogen; tests/accounts-tiers.test.mjs vergleicht beide.

export const TIERS=['guest','basic','pro','enterprise'];
/** Pro und Enterprise: gespeicherte Suchen, Artikel und aktive Benachrichtigungen je bis zu 100 */
export const PLAN_MAX=100;
/**
 * Stufe eines angemeldeten Kontos ohne gültige Zeile in plan_grants. Freigeschaltet wird erst über eine Zeile:
 * in der Testphase vom Admin (source beta/manual), später nach bestätigter Zahlung (source stripe, Abschnitt 9).
 * Bis dahin hat ein Konto die Rechte eines Gasts, dazu Kontoverwaltung, Datenauskunft und Löschen.
 */
export const ACCOUNT_DEFAULT_TIER='guest';
const INF=Number.POSITIVE_INFINITY;
export const LIMITS={
 guest:{maxResults:10,filters:false,bookmarks:0,savedSearches:0,notifications:0,emails:0,calendar:false},
 basic:{maxResults:INF,filters:true,bookmarks:1,savedSearches:1,notifications:1,emails:1,calendar:false},
 pro:{maxResults:INF,filters:true,bookmarks:PLAN_MAX,savedSearches:PLAN_MAX,notifications:PLAN_MAX,emails:1,calendar:false},
 enterprise:{maxResults:INF,filters:true,bookmarks:PLAN_MAX,savedSearches:PLAN_MAX,notifications:PLAN_MAX,emails:5,calendar:true},
};
/** Funktionen je Stufe, die der Server prüft (requireFeature) */
export const FEATURES={
 guest:{analytics:false,calendar:false,lenaPerMin:10},
 basic:{analytics:false,calendar:false,lenaPerMin:30},
 pro:{analytics:false,calendar:false,lenaPerMin:30},
 enterprise:{analytics:true,calendar:true,lenaPerMin:60},
};
/** Übersichten der Auswertungen, die ohne Enterprise offen sind (pages/analytics/AnalyticsPages.tsx) */
export const FREE_ANALYTICS=['/analytics','/analytics/ueber','/analytics/tools','/analytics/einblicke','/analytics/themen','/analytics/politik','/analytics/finanzen'];
export const TIER_LABEL={guest:'Gast',basic:'Basic',pro:'Pro',enterprise:'Enterprise'};
/** Preise: Platzhalter bis zur Entscheidung (konten-konzept.md, Abschnitt 15). null heißt „Preis folgt“. */
export const PRICES={basic:null,pro:null,enterprise:null};
export const rank=tier=>TIERS.indexOf(tier);
export const validTier=tier=>TIERS.includes(tier);
/** Grenzen als JSON (Infinity → null) */
export const limitsJson=tier=>Object.fromEntries(Object.entries(LIMITS[tier]||LIMITS.guest).map(([k,v])=>[k,v===INF?null:v]));

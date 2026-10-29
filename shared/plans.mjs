// Stufen, Grenzen und Funktionen: eine Quelle für Server und Oberfläche (requirements/konten-konzept.md, Abschnitt 7).
// docs/produkt/stufen.md wird von Hand mitgezogen; tests/accounts-rules.test.mjs vergleicht beide.

/** Reihenfolge = Rang. Enterprise gibt es nicht im Angebot (später KI, Team, Schnittstelle), die Stufe bleibt verborgen über Pro. */
export const TIERS=['guest','basic','plus','pro','enterprise'];
/** Stufen, die sich über Stripe buchen lassen (server/accounts/billing.mjs, STRIPE_PRICE_PLUS und STRIPE_PRICE_PRO) */
export const BOOKABLE=['plus','pro'];
/** „Unbegrenzt“ (Pro, Enterprise): interne Obergrenze gegen Missbrauch, angezeigt wird „unbegrenzt“ */
export const PLAN_MAX=1000;
/**
 * Stufe eines angemeldeten Kontos ohne gültige Zeile in plan_grants: „Konto“ (basic, kostenlos; Entscheidung 23.10.2026).
 * Plus und Pro werden über eine Zeile freigeschaltet: vom Admin (source beta/manual) oder nach bestätigter Zahlung
 * (source stripe, Abschnitt 9). Stufen seit 29.10.2026: Gast, Konto, Plus 2,99 €, Pro 19,99 € (docs/produkt/stufen.md).
 */
export const ACCOUNT_DEFAULT_TIER='basic';
const INF=Number.POSITIVE_INFINITY;
/**
 * notifications: Glocken an Suchen und gefolgten Vorgängen zusammen. freqs: erlaubte Rhythmen der Mails (Glocken, Wochenbericht,
 * Kalender), schnellster zuerst; „sofort“ gibt es in keiner Stufe mehr (server/accounts/notify.mjs). weeklyReport: Wochenbericht
 * über alle gespeicherten Suchen ohne eigene Glocke. calendarAreas: Gebiete im Sitzungskalender (je Eintrag ein Ort, auf Wunsch
 * mit Umkreis). Plus: alle Suchen und Vorgänge in einer Mail je Woche, deshalb so viele Glocken wie Suchen und Artikel.
 */
export const LIMITS={
 guest:{maxResults:10,filters:false,bookmarks:0,savedSearches:0,notifications:0,freqs:[],weeklyReport:false,calendarAreas:0,emails:0},
 basic:{maxResults:20,filters:true,bookmarks:1,savedSearches:1,notifications:1,freqs:['weekly'],weeklyReport:false,calendarAreas:1,emails:1},
 plus:{maxResults:INF,filters:true,bookmarks:10,savedSearches:10,notifications:20,freqs:['weekly'],weeklyReport:true,calendarAreas:5,emails:1},
 pro:{maxResults:INF,filters:true,bookmarks:PLAN_MAX,savedSearches:PLAN_MAX,notifications:PLAN_MAX,freqs:['daily','weekly'],weeklyReport:true,calendarAreas:PLAN_MAX,emails:1},
 enterprise:{maxResults:INF,filters:true,bookmarks:PLAN_MAX,savedSearches:PLAN_MAX,notifications:PLAN_MAX,freqs:['daily','weekly'],weeklyReport:true,calendarAreas:PLAN_MAX,emails:5},
};
/** Funktionen je Stufe, die der Server prüft (gated(…,{feature}) in server/services/session.ts) */
export const FEATURES={
 // KI-Assistenten (Kunden-MCP) gehören zu keiner Stufe: Zugang nur über die Kundendatei des Betreibers (server/accounts/oauth.mjs).
 // fulltext: Suche in den Texten der Dokumente (Pro); gesperrt ist sie schon, gebaut wird sie getrennt (Parameter volltext=1).
 guest:{analytics:false,calendar:false,fulltext:false,lenaPerMin:10},
 basic:{analytics:false,calendar:true,fulltext:false,lenaPerMin:30},
 plus:{analytics:true,calendar:true,fulltext:false,lenaPerMin:60},
 pro:{analytics:true,calendar:true,fulltext:true,lenaPerMin:60},
 enterprise:{analytics:true,calendar:true,fulltext:true,lenaPerMin:60},
};
export const TIER_LABEL={guest:'Gast',basic:'Konto',plus:'Plus',pro:'Pro',enterprise:'Enterprise'};
/** Preise in Euro im Monat (Endpreis). null heißt „Preis folgt“ (Enterprise, nicht im Angebot). */
export const PRICES={basic:0,plus:2.99,pro:19.99,enterprise:null};
export const rank=tier=>TIERS.indexOf(tier);
export const validTier=tier=>TIERS.includes(tier);
/** Grenzen als JSON (Infinity → null) */
export const limitsJson=tier=>Object.fromEntries(Object.entries(LIMITS[tier]||LIMITS.guest).map(([k,v])=>[k,v===INF?null:v]));
/** Rhythmen von schnell nach langsam; „instant“ steht noch in älteren Zeilen und gilt als „täglich“ */
export const FREQS=['instant','daily','weekly'];
/**
 * Rhythmus, der in dieser Stufe gilt: der gewünschte, wenn erlaubt, sonst der nächst langsamere erlaubte (sofort → täglich,
 * täglich → wöchentlich); ohne Wunsch der schnellste erlaubte. null: keine Mails in dieser Stufe.
 */
export function freqFor(tier,wanted){
 const allowed=LIMITS[tier]?.freqs||[];
 if(allowed.includes(wanted))return wanted;
 const at=FREQS.indexOf(wanted);
 return allowed.find(f=>FREQS.indexOf(f)>at)??allowed.at(-1)??null;
}
/**
 * Gebietsschlüssel des Kalenders in dieser Stufe: die gespeicherte Liste (mit Umkreis, im Browser gerechnet). Stehen mehr Gebiete
 * im Kalender, als die Stufe erlaubt (nach einem Wechsel nach unten), nur die ersten Orte selbst, ohne Umkreis.
 */
export function calendarAgsFor(areas,ags,tier){
 const max=LIMITS[tier]?.calendarAreas??0,list=Array.isArray(areas)?areas:[];
 if(!max)return [];
 return list.length<=max?(Array.isArray(ags)?ags:[]):list.slice(0,max).map(a=>String(a?.ags??'')).filter(Boolean);
}

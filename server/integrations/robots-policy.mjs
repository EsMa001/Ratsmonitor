// How the project treats robots.txt: recorded, not obeyed.
//
// Decision of the project owner of 05.10.2026 (legally reviewed): automated retrieval of public council documents of
// German authorities is allowed and wanted, also through HTML pages where no suitable interface exists. robots.txt is
// therefore still asked and recorded (scripts/source-discovery/robots.mjs, server/integrations/source-robots.json, the
// gap atlas), but no longer obeyed.
//
// Unchanged:
// - Every request names the project in its User-Agent; never a browser identity.
// - Load limits: at most two requests per server at a time (pipeline-jobs.mjs, verify.mjs, crawl.mjs), time budgets
//   per source, no load peaks.
// - No repetition after HTTP 403 (or 429). No circumvention of technical blocks: 401/403, web firewalls, access checks
//   in the browser (ALLRIS "Zugriff pruefen"), logins, members' areas. Such areas stay "Zugriffsschutz"; only a consent
//   of the operator opens them (source-consents.json, scope "freischaltung").
// - Public parts only; the non-public part is never read.
//
// ROBOTS_POLICY=obey restores the former behaviour (robots.txt obeyed); the tests of the old rules set it. Without it
// (also in the Worker, which has no process environment) the rule is "record".
export const ROBOTS_POLICIES=Object.freeze(['record','obey']);
/** 'record' (recorded, not obeyed; the default) or 'obey'. */
export function robotsPolicy(env=globalThis.process?.env){
 return String(env?.ROBOTS_POLICY||'').trim().toLowerCase()==='obey'?'obey':'record';
}
/** Whether a refusal in robots.txt keeps an address from being read. */
export const obeyRobots=(env)=>robotsPolicy(env)==='obey';

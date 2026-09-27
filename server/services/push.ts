import 'server-only';
import { env } from 'cloudflare:workers';
const bytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const encode = (s: string) => b64(new TextEncoder().encode(s));
export function validEndpoint(value: string) { try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port && (u.hostname === 'fcm.googleapis.com' || u.hostname === 'updates.push.services.mozilla.com' || u.hostname.endsWith('.push.services.mozilla.com') || u.hostname === 'web.push.apple.com');
}
catch {
    return false;
} }
export async function endpointId(endpoint: string) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint)))].map(x => x.toString(16).padStart(2, '0')).join(''); }
export async function sendWake(endpoint: string) { if (!validEndpoint(endpoint) || !env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT)
    throw Error('Push nicht konfiguriert'); const pub = bytes(env.VAPID_PUBLIC_KEY); const key = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: b64(pub.slice(1, 33)), y: b64(pub.slice(33, 65)), d: env.VAPID_PRIVATE_KEY, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']); const msg = encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })) + '.' + encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 3600, sub: env.VAPID_SUBJECT })); const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(msg))); return fetch(endpoint, { method: 'POST', headers: { TTL: '3600', Urgency: 'normal', Authorization: `vapid t=${msg}.${b64(sig)}, k=${env.VAPID_PUBLIC_KEY}` }, redirect: 'error', signal: AbortSignal.timeout(12000) }); }
export async function dispatchDecisionPush() { if (!env.DB || !env.VAPID_PRIVATE_KEY)
    return; const latest = await env.DB.prepare("SELECT value FROM system_state WHERE key='latest-decision'").first<{
    value: string;
}>(); if (!latest)
    return; const decision = JSON.parse(latest.value); const subscriptions = await env.DB.prepare('SELECT id,endpoint,last_sent_at,created_at FROM push_subscriptions WHERE last_sent_at IS NULL OR last_sent_at < ? LIMIT 500').bind(decision.detectedAt).all<{
    id: string;
    endpoint: string;
    last_sent_at: string;
    created_at: string;
}>(); for (const s of subscriptions.results) {
    if (s.created_at >= decision.detectedAt)
        continue;
    try {
        const r = await sendWake(s.endpoint);
        if (r.status === 404 || r.status === 410)
            await env.DB.prepare('DELETE FROM push_subscriptions WHERE id=?').bind(s.id).run();
        else if (r.ok)
            await env.DB.prepare('UPDATE push_subscriptions SET last_sent_at=? WHERE id=?').bind(decision.detectedAt, s.id).run();
    }
    catch {
        console.error('Push-Zustellung fehlgeschlagen');
    }
} }

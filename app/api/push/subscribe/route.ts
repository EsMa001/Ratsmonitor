import { env } from 'cloudflare:workers';
import { validEndpoint, endpointId } from '@/server/services/push';
async function change(request: Request, remove = false) { if (request.headers.get('origin') !== new URL(request.url).origin)
    return Response.json({ error: 'Origin abgelehnt' }, { status: 403 }); if (Number(request.headers.get('content-length')) > 10000)
    return new Response(null, { status: 413 }); if (!env.DB)
    return Response.json({ error: 'Speicher nicht erreichbar' }, { status: 503 }); try {
    const raw = await request.text();
    if (raw.length > 10000)
        return new Response(null, { status: 413 });
    const body = JSON.parse(raw);
    if (typeof body.endpoint !== 'string' || body.endpoint.length > 4000 || !validEndpoint(body.endpoint))
        return Response.json({ error: 'Ungültiges Abonnement' }, { status: 400 });

    const id = await endpointId(body.endpoint);
    if (remove) {
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE id=?').bind(id).run();
    }
    else {
        if (typeof body.keys?.auth !== 'string' || typeof body.keys?.p256dh !== 'string')
            return new Response(null, { status: 400 });
        await env.DB.prepare('INSERT INTO push_subscriptions (id,endpoint,auth,p256dh,created_at,last_sent_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET auth=excluded.auth,p256dh=excluded.p256dh').bind(id, body.endpoint, body.keys.auth.slice(0, 200), body.keys.p256dh.slice(0, 300), new Date().toISOString(), new Date().toISOString()).run();
    }
    return Response.json({ ok: true });
}
catch {
    return Response.json({ error: 'Abonnement konnte nicht gespeichert werden' }, { status: 500 });
} }
export const POST = (r: Request) => change(r);
export const DELETE = (r: Request) => change(r, true);

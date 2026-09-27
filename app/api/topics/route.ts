import { getFeedPage } from '@/server/repositories/topics';
import { parsePage, InvalidPage, StalePage } from '@/shared/pagination';
export async function GET(request: Request) {
    try {
        return Response.json(await getFeedPage(parsePage(new URL(request.url).searchParams)), { headers: { 'Cache-Control': 'no-store' } });
    }
    catch (e) {
        if (e instanceof InvalidPage || e instanceof StalePage)
            return Response.json({ error: e.message }, { status: e instanceof StalePage ? 409 : 400 });
        return Response.json({ error: 'Themen konnten nicht geladen werden.' }, { status: 500 });
    }
}

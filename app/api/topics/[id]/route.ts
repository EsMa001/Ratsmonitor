import { getTopic } from '@/server/repositories/topics';
export async function GET(_request: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await params;
    const topic = await getTopic(id);
    // Ein Vorgang ändert sich selten: eine Minute im Browser halten, danach im Hintergrund erneuern (Zurück und erneutes Öffnen ohne Abruf).
    return topic ? Response.json(topic, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } }) : Response.json({ error: 'Thema nicht gefunden.' }, { status: 404 });
}

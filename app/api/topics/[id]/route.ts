import { getTopic } from '@/server/repositories/topics';
export async function GET(_request: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await params;
    const topic = await getTopic(id);
    // Ein Vorgang ändert sich selten: eine Minute im Browser halten (Zurück und erneutes Öffnen ohne Abruf). private: Antworten
    // hinter der Anmeldung gehören nicht in geteilte Zwischenspeicher; ohne Nachladen im Hintergrund ist nichts älter als eine Minute.
    return topic ? Response.json(topic, { headers: { 'Cache-Control': 'private, max-age=60' } }) : Response.json({ error: 'Thema nicht gefunden.' }, { status: 404 });
}

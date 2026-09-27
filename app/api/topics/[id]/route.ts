import { getTopic } from '@/server/repositories/topics';
export async function GET(_request: Request, { params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await params;
    const topic = await getTopic(id);
    return topic ? Response.json(topic, { headers: { 'Cache-Control': 'no-store' } }) : Response.json({ error: 'Thema nicht gefunden.' }, { status: 404 });
}

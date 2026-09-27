import {validRegion} from './regions';
export class InvalidPage extends Error {
}
export class StalePage extends Error {
}
export const PAGE_SIZE = 12;
export function parsePage(search: URLSearchParams) {
    const raw = search.get('limit') ?? String(PAGE_SIZE);
    if (!/^\d+$/.test(raw) || Number(raw) < 1 || Number(raw) > 50)
        throw new InvalidPage('limit muss zwischen 1 und 50 liegen.');
    const filter=search.get('filter')||'alle';
    if(!['alle','offen','entschieden'].includes(filter))throw new InvalidPage('Ungültiger Filter.');
    const region=search.get('region')||'billerbeck';
    if(!validRegion(region))throw new InvalidPage('Ungültiges Gebiet.');
    const cursor = search.get('cursor');
    let offset = 0, revision: string | undefined;
    if (cursor) {
        try {
            if (cursor.length > 1000)
                throw Error();
            const data = JSON.parse(atob(cursor));
            if ((data.region||'billerbeck')!==region || (data.filter||'alle')!==filter || data.v !== 1 || !Number.isSafeInteger(data.offset) || data.offset < 0 || typeof data.revision !== 'string')
                throw Error();
            offset = data.offset;
            revision = data.revision;
        }
        catch {
            throw new InvalidPage('Ungültiger Cursor.');
        }
    }
    return { limit: Number(raw), offset, revision, region, filter:filter as TopicFilter };
}
export type PageRequest = ReturnType<typeof parsePage>;
export function nextCursor(offset: number, revision: string,filter:TopicFilter='alle',region='billerbeck') { return btoa(JSON.stringify({ v: 1, offset, revision,filter,region })); }
export type TopicFilter='alle'|'offen'|'entschieden';
export function matchesFilter(status:string,filter:TopicFilter){return filter==='alle'||(filter==='entschieden'?['approved','rejected'].includes(status):['announced','consulting','recommended','postponed'].includes(status));}

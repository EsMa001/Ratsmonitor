import {getRegionCoverage} from '@/server/repositories/regions';
import {regionAvailability} from '@/shared/region-availability.mjs';
import {Header,Footer} from '@/components/site-chrome';
import {NewsFeed} from '@/components/news-feed';
import {RegionPicker} from '@/components/region-picker';
import {getFeedPage,getUpcomingSessions} from '@/server/repositories/topics';
import {parsePage} from '@/shared/pagination';
import {regionName,validRegion} from '@/shared/regions';
export const dynamic='force-dynamic';
export default async function Home({searchParams}:{searchParams:Promise<{region?:string}>}){const params=await searchParams;const region=params.region&&validRegion(params.region)?params.region:'billerbeck';const [data,sessions,coverage]=await Promise.all([getFeedPage(parsePage(new URLSearchParams({region}))),getUpcomingSessions(region),getRegionCoverage()]);return <div className="screen screen--tabbar"><Header region={region} coverage={data.coverage} total={data.total} place={regionName(region)}/><main id="inhalt"><h1 className="sr-only">Themen aus {regionName(region)}</h1><RegionPicker region={region} availability={regionAvailability(coverage)}/>{!data.storageAvailable&&<p className="feed-message" role="status">Die Datenbank ist derzeit nicht erreichbar. Angezeigt wird ein gespeicherter Ersatzstand.</p>}{!data.coverage.complete&&<p className="feed-message">Für dieses Gebiet fehlen noch Daten oder der Quellenbestand ist unvollständig. <a href={"/quellen?region="+region}>Datenlage ansehen</a></p>}<NewsFeed key={region} region={region} initialPage={data} sessions={sessions}/></main><Footer region={region}/></div>}

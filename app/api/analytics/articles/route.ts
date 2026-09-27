import {getAnalytics,InvalidAnalysis} from '@/server/repositories/analytics';
import {validRegion} from '@/shared/regions';
import {analysisListPage} from '@/shared/analysis-payload.mjs';
export async function GET(request:Request){
 try{
  const params=new URL(request.url).searchParams,scope=params.get('scope')||'matches',target=params.get('target')||'',offset=Number(params.get('offset')||0),revision=params.get('revision')||'';
  if(!['local','matches'].includes(scope)||scope==='matches'&&!validRegion(target)||!Number.isInteger(offset)||offset<0||offset>100000||revision.length>100)throw new InvalidAnalysis('Ungültige Listenauswahl.');
  const d=await getAnalytics(params);
  const result=analysisListPage(d,scope,target,offset,revision);
  return Response.json(result,{status:result.changed?409:200,headers:{'Cache-Control':'no-store'}});
 }catch(e){return Response.json({error:e instanceof InvalidAnalysis?e.message:'Die Vorgänge konnten nicht geladen werden.'},{status:e instanceof InvalidAnalysis?400:503});}
}

import {getAnalytics,InvalidAnalysis} from '@/server/repositories/analytics';
export async function GET(request:Request){try{return Response.json(await getAnalytics(new URL(request.url).searchParams));}catch(e){return Response.json({error:e instanceof InvalidAnalysis?e.message:'Analyse momentan nicht verfügbar.'},{status:e instanceof InvalidAnalysis?400:503});}}
